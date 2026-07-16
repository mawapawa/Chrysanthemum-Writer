import { useState, useEffect } from "react";
import { Save, Upload, Trash2, X, Clock } from "lucide-react";
import type { SaveData } from "../types";
import { listSlots, saveSlot, loadSlot, deleteSlot, getMaxSlots } from "../services/saveLoad";

interface SaveLoadDialogProps {
  mode: "save" | "load";
  currentSaveData?: Omit<SaveData, "slot" | "timestamp" | "name"> & { nodeTitle?: string };
  onLoad: (data: SaveData) => void;
  onClose: () => void;
}

export default function SaveLoadDialog({ mode, currentSaveData, onLoad, onClose }: SaveLoadDialogProps) {
  const [slots, setSlots] = useState<(SaveData | null)[]>([]);
  const [editName, setEditName] = useState<string>("");
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const maxSlots = getMaxSlots();

  useEffect(() => {
    setSlots(listSlots());
  }, []);

  const refresh = () => setSlots(listSlots());

  const handleSave = (slot: number) => {
    if (!currentSaveData) return;
    const name = editSlot === slot && editName.trim() ? editName.trim() : `Slot ${slot + 1}`;
    saveSlot(slot, { ...currentSaveData, name, slot, timestamp: Date.now() });
    setEditSlot(null);
    setEditName("");
    refresh();
  };

  const handleLoad = (slot: number) => {
    const data = loadSlot(slot);
    if (data) onLoad(data);
  };

  const handleDelete = (slot: number) => {
    deleteSlot(slot);
    refresh();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            {mode === "save" ? <Save className="w-4 h-4 text-emerald-400" /> : <Upload className="w-4 h-4 text-indigo-400" />}
            {mode === "save" ? "Save Game" : "Load Game"}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {Array.from({ length: maxSlots }, (_, i) => {
            const slot = slots[i];
            return (
              <div key={i} className={`glass-card p-3 flex items-center justify-between ${slot ? "" : "opacity-60"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 w-6">S{i + 1}</span>
                    {slot ? (
                      <>
                        <span className="text-xs font-bold text-white truncate">{slot.name}</span>
                        <span className="text-[9px] text-slate-500 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" /> {formatDate(slot.timestamp)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Empty Slot</span>
                    )}
                  </div>
                  {slot?.nodeTitle && (
                    <p className="text-[10px] text-slate-400 ml-8 mt-0.5 truncate">{slot.nodeTitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {mode === "save" && (
                    editSlot === i ? (
                      <div className="flex items-center gap-1">
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          placeholder="Save name..."
                          className="w-24 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-200 outline-none focus:border-indigo-500"
                          autoFocus />
                        <button onClick={() => handleSave(i)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditSlot(i); setEditName(slot?.name ?? ""); }}
                        className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white text-[9px] font-bold rounded-lg cursor-pointer flex items-center gap-1">
                        <Save className="w-3 h-3" /> {slot ? "Overwrite" : "Save"}
                      </button>
                    )
                  )}
                  {mode === "load" && slot && (
                    <>
                      <button onClick={() => handleLoad(i)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded-lg cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3" /> Load
                      </button>
                      <button onClick={() => handleDelete(i)}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-slate-600 mt-4 text-center">
          {mode === "save" ? "Saved to browser localStorage" : "Progress is stored locally in this browser"}
        </p>
      </div>
    </div>
  );
}