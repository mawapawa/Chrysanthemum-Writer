import React, { useState } from "react";
import { VNProject, VNItem } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Package, Edit2 } from "lucide-react";
import TagInput from "./TagInput";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { ManagerLayout } from "./ManagerLayout";
import { EmptyState } from "./EmptyState";

interface ItemsManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function ItemsManager({ project, onUpdateProject }: ItemsManagerProps) {
  const allItemTags = [...new Set(project.inventory.flatMap(i => i.tags))];
  const [editingItem, setEditingItem] = useState<VNItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formStatModifiers, setFormStatModifiers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const { confirmId, ref, requestDelete } = useConfirmDelete();

  const resetForm = () => {
    setEditingItem(null);
    setItemName("");
    setDescription("");
    setFormTags([]);
    setFormStatModifiers({});
    setError(null);
  };

  const startEdit = (item: VNItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setDescription(item.description || "");
    setFormTags([...item.tags]);
    setFormStatModifiers(item.statModifiers ? { ...item.statModifiers } : {});
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = itemName.trim();
    if (!cleanName) { setError("Item name cannot be empty."); return; }
    if (project.inventory.some((i) => i.name.toLowerCase() === cleanName.toLowerCase() && i.id !== editingItem?.id)) {
      setError(`An item named "${cleanName}" already exists.`); return;
    }
    if (editingItem) {
      const updated = project.inventory.map(i =>
        i.id === editingItem.id ? { ...i, name: cleanName, description: description.trim() || undefined, tags: [...formTags], statModifiers: Object.keys(formStatModifiers).length > 0 ? { ...formStatModifiers } : undefined } : i
      );
      onUpdateProject({ ...project, inventory: updated, lastModified: Date.now() });
    } else {
      const newItem: VNItem = { id: crypto.randomUUID(), displayId: generateDisplayId("ITM"), name: cleanName, description: description.trim() || undefined, tags: [...formTags], statModifiers: Object.keys(formStatModifiers).length > 0 ? { ...formStatModifiers } : undefined };
      onUpdateProject({ ...project, inventory: [...project.inventory, newItem], lastModified: Date.now() });
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!requestDelete(id)) return;
    onUpdateProject({ ...project, inventory: project.inventory.filter((i) => i.id !== id), lastModified: Date.now() });
  };

  return (
    <ManagerLayout icon={Package} title="Define Items" listTitle="Inventory Registry"
      description="Create inventory items that players can collect, use, and trade throughout your visual novel."
      form={
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-xs text-red-400">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Item Name</label>
            <input type="text" placeholder="e.g. Ancient Key, Healing Herb" value={itemName} onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3 py-2 glass-input rounded-xl text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description (Optional)</label>
            <textarea placeholder="e.g. A rusty old key that opens the cellar door." value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="w-full px-3 py-2 glass-input rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Tags</label>
            <TagInput tags={formTags} onChange={setFormTags} existingTags={allItemTags} placeholder="Add tag and press Enter..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Stat Modifiers</label>
            {Object.keys(formStatModifiers).length === 0 && (
              <p className="text-[10px] text-slate-500 italic mb-1">No stat modifiers. Add ones like "hp", "attack".</p>
            )}
            {Object.entries(formStatModifiers).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 mb-1">
                <input type="text" value={key} onChange={e => {
                  const newMods = { ...formStatModifiers };
                  delete newMods[key];
                  newMods[e.target.value] = val;
                  setFormStatModifiers(newMods);
                }} className="flex-1 bg-slate-950 border border-slate-800 text-xs rounded p-1.5 text-slate-200" placeholder="stat name" />
                <input type="number" value={val} onChange={e => setFormStatModifiers({ ...formStatModifiers, [key]: parseInt(e.target.value) || 0 })}
                  className="w-20 bg-slate-950 border border-slate-800 text-xs rounded p-1.5 text-slate-200 text-center" />
                <button onClick={() => { const n = { ...formStatModifiers }; delete n[key]; setFormStatModifiers(n); }}
                  className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
              </div>
            ))}
            <button onClick={() => setFormStatModifiers({ ...formStatModifiers, "": 0 })}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">+ Add Modifier</button>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2.5 px-4 glass-button text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer">
              {editingItem ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingItem ? "Update Item" : "Add Item"}
            </button>
            {editingItem && (
              <button type="button" onClick={resetForm} className="py-2.5 px-4 glass-button text-slate-300 font-medium text-sm rounded-xl cursor-pointer">
                Cancel
              </button>
            )}
          </div>
        </form>
      }
    >
      {project.inventory.length === 0 ? (
        <EmptyState icon={Package} text="No items defined yet" subtext="Add items to your game's inventory that players can find, collect, and use." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.inventory.map((item) => (
            <div key={item.id} className="glass-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-sm font-semibold text-slate-200 px-2 py-0.5 rounded-lg">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(item)} className="p-1 text-slate-400 hover:text-indigo-400 rounded cursor-pointer" title="Edit item">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <div ref={ref}>
                      <button onClick={() => handleDelete(item.id)}
                        className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                          confirmId === item.id ? "bg-red-600 border-red-500 text-white animate-pulse" : "text-slate-400 hover:text-red-400 border-transparent"
                        }`}>
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmId === item.id && <span>Confirm?</span>}
                      </button>
                    </div>
                  </div>
                </div>
                {item.description ? <p className="text-xs text-slate-300 leading-relaxed mt-1">{item.description}</p> : <p className="text-xs text-slate-500 italic">No description provided.</p>}
                {item.statModifiers && Object.keys(item.statModifiers).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(item.statModifiers).map(([stat, val]) => (
                      <span key={stat} className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-900/50 text-emerald-300">
                        {stat} {val > 0 ? `+${val}` : val}
                      </span>
                    ))}
                  </div>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.map(tag => <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-900/50 text-indigo-300">{tag}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}
