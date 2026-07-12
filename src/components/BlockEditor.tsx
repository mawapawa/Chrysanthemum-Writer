import React, { useState, useCallback, useRef, useEffect } from "react";
import { VNProject, SceneBlock, VNEntity } from "../types";
import {
  Plus, MessageSquare, FileText, Activity, BarChart3,
  GitBranch, UserCheck, Filter, Flag, ArrowRight, X
} from "lucide-react";

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

// Convert blocks to a plain text representation for the textarea
function blocksToText(blocks: SceneBlock[], project: VNProject): string {
  return blocks.map(b => {
    switch (b.type) {
      case "dialogue": return `[${b.speaker}] "${b.text}"`;
      case "narrative": return b.text;
      case "effect": return `[${b.operation}${b.value}] [${b.variableName}]`;
      case "statDisplay": return `[${b.variableName}: ?]`;
      case "choice": {
        const target = project.nodes[b.targetNodeId]?.title || "untitled";
        return `→ ${b.text} —> ${target}${b.random ? ` (${b.random}%)` : ""}`;
      }
      case "entity": {
        const e = project.entities.find(en => en.id === b.entityId);
        return e ? `[${e.name}]` : "[unknown]";
      }
      case "condition": return b.source === "tracker" ? `if: ${b.targetId} ${b.operator} ${b.compareValue}` : `if: ${b.targetId}`;
      case "continue": {
        const t = project.nodes[b.targetNodeId]?.title || "untitled";
        return `→ continue: ${t}`;
      }
      case "ending": return `[${b.endingType} END${b.endingName ? `: ${b.endingName}` : ""}]`;
    }
  }).join("\n");
}

// Parse text back into blocks
function textToBlocks(text: string, project: VNProject): SceneBlock[] {
  const lines = text.split("\n");
  const blocks: SceneBlock[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Dialogue: [Speaker] "text"
    const dialogueMatch = trimmed.match(/^\[([^\]]+)\]\s+"(.+)"$/);
    if (dialogueMatch) {
      blocks.push({ type: "dialogue", speaker: dialogueMatch[1], text: dialogueMatch[2] });
      continue;
    }

    // Effect: [+N] [StatName] or [-N] [StatName] or [=N] [StatName]
    const effectMatch = trimmed.match(/^\[([+\-=])(\d+)\]\s+\[([^\]]+)\]$/);
    if (effectMatch) {
      blocks.push({ type: "effect", operation: effectMatch[1] as any, value: parseInt(effectMatch[2]), variableName: effectMatch[3] });
      continue;
    }

    // Stat display: [StatName: ?]
    const statMatch = trimmed.match(/^\[([^\]]+):\s*\?\]$/);
    if (statMatch) {
      blocks.push({ type: "statDisplay", variableName: statMatch[1] });
      continue;
    }

    // Choice: → text —> target
    const choiceMatch = trimmed.match(/^→\s+(.+?)\s*—>\s*(.+)$/);
    if (choiceMatch) {
      const targetName = choiceMatch[2].replace(/\s*\(\d+%\)$/, "").trim();
      const targetNode = Object.values(project.nodes).find(n => n.title === targetName);
      blocks.push({ type: "choice", text: choiceMatch[1].trim(), targetNodeId: targetNode?.id || "" });
      continue;
    }

    // Continue: → continue: target
    const continueMatch = trimmed.match(/^→\s+continue:\s*(.+)$/);
    if (continueMatch) {
      const targetNode = Object.values(project.nodes).find(n => n.title === continueMatch[1].trim());
      blocks.push({ type: "continue", targetNodeId: targetNode?.id || "" });
      continue;
    }

    // Ending: [GOOD END: Name] or [BAD END] etc.
    const endingMatch = trimmed.match(/^\[(GOOD|BAD|NEUTRAL|NORMAL)\s+END(?::\s*(.+))?\]$/);
    if (endingMatch) {
      blocks.push({ type: "ending", endingType: endingMatch[1] as any, endingName: endingMatch[2]?.trim() });
      continue;
    }

    // Condition: if: stat >= 5 or if: flag
    const condMatch = trimmed.match(/^if:\s*(.+?)(?:\s*(>=|<=|>|<|==|!=)\s*(\d+))?$/);
    if (condMatch) {
      const targetName = condMatch[1].trim();
      const tracker = project.trackers.find(t => t.name === targetName);
      const flag = project.flags.find(f => f.name === targetName);
      if (tracker) {
        blocks.push({ type: "condition", source: "tracker", targetId: tracker.id, operator: condMatch[2] || ">=", compareValue: condMatch[3] ? parseInt(condMatch[3]) : 1 });
      } else if (flag) {
        blocks.push({ type: "condition", source: "flag", targetId: flag.id });
      } else {
        blocks.push({ type: "condition", source: "tracker", targetId: targetName, operator: condMatch[2] || ">=", compareValue: condMatch[3] ? parseInt(condMatch[3]) : 1 });
      }
      continue;
    }

    // Otherwise it's narration
    blocks.push({ type: "narrative", text: trimmed });
  }
  return blocks;
}

