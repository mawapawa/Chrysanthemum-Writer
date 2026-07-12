import React, { useState, useCallback, useRef, useEffect } from "react";
import { VNProject, SceneBlock, VNEntity } from "../types";
import {
  Plus, MessageSquare, FileText, Activity, BarChart3,
  GitBranch, UserCheck, Filter, Flag, ArrowRight, X
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

function DialogueEdit({ block, project, onSave, onCancel }: {
  block: SceneBlock & { type: "dialogue" }; project: VNProject; onSave: (b: SceneBlock) => void; onCancel: () => void;
}) {
  const [speaker, setSpeaker] = useState(block.speaker);
  const [expression, setExpression] = useState(block.expression || "Neutral");
  const [html, setHtml] = useState(block.text ? `<p>${block.text}</p>` : "");
  const entity = project.entities.find(e => e.name === speaker);
  const tones = entity?.expressions?.length ? entity.expressions : DEFAULT_EXPRESSIONS;

  const save = useCallback(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const plainText = doc.body.textContent || "";
    if (plainText.trim()) onSave({ type: "dialogue", speaker, expression, text: plainText.trim() });
  }, [html, speaker, expression, onSave]);

  return (
    <div className="flex flex-col gap-1 my-0.5">
      <div className="flex gap-1.5">
        <select value={speaker} onChange={e => { setSpeaker(e.target.value); setExpression("Neutral"); }}
          className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
          <option value="Narrator">Narrator</option>
          {project.entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
        <select value={expression} onChange={e => setExpression(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
          {tones.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded overflow-hidden">
        <div className="bg-slate-950">
          <ScriptEditor initialContent={html} onChange={setHtml} placeholder="Write dialogue..." />
        </div>
      </div>
      <div className="flex gap-1 justify-end">
        <button onClick={save} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded cursor-pointer">Save</button>
        <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function NarrativeEdit({ block, onSave, onCancel }: {
  block: SceneBlock & { type: "narrative" }; onSave: (b: SceneBlock) => void; onCancel: () => void;
}) {
  const [html, setHtml] = useState(block.text ? `<p>${block.text}</p>` : "");

  const save = useCallback(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const plainText = doc.body.textContent || "";
    if (plainText.trim()) onSave({ type: "narrative", text: plainText.trim() });
  }, [html, onSave]);

  return (
    <div className="my-0.5">
      <div className="bg-slate-800 border border-slate-700 rounded overflow-hidden">
        <div className="bg-slate-950">
          <ScriptEditor initialContent={html} onChange={setHtml} placeholder="Write narrative..." />
        </div>
      </div>
      <div className="flex gap-1 justify-end mt-1">
        <button onClick={save} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded cursor-pointer">Save</button>
        <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function EffectEdit({ block, project, onSave, onCancel }: {
  block: SceneBlock & { type: "effect" }; project: VNProject; onSave: (b: SceneBlock) => void; onCancel: () => void;
}) {
  const [op, setOp] = useState(block.operation);
  const [val, setVal] = useState(block.value);
  const [name, setName] = useState(block.variableName);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex items-center gap-1 my-0.5" onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}>
      <select value={op} onChange={e => setOp(e.target.value as any)}
        className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-10 text-center cursor-pointer">
        <option value="+">+</option><option value="-">−</option><option value="=">=</option>
      </select>
      <input ref={ref} type="number" value={val} onChange={e => setVal(Number(e.target.value))}
        className="w-14 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white text-center focus:outline-none focus:border-indigo-500" />
      <input value={name} onChange={e => setName(e.target.value)} placeholder="stat"
        list="el-tracker-list"
        className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500"
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (name.trim()) onSave({ type: "effect", operation: op, value: val, variableName: name.trim() }); } }}
        onBlur={() => { if (name.trim()) onSave({ type: "effect", operation: op, value: val, variableName: name.trim() }); else onCancel(); }}
      />
      <datalist id="el-tracker-list">
        {project.trackers.map(t => <option key={t.id} value={t.name} />)}
      </datalist>
    </div>
  );
}

function DisplayEdit({ block, project, onSave, onCancel }: {
  block: SceneBlock & { type: "statDisplay" }; project: VNProject; onSave: (b: SceneBlock) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(block.variableName);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="my-0.5">
      <input ref={ref} value={name} onChange={e => setName(e.target.value)} placeholder="stat name"
        list="el-st-list"
        className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500 w-full"
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (name.trim()) onSave({ type: "statDisplay", variableName: name.trim() }); } if (e.key === "Escape") onCancel(); }}
        onBlur={() => { if (name.trim()) onSave({ type: "statDisplay", variableName: name.trim() }); else onCancel(); }}
      />
      <datalist id="el-st-list">
        {project.trackers.map(t => <option key={t.id} value={t.name} />)}
      </datalist>
    </div>
  );
}

