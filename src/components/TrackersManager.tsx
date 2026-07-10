/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { VNProject, VNTracker } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Sliders } from "lucide-react";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { ManagerLayout } from "./ManagerLayout";
import { EmptyState } from "./EmptyState";

interface TrackersManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function TrackersManager({ project, onUpdateProject }: TrackersManagerProps) {
  const [trackerName, setTrackerName] = useState("");
  const [startingValue, setStartingValue] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { confirmId, ref, requestDelete } = useConfirmDelete();

  const handleAddTracker = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = trackerName.trim();
    if (!cleanName) { setError("Tracker name cannot be empty."); return; }
    if (project.trackers.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`A tracker named "${cleanName}" already exists.`); return;
    }
    const newTracker: VNTracker = { id: crypto.randomUUID(), displayId: generateDisplayId("TRK"), name: cleanName, defaultValue: startingValue, description: description.trim() || undefined };
    onUpdateProject({ ...project, trackers: [...project.trackers, newTracker], lastModified: Date.now() });
    setTrackerName(""); setStartingValue(0); setDescription("");
  };

  const handleDelete = (id: string) => {
    if (!requestDelete(id)) return;
    onUpdateProject({ ...project, trackers: project.trackers.filter((t) => t.id !== id), lastModified: Date.now() });
  };

  return (
    <ManagerLayout
      icon={Sliders} title="Define Stats"
      description="Create numeric stats to track player resources, attributes, and progression."
      listTitle="Stats Registry"
      form={
        <form onSubmit={handleAddTracker} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Stat Name</label>
            <input type="text" placeholder="e.g. Courage, Gold, Relationship" value={trackerName} onChange={(e) => setTrackerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Starting Value</label>
            <input type="number" value={startingValue} onChange={(e) => setStartingValue(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea placeholder="e.g. Tracks the player's courage level throughout the story." value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button type="submit" className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer">
            <Plus className="w-4 h-4" /> Add Stat
          </button>
        </form>
      }
    >
      {project.trackers.length === 0 ? (
        <EmptyState icon={Sliders} text="No stats defined yet" subtext="Create numeric stats for player resources, attributes, and story progression." />
      ) : (
        <div className="divide-y divide-gray-100">
          {project.trackers.map((tracker) => (
            <div key={tracker.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">{tracker.name}</span>
                    <span className="text-xs text-gray-400 font-mono">Start: <span className="font-bold">{tracker.defaultValue}</span></span>
                  </div>
                  {tracker.description && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{tracker.description}</p>}
                </div>
                <div ref={ref}>
                  <button onClick={() => handleDelete(tracker.id)}
                    className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                      confirmId === tracker.id ? "bg-red-600 border-red-500 text-white animate-pulse" : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"
                    }`}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmId === tracker.id && <span>Confirm?</span>}
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
