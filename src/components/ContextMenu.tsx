import { useState, useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  selectedText: string;
  onClose: () => void;
  onApplyStyle: (style: string) => void;
  onApplyColor: (color: string) => void;
  onRemoveEffects: () => void;
}

type MenuLevel = "main" | "style" | "color";

const STYLE_NAMES: { key: string; label: string }[] = [
  { key: "shake", label: "Shake" },
  { key: "wiggle", label: "Wiggle" },
  { key: "glitch", label: "Glitch" },
  { key: "glow", label: "Glow" },
  { key: "whisper", label: "Whisper" },
  { key: "redacted", label: "Redacted" },
];

const COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: "Red", hex: "#f43f5e" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Green", hex: "#10b981" },
  { label: "Purple", hex: "#a855f7" },
];

function ContextMenu({ x, y, selectedText, onClose, onApplyStyle, onApplyColor, onRemoveEffects }: ContextMenuProps) {
  const [level, setLevel] = useState<MenuLevel>("main");
  const [customHex, setCustomHex] = useState("");
  const [showHexInput, setShowHexInput] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const close = () => { setLevel("main"); onClose(); };

  const menuItem = (label: string, onClick: () => void, arrow?: boolean) => (
    <button onClick={onClick} className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/60 rounded flex items-center justify-between cursor-pointer">
      <span>{label}</span>
      {arrow && <span className="text-slate-500 ml-2">▸</span>}
    </button>
  );

  const backItem = () => (
    <button onClick={() => setLevel("main")} className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700/60 rounded flex items-center gap-1.5 cursor-pointer border-b border-slate-700/50 mb-1">
      <span className="text-indigo-400">◀</span> Back
    </button>
  );

  const divider = () => <div className="h-px bg-slate-700/50 my-1" />;

  switch (level) {
    case "main":
      return (
        <div ref={menuRef} className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[200px]" style={{ left: x, top: y }}>
          <div className="px-3 py-1 text-[9px] text-slate-500 font-mono border-b border-slate-700/50 mb-1 truncate max-w-[220px]">"{selectedText.substring(0, 40)}{selectedText.length > 40 ? "..." : ""}"</div>
          {menuItem("🎨 Text Style...", () => setLevel("style"), true)}
          {menuItem("🎨 Text Color...", () => setLevel("color"), true)}
          {divider()}
          {menuItem("✕ Remove Effects", onRemoveEffects)}
        </div>
      );

    case "style":
      return (
        <div ref={menuRef} className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[180px]" style={{ left: x, top: y }}>
          {backItem()}
          {STYLE_NAMES.map(s => menuItem(s.label, () => { onApplyStyle(s.key); close(); }))}
        </div>
      );

    case "color":
      return (
        <div ref={menuRef} className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[180px]" style={{ left: x, top: y }}>
          {backItem()}
          {COLOR_PRESETS.map(c => (
            <button key={c.hex} onClick={() => { onApplyColor(c.hex); close(); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/60 rounded flex items-center gap-2 cursor-pointer">
              <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: c.hex }} />
              {c.label}
            </button>
          ))}
          {divider()}
          {!showHexInput ? (
            menuItem("Custom hex...", () => setShowHexInput(true))
          ) : (
            <div className="px-3 py-1.5">
              <input autoFocus type="text" placeholder="#000000" value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && customHex) { onApplyColor(customHex); close(); } if (e.key === "Escape") setShowHexInput(false); }}
                className="w-full bg-slate-800 border border-slate-600 text-xs rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500" />
            </div>
          )}
        </div>
      );
  }
}

export default ContextMenu;
