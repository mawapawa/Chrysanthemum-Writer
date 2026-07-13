import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import React, { useRef, useEffect, useState, useCallback } from "react";

export interface InlineCommandAttrs {
  type: string;
  label: string;
  isFinalized: boolean;
  blockData: string; // JSON of full SceneBlock for round-tripping
}

export const InlineCommandNode = Node.create<{ onFinalize?: (attrs: InlineCommandAttrs) => void }>({
  name: "inlineCommand",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      type: { default: "" },
      label: { default: "" },
      isFinalized: { default: false },
      blockData: { default: "" },
    };
  },

  parseHTML() {
    return [{
      tag: "span[data-block]",
      getAttrs: (el) => {
        if (typeof el === "string") return false;
        const blockAttr = (el as HTMLElement).getAttribute("data-block");
        if (!blockAttr) return false;
        try {
          const parsed = JSON.parse(decodeURIComponent(blockAttr));
          return { type: parsed.type || "", label: "", isFinalized: true };
        } catch {
          return false;
        }
      },
    }];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as unknown as InlineCommandAttrs;
    if (attrs.isFinalized) {
      const color = commandColor(attrs.type);
      const data = attrs.blockData || encodeURIComponent(JSON.stringify({ type: attrs.type, label: attrs.label }));
      return [
        "span",
        {
          "data-block": data,
          class: `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${color} border`,
          style: "user-select: none; cursor: default; vertical-align: middle;",
        },
        `${commandIcon(attrs.type)} ${attrs.label}`,
      ];
    }
    return [
      "span",
      { "data-inline-command": "" },
      "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineCommandNodeView);
  },

  addCommands() {
    return {
      insertInlineCommand:
        (attrs: Record<string, any>) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { ...attrs, isFinalized: false },
          });
        },
    } as any;
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const node = selection.$anchor.nodeBefore;
        if (node?.type.name === this.name && !node.attrs.isFinalized) {
          editor.commands.deleteSelection();
          return true;
        }
        return false;
      },
    };
  },
});

function commandColor(type: string): string {
  const colors: Record<string, string> = {
    stat: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    flag: "text-amber-300 bg-amber-500/15 border-amber-500/30",
    link: "text-indigo-300 bg-indigo-500/15 border-indigo-500/30",
    dialogue: "text-sky-300 bg-sky-500/15 border-sky-500/30",
    effect: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    condition: "text-rose-300 bg-rose-500/15 border-rose-500/30",
    redirect: "text-teal-300 bg-teal-500/15 border-teal-500/30",
    ending: "text-rose-300 bg-rose-500/15 border-rose-500/30",
    item: "text-pink-300 bg-pink-500/15 border-pink-500/30",
    bgm: "text-blue-300 bg-blue-500/15 border-blue-500/30",
    sfx: "text-purple-300 bg-purple-500/15 border-purple-500/30",
    bg: "text-green-300 bg-green-500/15 border-green-500/30",
    delay: "text-orange-300 bg-orange-500/15 border-orange-500/30",
  };
  return colors[type] || "text-slate-300 bg-slate-500/15 border-slate-500/30";
}

function commandIcon(type: string): string {
  const icons: Record<string, string> = {
    stat: "📊",
    flag: "🚩",
    link: "🔗",
    dialogue: "💬",
    effect: "⚡",
    condition: "👁️",
    redirect: "🔀",
    ending: "🏁",
    bgm: "🎵",
    sfx: "💥",
    bg: "🖼️",
    delay: "⏳",
    item: "🎒",
  };
  return icons[type] || "📝";
}

type Step = "command" | "argument" | "value" | "done";

interface StepConfig {
  prompt: string;
  options?: string[];
}

