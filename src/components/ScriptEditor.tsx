import React, { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Paragraph from "@tiptap/extension-paragraph";
import { Mark, Node as ProseNode } from "@tiptap/core";
import { VNProject, DialogueBlock, InlineEffect } from "../types";
import ContextMenu from "./ContextMenu";
import WikiLinkPopup, { WikiLinkMatch } from "./WikiLinkPopup";
import VariableSuggestPopup, { Suggestion } from "./VariableSuggestPopup";
import WikilinkSuggestPopup, { NodeMatch } from "./WikilinkSuggestPopup";

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
  onCreateNode?: (title: string) => string | null;
  onSelectNode?: (nodeId: string) => void;
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

const WikiLinkMark = Mark.create({
  name: "wikiLink",
  addAttributes() {
    return { type: { default: "" }, targetId: { default: "" }, label: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-link]" }];
  },
  renderHTML({ mark }) {
    return ["span", {
      "data-link": mark.attrs.type,
      "data-id": mark.attrs.targetId,
      class: "border-b border-dotted border-indigo-400/50 text-indigo-300 cursor-pointer",
      title: mark.attrs.label,
    }, 0];
  },
});

function findMatchInRegistries(text: string, project: VNProject): WikiLinkMatch | null {
  for (const e of project.entities) if (e.name === text) return { type: "entity", targetId: e.id, label: e.name };
  for (const i of project.inventory) if (i.name === text) return { type: "item", targetId: i.id, label: i.name };
  for (const f of project.flags) if (f.name === text) return { type: "flag", targetId: f.id, label: f.name };
  for (const t of project.trackers) if (t.name === text) return { type: "tracker", targetId: t.id, label: t.name };
  return null;
}

export default function ScriptEditor({
  project, nodeId, dialogueTimeline, onUpdateTimeline, onCreateNode, onSelectNode,
}: ScriptEditorProps) {
  const [menuState, setMenuState] = useState<{
    x: number; y: number; selectedText: string;
  } | null>(null);
  const [wikiMatch, setWikiMatch] = useState<{
    x: number; y: number; match: WikiLinkMatch;
  } | null>(null);
  const [varSuggest, setVarSuggest] = useState<{
    x: number; y: number; query: string; suggestions: Suggestion[];
  } | null>(null);
  const [wikiLinkSuggest, setWikiLinkSuggest] = useState<{
    x: number; y: number; title: string; matches: NodeMatch[];
  } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      DialogueParagraph,
      TextStyleMark,
      TextColorMark,
      ItemChip,
      WikiLinkMark,
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

  const prevNodeId = useRef(nodeId);
  const initialized = useRef(false);

  useEffect(() => {
    if (!editor) return;
    if (prevNodeId.current !== nodeId || !initialized.current) {
      initialized.current = true;
      prevNodeId.current = nodeId;
      const html = blocksToHtml(dialogueTimeline, project.inventory);
      editor.commands.setContent(html || "");
    }
  }, [nodeId, dialogueTimeline, editor]);

  _entitiesForBadge = project.entities;

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      requestAnimationFrame(() => {
        if (!editor || !editor.isEditable) return;
        const { from, to } = editor.state.selection;
        if (from === to) { setWikiMatch(null); return; }
        const text = editor.state.doc.textBetween(from, to);
        if (!text || text.length > 80) { setWikiMatch(null); return; }
        const match = findMatchInRegistries(text, project);
        if (match) {
          const coords = editor.view.coordsAtPos(to);
          setWikiMatch({ x: Math.max(0, coords.left - 40), y: coords.bottom + 4, match });
        } else {
          setWikiMatch(null);
        }
      });
    };
    editor.on("selectionUpdate", handler);
    return () => { editor.off("selectionUpdate", handler); };
  }, [editor, project]);

  // $variable detection
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      requestAnimationFrame(() => {
        if (!editor || !editor.isEditable) return;
        const { $head } = editor.state.selection;
        if (!$head.parent) { setVarSuggest(null); return; }
        const textBefore = $head.parent.textBetween(Math.max(0, $head.parentOffset - 30), $head.parentOffset);
        const match = textBefore.match(/\$([a-zA-Z_]*)$/);
        if (!match) { setVarSuggest(null); return; }
        const query = match[1];
        const allCandidates: Suggestion[] = [
          ...project.trackers.map(t => ({ id: t.id, name: t.name, type: "tracker" as const, defaultValue: t.defaultValue })),
          ...project.flags.map(f => ({ id: f.id, name: f.name, type: "flag" as const, defaultValue: f.defaultValue })),
        ];
        const filtered = query ? allCandidates.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : allCandidates;
        if (filtered.length === 0) { setVarSuggest(null); return; }
        const coords = editor.view.coordsAtPos($head.pos);
        if (!coords) { setVarSuggest(null); return; }
        setVarSuggest({ x: Math.max(0, coords.left - 20), y: coords.bottom + 4, query, suggestions: filtered.slice(0, 10) });
      });
    };
    editor.on("selectionUpdate", handler);
    return () => { editor.off("selectionUpdate", handler); };
  }, [editor, project.trackers, project.flags]);

  // [[wikilink]] detection
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      requestAnimationFrame(() => {
        if (!editor || !editor.isEditable) return;
        const { $head } = editor.state.selection;
        if (!$head.parent) { setWikiLinkSuggest(null); return; }
        const textBefore = $head.parent.textBetween(Math.max(0, $head.parentOffset - 50), $head.parentOffset);
        const match = textBefore.match(/\[\[([^\]]*)\]\]$/);
        if (!match) { setWikiLinkSuggest(null); return; }
        const title = match[1].trim();
        if (!title) { setWikiLinkSuggest(null); return; }
        const allNodes = Object.values(project.nodes);
        const existing = allNodes.filter(n => n.title.toLowerCase().includes(title.toLowerCase()));
        const matches: NodeMatch[] = [];
        if (existing.length > 0) {
          existing.forEach(n => matches.push({ id: n.id, title: n.title, exists: true }));
        }
        if (!existing.some(n => n.title.toLowerCase() === title.toLowerCase())) {
          matches.push({ id: "new", title, exists: false });
        }
        const coords = editor.view.coordsAtPos($head.pos);
        if (!coords) { setWikiLinkSuggest(null); return; }
        setWikiLinkSuggest({ x: Math.max(0, coords.left - 20), y: coords.bottom + 4, title, matches: matches.slice(0, 8) });
      });
    };
    editor.on("selectionUpdate", handler);
    return () => { editor.off("selectionUpdate", handler); };
  }, [editor, project.nodes]);

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
    const { to } = editor.state.selection;
    editor.chain().focus()
      .toggleMark("textStyle", { styles: style })
      .setTextSelection(to)
      .run();
    setMenuState(null);
  }, [editor]);

  const handleApplyColor = useCallback((color: string) => {
    if (!editor) return;
    const { to } = editor.state.selection;
    editor.chain().focus()
      .toggleMark("textColor", { color })
      .setTextSelection(to)
      .run();
    setMenuState(null);
  }, [editor]);

  const handleRemoveEffects = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetMark("textStyle").unsetMark("textColor").run();
    setMenuState(null);
  }, [editor]);

  const handleAcceptWikiLink = useCallback(() => {
    if (!editor || !wikiMatch) return;
    const { from, to } = editor.state.selection;
    editor.chain().focus()
      .setMark("wikiLink", {
        type: wikiMatch.match.type,
        targetId: wikiMatch.match.targetId,
        label: wikiMatch.match.label,
      })
      .setTextSelection(to)
      .unsetMark("wikiLink")
      .run();
    setWikiMatch(null);
  }, [editor, wikiMatch]);

  const handleWikiLinkSelect = useCallback((nm: NodeMatch) => {
    if (!editor) return;
    const { $head } = editor.state.selection;
    const textBefore = $head.parent.textBetween(Math.max(0, $head.parentOffset - 50), $head.parentOffset);
    const match = textBefore.match(/\[\[([^\]]*)\]\]$/);
    if (!match) { setWikiLinkSuggest(null); return; }
    const from = $head.pos - match[0].length;
    const to = $head.pos;
    let targetId = nm.id;
    if (!nm.exists && onCreateNode) {
      const newId = onCreateNode(nm.title);
      if (newId) targetId = newId;
    }
    editor.chain().focus()
      .deleteRange({ from, to })
      .insertContent(nm.title)
      .setTextSelection(from)
      .setMark("wikiLink", { type: "node", targetId, label: nm.title })
      .run();
    if (!nm.exists && targetId !== "new" && onSelectNode) {
      onSelectNode(targetId);
    }
    setWikiLinkSuggest(null);
  }, [editor, onCreateNode, onSelectNode]);

  const handleSelectVariable = useCallback((suggestion: Suggestion) => {
    if (!editor) return;
    const { $head } = editor.state.selection;
    const textBefore = $head.parent.textBetween(Math.max(0, $head.parentOffset - 30), $head.parentOffset);
    const match = textBefore.match(/\$([a-zA-Z_]*)$/);
    if (!match) { setVarSuggest(null); return; }
    const from = $head.pos - match[0].length;
    const to = $head.pos;
    editor.chain().focus()
      .deleteRange({ from, to })
      .insertContent({
        type: "itemChip",
        attrs: {
          effect: suggestion.type === "tracker" ? "adjust_tracker" : "set_flag",
          targetId: suggestion.id,
          label: suggestion.name,
        },
      })
      .run();
    setVarSuggest(null);
  }, [editor]);

  const handleAdjustTracker = useCallback((trackerId: string, operation: string, value: number, trackerName: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    editor.chain().focus().insertContent({
      type: "itemChip",
      attrs: {
        effect: "adjust_tracker",
        targetId: trackerId,
        label: `${trackerName} ${operation === "set" ? "=" : operation === "add" ? "+" : "-"}${value}`,
      },
    }).run();
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
      {wikiMatch && (
        <WikiLinkPopup
          x={wikiMatch.x}
          y={wikiMatch.y}
          match={wikiMatch.match}
          onAccept={handleAcceptWikiLink}
          onDismiss={() => setWikiMatch(null)}
        />
      )}
      {wikiLinkSuggest && (
        <WikilinkSuggestPopup
          x={wikiLinkSuggest.x}
          y={wikiLinkSuggest.y}
          title={wikiLinkSuggest.title}
          matches={wikiLinkSuggest.matches}
          onSelect={handleWikiLinkSelect}
          onDismiss={() => setWikiLinkSuggest(null)}
        />
      )}
      {varSuggest && (
        <VariableSuggestPopup
          x={varSuggest.x}
          y={varSuggest.y}
          query={varSuggest.query}
          suggestions={varSuggest.suggestions}
          onSelect={handleSelectVariable}
          onDismiss={() => setVarSuggest(null)}
        />
      )}
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
          onAdjustTracker={handleAdjustTracker}
          entities={project.entities}
          inventory={project.inventory}
          flags={project.flags}
          trackers={project.trackers}
        />
      )}
    </div>
  );
}

