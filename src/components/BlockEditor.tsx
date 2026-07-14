import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Mark } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { VNProject, SceneBlock } from "../types";
import { InlineCommandNode, commandColor } from "../extensions/InlineCommand";
import { handleSlashCommand } from "../utils/inlineCommandUtils";
import ContextMenu from "./ContextMenu";

interface BlockEditorProps {
  project: VNProject;
  blocks: SceneBlock[];
  onChange: (blocks: SceneBlock[]) => void;
  onCreateNode?: () => string;
  onCreateNodeWithTitle?: (title: string) => string;
  onCreateInventoryItem?: (name: string) => void;
}

// Check if a block has meaningful content
function blockHasContent(b: SceneBlock): boolean {
  if (!b) return false;
  switch (b.type) {
    case "dialogue": return (b.text || "").trim().length > 0;
    case "narrative": return (b.text || "").trim().length > 0;
    case "effect": return (b.variableName || "").trim().length > 0;
    case "statDisplay": return (b.variableName || "").trim().length > 0;
    case "choice": return (b.text || "").trim().length > 0 && (b.targetNodeId || "").length > 0;
    case "entity": return (b.entityId || "").length > 0;
    case "condition": return (b.targetId || "").length > 0;
    case "continue": return (b.targetNodeId || "").length > 0;
    case "ending": return true;
    case "flag": return (b.flagName || "").trim().length > 0;
    case "bgm": return (b.trackName || "").trim().length > 0;
    case "sfx": return (b.soundName || "").trim().length > 0;
    case "background": return (b.asset || "").trim().length > 0;
    case "delay": return (b.seconds || 0) > 0;
    case "itemEffect": return (b.itemName || "").trim().length > 0;
    default: return true;
  }
}

// Convert blocks to TipTap HTML
function blocksToHTML(blocks: SceneBlock[], project: VNProject): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (!blockHasContent(b)) continue;
    if (b.type === "narrative") {
      parts.push(escapeHTML(b.text || "").replace(/\n/g, "<br>"));
    } else {
      const label = badgeLabel(b, project);
      const cls = commandColor(b.type);
      const data = encodeURIComponent(JSON.stringify(b));
      parts.push(`<span data-block="${data}" class="${cls}" style="user-select:none;cursor:default;vertical-align:middle;">${escapeHTML(label)}</span>`);
    }
  }
  return `<p>${parts.join("<br>")}</p>`;
}

// Parse TipTap HTML back to blocks
function htmlToBlocks(html: string, project: VNProject): SceneBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstChild as HTMLElement;
  const blocks: SceneBlock[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) blocks.push({ type: "narrative", text });
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      // Check for finalized inline commands (badges with data-block)
      if (el.hasAttribute("data-block")) {
        try {
          const raw = JSON.parse(decodeURIComponent(el.getAttribute("data-block")!));
          if (raw.type === "stat") raw.type = "effect";
          if (raw.type === "link") raw.type = "choice";
          if (raw.type === "redirect") raw.type = "continue";
          if (raw.type === "item") raw.type = "itemEffect";
          const parsed = raw as SceneBlock;
          blocks.push(parsed);
          return;
        } catch { /* fall through */ }
      }
      // Check for unfinalized inline commands (span with data-inline-command)
      if (el.hasAttribute("data-inline-command") && !el.hasAttribute("data-block")) {
        // Unfinalized — store as narrative for now
        const text = el.textContent?.trim();
        if (text) blocks.push({ type: "narrative", text });
        return;
      }
      // Recurse into children
      for (const child of el.childNodes) walk(child);
    }
  };

  for (const child of container.childNodes) walk(child);
  return blocks;
}