const COMMAND_STEPS: Record<string, StepConfig[]> = {
  stat: [
    { prompt: "Stat name...", options: undefined },
    { prompt: "Value (e.g. +10, -5, =0)", options: undefined },
  ],
  flag: [
    { prompt: "Flag name...", options: undefined },
    { prompt: "Value: true or false", options: ["true", "false"] },
  ],
  link: [
    { prompt: "Target scene...", options: undefined },
    { prompt: "Choice text (optional)", options: undefined },
  ],
  dialogue: [
    { prompt: "Speaker name...", options: undefined },
    { prompt: "Dialogue text...", options: undefined },
  ],
  effect: [
    { prompt: "Effect type", options: ["+", "-", "="] },
    { prompt: "Value", options: undefined },
  ],
  condition: [
    { prompt: "Variable name...", options: undefined },
    { prompt: "Operator", options: [">=", "<=", ">", "<", "==", "!="] },
    { prompt: "Value", options: undefined },
  ],
  redirect: [
    { prompt: "Target scene...", options: undefined },
  ],
  ending: [
    { prompt: "Ending type", options: ["GOOD", "BAD", "NORMAL", "NEUTRAL"] },
    { prompt: "Ending name (optional)", options: undefined },
  ],
  bgm: [{ prompt: "Track name...", options: undefined }],
  sfx: [{ prompt: "Sound name...", options: undefined }],
  bg: [{ prompt: "Image path or color...", options: undefined }],
  delay: [{ prompt: "Seconds (e.g. 2)", options: undefined }],
  item: [
    { prompt: "Give or take?", options: ["give", "take"] },
    { prompt: "Item name...", options: undefined },
  ],
};

