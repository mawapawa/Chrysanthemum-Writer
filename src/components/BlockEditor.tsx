import React, { useState, useCallback, useRef, useEffect } from "react";
import { VNProject, SceneBlock } from "../types";
import { Plus } from "lucide-react";

interface BlockEditorProps {
  project: VNProject;
  blocks: SceneBlock[];
  onChange: (blocks: SceneBlock[]) => void;
  onCreateNode?: () => string;
}

type BlockAction = keyof typeof BLOCK_LABELS;

const BLOCK_LABELS = {
  dialogue: { icon: "💬", label: "Dialogue" },
  narrative: { icon: "📝", label: "Narrative" },
  effect: { icon: "📊", label: "Effect" },
  statDisplay: { icon: "📈", label: "Stat" },
  choice: { icon: "🔗", label: "Link" },
  entity: { icon: "👤", label: "Entity" },
  condition: { icon: "👁️", label: "Condition" },
  continue: { icon: "🔀", label: "Redirect" },
  ending: { icon: "🏁", label: "Ending" },
  flag: { icon: "🚩", label: "Flag" },
  bgm: { icon: "🎵", label: "BGM" },
  sfx: { icon: "💥", label: "SFX" },
  background: { icon: "🖼️", label: "Background" },
  delay: { icon: "⏳", label: "Delay" },
  itemEffect: { icon: "🎒", label: "Item" },
} as const;

const BLOCK_ACTIONS = Object.entries(BLOCK_LABELS).map(([key, v]) => ({ key: key as BlockAction, ...v }));

function blockToBadgeHTML(block: SceneBlock, project: VNProject): string {
  const cls = `cm-badge cm-badge-${block.type}`;
  const data = encodeURIComponent(JSON.stringify(block));
  let label = "";
  switch (block.type) {
    case "dialogue": label = `${BLOCK_LABELS.dialogue.icon} ${block.speaker}: "${block.text}"`; break;
    case "effect": label = `${BLOCK_LABELS.effect.icon} ${block.operation}${block.value} ${block.variableName}`; break;
    case "statDisplay": label = `${BLOCK_LABELS.statDisplay.icon} ${block.variableName}: ?`; break;
    case "choice": label = `${BLOCK_LABELS.choice.icon} ${block.text}`; break;
    case "entity": { const e = project.entities.find(en => en.id === block.entityId); label = `${BLOCK_LABELS.entity.icon} ${e?.name || "?"}`; break; }
    case "condition": label = `${BLOCK_LABELS.condition.icon} if: ${block.condition?.source || "?"}`; break;
    case "continue": { const t = project.nodes[block.targetNodeId]; label = `${BLOCK_LABELS.continue.icon} ${t?.title || "?"}`; break; }
    case "ending": label = `${BLOCK_LABELS.ending.icon} ${block.endingType}${block.endingName ? `: ${block.endingName}` : ""}`; break;
    case "flag": label = `${BLOCK_LABELS.flag.icon} ${block.flagName} = ${block.flagValue}`; break;
    case "bgm": label = `${BLOCK_LABELS.bgm.icon} ${block.trackName}${block.fadeIn ? ` (fade ${block.fadeIn}s)` : ""}`; break;
    case "sfx": label = `${BLOCK_LABELS.sfx.icon} ${block.soundName}`; break;
    case "background": label = `${BLOCK_LABELS.background.icon} ${block.asset}`; break;
    case "delay": label = `${BLOCK_LABELS.delay.icon} ${block.seconds}s`; break;
    case "itemEffect": label = `${BLOCK_LABELS.itemEffect.icon} ${block.action === "give" ? "+" : "-"} ${block.itemName}`; break;
    case "narrative": return escHTML(block.text);
  }
  return `<span class="${cls}" tabindex="0" data-block="${data}" contenteditable="false">${escHTML(label)}</span>`;
}

function escHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function blocksToHTML(blocks: SceneBlock[], project: VNProject): string {
  // Group contiguous narrative blocks into paragraphs
  const parts: string[] = [];
  let para: string[] = [];
  for (const b of blocks) {
    if (b.type === "narrative") {
      para.push(escHTML(b.text));
    } else {
      if (para.length) { parts.push(`<p>${para.join("<br>")}</p>`); para = []; }
      parts.push(`<p>${blockToBadgeHTML(b, project)}</p>`);
    }
  }
  if (para.length) parts.push(`<p>${para.join("<br>")}</p>`);
  return parts.join("\n");
}

function HTMLToBlocks(html: string, project: VNProject): SceneBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstChild as HTMLElement;
  const blocks: SceneBlock[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) { blocks.push({ type: "narrative", text }); }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.hasAttribute("data-block")) {
        try {
          const parsed = JSON.parse(decodeURIComponent(el.getAttribute("data-block")!)) as SceneBlock;
          blocks.push(parsed);
          return;
        } catch { /* fall through to text */ }
      }
      // For <p> or <div>, recurse into children
      for (const child of el.childNodes) walk(child);
    }
  };

  for (const child of container.childNodes) walk(child);
  return blocks;
}

function createDefaultBlock(action: BlockAction, project: VNProject, onCreateNode?: () => string): SceneBlock | null {
  switch (action) {
    case "dialogue": return { type: "dialogue", speaker: "Narrator", text: "" };
    case "narrative": return null; // handled by just focusing the editor
    case "effect": return { type: "effect", variableName: "", operation: "+", value: 0 };
    case "statDisplay": return { type: "statDisplay", variableName: "" };
    case "choice": return { type: "choice", text: "", targetNodeId: "" };
    case "entity": return { type: "entity", entityId: "" };
    case "condition": return { type: "condition", condition: { source: "tracker", targetId: "" } };
    case "continue": return { type: "continue", targetNodeId: "" };
    case "ending": return { type: "ending", endingType: "NORMAL" };
    case "flag": return { type: "flag", flagName: "", flagValue: true };
    case "bgm": return { type: "bgm", trackName: "" };
    case "sfx": return { type: "sfx", soundName: "" };
    case "background": return { type: "background", asset: "" };
    case "delay": return { type: "delay", seconds: 1 };
    case "itemEffect": return { type: "itemEffect", action: "give", itemName: "" };
  }
}

