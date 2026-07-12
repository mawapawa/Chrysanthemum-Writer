import React, { useState, useCallback, useRef, useEffect } from "react";
import { VNProject, SceneBlock, VNEntity } from "../types";
import {
  Plus, MessageSquare, FileText, Activity, BarChart3,
  GitBranch, UserCheck, Filter, Flag, ArrowRight, X, Pencil
} from "lucide-react";
import ScriptEditor from "./ScriptEditor";

interface BlockEditorProps {
  project: VNProject;
  blocks: SceneBlock[];
  onChange: (blocks: SceneBlock[]) => void;
  onCreateNode?: () => string;
}

type BlockAction = "dialogue" | "narrative" | "effect" | "statDisplay" | "choice" | "entity" | "condition" | "continue" | "ending";

const BLOCK_ACTIONS: { key: BlockAction; icon: React.ReactNode; label: string }[] = [
  { key: "dialogue", icon: <MessageSquare className="w-3 h-3" />, label: "Dialogue" },
  { key: "narrative", icon: <FileText className="w-3 h-3" />, label: "Narrative" },
  { key: "effect", icon: <Activity className="w-3 h-3" />, label: "Effect" },
  { key: "statDisplay", icon: <BarChart3 className="w-3 h-3" />, label: "Stat" },
  { key: "choice", icon: <GitBranch className="w-3 h-3" />, label: "Choice" },
  { key: "entity", icon: <UserCheck className="w-3 h-3" />, label: "Entity" },
  { key: "condition", icon: <Filter className="w-3 h-3" />, label: "Condition" },
  { key: "continue", icon: <ArrowRight className="w-3 h-3" />, label: "Continue" },
  { key: "ending", icon: <Flag className="w-3 h-3" />, label: "Ending" },
];

const DEFAULT_EXPRESSIONS = ["Neutral", "Smile", "Surprise", "Serious", "Sad", "Angry"];

// Separate narrative blocks from complex blocks
function splitBlocks(blocks: SceneBlock[]): { narrativeText: string; complexBlocks: SceneBlock[] } {
  const narrativeLines: string[] = [];
  const complexBlocks: SceneBlock[] = [];
  for (const b of blocks) {
    if (b.type === "narrative") {
      narrativeLines.push(b.text);
    } else {
      complexBlocks.push(b);
    }
  }
  return { narrativeText: narrativeLines.join("\n\n"), complexBlocks };
}

// Render a badge for display
function Badge({ block, project }: { block: SceneBlock; project?: VNProject }) {
  switch (block.type) {
    case "dialogue":
      return <><span className="font-semibold text-sky-300">[{block.speaker}]</span> <span className="text-slate-100">"{block.text}"</span></>;
    case "effect":
      return <><span className={`font-bold ${block.operation === "+" ? "text-emerald-400" : block.operation === "-" ? "text-rose-400" : "text-amber-400"}`}>[{block.operation}{block.value}]</span> <span className="text-slate-200">[{block.variableName}]</span></>;
    case "statDisplay": {
      const val = project?.trackers.find(t => t.name === block.variableName)?.defaultValue ?? "?";
      return <span className="text-amber-300 font-mono">[{block.variableName}: {val}]</span>;
    }
    case "choice":
      return <><span className="text-indigo-300">→ {block.text}</span>{block.random ? <span className="text-[10px] text-indigo-400 ml-1">({block.random}%)</span> : null}</>;
    case "entity": {
      const entity = project?.entities.find(e => e.id === block.entityId);
      return entity ? <span className="text-purple-300 font-semibold">[{entity.name}]</span> : <span className="text-rose-400">[Unknown entity]</span>;
    }
    case "condition":
      return <span className="text-rose-300">[if: {block.targetId} {block.operator} {block.compareValue}]</span>;
    case "continue": {
      const tn = project?.nodes?.[block.targetNodeId];
      return <><span className="text-teal-400">→ Continue to: </span><span className="text-teal-300 font-semibold">{tn?.title || "Unknown"}</span></>;
    }
    case "ending":
      return <span className={`font-bold ${block.endingType === "GOOD" ? "text-emerald-400" : block.endingType === "BAD" ? "text-rose-400" : "text-cyan-400"}`}>[{block.endingType} END{block.endingName ? `: ${block.endingName}` : ""}]</span>;
    default:
      return null;
  }
}