export default function BlockEditor({ project, blocks, onChange, onCreateNode }: BlockEditorProps) {
  const [text, setText] = useState(() => blocksToText(blocks, project));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activePrompt, setActivePrompt] = useState<BlockAction | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Sync text from blocks when blocks change externally
  useEffect(() => {
    setText(blocksToText(blocks, project));
  }, [blocks]);

  // Sync blocks when text changes (debounced on blur)
  const handleBlur = useCallback(() => {
    const parsed = textToBlocks(text, project);
    if (JSON.stringify(parsed) !== JSON.stringify(blocks)) {
      onChange(parsed);
    }
  }, [text, blocks, project, onChange]);

  const insertAtCursor = useCallback((insertText: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = text.slice(0, start) + insertText + text.slice(end);
    setText(newText);
    // Re-position cursor after the inserted text
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insertText.length;
      ta.setSelectionRange(pos, pos);
    });
  }, [text]);

  const handlePaletteSelect = useCallback((action: BlockAction) => {
    setPaletteOpen(false);
    setActivePrompt(action);
  }, []);

  const renderPrompt = () => {
    if (!activePrompt) return null;
    const cancel = () => setActivePrompt(null);

    switch (activePrompt) {
      case "dialogue": {
        const [speaker, setSpeaker] = useState("Narrator");
        const [expr, setExpr] = useState("Neutral");
        const [lineText, setLineText] = useState("");
        const entity = project.entities.find(e => e.name === speaker);
        const tones = entity?.expressions?.length ? entity.expressions : DEFAULT_EXPRESSIONS;
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <select value={speaker} onChange={e => { setSpeaker(e.target.value); setExpr("Neutral"); }}
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
              <option value="Narrator">Narrator</option>
              {project.entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select value={expr} onChange={e => setExpr(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
              {tones.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={lineText} onChange={e => setLineText(e.target.value)} placeholder="dialogue text"
              className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && lineText.trim()) { insertAtCursor(`[${speaker}] "${lineText.trim()}"\n`); setActivePrompt(null); } if (e.key === "Escape") cancel(); }} />
            <button onClick={() => { if (lineText.trim()) { insertAtCursor(`[${speaker}] "${lineText.trim()}"\n`); setActivePrompt(null); } }}
              className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      case "effect": {
        const [op, setOp] = useState("+");
        const [val, setVal] = useState(0);
        const [name, setName] = useState("");
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <select value={op} onChange={e => setOp(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-10 text-center cursor-pointer"><option value="+">+</option><option value="-">−</option><option value="=">=</option></select>
            <input type="number" value={val} onChange={e => setVal(Number(e.target.value))}
              className="w-14 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white text-center focus:outline-none focus:border-indigo-500" autoFocus />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="stat name" list="fx-tl"
              className="w-24 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500"
              onKeyDown={e => { if (e.key === "Enter" && name.trim()) { insertAtCursor(`[${op}${val}] [${name.trim()}]\n`); setActivePrompt(null); } if (e.key === "Escape") cancel(); }} />
            <datalist id="fx-tl">{project.trackers.map(t => <option key={t.id} value={t.name} />)}</datalist>
            <button onClick={() => { if (name.trim()) { insertAtCursor(`[${op}${val}] [${name.trim()}]\n`); setActivePrompt(null); } }}
              className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      case "continue": {
        const [targetId, setTargetId] = useState("");
        const allNodes = Object.values(project.nodes).filter(n => n.nodeType === "story" || !n.nodeType);
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <select value={targetId} onChange={e => {
              if (e.target.value === "__new__" && onCreateNode) {
                const newId = onCreateNode();
                const newNode = project.nodes[newId];
                if (newNode) { insertAtCursor(`→ continue: ${newNode.title}\n`); setActivePrompt(null); }
              } else {
                setTargetId(e.target.value);
              }
            }} autoFocus
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[160px]">
              <option value="">→ target</option>
              {allNodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
              {onCreateNode && <option value="__new__">+ New scene</option>}
            </select>
            <button onClick={() => { if (targetId) { const n = project.nodes[targetId]; insertAtCursor(`→ continue: ${n?.title || "scene"}\n`); setActivePrompt(null); } }}
              className="text-[10px] px-2 py-1 bg-teal-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      case "ending": {
        const [et, setEt] = useState("GOOD");
        const [en, setEn] = useState("");
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <select value={et} onChange={e => setEt(e.target.value)} autoFocus
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
              <option value="GOOD">Good</option><option value="BAD">Bad</option><option value="NORMAL">Normal</option><option value="NEUTRAL">Neutral</option>
            </select>
            <input value={en} onChange={e => setEn(e.target.value)} placeholder="ending name"
              className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500"
              onKeyDown={e => { if (e.key === "Enter") { insertAtCursor(`[${et} END${en.trim() ? `: ${en.trim()}` : ""}]\n`); setActivePrompt(null); } if (e.key === "Escape") cancel(); }} />
            <button onClick={() => { insertAtCursor(`[${et} END${en.trim() ? `: ${en.trim()}` : ""}]\n`); setActivePrompt(null); }}
              className="text-[10px] px-2 py-1 bg-rose-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      case "statDisplay": {
        const [n, setN] = useState("");
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <input value={n} onChange={e => setN(e.target.value)} placeholder="stat name" list="sd-tl" autoFocus
              className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500"
              onKeyDown={e => { if (e.key === "Enter" && n.trim()) { insertAtCursor(`[${n.trim()}: ?]\n`); setActivePrompt(null); } if (e.key === "Escape") cancel(); }} />
            <datalist id="sd-tl">{project.trackers.map(t => <option key={t.id} value={t.name} />)}</datalist>
            <button onClick={() => { if (n.trim()) { insertAtCursor(`[${n.trim()}: ?]\n`); setActivePrompt(null); } }}
              className="text-[10px] px-2 py-1 bg-amber-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      case "choice": {
        const [ct, setCt] = useState("");
        const [targetId, setTargetId] = useState("");
        const [rand, setRand] = useState(0);
        const allNodes = Object.values(project.nodes).filter(n => n.nodeType === "story" || !n.nodeType);
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <input value={ct} onChange={e => setCt(e.target.value)} placeholder="choice text"
              className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-32 focus:outline-none focus:border-indigo-500" autoFocus />
            <select value={targetId} onChange={e => {
              if (e.target.value === "__new__" && onCreateNode) {
                const newId = onCreateNode();
                const newNode = project.nodes[newId];
                if (newNode) { insertAtCursor(`→ ${ct.trim() || "option"} —> ${newNode.title}\n`); setActivePrompt(null); }
              } else { setTargetId(e.target.value); }
            }}
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[130px]">
              <option value="">→ target</option>
              {allNodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
              {onCreateNode && <option value="__new__">+ New scene</option>}
            </select>
            <button onClick={() => { if (ct.trim() && targetId) { const n = project.nodes[targetId]; insertAtCursor(`→ ${ct.trim()} —> ${n?.title || "scene"}${rand > 0 ? ` (${rand}%)` : ""}\n`); setActivePrompt(null); } }}
              className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      case "entity": {
        const [eid, setEid] = useState("");
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <select value={eid} onChange={e => setEid(e.target.value)} autoFocus
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[140px]">
              <option value="">select entity</option>
              {project.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={() => { const ent = project.entities.find(e => e.id === eid); if (ent) { insertAtCursor(`[${ent.name}]\n`); setActivePrompt(null); } }}
              className="text-[10px] px-2 py-1 bg-purple-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      case "condition": {
        const [src, setSrc] = useState("tracker");
        const [tid, setTid] = useState("");
        const [op, setOp] = useState(">=");
        const [val, setVal] = useState(1);
        return (
          <div className="flex items-center gap-1.5 py-1 flex-wrap border-t border-slate-800 pt-2">
            <select value={src} onChange={e => setSrc(e.target.value)} autoFocus
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer"><option value="tracker">Tracker</option><option value="flag">Flag</option></select>
            {src === "tracker" ? (
              <><select value={tid} onChange={e => setTid(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[100px]"><option value="">stat</option>{project.trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <select value={op} onChange={e => setOp(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-12 text-center cursor-pointer"><option value=">=">≥</option><option value="<=">≤</option><option value=">">&gt;</option><option value="<">&lt;</option><option value="==">=</option><option value="!=">≠</option></select>
                <input type="number" value={val} onChange={e => setVal(Number(e.target.value))}
                  className="w-12 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white text-center" /></>
            ) : (
              <select value={tid} onChange={e => setTid(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[100px]"><option value="">flag</option>{project.flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
            )}
            <button onClick={() => { const tracker = project.trackers.find(t => t.id === tid); const flag = project.flags.find(f => f.id === tid); const name = tracker?.name || flag?.name || tid; if (tid) { insertAtCursor(src === "tracker" ? `if: ${name} ${op} ${val}\n` : `if: ${name}\n`); setActivePrompt(null); } }}
              className="text-[10px] px-2 py-1 bg-rose-600 text-white rounded cursor-pointer">add</button>
            <button onClick={cancel} className="text-[10px] px-2 py-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="relative" onKeyDown={e => { if (e.key === "Escape") { setPaletteOpen(false); setActivePrompt(null); } }}>
      {activePrompt ? (
        <div className="space-y-1">
          <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} rows={8}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-3 focus:outline-none focus:border-indigo-500 resize-none font-mono leading-relaxed"
            placeholder="Type narration here... Use the + button to insert dialogue, effects, choices, etc." />
          {renderPrompt()}
        </div>
      ) : (
        <>
          <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} onBlur={handleBlur} rows={8}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-3 focus:outline-none focus:border-indigo-500 resize-none font-mono leading-relaxed"
            placeholder="Type narration here... Use the + button below to insert dialogue, effects, choices, etc." />
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
          <div className="flex justify-end mt-1">
            <button onClick={() => setPaletteOpen(!paletteOpen)}
              className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              title="Insert block">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
