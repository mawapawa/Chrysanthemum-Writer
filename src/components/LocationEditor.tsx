import React from "react";
import { VNProject, StoryNode, LocationItem } from "../types";

interface LocationEditorProps {
  project: VNProject;
  node: StoryNode;
  onUpdateNode: (fields: Partial<StoryNode>) => void;
}

export default function LocationEditor({ project, node, onUpdateNode }: LocationEditorProps) {
  const calendar = project.calendar || [];
  const ld = node.locationData || { inventory: [], tags: [] };

  const updateLD = (fields: Partial<typeof ld>) => {
    onUpdateNode({ locationData: { ...ld, ...fields } });
  };

  const addItem = () => {
    if (project.inventory.length === 0) return;
    const newItem: LocationItem = { itemId: project.inventory[0].id, price: 0 };
    updateLD({ inventory: [...ld.inventory, newItem] });
  };

  const removeItem = (idx: number) => {
    updateLD({ inventory: ld.inventory.filter((_, i) => i !== idx) });
  };

  const updateItem = (idx: number, fields: Partial<LocationItem>) => {
    updateLD({ inventory: ld.inventory.map((item, i) => (i === idx ? { ...item, ...fields } : item)) });
  };

  const currentPeriodName = ld.openPeriodId ? calendar.find(p => p.id === ld.openPeriodId)?.name : null;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Display Name</label>
        <input type="text" value={node.title} onChange={(e) => onUpdateNode({ title: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Open During</label>
          <select value={ld.openPeriodId || ""} onChange={(e) => updateLD({ openPeriodId: e.target.value || undefined })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200">
            <option value="">— Always Open —</option>
            {calendar.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {currentPeriodName && (
            <p className="text-[9px] text-slate-500 mt-1 font-mono">Open during: {currentPeriodName}</p>
          )}
          {calendar.length === 0 && (
            <p className="text-[9px] text-amber-400 mt-1">No calendar periods defined. Add them in the Calendar tab.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Status Milestone (optional)</label>
          <select value={ld.statusFlagId || ""} onChange={(e) => updateLD({ statusFlagId: e.target.value || undefined })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200">
            <option value="">— Always Open —</option>
            {project.flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
        <textarea value={node.description} onChange={(e) => onUpdateNode({ description: e.target.value })}
          rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-slate-400">Items for Sale</label>
          <button onClick={addItem} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">
            + Add Item
          </button>
        </div>
        {ld.inventory.length === 0 && (
          <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-xl border border-slate-800/40">No items listed.</p>
        )}
        {ld.inventory.map((li, i) => {
          const item = project.inventory.find(it => it.id === li.itemId);
          return (
            <div key={i} className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 mb-1">
              <select value={li.itemId} onChange={(e) => updateItem(i, { itemId: e.target.value })}
                className="flex-1 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded p-1">
                {project.inventory.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
              <input type="number" value={li.price} onChange={(e) => updateItem(i, { price: parseInt(e.target.value) || 0 })}
                className="w-16 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded p-1 text-center" placeholder="0" />
              <span className="text-[10px] text-slate-500">gp</span>
              <button onClick={() => removeItem(i)} className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
            </div>
          );
        })}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Tags</label>
        <input type="text" placeholder="Comma-separated tags..."
          value={ld.tags.join(", ")}
          onChange={(e) => updateLD({ tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
      </div>
    </div>
  );
}
