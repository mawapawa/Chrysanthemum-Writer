import React, { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Paragraph from "@tiptap/extension-paragraph";
import { Mark, Node as ProseNode } from "@tiptap/core";
import { VNProject, DialogueBlock, InlineEffect } from "../types";
import ContextMenu from "./ContextMenu";

function textColorForHex(hex: string): string {
  const val = parseInt(hex.replace("#", ""), 16);
  const r = (val >> 16) & 0xff, g = (val >> 8) & 0xff, b = val & 0xff;
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? "text-slate-950" : "text-white";
}

const STYLE_CLASS_MAP: Record<string, string> = {
  shake: "animate-shake",
  glitch: "animate-glitch",
  glow: "text-glow",
  whisper: "text-whisper",
};

interface ScriptEditorProps {
  project: VNProject;
  nodeId: string;
  dialogueTimeline: DialogueBlock[];
  onUpdateTimeline: (blocks: DialogueBlock[]) => void;
}

let _entitiesForBadge: Array<{ name: string; color: string }> = [];

function SpeakerBadgeWrapper(props: ReactNodeViewProps) {
  const attrs = props.node.attrs as Record<string, unknown>;
  const speaker = (attrs.speaker as string) || "Narrator";
  const entity = _entitiesForBadge.find((e) => e.name === speaker);
  const color = entity?.color || "#64748b";
  const fg = textColorForHex(color);
  return (
    <NodeViewWrapper className="flex items-start gap-2 my-1" data-speaker={speaker}>
      <span
        className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5"
        style={{ backgroundColor: color, color: fg }}
      >
        {speaker}
      </span>
      <NodeViewContent className="flex-1" />
    </NodeViewWrapper>
  );
}

const DialogueParagraph = Paragraph.extend({
  name: "dialogueParagraph",
  addAttributes() {
    return { speaker: { default: "Narrator" } };
  },
  parseHTML() {
    return [{ tag: "p[data-speaker]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["p", { "data-speaker": HTMLAttributes.speaker }, 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SpeakerBadgeWrapper);
  },
});

const TextStyleMark = Mark.create({
  name: "textStyle",
  addAttributes() {
    return { styles: { default: "" } };
  },
  parseHTML() {
    return [{
      tag: "span[data-style]",
      getAttrs: (el) => ({ styles: (el as HTMLElement).getAttribute("data-style") || "" }),
    }];
  },
  renderHTML({ mark }) {
    const styles = (mark.attrs.styles as string).split(" ").filter(Boolean);
    const classes = styles.map(s => STYLE_CLASS_MAP[s] || s).join(" ");
    return ["span", { "data-style": mark.attrs.styles, class: classes }, 0];
  },
});

const TextColorMark = Mark.create({
  name: "textColor",
  addAttributes() {
    return { color: { default: "" } };
  },
  parseHTML() {
    return [{
      tag: "span[data-style-color]",
      getAttrs: (el) => ({ color: (el as HTMLElement).getAttribute("data-style-color") || "" }),
    }];
  },
  renderHTML({ mark }) {
    const c = mark.attrs.color as string;
    return ["span", { "data-style-color": c, style: `--custom-color: ${c}; color: ${c}` }, 0];
  },
});

const ItemChip = ProseNode.create({
  name: "itemChip",
  inline: true,
  group: "inline",
  atom: true,
  addAttributes() {
    return {
      effect: { default: "give_item" },
      targetId: { default: "" },
      label: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-effect]" }];
  },
  renderHTML({ node }) {
    return ["span", {
      "data-effect": node.attrs.effect,
      "data-id": node.attrs.targetId,
      class: "inline-flex items-center gap-0.5 px-1 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 cursor-default",
    }, node.attrs.label || node.attrs.targetId];
  },
});

export default function ScriptEditor({
  project, nodeId, dialogueTimeline, onUpdateTimeline,
}: ScriptEditorProps) {
  const [menuState, setMenuState] = useState<{
    x: number; y: number; selectedText: string;
  } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      DialogueParagraph,
      TextStyleMark,
      TextColorMark,
      ItemChip,
      Placeholder.configure({ placeholder: "Write your scene script here..." }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[200px] p-3 text-sm leading-relaxed",
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          event.preventDefault();
          const { from, to } = view.state.selection;
          const selectedText = view.state.doc.textBetween(from, to);
          if (!selectedText) {
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos) {
              const textAt = view.state.doc.textBetween(pos.pos, pos.pos + 1);
              if (!textAt) return true;
            }
            return true;
          }
          setMenuState({ x: event.clientX, y: event.clientY, selectedText });
          return true;
        },
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const blocks = parseHtmlToBlocks(html);
      onUpdateTimeline(blocks);
    },
  });

  useEffect(() => {
    if (editor && dialogueTimeline.length > 0) {
      const currentHtml = editor.getHTML();
      const generatedHtml = blocksToHtml(dialogueTimeline, project.entities);
      if (currentHtml !== generatedHtml) {
        editor.commands.setContent(generatedHtml);
      }
    } else if (editor && dialogueTimeline.length === 0) {
      editor.commands.setContent("");
    }
  }, [editor, dialogueTimeline, project.entities]);

  useEffect(() => {
    _entitiesForBadge = project.entities;
  }, [project.entities]);

  const handleCloseMenu = useCallback(() => setMenuState(null), []);

  const handleAssignSpeaker = useCallback((speaker: string) => {
    if (!editor) return;
    editor.chain().focus().updateAttributes("dialogueParagraph", { speaker }).run();
    setMenuState(null);
  }, [editor]);

  const handleGiveItem = useCallback((itemId: string, itemName: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: "itemChip",
      attrs: { effect: "give_item", targetId: itemId, label: itemName },
    }).run();
    setMenuState(null);
  }, [editor]);

  const handleTakeItem = useCallback((itemId: string, itemName: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: "itemChip",
      attrs: { effect: "take_item", targetId: itemId, label: itemName },
    }).run();
    setMenuState(null);
  }, [editor]);

  const handleRequireFlag = useCallback((flagId: string, flagName: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: "itemChip",
      attrs: { effect: "require_flag", targetId: flagId, label: flagName },
    }).run();
    setMenuState(null);
  }, [editor]);

  const handleApplyStyle = useCallback((style: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const existing = editor.state.doc.rangeHasMark(from, to, editor.schema.marks.textStyle);
    if (existing) {
      const mark = editor.state.doc.nodeAt(from)?.marks.find(m => m.type.name === "textStyle");
      const current = (mark?.attrs.styles as string || "").split(" ").filter(Boolean);
      const next = current.includes(style) ? current.filter(s => s !== style) : [...current, style];
      if (next.length === 0) {
        editor.chain().focus().unsetMark("textStyle").run();
      } else {
        editor.chain().focus().setMark("textStyle", { styles: next.join(" ") }).run();
      }
    } else {
      editor.chain().focus().setMark("textStyle", { styles: style }).run();
    }
    setMenuState(null);
  }, [editor]);

  const handleApplyColor = useCallback((color: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const existing = editor.state.doc.rangeHasMark(from, to, editor.schema.marks.textColor);
    if (existing) {
      editor.chain().focus().unsetMark("textColor").run();
    }
    editor.chain().focus().setMark("textColor", { color }).run();
    setMenuState(null);
  }, [editor]);

  const handleRemoveEffects = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetMark("textStyle").unsetMark("textColor").run();
    setMenuState(null);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-900 border-b border-slate-800">
        <span className="text-[10px] font-mono text-slate-500">Script Editor</span>
        <span className="text-[9px] text-slate-600 ml-auto italic">Right-click text for actions</span>
      </div>
      <EditorContent editor={editor} />
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          selectedText={menuState.selectedText}
          onClose={handleCloseMenu}
          onAssignSpeaker={handleAssignSpeaker}
          onGiveItem={handleGiveItem}
          onTakeItem={handleTakeItem}
          onRequireFlag={handleRequireFlag}
          onApplyStyle={handleApplyStyle}
          onApplyColor={handleApplyColor}
          onRemoveEffects={handleRemoveEffects}
          entities={project.entities}
          inventory={project.inventory}
          flags={project.flags}
        />
      )}
    </div>
  );
}