export default function BlockEditor({ project, blocks, onChange, onCreateNode }: BlockEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commandMode, setCommandMode] = useState(false);
  const [commandText, setCommandText] = useState("");
  const [editingBadge, setEditingBadge] = useState<{ block: SceneBlock; index: number } | null>(null);
  const palettePosRef = useRef({ x: 0, y: 0 });
  const savedRangeRef = useRef<Range | null>(null);
  const isInternalUpdate = useRef(false);

  // Render blocks into the contenteditable div
  const renderBlocks = useCallback(() => {
    if (!editorRef.current || isInternalUpdate.current) return;
    const html = blocksToHTML(blocks, project);
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [blocks, project]);

  useEffect(() => { renderBlocks(); }, [renderBlocks]);

  // Save cursor position
  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  // Insert a badge at the saved cursor position
  const insertBadgeAtCursor = useCallback((block: SceneBlock) => {
    const range = savedRangeRef.current;
    const el = editorRef.current;
    if (!el || !range) return;
    if (!el.contains(range.commonAncestorContainer) && el.contains(range.startContainer)) {
      // range is in a child
    } else if (!el.contains(range.commonAncestorContainer)) {
      // Fallback: append to end
      const p = document.createElement("p");
      el.appendChild(p);
      range.selectNodeContents(p);
      range.collapse(true);
    }

    const html = blockToBadgeHTML(block, project);
    const fragment = range.createContextualFragment(html);
    range.deleteContents();
    range.insertNode(fragment);

    // Move cursor after the inserted badge
    const newNode = fragment.lastChild || fragment;
    range.setStartAfter(newNode);
    range.collapse(true);
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    isInternalUpdate.current = true;
    syncBlocks();
    isInternalUpdate.current = false;
  }, [project]);

  // Sync blocks from DOM
  const syncBlocks = useCallback(() => {
    if (!editorRef.current) return;
    const newBlocks = HTMLToBlocks(editorRef.current.innerHTML, project);
    if (JSON.stringify(newBlocks) !== JSON.stringify(blocks)) {
      onChange(newBlocks);
    }
  }, [blocks, project, onChange]);

  // Handle keyboard input for / commands
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    // Check if we just typed /
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textBefore = range.startContainer.textContent || "";
    const caretPos = range.startOffset;
    const beforeCaret = textBefore.slice(0, caretPos).trim();

    if (beforeCaret.endsWith("/")) {
      saveRange();
      setCommandMode(true);
      setCommandText("");
      const rect = range.getBoundingClientRect();
      palettePosRef.current = { x: rect.left, y: rect.bottom + 4 };
      // Remove the / from the DOM
      range.startContainer.textContent = textBefore.slice(0, -1) + textBefore.slice(caretPos);
    }
  }, []);

  // Handle blur — sync blocks
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't sync if clicking on palette or badge editor
    if ((e.relatedTarget as HTMLElement)?.closest?.(".cm-palette, .cm-edit-popup")) return;
    syncBlocks();
  }, [syncBlocks]);

  // Command palette selection
  const handleCommandSelect = useCallback((action: BlockAction) => {
    const block = createDefaultBlock(action, project, onCreateNode);
    if (block) {
      insertBadgeAtCursor(block);
    }
    setCommandMode(false);
    setCommandText("");
    if (editorRef.current) editorRef.current.focus();
  }, [project, onCreateNode, insertBadgeAtCursor]);

  // Palette open
  const openPalette = useCallback(() => {
    saveRange();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      palettePosRef.current = { x: rect.left, y: rect.bottom + 4 };
    } else {
      const editorRect = editorRef.current?.getBoundingClientRect();
      palettePosRef.current = { x: editorRect?.left || 0, y: (editorRect?.bottom || 0) - 40 };
    }
    setPaletteOpen(true);
  }, []);

  // Badge click handling
  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const badge = target.closest("[data-block]") as HTMLElement | null;
    if (!badge) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const block = JSON.parse(decodeURIComponent(badge.getAttribute("data-block")!)) as SceneBlock;
      // Find index in blocks
      const idx = blocks.findIndex(b => JSON.stringify(b) === JSON.stringify(block));
      setEditingBadge({ block, index: idx >= 0 ? idx : blocks.length });
    } catch { /* ignore */ }
  }, [blocks]);

  // Update a badge after editing
  const handleBadgeUpdate = useCallback((newBlock: SceneBlock) => {
    if (!editorRef.current || !editingBadge) return;
    // Find and update the badge span in the DOM
    const badges = editorRef.current.querySelectorAll<HTMLSpanElement>("[data-block]");
    let idx = 0;
    for (const badge of badges) {
      try {
        const existing = JSON.parse(decodeURIComponent(badge.getAttribute("data-block")!)) as SceneBlock;
        if (JSON.stringify(existing) === JSON.stringify(editingBadge.block)) {
          const html = blockToBadgeHTML(newBlock, project);
          const temp = document.createElement("div");
          temp.innerHTML = html;
          const newEl = temp.firstElementChild as HTMLElement;
          if (newEl) {
            badge.parentNode?.replaceChild(newEl, badge);
          }
          break;
        }
      } catch { /* */ }
      idx++;
    }
    setEditingBadge(null);
    syncBlocks();
  }, [editingBadge, project, syncBlocks]);

  const handleBadgeDelete = useCallback(() => {
    if (!editorRef.current || !editingBadge) return;
    const badges = editorRef.current.querySelectorAll<HTMLSpanElement>("[data-block]");
    for (const badge of badges) {
      try {
        const existing = JSON.parse(decodeURIComponent(badge.getAttribute("data-block")!)) as SceneBlock;
        if (JSON.stringify(existing) === JSON.stringify(editingBadge.block)) {
          badge.remove();
          break;
        }
      } catch { /* */ }
    }
    setEditingBadge(null);
    syncBlocks();
    if (editorRef.current) editorRef.current.focus();
  }, [editingBadge, syncBlocks]);

  const filteredActions = commandText
    ? BLOCK_ACTIONS.filter(a => a.label.toLowerCase().includes(commandText.toLowerCase()))
    : BLOCK_ACTIONS;

  return (
    <div className="relative">
      {/* Contenteditable editor */}
      <div
        ref={editorRef}
        className="cm-editor w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-3 focus:outline-none focus:border-indigo-500 overflow-y-auto"
        contentEditable
        data-placeholder="Type your story here... Use / to add badges, or click the + button..."
        onInput={handleInput}
        onBlur={handleBlur}
        onClick={handleBadgeClick}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setCommandMode(false); setPaletteOpen(false); setEditingBadge(null); }
          if (e.key === "Enter" && commandMode && filteredActions.length > 0) {
            e.preventDefault();
            handleCommandSelect(filteredActions[0].key);
          }
          if (e.key === "Backspace" && commandMode && !commandText) {
            setCommandMode(false);
          }
        }}
        style={{ minHeight: "150px", maxHeight: "400px" }}
      />

      {/* + button */}
      <div className="flex justify-end mt-1.5">
        <button onClick={openPalette}
          className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
          title="Insert badge">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Command palette */}
      {(paletteOpen || commandMode) && (
        <div
          className="cm-palette fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[180px] max-h-60 overflow-y-auto"
          style={{ left: palettePosRef.current.x, top: palettePosRef.current.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {commandMode && (
            <div className="px-3 py-1 border-b border-slate-800 mb-1">
              <input
                value={commandText}
                onChange={e => setCommandText(e.target.value)}
                placeholder="Search commands..."
                className="w-full bg-transparent text-xs text-white focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredActions.length > 0) { e.preventDefault(); handleCommandSelect(filteredActions[0].key); }
                  if (e.key === "Escape") { setCommandMode(false); }
                }}
              />
            </div>
          )}
          {filteredActions.map(a => (
            <button key={a.key} onClick={() => { handleCommandSelect(a.key); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white rounded flex items-center gap-2 cursor-pointer">
              <span>{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Badge editor popover */}
      {editingBadge && (
        <div
          className="cm-edit-popup fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 min-w-[260px]"
          style={{
            left: Math.min(palettePosRef.current.x, window.innerWidth - 300),
            top: Math.min(palettePosRef.current.y, window.innerHeight - 200),
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <BadgeEditor
            block={editingBadge.block}
            project={project}
            onSave={handleBadgeUpdate}
            onDelete={handleBadgeDelete}
            onCancel={() => setEditingBadge(null)}
            onCreateNode={onCreateNode}
          />
        </div>
      )}
    </div>
  );
}

// Badge editor component
function BadgeEditor({ block, project, onSave, onDelete, onCancel, onCreateNode }: {
  block: SceneBlock; project: VNProject; onSave: (b: SceneBlock) => void; onDelete: () => void; onCancel: () => void;
  onCreateNode?: () => string;
}) {
  const label = BLOCK_LABELS[block.type as BlockAction]?.label || block.type;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
        <button onClick={onCancel} className="text-slate-500 hover:text-white cursor-pointer text-xs">✕</button>
      </div>
      <SimpleFields block={block} project={project} onSave={onSave} onDelete={onDelete} onCreateNode={onCreateNode} />
    </div>
  );
}

function SimpleFields({ block, project, onSave, onDelete, onCreateNode }: {
  block: SceneBlock; project: VNProject; onSave: (b: SceneBlock) => void; onDelete: () => void; onCreateNode?: () => string;
}) {
  const onChange = (patch: Partial<SceneBlock>) => {
    const merged = { ...block, ...patch } as SceneBlock;
    onSave(merged);
  };

  switch (block.type) {
    case "dialogue": {
      const b = block as SceneBlock & { type: "dialogue" };
      const entity = project.entities.find(e => e.name === b.speaker);
      const tones = entity?.expressions?.length ? entity.expressions : ["Neutral", "Smile", "Surprise", "Serious", "Sad", "Angry"];
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <select value={b.speaker} onChange={e => onChange({ speaker: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
              <option value="Narrator">Narrator</option>
              {project.entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select value={b.expression || "Neutral"} onChange={e => onChange({ expression: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
              {tones.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input value={b.text} onChange={e => onChange({ text: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1.5 text-white focus:outline-none focus:border-indigo-500"
            placeholder="Dialogue text..." autoFocus />
          <div className="flex gap-1 justify-end pt-1">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Close</button>
          </div>
        </div>
      );
    }
    case "effect": {
      const b = block as SceneBlock & { type: "effect" };
      return (
        <div className="flex items-center gap-1.5">
          <select value={b.operation} onChange={e => onChange({ operation: e.target.value as any })}
            className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-10 text-center cursor-pointer">
            <option value="+">+</option><option value="-">−</option><option value="=">=</option>
          </select>
          <input type="number" value={b.value} onChange={e => onChange({ value: parseInt(e.target.value) || 0 })}
            className="w-14 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white text-center focus:outline-none focus:border-indigo-500" />
          <input value={b.variableName} onChange={e => onChange({ variableName: e.target.value })} placeholder="stat"
            className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
          <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">✕</button>
          <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
        </div>
      );
    }
    case "choice": {
      const b = block as SceneBlock & { type: "choice" };
      const allNodes = Object.values(project.nodes).filter(n => n.nodeType === "story" || !n.nodeType);
      const [rand, setRand] = useState(b.random || 0);
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input value={b.text} onChange={e => onChange({ text: e.target.value })} placeholder="choice text"
              className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" autoFocus />
            <select value={b.targetNodeId} onChange={e => onChange({ targetNodeId: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer max-w-[130px]">
              <option value="">→ target</option>
              {allNodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
              {onCreateNode && <option value="__new__">+ New scene</option>}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
              <input type="checkbox" checked={rand > 0} onChange={e => setRand(e.target.checked ? 50 : 0)} className="w-3 h-3" />
              Random {rand > 0 ? `${rand}%` : ""}
            </label>
            {rand > 0 && <input type="range" min={1} max={100} value={rand} onChange={e => { setRand(Number(e.target.value)); onChange({ random: Number(e.target.value) }); }} className="w-20 h-1" />}
          </div>
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "continue": {
      const b = block as SceneBlock & { type: "continue" };
      const allNodes = Object.values(project.nodes).filter(n => n.nodeType === "story" || !n.nodeType);
      return (
        <div className="flex flex-col gap-1.5">
          <select value={b.targetNodeId} onChange={e => onChange({ targetNodeId: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
            <option value="">→ target</option>
            {allNodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
            {onCreateNode && <option value="__new__">+ New scene</option>}
          </select>
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "ending": {
      const b = block as SceneBlock & { type: "ending" };
      return (
        <div className="flex flex-col gap-1.5">
          <select value={b.endingType} onChange={e => onChange({ endingType: e.target.value as any })}
            className="w-full bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
            <option value="GOOD">Good</option><option value="BAD">Bad</option><option value="NORMAL">Normal</option><option value="NEUTRAL">Neutral</option>
          </select>
          <input value={b.endingName || ""} onChange={e => onChange({ endingName: e.target.value })} placeholder="ending name"
            className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "flag": {
      const b = block as SceneBlock & { type: "flag" };
      return (
        <div className="flex flex-col gap-1.5">
          <input value={b.flagName} onChange={e => onChange({ flagName: e.target.value })} placeholder="flag name"
            className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" autoFocus />
          <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer">
            <input type="checkbox" checked={b.flagValue} onChange={e => onChange({ flagValue: e.target.checked })} className="w-3 h-3" />
            {b.flagValue ? "True" : "False"}
          </label>
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "bgm": {
      const b = block as SceneBlock & { type: "bgm" };
      return (
        <div className="flex flex-col gap-1.5">
          <input value={b.trackName} onChange={e => onChange({ trackName: e.target.value })} placeholder="track name"
            className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" autoFocus />
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "sfx": {
      const b = block as SceneBlock & { type: "sfx" };
      return (
        <div className="flex flex-col gap-1.5">
          <input value={b.soundName} onChange={e => onChange({ soundName: e.target.value })} placeholder="sound name"
            className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" autoFocus />
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "background": {
      const b = block as SceneBlock & { type: "background" };
      return (
        <div className="flex flex-col gap-1.5">
          <input value={b.asset} onChange={e => onChange({ asset: e.target.value })} placeholder="image path or color"
            className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" autoFocus />
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "delay": {
      const b = block as SceneBlock & { type: "delay" };
      return (
        <div className="flex flex-col gap-1.5">
          <input type="number" min={0.1} step={0.1} value={b.seconds} onChange={e => onChange({ seconds: parseFloat(e.target.value) || 0 })}
            className="w-20 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" autoFocus />
          <span className="text-[10px] text-slate-500">seconds</span>
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "itemEffect": {
      const b = block as SceneBlock & { type: "itemEffect" };
      return (
        <div className="flex flex-col gap-1.5">
          <select value={b.action} onChange={e => onChange({ action: e.target.value as "give" | "take" })}
            className="w-full bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
            <option value="give">Give</option><option value="take">Take</option>
          </select>
          <input value={b.itemName} onChange={e => onChange({ itemName: e.target.value })} placeholder="item name"
            className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    case "condition": {
      const b = block as SceneBlock & { type: "condition" };
      return (
        <div className="flex flex-col gap-1.5">
          <select value={b.condition.source} onChange={e => onSave({ ...block, condition: { ...b.condition, source: e.target.value as "tracker" | "flag" } } as SceneBlock)}
            className="w-full bg-slate-800 border border-slate-700 text-[11px] rounded p-1 text-slate-200 cursor-pointer">
            <option value="tracker">Tracker</option><option value="flag">Flag</option>
          </select>
          {b.condition.source === "tracker" ? (
            <div className="flex items-center gap-1.5">
              <input value={b.condition.targetId} onChange={e => onSave({ ...block, condition: { ...b.condition, targetId: e.target.value } } as SceneBlock)} placeholder="stat name"
                className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
              <select value={b.condition.operator || ">="} onChange={e => onSave({ ...block, condition: { ...b.condition, operator: e.target.value } } as SceneBlock)}
                className="bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white w-12 text-center cursor-pointer">
                <option value=">=">≥</option><option value="<=">≤</option><option value=">">&gt;</option><option value="<">&lt;</option><option value="==">=</option><option value="!=">≠</option>
              </select>
              <input type="number" value={b.condition.compareValue || 1} onChange={e => onSave({ ...block, condition: { ...b.condition, compareValue: parseInt(e.target.value) || 0 } } as SceneBlock)}
                className="w-12 bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white text-center" />
            </div>
          ) : (
            <input value={b.condition.targetId} onChange={e => onSave({ ...block, condition: { ...b.condition, targetId: e.target.value } } as SceneBlock)} placeholder="flag name"
              className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-1 text-white focus:outline-none focus:border-indigo-500" />
          )}
          <div className="flex gap-1 justify-end">
            <button onClick={onDelete} className="text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
            <button onClick={onCancel} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded cursor-pointer">Done</button>
          </div>
        </div>
      );
    }
    default: {
      // Generic fallback — show data-block JSON for unknown types
      return (
        <div className="text-[10px] text-slate-500">
          <p className="mb-1">Block type: {(block as any).type}</p>
          <pre className="bg-slate-950 p-2 rounded text-[9px]">{JSON.stringify(block, null, 2)}</pre>
          <button onClick={onDelete} className="mt-2 text-[10px] px-2 py-0.5 bg-rose-700 text-white rounded cursor-pointer">Delete</button>
        </div>
      );
    }
  }
}
