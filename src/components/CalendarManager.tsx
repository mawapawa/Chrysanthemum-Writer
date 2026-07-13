import { useState } from "react";
import { VNProject, CalendarPeriod, CalendarCondition } from "../types";
import { Plus, Trash2, Clock } from "lucide-react";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { ManagerLayout } from "./ManagerLayout";
import { EmptyState } from "./EmptyState";

interface CalendarManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

function ConditionRow({ condition, trackers, onChange, onRemove }: {
  condition: CalendarCondition;
  trackers: Array<{ id: string; name: string }>;
  onChange: (c: CalendarCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <select value={condition.trackerId} onChange={e => onChange({ ...condition, trackerId: e.target.value })}
        className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1">
        {trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select value={condition.operator} onChange={e => onChange({ ...condition, operator: e.target.value as CalendarCondition["operator"] })}
        className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1">
        <option value=">=">≥</option>
        <option value="<=">≤</option>
        <option value=">">&gt;</option>
        <option value="<">&lt;</option>
        <option value="==">=</option>
        <option value="!=">≠</option>
      </select>
      <input type="number" value={condition.value} onChange={e => onChange({ ...condition, value: parseInt(e.target.value) || 0 })}
        className="w-14 bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1 text-center" />
      <button onClick={onRemove} className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
    </div>
  );
}

export default function CalendarManager({ project, onUpdateProject }: CalendarManagerProps) {
  const calendar = project.calendar || [];
  const trackers = project.trackers;
  const { confirmId, ref, requestDelete } = useConfirmDelete();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editConditions, setEditConditions] = useState<CalendarCondition[]>([]);

  const resetForm = () => {
    setEditingId(null);
    setEditName("");
    setEditConditions([]);
  };

  const startAdd = () => {
    if (trackers.length === 0) { alert("Create at least one tracker first (e.g. 'hour', 'day')."); return; }
    setEditingId("new");
    setEditName("");
    setEditConditions([{ trackerId: trackers[0].id, operator: ">=", value: 0 }]);
  };

  const startEdit = (p: CalendarPeriod) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditConditions(p.conditions.map(c => ({ ...c })));
  };

  const save = () => {
    if (!editName.trim() || editConditions.length === 0) return;
    const updated: CalendarPeriod = {
      id: editingId === "new" ? crypto.randomUUID() : editingId!,
      name: editName.trim(),
      conditions: editConditions,
    };
    const existing = calendar.filter(p => p.id !== updated.id);
    onUpdateProject({ ...project, calendar: [...existing, updated], lastModified: Date.now() });
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!requestDelete(id)) return;
    onUpdateProject({ ...project, calendar: calendar.filter(p => p.id !== id), lastModified: Date.now() });
  };

  const addCondition = () => {
    if (trackers.length === 0) return;
    setEditConditions([...editConditions, { trackerId: trackers[0].id, operator: ">=", value: 0 }]);
  };

  const updateCondition = (idx: number, c: CalendarCondition) => {
    setEditConditions(editConditions.map((oc, i) => i === idx ? c : oc));
  };

  const removeCondition = (idx: number) => {
    setEditConditions(editConditions.filter((_, i) => i !== idx));
  };

  return (
    <ManagerLayout icon={Clock} title="Calendar Periods" listTitle="Periods"
      description="Define time periods using tracker conditions. Locations can then be set to open during specific periods."
      form={
        <div className="space-y-4">
          {editingId && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Period Name</label>
                <input type="text" placeholder="e.g. Daytime, Night, Rainy Week" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-400">Conditions</label>
                  <button onClick={addCondition} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">+ Add Condition</button>
                </div>
                <div className="space-y-1">
                  {editConditions.map((c, i) => (
                    <ConditionRow key={i} condition={c} trackers={trackers}
                      onChange={nc => updateCondition(i, nc)} onRemove={() => removeCondition(i)} />
                  ))}
                </div>
                {editConditions.length === 0 && <p className="text-[11px] text-slate-500 italic">Add at least one condition.</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={!editName.trim() || editConditions.length === 0}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:cursor-not-allowed">
                  Save Period
                </button>
                <button onClick={resetForm} className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer">
                  Cancel
                </button>
              </div>
            </>
          )}
          {!editingId && (
            <button onClick={startAdd} className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4" /> Add Period
            </button>
          )}
        </div>
      }
    >
      {calendar.length === 0 ? (
        <EmptyState icon={Clock} text="No periods defined yet" subtext="Define time periods to control when locations are open or closed." />
      ) : (
        <div className="divide-y divide-slate-800">
          {calendar.map(p => {
            const condText = p.conditions.map(c => {
              const t = trackers.find(tr => tr.id === c.trackerId);
              return `${t?.name || c.trackerId} ${c.operator} ${c.value}`;
            }).join(", ");
            return (
              <div key={p.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">{p.name}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{condText}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(p)} className="p-1 text-slate-400 hover:text-indigo-400 cursor-pointer text-xs">✏️</button>
                    <div ref={ref}>
                      <button onClick={() => handleDelete(p.id)}
                        className={`text-xs px-2 py-1 rounded-lg border font-bold cursor-pointer ${confirmId === p.id ? "bg-red-600 border-red-500 text-white animate-pulse" : "text-slate-400 hover:text-red-400 border-transparent"}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmId === p.id && <span>Confirm?</span>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ManagerLayout>
  );
}
