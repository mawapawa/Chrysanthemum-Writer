import React, { useState } from "react";
import { VNProject, StoryNode, LocationNodeData, LocationItem } from "../types";

interface LocationEditorProps {
  project: VNProject;
  node: StoryNode;
  onUpdateNode: (fields: Partial<StoryNode>) => void;
}

function defaultLocationData(): LocationNodeData {
  return {
    visuals: { bgImage: "" },
    connections: [],
    mapPosition: { x: 50, y: 50 },
    encounterPool: [],
    baseActions: [],
    inventory: [],
    tags: [],
  };
}

export default function LocationEditor({ project, node, onUpdateNode }: LocationEditorProps) {
  const data = node.locationNodeData || defaultLocationData();

  const update = (fields: Partial<LocationNodeData>) => {
    onUpdateNode({ locationNodeData: { ...data, ...fields } });
  };

  const otherLocations = Object.values(project.nodes).filter(
    n => n.id !== node.id && n.nodeType === "location"
  );

  const toggleConnection = (locId: string) => {
    const exists = data.connections.includes(locId);
    update({ connections: exists ? data.connections.filter(c => c !== locId) : [...data.connections, locId] });
  };

  const addEncounterEntry = () => {
    const firstEnc = Object.values(project.nodes).find(n => n.nodeType === "encounter");
    update({ encounterPool: [...data.encounterPool, { encounterId: firstEnc?.id || "", weight: 1 }] });
  };

  const updateEncounterEntry = (i: number, fields: Partial<{ encounterId: string; weight: number }>) => {
    const pool = [...data.encounterPool];
    pool[i] = { ...pool[i], ...fields };
    update({ encounterPool: pool });
  };

  const removeEncounterEntry = (i: number) => {
    update({ encounterPool: data.encounterPool.filter((_, idx) => idx !== i) });
  };

  const addBaseAction = () => {
    update({ baseActions: [...data.baseActions, { label: "", actionCommand: "" }] });
  };

  const updateBaseAction = (i: number, fields: Partial<{ label: string; actionCommand: string }>) => {
    const actions = [...data.baseActions];
    actions[i] = { ...actions[i], ...fields };
    update({ baseActions: actions });
  };

  const removeBaseAction = (i: number) => {
    update({ baseActions: data.baseActions.filter((_, idx) => idx !== i) });
  };

  const addInventoryItem = () => {
    update({ inventory: [...data.inventory, { itemId: "", price: 0, quantity: 1 }] });
  };

  const updateInventoryItem = (i: number, fields: Partial<LocationItem>) => {
    const inv = [...data.inventory];
    inv[i] = { ...inv[i], ...fields };
    update({ inventory: inv });
  };

  const removeInventoryItem = (i: number) => {
    update({ inventory: data.inventory.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-4 p-4">
      {/* Visuals */}
      <div className="glass-card p-3 space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visuals</h4>
        <div>
          <label className="text-[10px] text-slate-500">Background Image</label>
          <input type="text" value={data.visuals.bgImage} onChange={e => update({ visuals: { ...data.visuals, bgImage: e.target.value } })}
            className="w-full bg-slate-950 border border-slate-800 text-xs rounded p-1.5 text-slate-200 mt-0.5" placeholder="Asset path or URL" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500">Ambient Audio (optional)</label>
          <input type="text" value={data.visuals.ambientAudio || ""} onChange={e => update({ visuals: { ...data.visuals, ambientAudio: e.target.value } })}
            className="w-full bg-slate-950 border border-slate-800 text-xs rounded p-1.5 text-slate-200 mt-0.5" placeholder="Audio asset path" />
        </div>
      </div>

      {/* Connections */}
      <div className="glass-card p-3 space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connections</h4>
        <p className="text-[10px] text-slate-500">Select connected locations</p>
        <div className="flex flex-wrap gap-1.5">
          {otherLocations.length === 0 && (
            <p className="text-[10px] text-slate-600 italic">No other location nodes exist.</p>
          )}
          {otherLocations.map(loc => (
            <button key={loc.id} onClick={() => toggleConnection(loc.id)}
              className={`text-[10px] px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                data.connections.includes(loc.id)
                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                  : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}>
              {loc.title}
            </button>
          ))}
        </div>
      </div>

      {/* Map Position */}
      <div className="glass-card p-3 space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Map Position</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500">X%</label>
            <input type="range" min="0" max="100" value={data.mapPosition.x}
              onChange={e => update({ mapPosition: { ...data.mapPosition, x: parseInt(e.target.value) } })}
              className="w-full accent-indigo-500" />
            <span className="text-[10px] text-slate-500 font-mono">{data.mapPosition.x}%</span>
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Y%</label>
            <input type="range" min="0" max="100" value={data.mapPosition.y}
              onChange={e => update({ mapPosition: { ...data.mapPosition, y: parseInt(e.target.value) } })}
              className="w-full accent-indigo-500" />
            <span className="text-[10px] text-slate-500 font-mono">{data.mapPosition.y}%</span>
          </div>
        </div>
      </div>

      {/* Encounter Pool */}
      <div className="glass-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Encounter Pool</h4>
          <button onClick={addEncounterEntry} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">+ Add</button>
        </div>
        {data.encounterPool.length === 0 && <p className="text-[10px] text-slate-600 italic">No random encounters.</p>}
        {data.encounterPool.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
            <select value={entry.encounterId} onChange={e => updateEncounterEntry(i, { encounterId: e.target.value })}
              className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1">
              <option value="">Select encounter...</option>
              {Object.values(project.nodes).filter(n => n.nodeType === "encounter").map(n => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
            <input type="number" min="1" value={entry.weight} onChange={e => updateEncounterEntry(i, { weight: parseInt(e.target.value) || 1 })}
              className="w-14 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1 text-center" title="Weight" />
            <button onClick={() => removeEncounterEntry(i)} className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
          </div>
        ))}
      </div>

      {/* Base Actions */}
      <div className="glass-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Base Actions</h4>
          <button onClick={addBaseAction} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">+ Add</button>
        </div>
        {data.baseActions.length === 0 && <p className="text-[10px] text-slate-600 italic">Default room buttons.</p>}
        {data.baseActions.map((action, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
            <input type="text" value={action.label} onChange={e => updateBaseAction(i, { label: e.target.value })}
              className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1 placeholder-slate-600" placeholder="Button label" />
            <input type="text" value={action.actionCommand} onChange={e => updateBaseAction(i, { actionCommand: e.target.value })}
              className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1 placeholder-slate-600" placeholder="/command" />
            <button onClick={() => removeBaseAction(i)} className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
          </div>
        ))}
      </div>

      {/* Inventory & Tags */}
      <div className="glass-card p-3 space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shop Inventory</h4>
        {data.inventory.length === 0 && <p className="text-[10px] text-slate-600 italic">No items for sale.</p>}
        {data.inventory.map((item, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
            <select value={item.itemId} onChange={e => updateInventoryItem(i, { itemId: e.target.value })}
              className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1">
              <option value="">Select item...</option>
              {project.inventory.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
            </select>
            <input type="number" min="1" value={item.quantity || 1} onChange={e => updateInventoryItem(i, { quantity: parseInt(e.target.value) || 1 })}
              className="w-14 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1 text-center" title="Qty" />
            <input type="number" min="0" value={item.price} onChange={e => updateInventoryItem(i, { price: parseInt(e.target.value) || 0 })}
              className="w-14 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1 text-center" title="Price" />
            <button onClick={() => removeInventoryItem(i)} className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
          </div>
        ))}
        <button onClick={addInventoryItem} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">+ Add Item</button>
      </div>

      <div>
        <label className="text-[10px] text-slate-500">Tags</label>
        <input type="text" value={data.tags.join(", ")} onChange={e => update({ tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
          className="w-full bg-slate-950 border border-slate-800 text-xs rounded p-1.5 text-slate-200 mt-0.5" placeholder="tag1, tag2, ..." />
      </div>
    </div>
  );
}