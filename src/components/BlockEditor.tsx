import React, { useState, useCallback } from "react";
import { VNProject, SceneBlock, StoryChoice, InlineEffect, ChoiceRequirement, VNEntity } from "../types";
import {
  Plus, MessageSquare, FileText, Activity, BarChart3,
  GitBranch, UserCheck, Filter, Flag, X, Check,
  ChevronRight, GripVertical
} from "lucide-react";

interface BlockEditorProps {
  project: VNProject;
  blocks: SceneBlock[];
  onChange: (blocks: SceneBlock[]) => void;
  onCreateNode?: () => string;
}

type BlockAction = "dialogue" | "narrative" | "effect" | "statDisplay" | "choice" | "entity" | "condition" | "ending";

const BLOCK_ACTIONS: { key: BlockAction; icon: React.ReactNode; label: string }[] = [
  { key: "dialogue", icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Dialogue" },
  { key: "narrative", icon: <FileText className="w-3.5 h-3.5" />, label: "Narrative" },
  { key: "effect", icon: <Activity className="w-3.5 h-3.5" />, label: "Effect" },
  { key: "statDisplay", icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Stat" },
  { key: "choice", icon: <GitBranch className="w-3.5 h-3.5" />, label: "Choice" },
  { key: "entity", icon: <UserCheck className="w-3.5 h-3.5" />, label: "Entity" },
  { key: "condition", icon: <Filter className="w-3.5 h-3.5" />, label: "Condition" },
  { key: "ending", icon: <Flag className="w-3.5 h-3.5" />, label: "Ending" },
];

const DEFAULT_EXPRESSIONS = ["Neutral", "Smile", "Surprise", "Serious", "Sad", "Angry"];

function InlineChoiceForm({ project, onSave, onCancel, onCreateNode }: {
  project: VNProject; onSave: (block: SceneBlock) => void; onCancel: () => void; onCreateNode?: () => string;
}) {
  const [text, setText] = useState("");
  const [targetId, setTargetId] = useState("");
  const [random, setRandom] = useState(0);
  const [showRandom, setShowRandom] = useState(false);
  const [effects, setEffects] = useState<InlineEffect[]>([]);
  const [req, setReq] = useState<ChoiceRequirement | undefined>();
  const [error, setError] = useState<string | null>(null);

  const allNodes = Object.values(project.nodes);
  const targets = allNodes.filter(n => n.nodeType === "story" || !n.nodeType);

  const handleSave = () => {
    if (!text.trim()) { setError("Choice text is required."); return; }
    if (!targetId) { setError("Target scene is required."); return; }
    onSave({
      type: "choice",
      text: text.trim(),
      targetNodeId: targetId,
      ...(showRandom && random > 0 ? { random } : {}),
      ...(effects.length > 0 ? { effects } : {}),
      ...(req ? { requirement: req } : {}),
    });
  };

  return (
    <div className="bg-slate-950 border border-indigo-500/40 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">New Choice</span>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-3 h-3" /></button>
      </div>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Choice text..."
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
        autoFocus onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }} />
      <select value={targetId} onChange={e => setTargetId(e.target.value)}
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer">
        <option value="">→ Select target scene...</option>
        {targets.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
        {onCreateNode && <option value="__new__">✨ Create new scene</option>}
      </select>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showRandom} onChange={e => setShowRandom(e.target.checked)}
            className="w-3 h-3 rounded border-slate-700" />
          Random chance
        </label>
      </div>
      {showRandom && (
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={random} onChange={e => setRandom(Number(e.target.value))}
            className="flex-1 h-1.5 accent-indigo-500" />
          <span className="text-xs font-mono text-indigo-300 w-10 text-right">{random}%</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Choice</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function InlineEffectForm({ project, onSave, onCancel }: {
  project: VNProject; onSave: (block: SceneBlock) => void; onCancel: () => void;
}) {
  const [op, setOp] = useState<"+" | "-" | "=">("+");
  const [statName, setStatName] = useState("");
  const [value, setValue] = useState(0);
  const trackers = project.trackers;

  const handleSave = () => {
    if (!statName.trim()) return;
    onSave({ type: "effect", variableName: statName.trim(), operation: op, value });
  };

  return (
    <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-3 space-y-2">
      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">New Effect</span>
      <div className="flex items-center gap-2">
        <select value={op} onChange={e => setOp(e.target.value as "+" | "-" | "=")}
          className="bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white w-14 text-center cursor-pointer">
          <option value="+">+</option>
          <option value="-">−</option>
          <option value="=">=</option>
        </select>
        <input type="number" value={value} onChange={e => setValue(Number(e.target.value))}
          className="w-16 bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white text-center focus:outline-none focus:border-indigo-500" />
        <input value={statName} onChange={e => setStatName(e.target.value)}
          placeholder="stat name"
          list="tracker-list"
          className="flex-1 bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }} />
        <datalist id="tracker-list">
          {trackers.map(t => <option key={t.id} value={t.name} />)}
        </datalist>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Effect</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function InlineDialogueForm({ project, onSave, onCancel }: {
  project: VNProject; onSave: (block: SceneBlock) => void; onCancel: () => void;
}) {
  const [speaker, setSpeaker] = useState("Narrator");
  const [expression, setExpression] = useState("Neutral");
  const [text, setText] = useState("");

  const entity = project.entities.find(e => e.name === speaker);
  const tones = entity?.expressions?.length ? entity.expressions : DEFAULT_EXPRESSIONS;

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({ type: "dialogue", speaker, expression, text: text.trim() });
  };

  return (
    <div className="bg-slate-950 border border-sky-500/40 rounded-xl p-3 space-y-2">
      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">New Dialogue</span>
      <div className="flex gap-2">
        <select value={speaker} onChange={e => { setSpeaker(e.target.value); setExpression("Neutral"); }}
          className="bg-slate-900 border border-slate-800 text-[11px] rounded-lg p-2 text-slate-200 cursor-pointer">
          <option value="Narrator">Narrator</option>
          {project.entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
        <select value={expression} onChange={e => setExpression(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-[11px] rounded-lg p-2 text-slate-200 cursor-pointer">
          {tones.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} autoFocus
        placeholder="What does the character say?"
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } if (e.key === "Escape") onCancel(); }} />
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Line</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function InlineNarrativeForm({ onSave, onCancel }: {
  onSave: (block: SceneBlock) => void; onCancel: () => void;
}) {
  const [text, setText] = useState("");

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({ type: "narrative", text: text.trim() });
  };

  return (
    <div className="bg-slate-950 border border-slate-500/40 rounded-xl p-3 space-y-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Narrative</span>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} autoFocus
        placeholder="Narrative description..."
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } if (e.key === "Escape") onCancel(); }} />
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Text</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function InlineStatDisplayForm({ project, onSave, onCancel }: {
  project: VNProject; onSave: (block: SceneBlock) => void; onCancel: () => void;
}) {
  const [statName, setStatName] = useState("");
  const trackers = project.trackers;

  const handleSave = () => {
    if (!statName.trim()) return;
    onSave({ type: "statDisplay", variableName: statName.trim() });
  };

  return (
    <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-3 space-y-2">
      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Show Stat</span>
      <input value={statName} onChange={e => setStatName(e.target.value)}
        placeholder="stat name"
        list="tracker-list-sd"
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }} autoFocus />
      <datalist id="tracker-list-sd">
        {trackers.map(t => <option key={t.id} value={t.name} />)}
      </datalist>
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Display</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function InlineEntityForm({ project, onSave, onCancel }: {
  project: VNProject; onSave: (block: SceneBlock) => void; onCancel: () => void;
}) {
  const [entityId, setEntityId] = useState("");

  const handleSave = () => {
    if (!entityId) return;
    onSave({ type: "entity", entityId });
  };

  return (
    <div className="bg-slate-950 border border-purple-500/40 rounded-xl p-3 space-y-2">
      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Entity Card</span>
      <select value={entityId} onChange={e => setEntityId(e.target.value)}
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 focus:outline-none cursor-pointer"
        autoFocus onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}>
        <option value="">Select entity...</option>
        {project.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Entity</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function InlineConditionForm({ project, onSave, onCancel }: {
  project: VNProject; onSave: (block: SceneBlock) => void; onCancel: () => void;
}) {
  const [source, setSource] = useState<"tracker" | "flag">("tracker");
  const [targetId, setTargetId] = useState("");
  const [operator, setOperator] = useState(">=");
  const [compareValue, setCompareValue] = useState(1);

  const trackers = project.trackers;
  const flags = project.flags;

  const handleSave = () => {
    if (!targetId) return;
    onSave({
      type: "condition",
      source,
      targetId,
      ...(source === "tracker" ? { operator, compareValue } : {}),
    });
  };

  return (
    <div className="bg-slate-950 border border-rose-500/40 rounded-xl p-3 space-y-2">
      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Condition</span>
      <div className="flex items-center gap-2">
        <select value={source} onChange={e => setSource(e.target.value as "tracker" | "flag")}
          className="bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 cursor-pointer">
          <option value="tracker">Tracker</option>
          <option value="flag">Flag</option>
        </select>
        {source === "tracker" ? (
          <>
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 cursor-pointer">
              <option value="">Select tracker...</option>
              {trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={operator} onChange={e => setOperator(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 w-14 text-center cursor-pointer">
              <option value=">=">≥</option>
              <option value="<=">≤</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value="==">=</option>
              <option value="!=">≠</option>
            </select>
            <input type="number" value={compareValue} onChange={e => setCompareValue(Number(e.target.value))}
              className="w-16 bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white text-center" />
          </>
        ) : (
          <select value={targetId} onChange={e => setTargetId(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 cursor-pointer">
            <option value="">Select flag...</option>
            {flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Condition</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function InlineEndingForm({ onSave, onCancel }: {
  onSave: (block: SceneBlock) => void; onCancel: () => void;
}) {
  const [endingType, setEndingType] = useState<"GOOD" | "BAD" | "NEUTRAL" | "NORMAL">("NORMAL");
  const [endingName, setEndingName] = useState("");

  const handleSave = () => {
    onSave({ type: "ending", endingType, endingName: endingName.trim() || undefined });
  };

  return (
    <div className="bg-slate-950 border border-rose-500/40 rounded-xl p-3 space-y-2">
      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">New Ending</span>
      <select value={endingType} onChange={e => setEndingType(e.target.value as any)}
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 cursor-pointer">
        <option value="GOOD">Good Ending</option>
        <option value="BAD">Bad Ending</option>
        <option value="NORMAL">Normal Ending</option>
        <option value="NEUTRAL">Neutral Ending</option>
      </select>
      <input value={endingName} onChange={e => setEndingName(e.target.value)}
        placeholder="Ending name (e.g. 'Faceplant')"
        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }} autoFocus />
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">Add Ending</button>
        <button onClick={onCancel}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function BlockRenderer({ block, entity, trackerValue }: {
  block: SceneBlock; entity?: VNEntity; trackerValue?: number;
}) {
  switch (block.type) {
    case "dialogue":
      return (
        <span>
          <span className="font-semibold text-sky-300">[{block.speaker}]</span>{" "}
          <span className="text-slate-100">"{block.text}"</span>
          {block.expression && block.expression !== "Neutral" && (
            <span className="text-[10px] text-slate-500 ml-1">({block.expression})</span>
          )}
        </span>
      );
    case "narrative":
      return <span className="text-slate-300">{block.text}</span>;
    case "effect":
      return (
        <span>
          <span className={`font-bold ${block.operation === "+" ? "text-emerald-400" : block.operation === "-" ? "text-rose-400" : "text-amber-400"}`}>
            [{block.operation}{block.value}]
          </span>{" "}
          <span className="text-slate-200">[{block.variableName}]</span>
        </span>
      );
    case "statDisplay":
      return (
        <span>
          <span className="text-amber-300 font-mono">[{block.variableName}: {trackerValue ?? "?"}]</span>
        </span>
      );
    case "choice":
      return (
        <span>
          <span className="text-indigo-300">→ {block.text}</span>
          {block.random && block.random > 0 && (
            <span className="text-[10px] text-indigo-400 ml-1">({block.random}%)</span>
          )}
        </span>
      );
    case "entity":
      return entity ? (
        <span>
          <span className="text-purple-300 font-semibold">[{entity.name}]</span>
          {entity.ownedTrackers?.map((t, i) => (
            <span key={i} className="text-[10px] text-purple-400 ml-1">{t.name}: {t.defaultValue}</span>
          ))}
        </span>
      ) : (
        <span className="text-rose-400">[Unknown entity]</span>
      );
    case "condition":
      return (
        <span>
          <span className="text-rose-300">[If ]</span>
          <span className="text-slate-200">{block.targetId}</span>
          {block.operator && <span className="text-slate-400"> {block.operator} {block.compareValue}</span>}
        </span>
      );
    case "ending":
      return (
        <span>
          <span className={`font-bold ${block.endingType === "GOOD" ? "text-emerald-400" : block.endingType === "BAD" ? "text-rose-400" : "text-cyan-400"}`}>
            [{block.endingType} END{block.endingName ? `: ${block.endingName}` : ""}]
          </span>
        </span>
      );
    default:
      return null;
  }
}

const BLOCK_BG: Record<string, string> = {
  dialogue: "bg-sky-950/30 border-sky-800/40",
  narrative: "bg-slate-800/30 border-slate-700/40",
  effect: "bg-emerald-950/30 border-emerald-800/40",
  statDisplay: "bg-amber-950/30 border-amber-800/40",
  choice: "bg-indigo-950/30 border-indigo-800/40",
  entity: "bg-purple-950/30 border-purple-800/40",
  condition: "bg-rose-950/30 border-rose-800/40",
  ending: "bg-rose-950/30 border-rose-800/40",
};

export default function BlockEditor({ project, blocks, onChange, onCreateNode }: BlockEditorProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<BlockAction | null>(null);

  const addBlock = useCallback((block: SceneBlock) => {
    onChange([...blocks, block]);
    setActiveForm(null);
    setPaletteOpen(false);
  }, [blocks, onChange]);

  const removeBlock = useCallback((index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  }, [blocks, onChange]);

  const getTrackerValue = (name: string): number | undefined => {
    return project.trackers.find(t => t.name === name)?.defaultValue;
  };

  const getEntity = (id: string): VNEntity | undefined => {
    return project.entities.find(e => e.id === id);
  };

  if (activeForm) {
    const formProps = { project, onSave: addBlock, onCancel: () => setActiveForm(null) };
    return (
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <div key={i} className={`flex items-start gap-1.5 p-2 rounded-lg border ${BLOCK_BG[block.type] || "bg-slate-800/30 border-slate-700/40"}`}>
            <button className="mt-0.5 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing cursor-pointer">
              <GripVertical className="w-3 h-3" />
            </button>
            <div className="flex-1 text-xs leading-relaxed">
              <BlockRenderer block={block} entity={getEntity((block as any).entityId)} trackerValue={getTrackerValue((block as any).variableName)} />
            </div>
            <button onClick={() => removeBlock(i)} className="text-slate-600 hover:text-rose-400 cursor-pointer shrink-0"><X className="w-3 h-3" /></button>
          </div>
        ))}
        {(() => {
          switch (activeForm) {
            case "dialogue": return <InlineDialogueForm {...formProps} />;
            case "narrative": return <InlineNarrativeForm onSave={addBlock} onCancel={() => setActiveForm(null)} />;
            case "effect": return <InlineEffectForm {...formProps} />;
            case "statDisplay": return <InlineStatDisplayForm {...formProps} />;
            case "choice": return <InlineChoiceForm {...formProps} onCreateNode={onCreateNode} />;
            case "entity": return <InlineEntityForm {...formProps} />;
            case "condition": return <InlineConditionForm {...formProps} />;
            case "ending": return <InlineEndingForm onSave={addBlock} onCancel={() => setActiveForm(null)} />;
            default: return null;
          }
        })()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-xs italic border-2 border-dashed border-slate-800 rounded-xl">
          No scene content yet. Click + below to add dialogue, effects, or choices.
        </div>
      ) : (
        blocks.map((block, i) => (
          <div key={i} className={`flex items-start gap-1.5 p-2 rounded-lg border ${BLOCK_BG[block.type] || "bg-slate-800/30 border-slate-700/40"}`}>
            <button className="mt-0.5 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing cursor-pointer">
              <GripVertical className="w-3 h-3" />
            </button>
            <div className="flex-1 text-xs leading-relaxed">
              <BlockRenderer block={block} entity={getEntity((block as any).entityId)} trackerValue={getTrackerValue((block as any).variableName)} />
            </div>
            <button onClick={() => removeBlock(i)} className="text-slate-600 hover:text-rose-400 cursor-pointer shrink-0"><X className="w-3 h-3" /></button>
          </div>
        ))
      )}

      <div className="relative">
        {paletteOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPaletteOpen(false)} />
            <div className="absolute bottom-full right-0 mb-1 z-50 flex flex-row-reverse gap-1 flex-wrap justify-end">
              {BLOCK_ACTIONS.map(action => (
                <button key={action.key} onClick={() => setActiveForm(action.key)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold rounded-lg border border-slate-700 transition-all cursor-pointer">
                  {action.icon}
                  {action.label}
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
