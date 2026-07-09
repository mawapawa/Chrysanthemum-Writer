import React, { useState, useEffect, useRef } from "react";
import { VNProject } from "../types";

interface SearchResult {
  type: "node" | "entity" | "item" | "flag" | "tracker";
  id: string;
  label: string;
  context: string;
}

interface SearchPaletteProps {
  project: VNProject;
  onSelectNode: (nodeId: string) => void;
  onSwitchTab: (tab: string) => void;
  onClose: () => void;
}

const CATEGORIES: Record<string, { icon: string; tab: string; label: string }> = {
  node: { icon: "📄", tab: "storyboard", label: "Node" },
  entity: { icon: "👤", tab: "entities", label: "Entity" },
  item: { icon: "📦", tab: "items", label: "Item" },
  flag: { icon: "🏁", tab: "flags", label: "Flag" },
  tracker: { icon: "📊", tab: "trackers", label: "Tracker" },
};

export default function SearchPalette({ project, onSelectNode, onSwitchTab, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allResults.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && allResults[selectedIdx]) {
        e.preventDefault();
        handleSelect(allResults[selectedIdx]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [query, selectedIdx, onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const allResults: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  if (q) {
    Object.values(project.nodes).forEach(n => {
      if (n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)) {
        allResults.push({ type: "node", id: n.id, label: n.title, context: n.description.substring(0, 60) });
      }
    });
    project.entities.forEach(e => {
      if (e.name.toLowerCase().includes(q)) allResults.push({ type: "entity", id: e.id, label: e.name, context: e.description || "" });
    });
    project.inventory.forEach(i => {
      if (i.name.toLowerCase().includes(q)) allResults.push({ type: "item", id: i.id, label: i.name, context: i.description || "" });
    });
    project.flags.forEach(f => {
      if (f.name.toLowerCase().includes(q)) allResults.push({ type: "flag", id: f.id, label: f.name, context: f.description || "" });
    });
    project.trackers.forEach(t => {
      if (t.name.toLowerCase().includes(q)) allResults.push({ type: "tracker", id: t.id, label: t.name, context: t.description || "" });
    });
  }

  const handleSelect = (r: SearchResult) => {
    if (r.type === "node") {
      onSwitchTab("storyboard");
      onSelectNode(r.id);
    } else {
      onSwitchTab(CATEGORIES[r.type].tab);
    }
    onClose();
  };

  const grouped = allResults.slice(0, 30);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-slate-950/60 backdrop-blur-sm">
      <div ref={overlayRef} className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-3 border-b border-slate-800">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search nodes, entities, items, flags, trackers..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            className="w-full bg-slate-800 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {q && grouped.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500 italic">No results for "{q}"</div>
          )}
          {!q && (
            <div className="p-4 text-center text-xs text-slate-500 italic">Type to search across all project data...</div>
          )}
          {grouped.map((r, i) => {
            const cat = CATEGORIES[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 cursor-pointer ${
                  i === selectedIdx ? "bg-indigo-600/25 text-white" : "text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{r.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {cat.label}{r.context ? ` — ${r.context}` : ""}
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-600 uppercase shrink-0">{cat.tab}</span>
              </button>
            );
          })}
        </div>
        <div className="p-2 border-t border-slate-800 flex items-center justify-center gap-3 text-[10px] text-slate-500">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
