import React, { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark } from "@tiptap/core";
import ContextMenu from "./ContextMenu";
import { InlineCommandNode } from "../extensions/InlineCommand";
import { handleSlashCommand } from "../utils/inlineCommandUtils";

const STYLE_CLASS_MAP: Record<string, string> = {
  shake: "animate-shake",
  glitch: "animate-glitch",
  glow: "text-glow",
  whisper: "text-whisper",
  redacted: "text-redacted",
  wiggle: "animate-wiggle",
};

interface ScriptEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

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

export default function ScriptEditor({ initialContent, onChange, placeholder }: ScriptEditorProps) {
  const [menuState, setMenuState] = React.useState<{ x: number; y: number; selectedText: string } | null>(null);

  const handleSlashKey = useCallback((view: any, event: KeyboardEvent) => {
    return handleSlashCommand(view, event);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, code: false, blockquote: false, horizontalRule: false, codeBlock: false }),
      TextStyleMark,
      TextColorMark,
      InlineCommandNode,
      Placeholder.configure({ placeholder: placeholder || "Write your scene script here..." }),
    ],
    editorProps: {
      attributes: { class: "max-w-none focus:outline-none min-h-[60px] p-2 text-sm leading-relaxed" },
      handleKeyDown: handleSlashKey,
      handleDOMEvents: {
        contextmenu: (view, event) => {
          event.preventDefault();
          const { from, to } = view.state.selection;
          const selectedText = view.state.doc.textBetween(from, to);
          if (!selectedText) return true;
          setMenuState({ x: event.clientX, y: event.clientY, selectedText });
          return true;
        },
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && initialContent !== undefined && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent || "");
    }
  }, [editor, initialContent]);

  const handleApplyStyle = React.useCallback((style: string) => {
    if (!editor) return;
    const currentStyles = editor.getAttributes("textStyle").styles as string || "";
    const styles = currentStyles ? currentStyles.split(" ").filter(Boolean) : [];
    const idx = styles.indexOf(style);
    if (idx >= 0) {
      styles.splice(idx, 1);
    } else {
      styles.push(style);
    }
    if (styles.length > 0) {
      editor.chain().focus().setMark("textStyle", { styles: styles.join(" ") }).setTextSelection(editor.state.selection.to).run();
    } else {
      editor.chain().focus().unsetMark("textStyle").setTextSelection(editor.state.selection.to).run();
    }
    setMenuState(null);
  }, [editor]);

  const handleApplyColor = React.useCallback((color: string) => {
    if (!editor) return;
    const { to } = editor.state.selection;
    editor.chain().focus().toggleMark("textColor", { color }).setTextSelection(to).run();
    setMenuState(null);
  }, [editor]);

  const handleRemoveEffects = React.useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetMark("textStyle").unsetMark("textColor").run();
    setMenuState(null);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative flex-1">
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
