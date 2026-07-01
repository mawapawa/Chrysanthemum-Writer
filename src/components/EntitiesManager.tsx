/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { VNProject, VNEntity } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Users, Check } from "lucide-react";

interface EntitiesManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

const ENTITY_PALETTE_COLORS = [
  "#f43f5e",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ea580c",
  "#ec4899",
  "#64748b",
];

function textColorForHex(hex: string): string {
  const val = parseInt(hex.replace("#", ""), 16);
  const r = (val >> 16) & 0xff, g = (val >> 8) & 0xff, b = val & 0xff;
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? "text-slate-950" : "text-white";
}

export default function EntitiesManager({ project, onUpdateProject }: EntitiesManagerProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(ENTITY_PALETTE_COLORS[0]);
  const [useCustomHex, setUseCustomHex] = useState(false);
  const [customHex, setCustomHex] = useState("#");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entityToConfirmDelete, setEntityToConfirmDelete] = useState<string | null>(null);
  const entityConfirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (entityConfirmRef.current && !entityConfirmRef.current.contains(event.target as Node)) {
        setEntityToConfirmDelete(null);
      }
    };
    if (entityToConfirmDelete !== null) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [entityToConfirmDelete]);

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Entity name cannot be empty.");
      return;
    }

    if (project.entities.some((ent) => ent.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`An entity named "${cleanName}" already exists.`);
      return;
    }

    const finalColor = useCustomHex && /^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : color;

    const newEntity: VNEntity = {
      id: crypto.randomUUID(),
      displayId: generateDisplayId("ENT"),
      name: cleanName,
      color: finalColor,
      description: description.trim() || undefined,
    };

    onUpdateProject({
      ...project,
      entities: [...project.entities, newEntity],
      lastModified: Date.now(),
    });

    setName("");
    setDescription("");
  };

  const handleDeleteEntity = (idToDelete: string) => {
    if (entityToConfirmDelete !== idToDelete) {
      setEntityToConfirmDelete(idToDelete);
      setTimeout(() => {
        setEntityToConfirmDelete((current) => (current === idToDelete ? null : current));
      }, 4000);
      return;
    }

    setEntityToConfirmDelete(null);
    onUpdateProject({
      ...project,
      entities: project.entities.filter((ent) => ent.id !== idToDelete),
      lastModified: Date.now(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full overflow-y-auto" id="entities-manager-container">
      <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs h-fit" id="entity-creator-card">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Define Entities</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Create entities (factions, organizations, or groups) and assign them a color identity for visual distinction.
        </p>

        <form onSubmit={handleAddEntity} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Entity Name</label>
            <input
              type="text"
              placeholder="e.g. Forest Guard, Shadow Cabal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Entity Color</label>
            <div className="grid grid-cols-4 gap-2">
              {ENTITY_PALETTE_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => { setColor(c); setUseCustomHex(false); }}
                  style={{ backgroundColor: c }}
                  className={`h-10 rounded-xl flex items-center justify-center cursor-pointer transition-transform ${
                    color === c && !useCustomHex ? "ring-4 ring-indigo-500/35 scale-105" : "hover:scale-102"
                  }`}
                >
                  {color === c && !useCustomHex && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomHex}
                  onChange={(e) => setUseCustomHex(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded"
                />
                <span>Use Custom Hex Code</span>
              </label>
              {useCustomHex && (
                <input
                  type="text"
                  placeholder="#000000"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              placeholder="e.g. A secret organization pulling the strings from the shadows."
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
            Add Entity
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-6" id="entity-list-panel">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs" id="entity-list-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Entity Registry</h2>

          {project.entities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-xl">
              <Users className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No entities defined yet</p>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Create entities like factions, guilds, or organizations to populate your story world.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.entities.map((entity) => (
                <div
                  key={entity.id}
                  className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50 flex flex-col justify-between"
                  id={`entity-card-${entity.id}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${textColorForHex(entity.color)}`} style={{ backgroundColor: entity.color }}>
                        {entity.name}
                      </span>
                      <div ref={entityConfirmRef}>
                        <button
                          onClick={() => handleDeleteEntity(entity.id)}
                          className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                            entityToConfirmDelete === entity.id
                              ? "bg-red-600 hover:bg-red-700 border-red-500 text-white animate-pulse"
                              : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"
                          }`}
                          title={entityToConfirmDelete === entity.id ? "Click again to confirm deletion" : "Remove entity"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {entityToConfirmDelete === entity.id && <span>Confirm?</span>}
                        </button>
                      </div>
                    </div>
                    {entity.description ? (
                      <p className="text-xs text-gray-600 leading-relaxed mt-1">{entity.description}</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No description provided.</p>
                    )}
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
