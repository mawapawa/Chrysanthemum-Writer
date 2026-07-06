import React, { useState, useEffect, useRef } from "react";
import { VNEntity, VNItem, VNFlag, VNTracker } from "../types";

interface ContextMenuProps {
  x: number;
  y: number;
  selectedText: string;
  onClose: () => void;
  onAssignSpeaker: (speaker: string) => void;
  onGiveItem: (itemId: string, itemName: string) => void;
  onTakeItem: (itemId: string, itemName: string) => void;
  onRequireFlag: (flagId: string, flagName: string) => void;
  onApplyStyle: (style: string) => void;
  onApplyColor: (color: string) => void;
  onRemoveEffects: () => void;
  onAdjustTracker: (trackerId: string, operation: string, value: number, trackerName: string) => void;
  entities: VNEntity[];
  inventory: VNItem[];
  flags: VNFlag[];
  trackers: VNTracker[];
}

type MenuLevel =
  | "main"
  | "speaker"
  | "gear"
  | "gearGive"
  | "gearTake"
  | "flags"
  | "adjustStat"
  | "style"
  | "color";

const STYLE_NAMES: { key: string; label: string }[] = [
  { key: "shake", label: "Shake" },
  { key: "glitch", label: "Glitch" },
  { key: "glow", label: "Glow" },
  { key: "whisper", label: "Whisper" },
];

const COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: "Red", hex: "#f43f5e" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Green", hex: "#10b981" },
  { label: "Purple", hex: "#a855f7" },
];

function ContextMenu({
  x, y, selectedText, onClose,
  onAssignSpeaker, onGiveItem, onTakeItem, onRequireFlag,
  onApplyStyle, onApplyColor, onRemoveEffects, onAdjustTracker,
  entities, inventory, flags, trackers,
}: ContextMenuProps) {
  const [level, setLevel] = useState<MenuLevel>("main");
  const [customHex, setCustomHex] = useState("");
  const [showHexInput, setShowHexInput] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const close = () => { setLevel("main"); onClose(); };

  const menuItem = (label: string, onClick: () => void, arrow?: boolean) => (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/60 rounded flex items-center justify-between cursor-pointer"
    >
      <span>{label}</span>
      {arrow && <span className="text-slate-500 ml-2">▸</span>}
    </button>
  );

  const backItem = () => (
    <button
      onClick={() => setLevel("main")}
      className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700/60 rounded flex items-center gap-1.5 cursor-pointer border-b border-slate-700/50 mb-1"
    >
      <span className="text-indigo-400">◀</span> Back
    </button>
  );

  const divider = () => <div className="h-px bg-slate-700/50 my-1" />;

  const renderLevel = () => {
    switch (level) {
      case "main":
        return (
          <>
            {menuItem("📝 Assign Speaker...", () => setLevel("speaker"), true)}
            {menuItem("🎒 Items...", () => setLevel("gear"), true)}
            {menuItem("🏁 Flag...", () => setLevel("flags"), true)}
            {menuItem("📊 Adjust Stat...", () => setLevel("adjustStat"), true)}
            {divider()}
            {menuItem("🎨 Text Style...", () => setLevel("style"), true)}
            {menuItem("🎨 Text Color...", () => setLevel("color"), true)}
            {divider()}
            {menuItem("✕ Remove Effects", onRemoveEffects)}
          </>
        );

      case "speaker":
        return (
          <>
            {backItem()}
            {menuItem("📖 Narration", () => { onAssignSpeaker("Narrator"); close(); })}
            {divider()}
            {entities.map(e => menuItem(e.name, () => { onAssignSpeaker(e.name); close(); }))}
          </>
        );

      case "gear":
        return (
          <>
            {backItem()}
            {menuItem("➕ Give Item...", () => setLevel("gearGive"), true)}
            {menuItem("➖ Take Item...", () => setLevel("gearTake"), true)}
          </>
        );

      case "gearGive":
        return (
          <>
            {backItem()}
            {inventory.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-slate-500 italic">No items defined</div>
            )}
            {inventory.map(item => menuItem(item.name, () => { onGiveItem(item.id, item.name); close(); }))}
          </>
        );

      case "gearTake":
        return (
          <>
            {backItem()}
            {inventory.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-slate-500 italic">No items defined</div>
            )}
            {inventory.map(item => menuItem(item.name, () => { onTakeItem(item.id, item.name); close(); }))}
          </>
        );

      case "flags":
        return (
          <>
            {backItem()}
            {flags.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-slate-500 italic">No flags defined</div>
            )}
            {flags.map(f => menuItem(`${f.name} (${f.defaultValue ? "on" : "off"})`, () => { onRequireFlag(f.id, f.name); close(); }))}
          </>
        );

      case "adjustStat":
        return (
          <>
            {backItem()}
            {trackers.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-slate-500 italic">No trackers defined</div>
            )}
            {trackers.map(t => (
              <div key={t.id} className="px-2 py-1">
                <div className="text-[10px] text-slate-400 mb-0.5">{t.name}</div>
                <div className="flex gap-1">
                  <button onClick={() => { onAdjustTracker(t.id, "set", t.defaultValue, t.name); close(); }} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300 rounded cursor-pointer">Set = {t.defaultValue}</button>
                  <button onClick={() => { onAdjustTracker(t.id, "add", 1, t.name); close(); }} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300 rounded cursor-pointer">+1</button>
                  <button onClick={() => { onAdjustTracker(t.id, "subtract", 1, t.name); close(); }} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300 rounded cursor-pointer">-1</button>
                </div>
              </div>
            ))}
          </>
        );

      case "style":
        return (
          <>
            {backItem()}
            {STYLE_NAMES.map(s => menuItem(s.label, () => { onApplyStyle(s.key); close(); }))}
          </>
        );

      case "color":
        return (
          <>
            {backItem()}
            {COLOR_PRESETS.map(c => (
              <button
                key={c.hex}
                onClick={() => { onApplyColor(c.hex); close(); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/60 rounded flex items-center gap-2 cursor-pointer"
              >
                <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: c.hex }} />
                {c.label}
              </button>
            ))}
            {divider()}
            {!showHexInput ? (
              menuItem("Custom hex...", () => setShowHexInput(true))
            ) : (
              <div className="px-3 py-1.5">
                <input
                  autoFocus
                  type="text"
                  placeholder="#ff4a6b"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customHex) { onApplyColor(customHex); close(); }
                    if (e.key === "Escape") setShowHexInput(false);
                  }}
                  className="w-full bg-slate-800 border border-slate-600 text-xs rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[200px]"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1 text-[9px] text-slate-500 font-mono border-b border-slate-700/50 mb-1 truncate max-w-[220px]">
        "{selectedText.substring(0, 40)}{selectedText.length > 40 ? "..." : ""}"
      </div>
      {renderLevel()}
    </div>
  );
}

export default ContextMenu;
