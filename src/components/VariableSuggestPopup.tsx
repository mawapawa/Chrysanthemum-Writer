import React, { useEffect, useState, useRef } from "react";

interface Suggestion {
  id: string;
  name: string;
  type: "tracker" | "flag";
  defaultValue: number | boolean;
}

interface VariableSuggestPopupProps {
  x: number;
  y: number;
  query: string;
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  onDismiss: () => void;
}

export default function VariableSuggestPopup({
  x, y, query, suggestions, onSelect, onDismiss,
}: VariableSuggestPopupProps) {
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
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && suggestions[selectedIdx]) { e.preventDefault(); onSelect(suggestions[selectedIdx]); }
      if (e.key === "Escape") { e.preventDefault(); onDismiss(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [suggestions, selectedIdx, onSelect, onDismiss]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  if (suggestions.length === 0) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1 text-[9px] text-slate-500 font-mono border-b border-slate-700/50">
        {query ? `"${query}"` : "Type a name..."}
      </div>
      {suggestions.map((s, i) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer ${
            i === selectedIdx ? "bg-indigo-600/30 text-white" : "text-slate-200 hover:bg-slate-700/60"
          }`}
        >
          <span>
            <span className={s.type === "tracker" ? "text-emerald-400" : "text-amber-400"}>
              {s.type === "tracker" ? "#" : "✓"}
            </span>{" "}
            {s.name}
          </span>
          <span className="text-[9px] text-slate-500 font-mono">
            {s.type === "tracker" ? `= ${s.defaultValue}` : s.defaultValue ? "on" : "off"}
          </span>
        </button>
      ))}
    </div>
  );
}

export type { Suggestion };
