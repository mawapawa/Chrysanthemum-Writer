import React, { useState } from "react";
import { VNProject, VNFlag } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Flag } from "lucide-react";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { ManagerLayout } from "./ManagerLayout";
import { EmptyState } from "./EmptyState";

interface FlagsManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function FlagsManager({ project, onUpdateProject }: FlagsManagerProps) {
  const [flagName, setFlagName] = useState("");
  const [defaultState, setDefaultState] = useState<boolean>(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { confirmId, ref, requestDelete } = useConfirmDelete();

  const handleAddFlag = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = flagName.trim();
    if (!cleanName) { setError("Flag name cannot be empty."); return; }
    if (project.flags.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`A flag named "${cleanName}" already exists.`); return;
    }
    const newFlag: VNFlag = { id: crypto.randomUUID(), displayId: generateDisplayId("FLG"), name: cleanName, defaultValue: defaultState, description: description.trim() || undefined };
    onUpdateProject({ ...project, flags: [...project.flags, newFlag], lastModified: Date.now() });
    setFlagName(""); setDescription("");
  };

  const handleDelete = (id: string) => {
    if (!requestDelete(id)) return;
    onUpdateProject({ ...project, flags: project.flags.filter((f) => f.id !== id), lastModified: Date.now() });
  };

  return (
    <ManagerLayout icon={Flag} title="Define Flags" listTitle="Flags Registry"
      description="Create true or false statuses for tracking story branching triggers, choices made, and player milestones."
      form={
        <form onSubmit={handleAddFlag} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flag Name</label>
            <input type="text" placeholder="e.g. met_astrid, secret_found" value={flagName} onChange={(e) => setFlagName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Default State</label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={defaultState} onChange={(e) => setDefaultState(e.target.checked)}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded" />
              <span>{defaultState ? "Checked (True)" : "Unchecked (False)"}</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea placeholder="e.g. Set to True when player first meets Astrid." value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button type="submit" className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer">
            <Plus className="w-4 h-4" /> Add Flag
          </button>
        </form>
      }
    >
      {project.flags.length === 0 ? (
        <EmptyState icon={Flag} text="No flags defined yet" subtext="Create true or false statuses to track player decisions and story progression." />
      ) : (
        <div className="divide-y divide-gray-100">
          {project.flags.map((flag) => (
            <div key={flag.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">{flag.name}</span>
                    <span className="text-xs text-gray-400 font-mono">Default: <span className="font-bold">{flag.defaultValue ? "True" : "False"}</span></span>
                  </div>
                  {flag.description && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{flag.description}</p>}
                </div>
                <div ref={ref}>
                  <button onClick={() => handleDelete(flag.id)}
                    className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                      confirmId === flag.id ? "bg-red-600 border-red-500 text-white animate-pulse" : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"
                    }`}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmId === flag.id && <span>Confirm?</span>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}