export default function BlockEditor({ project, blocks, onChange, onCreateNode }: BlockEditorProps) {
  const { narrativeText, complexBlocks } = splitBlocks(blocks);
  const [text, setText] = useState(narrativeText);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rebuildBlocks = useCallback((newNarrative: string, newComplex: SceneBlock[]) => {
    const narrativeBlocks: SceneBlock[] = newNarrative
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(text => ({ type: "narrative" as const, text }));
    onChange([...narrativeBlocks, ...newComplex]);
  }, [onChange]);

  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    rebuildBlocks(newText, complexBlocks);
  }, [complexBlocks, rebuildBlocks]);

  const addBlock = useCallback((block: SceneBlock) => {
    const newComplex = [...complexBlocks, block];
    rebuildBlocks(text, newComplex);
    setPaletteOpen(false);
  }, [text, complexBlocks, rebuildBlocks]);

  const updateBlock = useCallback((index: number, block: SceneBlock) => {
    const newComplex = [...complexBlocks];
    newComplex[index] = block;
    rebuildBlocks(text, newComplex);
    setEditingIndex(null);
  }, [text, complexBlocks, rebuildBlocks]);

  const removeBlock = useCallback((index: number) => {
    const newComplex = complexBlocks.filter((_, i) => i !== index);
    rebuildBlocks(text, newComplex);
    setEditingIndex(null);
  }, [text, complexBlocks, rebuildBlocks]);

  const handlePaletteSelect = useCallback((action: BlockAction) => {
    setPaletteOpen(false);
    let newBlock: SceneBlock | null = null;
    switch (action) {
      case "dialogue": newBlock = { type: "dialogue", speaker: "Narrator", text: "" }; break;
      case "narrative": { const ta = text; setText(ta ? ta + "\n\n" : ""); return; }
      case "effect": newBlock = { type: "effect", variableName: "", operation: "+", value: 0 }; break;
      case "statDisplay": newBlock = { type: "statDisplay", variableName: "" }; break;
      case "choice": newBlock = { type: "choice", text: "", targetNodeId: "" }; break;
      case "entity": newBlock = { type: "entity", entityId: "" }; break;
      case "condition": newBlock = { type: "condition", source: "tracker", targetId: "" }; break;
      case "continue": newBlock = { type: "continue", targetNodeId: "" }; break;
      case "ending": newBlock = { type: "ending", endingType: "NORMAL" }; break;
    }
    if (newBlock) {
      const newComplex = [...complexBlocks, newBlock];
      rebuildBlocks(text, newComplex);
      setEditingIndex(newComplex.length - 1);
    }
  }, [text, complexBlocks, rebuildBlocks]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditingIndex(null);
        setPaletteOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Narration textarea */}
      <textarea
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        rows={4}
        className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-3 focus:outline-none focus:border-indigo-500 resize-none font-mono leading-relaxed"
        placeholder="Type narration here. Use the buttons below to add dialogue, effects, choices, etc."
        onMouseDown={e => e.stopPropagation()}
      />

      {/* Badge strip */}
      {complexBlocks.length > 0 && (
        <div className="space-y-1 border border-slate-800 rounded-lg p-2 bg-slate-900/50">
          {complexBlocks.map((block, i) => (
            <div key={i} className="group flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-800/60 transition-colors">
              {editingIndex === i ? (
                <div className="flex-1">
                  <EditForm block={block} project={project} onSave={(b) => updateBlock(i, b)} onCancel={() => setEditingIndex(null)} onCreateNode={onCreateNode} />
                </div>
              ) : (
                <>
                  <div className="flex-1 text-xs leading-relaxed cursor-pointer" onClick={() => setEditingIndex(i)}>
                    <Badge block={block} project={project} />
                  </div>
                  <button onClick={() => setEditingIndex(i)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-400 cursor-pointer transition-opacity">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeBlock(i)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 cursor-pointer transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* + button */}
      <div className="relative">
        {paletteOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPaletteOpen(false)} />
            <div className="absolute bottom-full right-0 mb-1 z-50 flex flex-row-reverse gap-1 flex-wrap justify-end">
              {BLOCK_ACTIONS.map(action => (
                <button key={action.key} onClick={() => handlePaletteSelect(action.key)}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold rounded-lg border border-slate-700 transition-all cursor-pointer">
                  {action.icon}{action.label}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <button onClick={() => setPaletteOpen(!paletteOpen)}
            className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
            title="Insert block">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline edit forms for each block type
function EditForm({ block, project, onSave, onCancel, onCreateNode }: {
  block: SceneBlock; project: VNProject; onSave: (b: SceneBlock) => void; onCancel: () => void; onCreateNode?: () => string;
}) {
  switch (block.type) {
    case "dialogue": {
      const [speaker, setSpeaker] = useState(block.speaker);
      const [expr, setExpr] = useState(block.expression || "Neutral");
      const [html, setHtml] = useState(block.text ? `<p>${block.text}</p>` : "");
      const entity = project.entities.find(e => e.name === speaker);
      const tones = entity?.expressions?.length ? entity.expressions : DEFAULT_EXPRESSIONS;
      const save = () => {
        const parser = new DOMParser();
        const text = parser.parseFromString(html, "text/html").body.textContent || "";
        if (text.trim()) onSave({ type: "dialogue", speaker, expression: expr, text: text.trim() });
      };
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <select value={speaker} onChange={e => { setSpeaker(e.target.value); setExpr("Neutral"); }} className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
              <option value="Narrator">Narrator</option>
              {project.entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select value={expr} onChange={e => setExpr(e.target.value)} className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
              {tones.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="bg-slate-950 border border-slate-700 rounded overflow-hidden">
            <ScriptEditor initialContent={html} onChange={setHtml} placeholder="Write dialogue..." />
          </div>
          <div className="flex gap-1 justify-end">
            <button onClick={save} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded cursor-pointer">Done</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Cancel</button>
          </div>
        </div>
      );
    }
    case "effect": {
      const [op, setOp] = useState(block.operation);
      const [val, setVal] = useState(block.value);
      const [name, setName] = useState(block.variableName);
      return (
        <div className="flex items-center gap-1.5">
          <select value={op} onChange={e => setOp(e.target.value as any)} className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-10 text-center cursor-pointer"><option value="+">+</option><option value="-">−</option><option value="=">=</option></select>
          <input type="number" value={val} onChange={e => setVal(Number(e.target.value))} className="w-14 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white text-center focus:outline-none focus:border-indigo-500" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="stat" list="ef-tl" className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
          <datalist id="ef-tl">{project.trackers.map(t => <option key={t.id} value={t.name} />)}</datalist>
          <button onClick={() => { if (name.trim()) onSave({ type: "effect", operation: op, value: val, variableName: name.trim() }); }} className="text-[10px] px-2 py-0.5 bg-emerald-600 text-white rounded cursor-pointer">Done</button>
          <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">✕</button>
        </div>
      );
    }
    case "choice": {
      const [ct, setCt] = useState(block.text);
      const [targetId, setTargetId] = useState(block.targetNodeId);
      const [rand, setRand] = useState(block.random || 0);
      const allNodes = Object.values(project.nodes).filter(n => n.nodeType === "story" || !n.nodeType);
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input value={ct} onChange={e => setCt(e.target.value)} placeholder="choice text" className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[130px]">
              <option value="">→ target</option>
              {allNodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
              {onCreateNode && <option value="__new__">+ New scene</option>}
            </select>
          </div>
          {targetId === "__new__" && onCreateNode && (() => { const newId = onCreateNode(); setTargetId(newId); return null; })()}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
              <input type="checkbox" checked={rand > 0} onChange={e => setRand(e.target.checked ? 50 : 0)} className="w-3 h-3" />
              Random {rand > 0 ? `${rand}%` : ""}
            </label>
            {rand > 0 && <input type="range" min={1} max={100} value={rand} onChange={e => setRand(Number(e.target.value))} className="w-20 h-1" />}
          </div>
          <div className="flex gap-1 justify-end">
            <button onClick={() => { if (ct.trim() && targetId) onSave({ type: "choice", text: ct.trim(), targetNodeId: targetId, ...(rand > 0 ? { random: rand } : {}) }); }} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded cursor-pointer">Done</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">✕</button>
          </div>
        </div>
      );
    }
    case "continue": {
      const [targetId, setTargetId] = useState(block.targetNodeId);
      const allNodes = Object.values(project.nodes).filter(n => n.nodeType === "story" || !n.nodeType);
      return (
        <div className="flex items-center gap-1.5">
          <select value={targetId} onChange={e => setTargetId(e.target.value)} autoFocus className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[160px]">
            <option value="">→ target</option>
            {allNodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
            {onCreateNode && <option value="__new__">+ New scene</option>}
          </select>
          {targetId === "__new__" && onCreateNode && (() => { const newId = onCreateNode(); setTargetId(newId); return null; })()}
          <button onClick={() => { if (targetId) onSave({ type: "continue", targetNodeId: targetId }); }} className="text-[10px] px-2 py-0.5 bg-teal-600 text-white rounded cursor-pointer">Done</button>
          <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">✕</button>
        </div>
      );
    }
    case "ending": {
      const [et, setEt] = useState(block.endingType);
      const [en, setEn] = useState(block.endingName || "");
      return (
        <div className="flex items-center gap-1.5">
          <select value={et} onChange={e => setEt(e.target.value as any)} className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer"><option value="GOOD">Good</option><option value="BAD">Bad</option><option value="NORMAL">Normal</option><option value="NEUTRAL">Neutral</option></select>
          <input value={en} onChange={e => setEn(e.target.value)} placeholder="ending name" className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
          <button onClick={() => onSave({ type: "ending", endingType: et, endingName: en.trim() || undefined })} className="text-[10px] px-2 py-0.5 bg-rose-600 text-white rounded cursor-pointer">Done</button>
          <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">✕</button>
        </div>
      );
    }
    case "statDisplay": {
      const [n, setN] = useState(block.variableName);
      return (
        <div className="flex items-center gap-1.5">
          <input value={n} onChange={e => setN(e.target.value)} placeholder="stat name" list="sd-tl" className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
          <datalist id="sd-tl">{project.trackers.map(t => <option key={t.id} value={t.name} />)}</datalist>
          <button onClick={() => { if (n.trim()) onSave({ type: "statDisplay", variableName: n.trim() }); }} className="text-[10px] px-2 py-0.5 bg-amber-600 text-white rounded cursor-pointer">Done</button>
          <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">✕</button>
        </div>
      );
    }
    case "condition": {
      const [src, setSrc] = useState(block.source);
      const [tid, setTid] = useState(block.targetId);
      const [op, setOp] = useState(block.operator || ">=");
      const [val, setVal] = useState(block.compareValue || 1);
      return (
        <div className="flex items-center gap-1.5">
          <select value={src} onChange={e => setSrc(e.target.value as any)} className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer"><option value="tracker">Tracker</option><option value="flag">Flag</option></select>
          {src === "tracker" ? (
            <><select value={tid} onChange={e => setTid(e.target.value)} className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[100px]"><option value="">stat</option>{project.trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <select value={op} onChange={e => setOp(e.target.value)} className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-12 text-center cursor-pointer"><option value=">=">≥</option><option value="<=">≤</option><option value=">">&gt;</option><option value="<">&lt;</option><option value="==">=</option><option value="!=">≠</option></select>
              <input type="number" value={val} onChange={e => setVal(Number(e.target.value))} className="w-12 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white text-center" /></>
          ) : (
            <select value={tid} onChange={e => setTid(e.target.value)} className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[100px]"><option value="">flag</option>{project.flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          )}
          <button onClick={() => { if (tid) onSave({ type: "condition", source: src, targetId: tid, ...(src === "tracker" ? { operator: op, compareValue: val } : {}) }); }} className="text-[10px] px-2 py-0.5 bg-rose-600 text-white rounded cursor-pointer">Done</button>
          <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">✕</button>
        </div>
      );
    }
    case "entity": {
      const [eid, setEid] = useState(block.entityId);
      return (
        <div className="flex items-center gap-1.5">
          <select value={eid} onChange={e => setEid(e.target.value)} className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[140px]"><option value="">select entity</option>{project.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <button onClick={() => { if (eid) onSave({ type: "entity", entityId: eid }); }} className="text-[10px] px-2 py-0.5 bg-purple-600 text-white rounded cursor-pointer">Done</button>
          <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">✕</button>
        </div>
      );
    }
    default:
      return null;
  }
}