function EditManager({ block, project, onSave, onCancel, onCreateNode }: {
  block: SceneBlock; project: VNProject; onSave: (b: SceneBlock) => void; onCancel: () => void; onCreateNode?: () => string;
}) {
  switch (block.type) {
    case "dialogue": return <DialogueEdit block={block} project={project} onSave={onSave} onCancel={onCancel} />;
    case "narrative": return <NarrativeEdit block={block} onSave={onSave} onCancel={onCancel} />;
    case "effect": return <EffectEdit block={block} project={project} onSave={onSave} onCancel={onCancel} />;
    case "statDisplay": return <DisplayEdit block={block} project={project} onSave={onSave} onCancel={onCancel} />;
    default: {
      // For complex block types (choice, entity, condition, continue, ending),
      // clicking opens a simple prompt to edit key fields
      const label = block.type;
      return (
        <div className="flex items-center gap-1 my-0.5">
          <span className="text-[10px] text-slate-500 font-mono">Editing {label} block — delete and re-add to change</span>
          <button onClick={onCancel} className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">done</button>
        </div>
      );
    }
  }
}

const BADGE_STYLES: Record<string, string> = {
  dialogue: "text-sky-300",
  narrative: "text-slate-300",
  effect: "text-emerald-300",
  statDisplay: "text-amber-300",
  choice: "text-indigo-300",
  entity: "text-purple-300",
  condition: "text-rose-300",
  continue: "text-teal-300",
  ending: "text-rose-300",
};