function blocksToHtml(blocks: DialogueBlock[], entities: Array<{ name: string; color: string }>): string {
  return blocks.map((block) => {
    const text = applyEffectsToText(block.text, block.effects);
    return `<p data-speaker="${block.speaker}">${text}</p>`;
  }).join("\n");
}

function applyEffectsToText(text: string, effects: InlineEffect[]): string {
  let result = text;
  for (const effect of effects) {
    if (effect.type === "give_item") {
      result = result.replace(
        new RegExp(effect.targetId, "i"),
        `<span data-effect="give_item" data-id="${effect.targetId}" class="inline-flex items-center gap-0.5 px-1 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">${effect.targetId}</span>`,
      );
    }
  }
  return result;
}

function parseHtmlToBlocks(html: string): DialogueBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const paragraphs = doc.querySelectorAll("p");
  const blocks: DialogueBlock[] = [];
  const seen = new Set<string>();

  paragraphs.forEach((p) => {
    let speaker = p.getAttribute("data-speaker") || "Narrator";

    // Handle div-wrapped structure from NodeView
    const parentDiv = p.closest("[data-speaker]");
    if (parentDiv && parentDiv.getAttribute("data-speaker")) {
      speaker = parentDiv.getAttribute("data-speaker") || speaker;
    }

    // Get text content, excluding inline chip labels
    const text = p.textContent || "";
    const id = `${speaker}::${text}`;
    if (seen.has(id)) return;
    seen.add(id);

    const effects: InlineEffect[] = [];

    p.querySelectorAll("[data-effect]").forEach((span) => {
      const effectType = span.getAttribute("data-effect");
      const targetId = span.getAttribute("data-id");
      if (effectType && targetId) {
        effects.push({
          id: crypto.randomUUID(),
          type: effectType as InlineEffect["type"],
          targetId,
        });
      }
    });

    if (text.trim()) {
      blocks.push({
        id: crypto.randomUUID(),
        speaker,
        text: text.trim(),
        expression: "Neutral",
        effects,
      });
    }
  });

  return blocks;
}