function badgeLabel(b: SceneBlock, project: VNProject): string {
  switch (b.type) {
    case "dialogue": return `💬 ${b.speaker}: "${b.text}"`;
    case "effect": return `📊 ${b.variableName} ${b.operation}${b.value}`;
    case "statDisplay": return `📈 ${b.variableName}: ?`;
    case "choice": return `🔗 Choice: ${b.text}`;
    case "entity": { const e = project.entities.find(en => en.id === b.entityId); return `👤 ${e?.name || "?"}`; }
    case "condition": return `👁️ ${b.source || "?"}`;
    case "continue": { const t = project.nodes[b.targetNodeId]; return `🔀 ${t?.title || "?"}`; }
    case "ending": return `🏁 ${b.endingType}${b.endingName ? `: ${b.endingName}` : ""}`;
    case "flag": return `🚩 ${b.flagName} = ${b.flagValue}`;
    case "bgm": return `🎵 ${b.trackName}`;
    case "sfx": return `💥 ${b.soundName}`;
    case "background": return `🖼️ ${b.asset}`;
    case "delay": return `⏳ ${b.seconds}s`;
    case "itemEffect": return `🎒 ${b.action === "give" ? "+" : "-"} ${b.itemName}`;
    default: return "📝";
  }
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STYLE_CLASS_MAP: Record<string, string> = {
  shake: "animate-shake",
  glitch: "animate-glitch",
  glow: "text-glow",
  whisper: "text-whisper",
  redacted: "text-redacted",
  wiggle: "animate-wiggle",
};

const TextStyleMark = Mark.create({
  name: "textStyle",
  addAttributes() { return { styles: { default: "" } }; },
  parseHTML() { return [{ tag: "span[data-style]", getAttrs: (el) => ({ styles: (el as HTMLElement).getAttribute("data-style") || "" }) }]; },
  renderHTML({ mark }) {
    const styles = (mark.attrs.styles as string).split(" ").filter(Boolean);
    const classes = styles.map(s => STYLE_CLASS_MAP[s] || s).join(" ");
    return ["span", { "data-style": mark.attrs.styles, class: classes }, 0];
  },
});

const TextColorMark = Mark.create({
  name: "textColor",
  addAttributes() { return { color: { default: "" } }; },
  parseHTML() { return [{ tag: "span[data-style-color]", getAttrs: (el) => ({ color: (el as HTMLElement).getAttribute("data-style-color") || "" }) }]; },
  renderHTML({ mark }) {
    const c = mark.attrs.color as string;
    return ["span", { "data-style-color": c, style: `--custom-color: ${c}; color: ${c}` }, 0];
  },
});

function createDefaultBlock(type: string, project: VNProject): SceneBlock {
  switch (type) {
    case "dialogue": return { type: "dialogue", speaker: "Narrator", text: "" };
    case "effect": return { type: "effect", variableName: "", operation: "+", value: 0 };
    case "statDisplay": return { type: "statDisplay", variableName: "" };
    case "choice": return { type: "choice", text: "", targetNodeId: "" };
    case "entity": return { type: "entity", entityId: "" };
    case "condition": return { type: "condition", source: "tracker", targetId: "" };
    case "continue": return { type: "continue", targetNodeId: "" };
    case "ending": return { type: "ending", endingType: "NORMAL" };
    case "flag": return { type: "flag", flagName: "", flagValue: true };
    case "bgm": return { type: "bgm", trackName: "" };
    case "sfx": return { type: "sfx", soundName: "" };
    case "background": return { type: "background", asset: "" };
    case "delay": return { type: "delay", seconds: 1 };
    case "itemEffect": return { type: "itemEffect", action: "give", itemName: "" };
    default: return { type: "narrative", text: "" };
  }
}

export default function BlockEditor({ project, blocks, onChange, onCreateNode, onCreateNodeWithTitle, onCreateInventoryItem }: BlockEditorProps) {
  const htmlContent = useMemo(() => blocksToHTML(blocks, project), [blocks, project]);
  const [menuState, setMenuState] = useState<{ x: number; y: number; selectedText: string } | null>(null);
  const editorChangeRef = useRef(false);

  const handleSlash = useCallback((view: any, event: KeyboardEvent) => {
    return handleSlashCommand(view, event);
  }, []);

  const handleContextMenu = useCallback((view: any, event: MouseEvent) => {
    event.preventDefault();
    const { from, to } = view.state.selection;
    const selectedText = view.state.doc.textBetween(from, to);
    setMenuState({ x: event.clientX, y: event.clientY, selectedText });
    return true;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, code: false, blockquote: false, horizontalRule: false, codeBlock: false }),
      InlineCommandNode,
      TextStyleMark,
      TextColorMark,
      Placeholder.configure({ placeholder: "Type your story here..." }),
    ],
    content: htmlContent,
    editorProps: {
      attributes: { class: "cm-editor w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-3 focus:outline-none focus:border-indigo-500 overflow-y-auto" },
      handleKeyDown: handleSlash,
      handleDOMEvents: {
        contextmenu: handleContextMenu,
      },
    },
    onUpdate: ({ editor }) => {
      editorChangeRef.current = true;
      const html = editor.getHTML();
      const newBlocks = htmlToBlocks(html, project);
      if (JSON.stringify(newBlocks) !== JSON.stringify(blocks)) {
        onChange(newBlocks);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editorChangeRef.current) {
      editorChangeRef.current = false;
      return;
    }
    const currentHtml = editor.getHTML();
    if (currentHtml === htmlContent) return;
    const currentBlocks = htmlToBlocks(currentHtml, project);
    if (JSON.stringify(currentBlocks) !== JSON.stringify(blocks)) {
      editor.commands.setContent(htmlContent);
    }
  }, [editor, htmlContent, blocks, project]);

  useEffect(() => {
    if (editor) {
      const storage = (editor.storage as any).inlineCommand;
      if (storage) {
        storage.entityNames = project.entities.map(e => e.name);
        storage.entityData = project.entities.map(e => ({
          name: e.name,
          trackers: (e.ownedTrackers || []).map(t => t.name),
          flags: (e.ownedFlags || []).map(f => f.name),
          expressions: e.expressions || [],
        }));
        storage.nodeEntries = Object.values(project.nodes).map(n => ({ title: n.title, id: n.id }));
        storage.createNodeWithTitle = onCreateNodeWithTitle;
        storage.inventoryItemNames = project.inventory.map(i => i.name);
        storage.createInventoryItem = onCreateInventoryItem;
      }
    }
  }, [editor, project.entities, project.nodes, onCreateNodeWithTitle, onCreateInventoryItem]);

  const handleApplyStyle = useCallback((style: string) => {
    if (!editor) return;
    const currentStyles = editor.getAttributes("textStyle").styles as string || "";
    const styles = currentStyles ? currentStyles.split(" ").filter(Boolean) : [];
    const idx = styles.indexOf(style);
    if (idx >= 0) { styles.splice(idx, 1); } else { styles.push(style); }
    if (styles.length > 0) {
      editor.chain().focus().setMark("textStyle", { styles: styles.join(" ") }).setTextSelection(editor.state.selection.to).run();
    } else {
      editor.chain().focus().unsetMark("textStyle").setTextSelection(editor.state.selection.to).run();
    }
    setMenuState(null);
  }, [editor]);

  const handleApplyColor = useCallback((color: string) => {
    if (!editor) return;
    const { to } = editor.state.selection;
    editor.chain().focus().toggleMark("textColor", { color }).setTextSelection(to).run();
    setMenuState(null);
  }, [editor]);

  const handleRemoveEffects = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetMark("textStyle").unsetMark("textColor").run();
    setMenuState(null);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          selectedText={menuState.selectedText}
          onClose={() => setMenuState(null)}
          onApplyStyle={handleApplyStyle}
          onApplyColor={handleApplyColor}
          onRemoveEffects={handleRemoveEffects}
        />
      )}
    </div>
  );
}