function InlineChoiceForm({ project, onSave, onCancel, onCreateNode }: {
  project: VNProject; onSave: (block: SceneBlock) => void; onCancel: () => void; onCreateNode?: () => string;
}) {
  const [text, setText] = useState(""); const [targetId, setTargetId] = useState(""); const [random, setRandom] = useState(0);
  const allNodes = Object.values(project.nodes).filter(n => n.nodeType === "story" || !n.nodeType);
  return (
    <div className="flex items-center gap-1.5 py-1 flex-wrap" onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="choice text"
        className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-40 focus:outline-none focus:border-indigo-500"
        autoFocus onKeyDown={e => { if (e.key === "Enter" && text.trim() && targetId) { onSave({ type: "choice", text: text.trim(), targetNodeId: targetId, ...(random > 0 ? { random } : {}) }); } }} />
      <select value={targetId} onChange={e => setTargetId(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[130px]">
        <option value="">→ target</option>
        {allNodes.map(n => <option key={n.id} value={n.id}>{n.title.substring(0, 20)}</option>)}
        {onCreateNode && <option value="__new__">+ New scene</option>}
      </select>
      <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
        <input type="checkbox" checked={random > 0} onChange={e => setRandom(e.target.checked ? 50 : 0)} className="w-3 h-3" />
        {random > 0 ? `${random}%` : "random?"}
      </label>
      {random > 0 && <input type="range" min={1} max={100} value={random} onChange={e => setRandom(Number(e.target.value))} className="w-16 h-1" />}
      <button onClick={() => { if (text.trim() && targetId) onSave({ type: "choice", text: text.trim(), targetNodeId: targetId, ...(random > 0 ? { random } : {}) }); }}
        className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded cursor-pointer">add</button>
    </div>
  );
}

function RenderedBlock({ block, project }: { block: SceneBlock; project?: VNProject }) {
  switch (block.type) {
    case "dialogue":
      return <><span className="font-semibold text-sky-300">[{block.speaker}]</span> <span className="text-slate-100">"{block.text}"</span></>;
    case "narrative":
      return <span className="text-slate-300">{block.text}</span>;
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
      return entity ? <><span className="text-purple-300 font-semibold">[{entity.name}]</span>{entity.ownedTrackers?.map(t => <span key={t.name} className="text-[10px] text-purple-400 ml-1">{t.name}: {t.defaultValue}</span>)}</>
        : <span className="text-rose-400">[Unknown entity]</span>;
    }
    case "condition":
      return <><span className="text-rose-300">[{block.source === "tracker" ? `${block.targetId} ${block.operator} ${block.compareValue}` : block.targetId}]</span></>;
    case "continue": {
      const tn = project?.nodes?.[block.targetNodeId];
      return <><span className="text-teal-400">→ Continue to: </span><span className="text-teal-300 font-semibold">{tn?.title || "Unknown"}</span></>;
    }
    case "ending":
      return <><span className={`font-bold ${block.endingType === "GOOD" ? "text-emerald-400" : block.endingType === "BAD" ? "text-rose-400" : "text-cyan-400"}`}>[{block.endingType} END{block.endingName ? `: ${block.endingName}` : ""}]</span></>;
  }
}

export default function BlockEditor({ project, blocks, onChange, onCreateNode }: BlockEditorProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const insertBlock = useCallback((block: SceneBlock) => {
    const next = [...blocks, block];
    onChange(next);
    setEditingIndex(next.length - 1);
    setPaletteOpen(false);
  }, [blocks, onChange]);

  const updateBlock = useCallback((index: number, block: SceneBlock) => {
    const next = [...blocks];
    next[index] = block;
    onChange(next);
    setEditingIndex(null);
  }, [blocks, onChange]);

  const removeBlock = useCallback((index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
    setEditingIndex(null);
  }, [blocks, onChange]);

  const handlePaletteSelect = useCallback((action: BlockAction) => {
    let newBlock: SceneBlock;
    switch (action) {
      case "dialogue": newBlock = { type: "dialogue", speaker: "Narrator", text: "" }; break;
      case "narrative": newBlock = { type: "narrative", text: "" }; break;
      case "effect": newBlock = { type: "effect", variableName: "", operation: "+", value: 0 }; break;
      case "statDisplay": newBlock = { type: "statDisplay", variableName: "" }; break;
      case "choice": newBlock = { type: "choice", text: "", targetNodeId: "" }; break;
      case "entity": newBlock = { type: "entity", entityId: "" }; break;
      case "condition": newBlock = { type: "condition", source: "tracker", targetId: "" }; break;
      case "continue": newBlock = { type: "continue", targetNodeId: "" }; break;
      case "ending": newBlock = { type: "ending", endingType: "NORMAL" }; break;
    }
    insertBlock(newBlock);
  }, [insertBlock]);

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
    <div ref={containerRef} className="text-xs leading-relaxed space-y-0.5">
      {blocks.length === 0 && (
        <div className="py-3 text-center text-slate-500 italic border border-dashed border-slate-800 rounded">
          No content yet. Click + to add.
        </div>
      )}

      {blocks.map((block, i) => (
        <div key={i} className="group flex items-start gap-1">
          {editingIndex === i ? (
            <div className="flex-1">
              <EditManager block={block} project={project} onSave={(b) => updateBlock(i, b)} onCancel={() => { if (block.type === "dialogue" || block.type === "narrative") removeBlock(i); else setEditingIndex(null); }} onCreateNode={onCreateNode} />
            </div>
          ) : (
            <div
              className="flex-1 cursor-text py-0.5 px-1 -mx-1 rounded hover:bg-slate-800/40 transition-colors"
              onClick={() => { setEditingIndex(i); setNewForm(null); }}
            >
              <RenderedBlock block={block} project={project} />
            </div>
          )}
          {editingIndex !== i && (
            <button onClick={() => removeBlock(i)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 cursor-pointer shrink-0 mt-0.5 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      <div className="relative pt-1">
        {paletteOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPaletteOpen(false)} />
            <div className="absolute bottom-full right-0 mb-1 z-50 flex flex-row-reverse gap-1 flex-wrap justify-end">
              {BLOCK_ACTIONS.map(action => (
                <button key={action.key} onClick={() => { handlePaletteSelect(action.key); }}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold rounded-lg border border-slate-700 transition-all cursor-pointer">
                  {action.icon}{action.label}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <button onClick={() => setPaletteOpen(!paletteOpen)}
            className="p-1 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
            title="Insert block">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
