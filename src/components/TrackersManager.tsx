/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { VNProject, VNTracker } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Sliders } from "lucide-react";

interface TrackersManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function TrackersManager({ project, onUpdateProject }: TrackersManagerProps) {
  const [trackerName, setTrackerName] = useState("");
  const [startingValue, setStartingValue] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trackerToConfirmDelete, setTrackerToConfirmDelete] = useState<string | null>(null);
  const trackerConfirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (trackerConfirmRef.current && !trackerConfirmRef.current.contains(event.target as Node)) {
        setTrackerToConfirmDelete(null);
      }
    };
    if (trackerToConfirmDelete !== null) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [trackerToConfirmDelete]);

  const handleAddTracker = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = trackerName.trim();
    if (!cleanName) {
      setError("Tracker name cannot be empty.");
      return;
    }

    if (project.trackers.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`A tracker named "${cleanName}" already exists.`);
      return;
    }

    const newTracker: VNTracker = {
      id: crypto.randomUUID(),
      displayId: generateDisplayId("TRK"),
      name: cleanName,
      defaultValue: startingValue,
      description: description.trim() || undefined,
    };

    onUpdateProject({
      ...project,
      trackers: [...project.trackers, newTracker],
      lastModified: Date.now(),
    });

    setTrackerName("");
    setStartingValue(0);
    setDescription("");
  };

  const handleDeleteTracker = (idToDelete: string) => {
    if (trackerToConfirmDelete !== idToDelete) {
      setTrackerToConfirmDelete(idToDelete);
      setTimeout(() => {
        setTrackerToConfirmDelete((current) => (current === idToDelete ? null : current));
      }, 4000);
      return;
    }

    setTrackerToConfirmDelete(null);
    onUpdateProject({
      ...project,
      trackers: project.trackers.filter((t) => t.id !== idToDelete),
      lastModified: Date.now(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full overflow-y-auto" id="trackers-manager-container">
      <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs h-fit" id="tracker-creator-card">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Define Trackers</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Create numeric trackers to keep score of player stats, resources, or progression through your story.
        </p>

        <form onSubmit={handleAddTracker} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tracker Name</label>
            <input
              type="text"
              placeholder="e.g. Courage, Gold, Relationship"
              value={trackerName}
              onChange={(e) => setTrackerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Starting Value</label>
            <input
              type="number"
              value={startingValue}
              onChange={(e) => setStartingValue(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              placeholder="e.g. Tracks the player's courage level throughout the story."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Tracker
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-6" id="tracker-list-panel">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs" id="tracker-list-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trackers Registry</h2>

          {project.trackers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-xl">
              <Sliders className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No trackers defined yet</p>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Create numeric trackers for player stats, resources, and story progression.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {project.trackers.map((tracker) => (
                <div key={tracker.id} className="py-4 first:pt-0 last:pb-0" id={`tracker-row-${tracker.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                          {tracker.name}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          Start: <span className="font-bold">{tracker.defaultValue}</span>
                        </span>
                      </div>
                      {tracker.description && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{tracker.description}</p>
                      )}
                    </div>
                    <div ref={trackerConfirmRef}>
                      <button
                        onClick={() => handleDeleteTracker(tracker.id)}
                        className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                          trackerToConfirmDelete === tracker.id
                            ? "bg-red-600 hover:bg-red-700 border-red-500 text-white animate-pulse"
                            : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"
                        }`}
                        title={trackerToConfirmDelete === tracker.id ? "Click again to confirm deletion" : "Delete tracker"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {trackerToConfirmDelete === tracker.id && <span>Confirm?</span>}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
