import React, { useEffect, useRef } from "react";

interface WikiLinkMatch {
  type: "entity" | "item" | "flag" | "tracker";
  targetId: string;
  label: string;
}

interface WikiLinkPopupProps {
  x: number;
  y: number;
  match: WikiLinkMatch;
  onAccept: () => void;
  onDismiss: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  entity: "Entity",
  item: "Item",
  flag: "Flag",
  tracker: "Tracker",
};

export default function WikiLinkPopup({ x, y, match, onAccept, onDismiss }: WikiLinkPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-slate-800 border border-indigo-500/40 rounded-lg shadow-2xl px-3 py-2 flex items-center gap-2"
      style={{ left: x, top: y }}
    >
      <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">🔗 Link</span>
      <span className="text-xs text-slate-200 font-semibold">{match.label}</span>
      <span className="text-[9px] text-slate-500 font-mono">({TYPE_LABELS[match.type]})</span>
      <button
        onClick={onAccept}
        className="ml-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded cursor-pointer transition-colors"
      >
        Link
      </button>
    </div>
  );
}

export type { WikiLinkMatch };
