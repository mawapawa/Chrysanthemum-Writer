import React from "react";
import { VNProject, StoryNode, EncounterDrop } from "../types";

interface EncounterEditorProps {
  project: VNProject;
  node: StoryNode;
  onUpdateNode: (fields: Partial<StoryNode>) => void;
}

export default function EncounterEditor({ project, node, onUpdateNode }: EncounterEditorProps) {
  const ed = node.encounterData || { enemyName: "Enemy", hp: 10, attack: 5, defense: 2, drops: [], tags: [] };

  const updateED = (fields: Partial<typeof ed>) => {
    onUpdateNode({ encounterData: { ...ed, ...fields } });
  };

  const pickEntity = (entityId: string) => {
    const entity = project.entities.find(e => e.id === entityId);
    if (!entity) return;
    const s = entity.stats || {};
    updateED({
      enemyName: entity.name,
      hp: s["hp"] ?? ed.hp,
      attack: s["attack"] ?? ed.attack,
      defense: s["defense"] ?? ed.defense,
    });
  };

  const addDrop = () => {
    if (project.inventory.length === 0) return;
    updateED({ drops: [...ed.drops, { itemId: project.inventory[0].id, chance: 100, quantity: 1 }] });
  };

  const updateDrop = (idx: number, fields: Partial<EncounterDrop>) => {
    updateED({ drops: ed.drops.map((d, i) => (i === idx ? { ...d, ...fields } : d)) });
  };

  const removeDrop = (idx: number) => {
    updateED({ drops: ed.drops.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Encounter Name</label>
        <input type="text" value={node.title} onChange={(e) => onUpdateNode({ title: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Enemy (from Entities)</label>
        <select value="" onChange={(e) => { if (e.target.value) pickEntity(e.target.value); }}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200">
          <option value="">— Select Entity —</option>
          {project.entities.map(e => (
            <option key={e.id} value={e.id}>{e.name} {e.tags.length ? `(${e.tags.join(", ")})` : ""}</option>
          ))}
        </select>
        <p className="text-[9px] text-slate-500 mt-0.5">Selecting an entity auto-fills stats from that entity's Stat Overrides.</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Enemy</label>
          <input type="text" value={ed.enemyName} onChange={(e) => updateED({ enemyName: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">HP</label>
          <input type="number" value={ed.hp} onChange={(e) => updateED({ hp: parseInt(e.target.value) || 0 })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 text-center" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">ATK</label>
          <input type="number" value={ed.attack} onChange={(e) => updateED({ attack: parseInt(e.target.value) || 0 })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 text-center" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">DEF</label>
          <input type="number" value={ed.defense} onChange={(e) => updateED({ defense: parseInt(e.target.value) || 0 })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 text-center" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
        <textarea value={node.description} onChange={(e) => onUpdateNode({ description: e.target.value })}
          rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-slate-400">Drops</label>
          <button onClick={addDrop} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">+ Add Drop</button>
        </div>
        {ed.drops.length === 0 && <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-xl border border-slate-800/40">No drops defined.</p>}
        {ed.drops.map((d, i) => {
          const item = project.inventory.find(it => it.id === d.itemId);
          return (
            <div key={i} className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 mb-1">
              <select value={d.itemId} onChange={(e) => updateDrop(i, { itemId: e.target.value })}
                className="flex-1 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded p-1">
                {project.inventory.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
              <input type="number" value={d.chance} onChange={(e) => updateDrop(i, { chance: parseInt(e.target.value) || 0 })}
                className="w-14 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded p-1 text-center" placeholder="%" />
              <span className="text-[10px] text-slate-500">%</span>
              <span className="text-[10px] text-slate-500">x</span>
              <input type="number" value={d.quantity} onChange={(e) => updateDrop(i, { quantity: parseInt(e.target.value) || 1 })}
                className="w-12 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded p-1 text-center" />
              <button onClick={() => removeDrop(i)} className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">On Win →</label>
          <select value={ed.onWinNodeId || ""} onChange={(e) => updateED({ onWinNodeId: e.target.value || undefined })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[10px] text-slate-200">
            <option value="">— None —</option>
            {Object.values(project.nodes).filter(n => n.nodeType === "story").map(n =>
              <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">On Lose →</label>
          <select value={ed.onLoseNodeId || ""} onChange={(e) => updateED({ onLoseNodeId: e.target.value || undefined })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[10px] text-slate-200">
            <option value="">— None —</option>
            {Object.values(project.nodes).filter(n => n.nodeType === "story").map(n =>
              <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">On Flee →</label>
          <select value={ed.onFleeNodeId || ""} onChange={(e) => updateED({ onFleeNodeId: e.target.value || undefined })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[10px] text-slate-200">
            <option value="">— None —</option>
            {Object.values(project.nodes).filter(n => n.nodeType === "story").map(n =>
              <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Tags</label>
        <input type="text" placeholder="Comma-separated..." value={ed.tags.join(", ")}
          onChange={(e) => updateED({ tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
      </div>
    </div>
  );
}
