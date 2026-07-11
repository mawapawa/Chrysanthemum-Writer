import React, { useState } from "react";
import { VNProject, VNEntity, VNEntityStat, VNEntityFlag } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Users, Check, Edit2 } from "lucide-react";
import TagInput from "./TagInput";
import { textColorForHex } from "../utils/color";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { EmptyState } from "./EmptyState";

interface EntitiesManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

const ENTITY_PALETTE_COLORS = ["#f43f5e", "#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ea580c", "#ec4899", "#64748b"];
const DEFAULT_EXPRESSIONS = ["Neutral", "Smile", "Surprise", "Serious", "Sad", "Angry"];

export default function EntitiesManager({ project, onUpdateProject }: EntitiesManagerProps) {
  const allEntityTags = [...new Set(project.entities.flatMap(e => e.tags))];
  const [editingEntity, setEditingEntity] = useState<VNEntity | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(ENTITY_PALETTE_COLORS[0]);
  const [useCustomHex, setUseCustomHex] = useState(false);
  const [customHex, setCustomHex] = useState("#");
  const [description, setDescription] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formStats, setFormStats] = useState<Record<string, number>>({});
  const [formOwnedTrackers, setFormOwnedTrackers] = useState<VNEntityStat[]>([]);
  const [formOwnedFlags, setFormOwnedFlags] = useState<VNEntityFlag[]>([]);
  const [formExpressions, setFormExpressions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { confirmId, ref, requestDelete } = useConfirmDelete();

  const resetForm = () => {
    setName("");
    setColor(ENTITY_PALETTE_COLORS[0]);
    setUseCustomHex(false);
    setCustomHex("#");
    setDescription("");
    setFormTags([]);
    setFormStats({});
    setFormOwnedTrackers([]);
    setFormOwnedFlags([]);
    setFormExpressions([]);
    setError(null);
    setEditingEntity(null);
  };

  const startEdit = (entity: VNEntity) => {
    setEditingEntity(entity);
    setName(entity.name);
    setColor(entity.color);
    setUseCustomHex(false);
    setCustomHex("#");
    setDescription(entity.description || "");
    setFormTags([...entity.tags]);
    setFormStats(entity.stats ? { ...entity.stats } : {});
    setFormOwnedTrackers(entity.ownedTrackers ? [...entity.ownedTrackers] : []);
    setFormOwnedFlags(entity.ownedFlags ? [...entity.ownedFlags] : []);
    setFormExpressions(entity.expressions ? [...entity.expressions] : []);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = name.trim();
    if (!cleanName) { setError("Entity name cannot be empty."); return; }

    const finalColor = useCustomHex && /^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : color;

    const cleanedTrackers = formOwnedTrackers.filter(t => t.name.trim());
    const cleanedFlags = formOwnedFlags.filter(f => f.name.trim());

    if (editingEntity) {
      const updated = project.entities.map(ent =>
        ent.id === editingEntity.id
          ? {
              ...ent,
              name: cleanName,
              color: finalColor,
              description: description.trim() || undefined,
              tags: [...formTags],
              stats: Object.keys(formStats).length > 0 ? { ...formStats } : undefined,
              ownedTrackers: cleanedTrackers.length > 0 ? cleanedTrackers : undefined,
              ownedFlags: cleanedFlags.length > 0 ? cleanedFlags : undefined,
              expressions: formExpressions.length > 0 ? formExpressions : undefined,
            }
          : ent
      );
      onUpdateProject({ ...project, entities: updated, lastModified: Date.now() });
      resetForm();
      return;
    }

    if (project.entities.some(ent => ent.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`An entity named "${cleanName}" already exists.`);
      return;
    }

    const newEntity: VNEntity = {
      id: crypto.randomUUID(),
      displayId: generateDisplayId("ENT"),
      name: cleanName,
      color: finalColor,
      description: description.trim() || undefined,
      tags: [...formTags],
      ownedTrackers: cleanedTrackers.length > 0 ? cleanedTrackers : undefined,
      ownedFlags: cleanedFlags.length > 0 ? cleanedFlags : undefined,
      expressions: formExpressions.length > 0 ? formExpressions : undefined,
    };

    onUpdateProject({
      ...project,
      entities: [...project.entities, newEntity],
      lastModified: Date.now(),
    });
    resetForm();
  };

  const handleDeleteEntity = (id: string) => {
    if (!requestDelete(id)) return;
    onUpdateProject({ ...project, entities: project.entities.filter(ent => ent.id !== id), lastModified: Date.now() });
  };

  const addTracker = () => {
    setFormOwnedTrackers(prev => [...prev, { name: "", defaultValue: 0 }]);
  };

  const updateTracker = (idx: number, field: Partial<VNEntityStat>) => {
    setFormOwnedTrackers(prev => prev.map((t, i) => i === idx ? { ...t, ...field } : t));
  };

  const removeTracker = (idx: number) => {
    setFormOwnedTrackers(prev => prev.filter((_, i) => i !== idx));
  };

  const addFlag = () => {
    setFormOwnedFlags(prev => [...prev, { name: "", defaultValue: false }]);
  };

  const updateFlag = (idx: number, field: Partial<VNEntityFlag>) => {
    setFormOwnedFlags(prev => prev.map((f, i) => i === idx ? { ...f, ...field } : f));
  };

  const removeFlag = (idx: number) => {
    setFormOwnedFlags(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full overflow-y-auto" id="entities-manager-container">
      <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs h-fit" id="entity-creator-card">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">{editingEntity ? "Edit Entity" : "Define Entities"}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          {editingEntity ? `Editing "${editingEntity.name}"` : "Create characters, monsters, and NPCs."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Entity Name</label>
            <input type="text" placeholder="e.g. Sonja, Giant Rat" value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
            <div className="grid grid-cols-4 gap-2">
              {ENTITY_PALETTE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => { setColor(c); setUseCustomHex(false); }}
                  style={{ backgroundColor: c }}
                  className={`h-10 rounded-xl flex items-center justify-center cursor-pointer transition-transform ${color === c && !useCustomHex ? "ring-4 ring-indigo-500/35 scale-105" : "hover:scale-105"}`}>
                  {color === c && !useCustomHex && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={useCustomHex} onChange={(e) => setUseCustomHex(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded" />
                <span>Use Custom Hex Code</span>
              </label>
              {useCustomHex && (
                <input type="text" placeholder="#000000" value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea placeholder="e.g. A giant rat found in the sewers." value={description}
              onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tags</label>
            <TagInput tags={formTags} onChange={setFormTags} existingTags={allEntityTags} placeholder="Add tag and press Enter..." />
          </div>

          {/* Owned Trackers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Stats (numbers that change)</label>
              <button type="button" onClick={addTracker}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                <Plus className="w-3 h-3 inline" /> Add Stat
              </button>
            </div>
            {formOwnedTrackers.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">No stats yet. Add ones like "affection", "jealousy", "rage".</p>
            )}
            {formOwnedTrackers.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100 mb-1">
                <input type="text" value={t.name} placeholder="stat name"
                  onChange={(e) => updateTracker(idx, { name: e.target.value })}
                  className="flex-1 bg-white border border-gray-200 text-xs rounded p-1" />
                <span className="text-[10px] text-gray-500">default:</span>
                <input type="number" value={t.defaultValue}
                  onChange={(e) => updateTracker(idx, { defaultValue: parseInt(e.target.value) || 0 })}
                  className="w-16 bg-white border border-gray-200 text-xs rounded p-1 text-center" />
                <button type="button" onClick={() => removeTracker(idx)}
                  className="text-rose-400 hover:text-rose-600 text-xs cursor-pointer">✕</button>
              </div>
            ))}
          </div>

          {/* Owned Flags */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">States (on/off)</label>
              <button type="button" onClick={addFlag}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                <Plus className="w-3 h-3 inline" /> Add State
              </button>
            </div>
            {formOwnedFlags.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">No states yet. Add ones like "met_sonja", "has_key".</p>
            )}
            {formOwnedFlags.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100 mb-1">
                <input type="text" value={f.name} placeholder="state name"
                  onChange={(e) => updateFlag(idx, { name: e.target.value })}
                  className="flex-1 bg-white border border-gray-200 text-xs rounded p-1" />
                <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={f.defaultValue}
                    onChange={(e) => updateFlag(idx, { defaultValue: e.target.checked })}
                    className="w-3 h-3" />
                  default on
                </label>
                <button type="button" onClick={() => removeFlag(idx)}
                  className="text-rose-400 hover:text-rose-600 text-xs cursor-pointer">✕</button>
              </div>
            ))}
          </div>

          {/* Expressions */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Speech Tones</label>
            <TagInput tags={formExpressions} onChange={setFormExpressions} existingTags={DEFAULT_EXPRESSIONS} placeholder="Type a tone and press Enter..." />
            {formExpressions.length === 0 && (
              <p className="text-[11px] text-gray-400 italic mt-1">Defaults to Neutral, Smile, Surprise, Serious, Sad, Angry.</p>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit"
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer">
              {editingEntity ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingEntity ? "Update Entity" : "Add Entity"}
            </button>
            {editingEntity && (
              <button type="button" onClick={resetForm}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium text-sm rounded-xl cursor-pointer">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-6" id="entity-list-panel">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs" id="entity-list-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Entity Registry</h2>
          {project.entities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-xl">
              <Users className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No entities defined yet</p>
              <p className="text-xs text-gray-400 mt-1">Create characters, monsters, and NPCs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.entities.map((entity) => {
                const trackers = entity.ownedTrackers || [];
                const flags = entity.ownedFlags || [];
                const expressions = entity.expressions || [];
                return (
                  <div key={entity.id} className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50 flex flex-col justify-between" id={`entity-card-${entity.id}`}>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${textColorForHex(entity.color)}`} style={{ backgroundColor: entity.color }}>
                          {entity.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(entity)}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded cursor-pointer" title="Edit entity">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <div ref={ref}>
                            <button onClick={() => handleDeleteEntity(entity.id)}
                              className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${confirmId === entity.id ? "bg-red-600 border-red-500 text-white animate-pulse" : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"}`}
                              title={confirmId === entity.id ? "Click again to confirm" : "Delete entity"}>
                              <Trash2 className="w-3.5 h-3.5" />
                              {confirmId === entity.id && <span className="text-[9px]">Confirm?</span>}
                            </button>
                          </div>
                        </div>
                      </div>
                      {entity.description ? (
                        <p className="text-xs text-gray-600 leading-relaxed mt-1">{entity.description}</p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No description.</p>
                      )}
                      {trackers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {trackers.map((t, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">{t.name}: {t.defaultValue}</span>
                          ))}
                        </div>
                      )}
                      {flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {flags.map((f, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">{f.name}: {f.defaultValue ? "✓" : "✗"}</span>
                          ))}
                        </div>
                      )}
                      {expressions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {expressions.map((ex, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">{ex}</span>
                          ))}
                        </div>
                      )}
                      {entity.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {entity.tags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}