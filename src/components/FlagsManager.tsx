/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { VNProject, VNFlag } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Flag } from "lucide-react";

interface FlagsManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function FlagsManager({ project, onUpdateProject }: FlagsManagerProps) {
  const [flagName, setFlagName] = useState("");
  const [defaultState, setDefaultState] = useState<boolean>(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flagToConfirmDelete, setFlagToConfirmDelete] = useState<string | null>(null);
  const flagConfirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (flagConfirmRef.current && !flagConfirmRef.current.contains(event.target as Node)) {
        setFlagToConfirmDelete(null);
      }
    };
    if (flagToConfirmDelete !== null) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [flagToConfirmDelete]);

  const handleAddFlag = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = flagName.trim();
    if (!cleanName) {
      setError("Flag name cannot be empty.");
      return;
    }

    if (project.flags.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`A flag named "${cleanName}" already exists.`);
      return;
    }

    const newFlag: VNFlag = {
      id: crypto.randomUUID(),
      displayId: generateDisplayId("FLG"),
      name: cleanName,
      defaultValue: defaultState,
      description: description.trim() || undefined,
    };

    onUpdateProject({
      ...project,
      flags: [...project.flags, newFlag],
      lastModified: Date.now(),
    });

    setFlagName("");
    setDescription("");
  };

  const handleDeleteFlag = (idToDelete: string) => {
    if (flagToConfirmDelete !== idToDelete) {
      setFlagToConfirmDelete(idToDelete);
      setTimeout(() => {
        setFlagToConfirmDelete((current) => (current === idToDelete ? null : current));
      }, 4000);
      return;
    }

    setFlagToConfirmDelete(null);
    onUpdateProject({
      ...project,
      flags: project.flags.filter((f) => f.id !== idToDelete),
      lastModified: Date.now(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full overflow-y-auto" id="flags-manager-container">
      <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs h-fit" id="flag-creator-card">
        <div className="flex items-center gap-2 mb-4">
          <Flag className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Define Flags</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Create true or false statuses for tracking story branching triggers, choices made, and player milestones.
        </p>

        <form onSubmit={handleAddFlag} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flag Name</label>
            <input
              type="text"
              placeholder="e.g. met_astrid, secret_found"
              value={flagName}
              onChange={(e) => setFlagName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Default State</label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={defaultState}
                onChange={(e) => setDefaultState(e.target.checked)}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <span>{defaultState ? "Checked (True)" : "Unchecked (False)"}</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              placeholder="e.g. Set to True when player first meets Astrid."
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
            Add Flag
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-6" id="flag-list-panel">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs" id="flag-list-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Flags Registry</h2>

          {project.flags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-xl">
              <Flag className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No flags defined yet</p>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Create true or false statuses to track player decisions and story progression.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {project.flags.map((flag) => (
                <div key={flag.id} className="py-4 first:pt-0 last:pb-0" id={`flag-row-${flag.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                          {flag.name}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          Default: <span className="font-bold">{flag.defaultValue ? "True" : "False"}</span>
                        </span>
                      </div>
                      {flag.description && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{flag.description}</p>
                      )}
                    </div>
                    <div ref={flagConfirmRef}>
                      <button
                        onClick={() => handleDeleteFlag(flag.id)}
                        className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                          flagToConfirmDelete === flag.id
                            ? "bg-red-600 hover:bg-red-700 border-red-500 text-white animate-pulse"
                            : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"
                        }`}
                        title={flagToConfirmDelete === flag.id ? "Click again to confirm deletion" : "Delete flag"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {flagToConfirmDelete === flag.id && <span>Confirm?</span>}
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
