import React, { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { VNProject, SceneBlock } from "../types";
import { Plus } from "lucide-react";
import { InlineCommandNode } from "../extensions/InlineCommand";

interface BlockEditorProps {
  project: VNProject;
  blocks: SceneBlock[];
  onChange: (blocks: SceneBlock[]) => void;
  onCreateNode?: () => string;
}

// Convert blocks to TipTap HTML
function blocksToHTML(blocks: SceneBlock[], project: VNProject): string {
  const paragraphs: string[] = [];
  let para: string[] = [];
  for (const b of blocks) {
    if (b.type === "narrative") {
      para.push(escapeHTML(b.text));
    } else {
      if (para.length) { paragraphs.push(`<p>${para.join("<br>")}</p>`); para = []; }
      const label = badgeLabel(b, project);
      const cls = commandColor(b.type);
      const data = encodeURIComponent(JSON.stringify(b));
      paragraphs.push(`<p><span data-inline-command data-block="${data}" class="${cls}" style="user-select:none;cursor:default;vertical-align:middle;">${escapeHTML(label)}</span></p>`);
    }
  }
  if (para.length) paragraphs.push(`<p>${para.join("<br>")}</p>`);
  return paragraphs.join("\n");
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
          const parsed = JSON.parse(decodeURIComponent(el.getAttribute("data-block")!)) as SceneBlock;
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
    case "effect": return `📊 ${b.operation}${b.value} ${b.variableName}`;
    case "statDisplay": return `📈 ${b.variableName}: ?`;
    case "choice": return `🔗 ${b.text}`;
    case "entity": { const e = project.entities.find(en => en.id === b.entityId); return `👤 ${e?.name || "?"}`; }
    case "condition": return `👁️ ${b.condition?.source || "?"}`;
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

function commandColor(type: string): string {
  const colors: Record<string, string> = {
    dialogue: "cm-badge-dialogue", effect: "cm-badge-effect", statDisplay: "cm-badge-statDisplay",
    choice: "cm-badge-choice", entity: "cm-badge-entity", condition: "cm-badge-condition",
    continue: "cm-badge-continue", ending: "cm-badge-ending", flag: "cm-badge-flag",
    bgm: "cm-badge-bgm", sfx: "cm-badge-sfx", background: "cm-badge-background",
    delay: "cm-badge-delay", itemEffect: "cm-badge-itemEffect",
  };
  return colors[type] || "cm-badge";
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function createDefaultBlock(type: string, project: VNProject): SceneBlock {
  switch (type) {
    case "dialogue": return { type: "dialogue", speaker: "Narrator", text: "" };
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
    default: return { type: "narrative", text: "" };
  }
}

export default function BlockEditor({ project, blocks, onChange, onCreateNode }: BlockEditorProps) {
  const [initialHTML] = useState(() => blocksToHTML(blocks, project));

  const handleSlash = useCallback((view: any, event: KeyboardEvent) => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const { state } = view;
      const { $from } = state.selection;
      const before = $from.parent.textContent.slice(0, $from.parentOffset);
      if (before === "" || before.endsWith(" ")) {
        event.preventDefault();
        const tr = state.tr.delete(state.selection.from - 1, state.selection.from);
        const node = view.state.schema.nodes.inlineCommand?.create();
        if (node) {
          tr.insert(state.selection.from - 1, node);
          view.dispatch(tr);
        }
        return true;
      }
    }
    return false;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, code: false, blockquote: false, horizontalRule: false, codeBlock: false }),
      InlineCommandNode,
      Placeholder.configure({ placeholder: "Type your story here... Use / or + to add badges..." }),
    ],
    content: initialHTML,
    editorProps: {
      attributes: { class: "cm-editor w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-3 focus:outline-none focus:border-indigo-500 overflow-y-auto" },
      handleKeyDown: handleSlash,
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const newBlocks = htmlToBlocks(html, project);
      if (JSON.stringify(newBlocks) !== JSON.stringify(blocks)) {
        onChange(newBlocks);
      }
    },
  });

  useEffect(() => {
    if (editor && initialHTML && editor.getHTML() !== initialHTML) {
      editor.commands.setContent(initialHTML);
    }
  }, [editor, initialHTML]);

  const handleAddBadge = useCallback(() => {
    if (!editor) return;
    const node = editor.schema.nodes.inlineCommand?.create();
    if (node) {
      editor.chain().focus().insertContent(node).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      <div className="flex justify-end mt-1.5">
        <button onMouseDown={(e) => { e.preventDefault(); handleAddBadge(); }}
          className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
          title="Insert badge">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