function InlineCommandNodeView({ node, updateAttributes, editor, getPos }: {
  node: any; updateAttributes: any; editor: any; getPos: any;
}) {
  const attrs = node.attrs as InlineCommandAttrs;
  const [step, setStep] = useState<number>(0);
  const [values, setValues] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!attrs.isFinalized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step, attrs.isFinalized]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = currentInput.trim();
      if (!trimmed && step > 0) {
        // Allow empty for optional fields
      }
      const newValues = [...values, trimmed];
      setValues(newValues);

      if (!attrs.type) {
        // First step — selecting command type
        // Find matching command
        const cmd = Object.keys(COMMAND_STEPS).find(c =>
          c.startsWith(trimmed.toLowerCase()) || trimmed.toLowerCase().startsWith(c)
        );
        if (cmd) {
          updateAttributes({ type: cmd });
          setStep(1);
          setCurrentInput("");
        }
        return;
      }

      const steps = COMMAND_STEPS[attrs.type];
      if (!steps) {
        const full = newValues.filter(Boolean).join(" ");
        finalize(attrs.type, full, buildBlockData(attrs.type, newValues));
        return;
      }

      if (step >= steps.length - 1) {
        // Final step — build label and finalize
        const label = buildLabel(attrs.type, newValues);
        finalize(attrs.type, label, buildBlockData(attrs.type, newValues));
      } else {
        setStep(s => s + 1);
        setCurrentInput("");
      }
    }

    if (e.key === "Backspace" && !currentInput) {
      e.preventDefault();
      // Delete this node
      const pos = getPos();
      if (typeof pos === "number") {
        editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
        editor.commands.focus();
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      // Cancel — delete node and move cursor back
      const pos = getPos();
      if (typeof pos === "number") {
        editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
        editor.commands.focus();
      }
    }
  }, [currentInput, values, step, attrs.type, attrs.isFinalized]);

  const finalize = useCallback((type: string, label: string, blockData?: string) => {
    const attrs: Record<string, any> = { type, label, isFinalized: true };
    if (blockData) attrs.blockData = blockData;
    updateAttributes(attrs);
    // Move cursor after the badge
    const pos = getPos();
    if (typeof pos === "number") {
      editor.commands.focus();
      editor.commands.setTextSelection({ from: pos + node.nodeSize + 1, to: pos + node.nodeSize + 1 });
    }
  }, [getPos, editor, node.nodeSize]);

  if (attrs.isFinalized) {
    const color = commandColor(attrs.type);
    const handleClick = () => {
      // Re-open for editing — reset to command selection
      setStep(0);
      setValues([]);
      setCurrentInput("");
      updateAttributes({ isFinalized: false, type: "", label: "" });
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${color} border cursor-pointer hover:opacity-80 transition-opacity`}
        style={{ userSelect: "none", verticalAlign: "middle" }}
        contentEditable={false}
        onClick={handleClick}
      >
        {commandIcon(attrs.type)} {attrs.label}
      </span>
    );
  }

  const steps = COMMAND_STEPS[attrs.type] || null;
  const currentStep = steps ? steps[Math.min(step, steps.length - 1)] : null;
  const prompt = attrs.type ? (currentStep?.prompt || "Type and press Enter...") : "Type a command (stat, flag, link, etc.)...";
  const width = Math.max(80, Math.min(300, (currentInput.length + prompt.length) * 8 + 24));

  return (
    <span className="inline-flex items-center" style={{ verticalAlign: "middle" }} contentEditable={false}>
      {!attrs.type && <span className="text-[10px] text-indigo-400 mr-1 font-mono">/</span>}
      <input
        ref={inputRef}
        type="text"
        value={currentInput}
        onChange={e => setCurrentInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!attrs.isFinalized) {
            const pos = getPos();
            if (typeof pos === "number") {
              editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
            }
          }
        }}
        placeholder={prompt}
        className="bg-slate-800 border border-indigo-500/50 text-white text-xs rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        style={{ width, minWidth: 80, maxWidth: 300 }}
        spellCheck={false}
      />
      {currentStep?.options && (
        <span className="ml-1 text-[9px] text-slate-500 font-mono">
          [{currentStep.options.join("/")}]
        </span>
      )}
    </span>
  );
}

function buildLabel(type: string, values: string[]): string {
  switch (type) {
    case "stat": return `${values[0]} ${values[1] || ""}`;
    case "flag": return `${values[0]} = ${values[1] || "true"}`;
    case "link": return values[1] ? `${values[0]}: ${values[1]}` : values[0];
    case "dialogue": return `${values[0]}: "${values[1] || ""}"`;
    case "effect": return `${values[0]}${values[1] || ""}`;
    case "condition": return `${values[0]} ${values[1] || ">="} ${values[2] || 1}`;
    case "redirect": return `→ ${values[0]}`;
    case "ending": return `${values[0]}${values[1] ? `: ${values[1]}` : ""}`;
    case "item": return `${values[0]} ${values[1] || ""}`;
    default: return values.filter(Boolean).join(" ");
  }
}

function buildBlockData(type: string, values: string[]): string {
  // Build a proper SceneBlock from the command input values
  let block: Record<string, any> = { type };
  switch (type) {
    case "stat": block.variableName = values[0] || ""; block.operation = "+"; block.value = parseInt(values[1]) || 0; break;
    case "flag": block.flagName = values[0] || ""; block.flagValue = values[1] !== "false"; break;
    case "link": block.text = values[0] || ""; block.targetNodeId = values[1] || ""; break;
    case "dialogue": block.speaker = values[0] || "Narrator"; block.text = values[1] || ""; break;
    case "effect": block.operation = values[0] || "+"; block.value = parseInt(values[1]) || 0; block.variableName = values[2] || ""; break;
    case "condition": block.source = "tracker"; block.targetId = values[0] || ""; block.operator = values[1] || ">="; block.compareValue = parseInt(values[2]) || 1; break;
    case "redirect": block.targetNodeId = values[0] || ""; break;
    case "ending": block.endingType = values[0] || "NORMAL"; block.endingName = values[1] || ""; break;
    case "item": block.action = values[0] || "give"; block.itemName = values[1] || ""; break;
    case "bgm": block.trackName = values[0] || ""; break;
    case "sfx": block.soundName = values[0] || ""; break;
    case "bg": block.asset = values[0] || ""; break;
    case "delay": block.seconds = parseFloat(values[0]) || 1; break;
    default: block.label = values.join(" "); break;
  }
  return encodeURIComponent(JSON.stringify(block));
}