function blocksToHtml(
  blocks: DialogueBlock[],
  inventory: Array<{ id: string; name: string }>,
): string {
  return blocks.map((block) => {
    const text = applyEffectsToText(block.text, block.effects, inventory);
    return `<p data-speaker="${block.speaker}">${text}</p>`;
  }).join("\n");
}

function applyEffectsToText(
  text: string,
  effects: InlineEffect[],
  inventory: Array<{ id: string; name: string }>,
): string {
  let result = text;
  for (const effect of effects) {
    if (effect.type === "give_item" || effect.type === "take_item") {
      const item = inventory.find(i => i.id === effect.targetId);
      const displayName = item?.name || effect.targetId;
      const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (result.match(new RegExp(escaped, "i"))) {
        result = result.replace(
          new RegExp(escaped, "i"),
          `<span data-effect="${effect.type}" data-id="${effect.targetId}" class="inline-flex items-center gap-0.5 px-1 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">${displayName}</span>`,
        );
      }
    }
  }
  return result;
}

function parseHtmlToBlocks(html: string): DialogueBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const paragraphs = doc.querySelectorAll("p");
  const blocks: DialogueBlock[] = [];

  paragraphs.forEach((p) => {
    const speaker = p.getAttribute("data-speaker") || "Narrator";
    const text = p.textContent || "";

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
