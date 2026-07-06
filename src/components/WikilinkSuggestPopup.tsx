import React, { useEffect, useState, useRef } from "react";

interface NodeMatch {
  id: string;
  title: string;
  exists: boolean;
}

interface WikilinkSuggestPopupProps {
  x: number;
  y: number;
  title: string;
  matches: NodeMatch[];
  onSelect: (match: NodeMatch) => void;
  onDismiss: () => void;
}

export default function WikilinkSuggestPopup({ x, y, title, matches, onSelect, onDismiss }: WikilinkSuggestPopupProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onDismiss]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, matches.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && matches[selectedIdx]) { e.preventDefault(); onSelect(matches[selectedIdx]); }
      if (e.key === "Escape") { e.preventDefault(); onDismiss(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [matches, selectedIdx, onSelect, onDismiss]);

  if (matches.length === 0) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 min-w-[200px]"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1 text-[9px] text-slate-500 font-mono border-b border-slate-700/50">
        Link: {title}
      </div>
      {matches.map((m, i) => (
        <button
          key={m.id}
          onClick={() => onSelect(m)}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer ${
            i === selectedIdx ? "bg-indigo-600/30 text-white" : "text-slate-200 hover:bg-slate-700/60"
          }`}
        >
          <span>
            <span className={m.exists ? "text-indigo-400" : "text-emerald-400"}>
              {m.exists ? "🔗" : "✨"}
            </span>{" "}
            {m.title}
          </span>
          <span className="text-[9px] text-slate-500 font-mono">
            {m.exists ? "Link" : "Create"}
          </span>
        </button>
      ))}
    </div>
  );
}

export type { NodeMatch };
