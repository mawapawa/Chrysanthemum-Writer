/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { VNProject, VNItem } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Package } from "lucide-react";
import TagInput from "./TagInput";

interface ItemsManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function ItemsManager({ project, onUpdateProject }: ItemsManagerProps) {
  const allItemTags = [...new Set(project.inventory.flatMap(i => i.tags))];
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [itemToConfirmDelete, setItemToConfirmDelete] = useState<string | null>(null);
  const itemConfirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (itemConfirmRef.current && !itemConfirmRef.current.contains(event.target as Node)) {
        setItemToConfirmDelete(null);
      }
    };
    if (itemToConfirmDelete !== null) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [itemToConfirmDelete]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = itemName.trim();
    if (!cleanName) {
      setError("Item name cannot be empty.");
      return;
    }

    if (project.inventory.some((i) => i.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`An item named "${cleanName}" already exists.`);
      return;
    }

    const newItem: VNItem = {
      id: crypto.randomUUID(),
      displayId: generateDisplayId("ITM"),
      name: cleanName,
      description: description.trim() || undefined,
      tags: [...formTags],
    };

    onUpdateProject({
      ...project,
      inventory: [...project.inventory, newItem],
      lastModified: Date.now(),
    });

    setItemName("");
    setDescription("");
    setFormTags([]);
  };

  const handleDeleteItem = (idToDelete: string) => {
    if (itemToConfirmDelete !== idToDelete) {
      setItemToConfirmDelete(idToDelete);
      setTimeout(() => {
        setItemToConfirmDelete((current) => (current === idToDelete ? null : current));
      }, 4000);
      return;
    }

    setItemToConfirmDelete(null);
    onUpdateProject({
      ...project,
      inventory: project.inventory.filter((i) => i.id !== idToDelete),
      lastModified: Date.now(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full overflow-y-auto" id="items-manager-container">
      <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs h-fit" id="item-creator-card">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Define Items</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Create inventory items that players can collect, use, and trade throughout your visual novel.
        </p>

        <form onSubmit={handleAddItem} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Item Name</label>
            <input
              type="text"
              placeholder="e.g. Ancient Key, Healing Herb"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              placeholder="e.g. A rusty old key that opens the cellar door."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tags</label>
            <TagInput
              tags={formTags}
              onChange={setFormTags}
              existingTags={allItemTags}
              placeholder="Add tag and press Enter..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-6" id="item-list-panel">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs" id="item-list-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory Registry</h2>

          {project.inventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-xl">
              <Package className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No items defined yet</p>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Add items to your game's inventory that players can find, collect, and use.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.inventory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50 flex flex-col justify-between"
                  id={`item-card-${item.id}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                        {item.name}
                      </span>
                      <div ref={itemConfirmRef}>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                            itemToConfirmDelete === item.id
                              ? "bg-red-600 hover:bg-red-700 border-red-500 text-white animate-pulse"
                              : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"
                          }`}
                          title={itemToConfirmDelete === item.id ? "Click again to confirm deletion" : "Remove item"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {itemToConfirmDelete === item.id && <span>Confirm?</span>}
                        </button>
                      </div>
                    </div>
                    {item.description ? (
                      <p className="text-xs text-gray-600 leading-relaxed mt-1">{item.description}</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No description provided.</p>
                    )}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">
                            {tag}
                          </span>
                        ))}
                      </div>
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
