import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { flushSync } from "react-dom";

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
          return { type: parsed.type || "", label: "", isFinalized: true, blockData: blockAttr };
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
      const displayLabel = (() => {
        try {
          const raw = attrs.blockData || "";
          if (!raw) return blockFallbackLabel({ type: attrs.type, label: attrs.label });
          const parsed = JSON.parse(decodeURIComponent(raw));
          return blockFallbackLabel(parsed);
        } catch {
          return attrs.label || attrs.type;
        }
      })();
      return [
        "span",
        {
          "data-block": attrs.blockData || encodeURIComponent(JSON.stringify({ type: attrs.type })),
          class: `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${color} border`,
          style: "user-select: none; cursor: default; vertical-align: middle;",
        },
        `${commandIcon(attrs.type)} ${displayLabel}`,
      ];
    }
    return [
      "span",
      { "data-inline-command": "" },
      "",
    ];
  },

  addStorage() {
    return {
      entityNames: [] as string[],
      entityData: [] as { name: string; trackers: string[]; flags: string[]; expressions: string[] }[],
      nodeEntries: [] as { title: string; id: string }[],
      createNodeWithTitle: undefined as ((title: string) => string) | undefined,
      inventoryItemNames: [] as string[],
      createInventoryItem: undefined as ((name: string) => void) | undefined,
      segmentNames: [] as string[],
      createEntity: undefined as ((name: string) => void) | undefined,
    };
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
      Delete: ({ editor }) => {
        const { selection } = editor.state;
        const node = selection.$anchor.nodeAfter;
        if (node?.type.name === this.name && !node.attrs.isFinalized) {
          editor.commands.deleteSelection();
          return true;
        }
        return false;
      },
    };
  },
});

export function commandColor(type: string): string {
  const colors: Record<string, string> = {
    stat: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    flag: "text-amber-300 bg-amber-500/15 border-amber-500/30",
    link: "text-indigo-300 bg-indigo-500/15 border-indigo-500/30",
    choice: "text-indigo-300 bg-indigo-500/15 border-indigo-500/30",
    dialogue: "text-sky-300 bg-sky-500/15 border-sky-500/30",
    effect: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    condition: "text-rose-300 bg-rose-500/15 border-rose-500/30",
    redirect: "text-teal-300 bg-teal-500/15 border-teal-500/30",
    continue: "text-teal-300 bg-teal-500/15 border-teal-500/30",
    ending: "text-rose-300 bg-rose-500/15 border-rose-500/30",
    item: "text-pink-300 bg-pink-500/15 border-pink-500/30",
    bgm: "text-blue-300 bg-blue-500/15 border-blue-500/30",
    sfx: "text-purple-300 bg-purple-500/15 border-purple-500/30",
    bg: "text-green-300 bg-green-500/15 border-green-500/30",
    delay: "text-orange-300 bg-orange-500/15 border-orange-500/30",
    use_item: "text-violet-300 bg-violet-500/15 border-violet-500/30",
    intercept: "text-yellow-300 bg-yellow-500/15 border-yellow-500/30",
    trigger: "text-cyan-300 bg-cyan-500/15 border-cyan-500/30",
  };
  return colors[type] || "text-slate-300 bg-slate-500/15 border-slate-500/30";
}

export function commandIcon(type: string): string {
  const icons: Record<string, string> = {
    stat: "📊",
    flag: "🚩",
    link: "🔗",
    choice: "🔗",
    dialogue: "💬",
    effect: "⚡",
    condition: "👁️",
    redirect: "🔀",
    continue: "🔀",
    ending: "🏁",
    bgm: "🎵",
    sfx: "💥",
    bg: "🖼️",
    delay: "⏳",
    item: "🎒",
    use_item: "🧪",
    intercept: "🚧",
    trigger: "⏰",
  };
  return icons[type] || "📝";
}

function blockFallbackLabel(block: any): string {
  switch (block.type) {
    case "dialogue": return `${block.speaker || "?"}: "${block.text || ""}"`;
    case "narrative": return block.text || "";
    case "effect":
    case "stat": return `${block.variableName || "?"} ${block.operation || "+"}${block.value || 0}`;
    case "statDisplay": return `${block.variableName || "?"}: ?`;
    case "choice":
    case "link": return `Choice: ${block.text || "?"}`;
    case "entity": return block.entityId ? `Entity: ${block.entityId}` : "?";
    case "flag": return `${block.flagName || "?"} = ${block.flagValue !== undefined ? block.flagValue : "?"}`;
    case "condition":
    case "conditional": return `${block.targetId || "?"} ${block.operator || ">="} ${block.compareValue || 1}`;
    case "redirect":
    case "continue": return `→ ${block.targetNodeId || "?"}`;
    case "ending": return `${block.endingType || "?"}${block.endingName ? `: ${block.endingName}` : ""}`;
    case "itemEffect":
    case "item": return block.action === "use" ? `🧪 ${block.itemName || "?"}` : `${block.itemName || "?"}`;
    case "bgm": return block.trackName || "?";
    case "sfx": return block.soundName || "?";
    case "background": return block.asset || "?";
    case "delay": return `${block.seconds || 1}s`;
    case "time": return block.action === "set_date" ? `⏰ ${block.dateString || "?"}` : block.action === "set" ? `⏰ ${block.segment || "?"}` : `⏰ +${block.value || 1} ${block.unit || "tick"}${(block.value || 1) > 1 ? "s" : ""}`;
    case "intercept": return `🚧 Intercept: ${block.targetLocationId || "?"}${block.condition?.targetId ? ` if ${block.condition.source}.${block.condition.targetId}` : ""}`;
    case "trigger": return `⏰ ${block.source || "?"}.${block.targetId || "?"} ${block.source === "flag" ? `= ${block.expect ?? true}` : `>= ${block.min ?? 1}`}`;
    default: return block.type || "?";
  }
}

interface StepConfig {
  prompt: string;
  options?: string[];
}

const COMMAND_STEPS: Record<string, StepConfig[]> = {
  stat: [
    { prompt: "Entity...", options: undefined },
    { prompt: "Stat name...", options: undefined },
    { prompt: "Value (e.g. +10, -5, =0)", options: undefined },
  ],
  flag: [
    { prompt: "Entity...", options: undefined },
    { prompt: "Flag name...", options: undefined },
    { prompt: "Active or Inactive?", options: ["Active", "Inactive"] },
  ],
  choice: [
    { prompt: "Choice text...", options: undefined },
    { prompt: "Target scene...", options: undefined },
  ],
  dialogue: [
    { prompt: "Speaker name...", options: undefined },
    { prompt: "Tone", options: ["Neutral", "Smile", "Surprise", "Serious", "Sad", "Angry"] },
    { prompt: "Dialogue text...", options: undefined },
  ],
  condition: [
    { prompt: "Variable name...", options: undefined },
    { prompt: "Operator", options: [">=", "<=", ">", "<", "==", "!="] },
    { prompt: "Value", options: undefined },
  ],
  continue: [
    { prompt: "Target scene...", options: undefined },
  ],
  ending: [
    { prompt: "Ending type", options: ["GOOD", "BAD", "NORMAL", "NEUTRAL"] },
    { prompt: "Ending name (optional)", options: undefined },
  ],
  item: [
    { prompt: "Item name...", options: undefined },
    { prompt: "Give or take?", options: ["give", "take"] },
  ],
  time: [
    { prompt: "Action", options: ["add", "set segment", "set date"] },
    { prompt: "Unit / Segment / Date", options: undefined },
    { prompt: "Amount", options: undefined },
  ],
  use_item: [
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandTypes = Object.keys(COMMAND_STEPS);
  const filteredCommands = commandTypes.filter(cmd =>
    cmd.includes(currentInput.toLowerCase())
  );
  const entityNames: string[] = (editor as any)?.storage?.inlineCommand?.entityNames || [];
  const nodeEntries: { title: string; id: string }[] = (editor as any)?.storage?.inlineCommand?.nodeEntries || [];

  useEffect(() => {
    if (!attrs.isFinalized || isEditing) {
      if (inputRef.current) {
        const el = inputRef.current;
        setTimeout(() => el.focus(), 0);
      }
    }
  });

  const commitValue = useCallback((value: string) => {
    if (!attrs.type) {
      const cmd = Object.keys(COMMAND_STEPS).find(c =>
        c.startsWith(value.toLowerCase()) || value.toLowerCase().startsWith(c)
      );
      if (cmd) {
        flushSync(() => {
          setCurrentInput("");
          setSelectedIndex(0);
        });
        updateAttributes({ type: cmd, label: cmd });
        setStep(0);
      }
      return;
    }

    const newValues = [...values, value];
    setValues(newValues);
    const steps = COMMAND_STEPS[attrs.type];
    if (!steps || step >= steps.length - 1) {
      let blockValues = newValues;
      if (attrs.type === "choice" || attrs.type === "continue") {
        const sceneName = attrs.type === "choice" ? newValues[1] : newValues[0];
        if (sceneName) {
          const inlineStorage = (editor as any)?.storage?.inlineCommand;
          console.log("[COMMIT] storage keys:", Object.keys(inlineStorage || {}), "nodeEntries:", inlineStorage?.nodeEntries?.length, "createNode:", typeof inlineStorage?.createNodeWithTitle);
          const nodeEntriesList: { title: string; id: string }[] = inlineStorage?.nodeEntries || [];
          const match = nodeEntriesList.find((n: { title: string }) => n.title === sceneName);
          if (match) {
            console.log("[COMMIT] Found existing node:", sceneName, "-> id:", match.id);
            blockValues = attrs.type === "choice"
              ? [newValues[0], match.id]
              : [match.id];
          } else {
            const createNode = inlineStorage?.createNodeWithTitle;
            if (createNode) {
              const newId = createNode(sceneName);
              console.log("[COMMIT] Created node:", sceneName, "-> id:", newId);
              blockValues = attrs.type === "choice"
                ? [newValues[0], newId]
                : [newId];
            } else {
              console.warn("[COMMIT] createNodeWithTitle not available");
            }
          }
        }
      }
      if (attrs.type === "item" && step === 0) {
        const itemName = newValues[0];
        if (itemName) {
          const inlineStorage = (editor as any)?.storage?.inlineCommand;
          const names: string[] = inlineStorage?.inventoryItemNames || [];
          if (!names.includes(itemName)) {
            const createItem = inlineStorage?.createInventoryItem;
            if (createItem) createItem(itemName);
          }
        }
      }
      if ((attrs.type === "stat" || attrs.type === "flag") && step === 0) {
        const entityName = newValues[0];
        if (entityName) {
          const inlineStorage = (editor as any)?.storage?.inlineCommand;
          const names: string[] = inlineStorage?.entityNames || [];
          if (!names.includes(entityName)) {
            const createEntity = inlineStorage?.createEntity;
            if (createEntity) createEntity(entityName);
          }
        }
      }
      if (attrs.type === "use_item" && step === 0) {
        const itemName = newValues[0];
        if (itemName) {
          const inlineStorage = (editor as any)?.storage?.inlineCommand;
          const names: string[] = inlineStorage?.inventoryItemNames || [];
          if (!names.includes(itemName)) {
            const createItem = inlineStorage?.createInventoryItem;
            if (createItem) createItem(itemName);
          }
        }
      }
      const label = buildLabel(attrs.type, newValues);
      finalize(attrs.type, label, buildBlockData(attrs.type, blockValues));
    } else {
      setCurrentInput("");
      setStep(s => s + 1);
    }
  }, [values, step, attrs.type, selectedIndex, editor]);

  const steps = COMMAND_STEPS[attrs.type] || null;
  const currentStep = steps ? steps[Math.min(step, steps.length - 1)] : null;
  const entityData: { name: string; trackers: string[]; flags: string[]; expressions: string[] }[] = (editor as any)?.storage?.inlineCommand?.entityData || [];
  const inventoryItemNames: string[] = (editor as any)?.storage?.inlineCommand?.inventoryItemNames || [];
  const DEFAULT_TONES = ["Neutral", "Smile", "Surprise", "Serious", "Sad", "Angry"];
  const segmentNames: string[] = (editor as any)?.storage?.inlineCommand?.segmentNames || [];
  const dynamicOptionsVal = (attrs.type === "dialogue" && step === 0) || ((attrs.type === "stat" || attrs.type === "flag") && step === 0)
    ? entityNames
    : attrs.type === "dialogue" && step === 1 && values[0]
    ? (() => {
        const entity = entityData.find(e => e.name === values[0]);
        return [...new Set([...(entity?.expressions || []), ...DEFAULT_TONES])];
      })()
    : attrs.type === "stat" && step === 1 && values[0]
    ? entityData.find(e => e.name === values[0])?.trackers
    : attrs.type === "flag" && step === 1 && values[0]
    ? entityData.find(e => e.name === values[0])?.flags
    : (attrs.type === "choice" && step === 1) || (attrs.type === "continue" && step === 0)
    ? nodeEntries.map(n => n.title)
    : attrs.type === "item" && step === 0
    ? inventoryItemNames
    : attrs.type === "use_item" && step === 0
    ? inventoryItemNames
    : attrs.type === "time" && step === 1 && values[0] === "set segment"
    ? segmentNames
    : attrs.type === "time" && step === 1 && values[0] === "add"
    ? ["ticks", "days", "months"]
    : attrs.type === "time" && step === 1 && values[0] === "set date"
    ? undefined
    : currentStep?.options;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const optionsList = !attrs.type ? filteredCommands : dynamicOptionsVal;
    if (optionsList && e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, optionsList.length - 1));
      return;
    }
    if (optionsList && e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const input = (e.currentTarget as HTMLInputElement).value;
      const trimmed = input.trim();
      const options = !attrs.type ? filteredCommands : dynamicOptionsVal;
      if (options) {
        const filtered = options.filter(opt => !trimmed || opt.toLowerCase().includes(trimmed.toLowerCase()));
        if (filtered[selectedIndex]) {
          commitValue(filtered[selectedIndex]);
          return;
        }
      }
      commitValue(trimmed || (attrs.type ? values[step] || "" : ""));
      return;
    }

    if (e.key === "Backspace" && !(e.currentTarget as HTMLInputElement).value) {
      e.preventDefault();
      if (isEditing) {
        setIsEditing(false);
      } else if (step > 0) {
        setValues(v => v.slice(0, -1));
        setStep(s => s - 1);
        setCurrentInput("");
      } else if (attrs.type) {
        setCurrentInput("");
        updateAttributes({ type: "", label: "" });
      } else {
        const pos = getPos();
        if (typeof pos === "number") {
          editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
          editor.commands.focus();
        }
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (isEditing) {
        setIsEditing(false);
      } else {
        const pos = getPos();
        if (typeof pos === "number") {
          editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
          editor.commands.focus();
        }
      }
    }
  }, [currentInput, values, step, attrs.type, filteredCommands, selectedIndex, commitValue, dynamicOptionsVal, isEditing]);

  const finalize = useCallback((type: string, label: string, blockData?: string) => {
    const newAttrs: Record<string, any> = { type, label, isFinalized: true };
    if (blockData) newAttrs.blockData = blockData;
    flushSync(() => {
      updateAttributes(newAttrs);
      setIsEditing(false);
    });
    const pos = getPos();
    if (typeof pos === "number") {
      editor.commands.focus();
      editor.commands.setTextSelection({ from: pos + node.nodeSize, to: pos + node.nodeSize });
    }
  }, [getPos, editor, node.nodeSize]);

  if (attrs.isFinalized && !isEditing) {
    const color = commandColor(attrs.type);
    const displayLabel = (() => {
      try {
        const raw = attrs.blockData || "";
        if (!raw) return attrs.label || attrs.type;
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (parsed.type === "continue" || parsed.type === "redirect") {
          const match = nodeEntries.find(n => n.id === parsed.targetNodeId);
          return `Continue to ${match?.title || parsed.targetNodeId || "?"}`;
        }
        return blockFallbackLabel(parsed);
      } catch {
        return attrs.label || attrs.type;
      }
    })();
    const handleClick = () => {
      setStep(0);
      setValues([]);
      setCurrentInput("");
      setIsEditing(true);
    };
    return (
      <NodeViewWrapper>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${color} border cursor-pointer hover:opacity-80 transition-opacity`}
          style={{ verticalAlign: "middle" }}
          contentEditable={false}
          onClick={handleClick}
        >
          {commandIcon(attrs.type)} {displayLabel}
        </span>
      </NodeViewWrapper>
    );
  }

  const prompt = attrs.type ? (currentStep?.prompt || "Type and press Enter...") : "Type a command (stat, flag, link, etc.)...";
  const width = Math.max(80, Math.min(300, (currentInput.length + prompt.length) * 8 + 24));

  return (
    <NodeViewWrapper>
      <span className="inline-flex flex-col gap-0.5" contentEditable={false}>
        <span className="inline-flex items-center flex-wrap gap-1">
          {/* Step labels: command type badge */}
          {attrs.type && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${commandColor(attrs.type)}`}>
              {commandIcon(attrs.type)} {attrs.type}
            </span>
          )}

          {/* Step labels: completed values */}
          {values.slice(0, step).map((v, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300">
              {v || "..."}
            </span>
          ))}

          {/* Current input */}
          {!attrs.type && <span className="text-[10px] text-indigo-400 mr-1 font-mono">/</span>}
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={currentInput}
            onChange={e => { setCurrentInput(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (attrs.isFinalized && isEditing) {
                setIsEditing(false);
              } else if (!attrs.isFinalized && !attrs.type && !currentInput) {
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

          {/* Step options dropdown (autocomplete) */}
          {dynamicOptionsVal && dynamicOptionsVal.length > 0 && (
            <div className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
              {dynamicOptionsVal
                .filter(opt => !currentInput || opt.toLowerCase().includes(currentInput.toLowerCase()))
                .map((opt, i) => (
                  <button
                    key={opt}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => commitValue(opt)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                      i === selectedIndex
                        ? "bg-indigo-600/30 text-indigo-200"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{opt}</span>
                  </button>
              ))}
            </div>
          )}
        </span>

        {/* Command type dropdown (only at step 0) */}
        {!attrs.type && filteredCommands.length > 0 && (
          <div className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => commitValue(cmd)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                  i === selectedIndex
                    ? "bg-indigo-600/30 text-indigo-200"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{commandIcon(cmd)}</span>
                <span>{cmd}</span>
              </button>
            ))}
          </div>
        )}
      </span>
    </NodeViewWrapper>
  );
}

function buildLabel(type: string, values: string[]): string {
  switch (type) {
    case "stat": return `${values[0] || "?"}.${values[1] || ""} ${values[2] || ""}`;
    case "flag": return `${values[0] || "?"}.${values[1] || ""} = ${values[2] || "Active"}`;
    case "link":
    case "choice": return `Choice: ${values[0]}`;
    case "dialogue": return `${values[0]}: "${values[2] || ""}"`;
    case "effect": return `${values[0]} ${values[1]}${values[2] || ""}`;
    case "condition": return `${values[0]} ${values[1] || ">="} ${values[2] || 1}`;
    case "redirect":
    case "continue": return `Continue to ${values[0]}`;
    case "ending": return `${values[0]}${values[1] ? `: ${values[1]}` : ""}`;
    case "item": return `${values[0]} ${values[1] || "give"}`;
    case "time": return values[0] === "set date" ? `⏰ Set date: ${values[1] || "?"}` : values[0] === "set segment" ? `⏰ ${values[1] || "?"}` : `⏰ +${values[2] || "?"} ${values[1] || ""}`;
    case "use_item": return `🧪 ${values[0] || "?"}`;
    default: return values.filter(Boolean).join(" ");
  }
}

function buildBlockData(type: string, values: string[]): string {
  let block: Record<string, any> = { type };
  switch (type) {
    case "stat": block.type = "effect"; block.variableName = values[0] ? `${values[0]}.${values[1] || ""}` : values[1] || ""; block.operation = "+"; block.value = parseInt(values[2]) || 0; break;
    case "flag": block.flagName = values[0] ? `${values[0]}.${values[1] || ""}` : values[1] || ""; block.flagValue = values[2] === "Active" || values[2] === undefined; break;
    case "link":
    case "choice": block.type = "choice"; block.text = values[0] || ""; block.targetNodeId = values[1] || ""; break;
    case "dialogue": block.speaker = values[0] || "Narrator"; block.expression = values[1] || "Neutral"; block.text = values[2] || ""; break;
    case "effect": block.variableName = values[0] || ""; block.operation = values[1] || "+"; block.value = parseInt(values[2]) || 0; break;
    case "condition": block.source = "tracker"; block.targetId = values[0] || ""; block.operator = values[1] || ">="; block.compareValue = parseInt(values[2]) || 1; break;
    case "redirect":
    case "continue": block.targetNodeId = values[0] || ""; break;
    case "ending": block.endingType = values[0] || "NORMAL"; block.endingName = values[1] || ""; break;
    case "item": block.type = "itemEffect"; block.itemName = values[0] || ""; block.action = values[1] || "give"; break;
    case "time":
      if (values[0] === "set date") {
        block.action = "set_date"; block.dateString = values[1] || ""; block.value = 0;
      } else if (values[0] === "set segment") {
        block.action = "set"; block.value = 0; block.segment = values[1] || "";
      } else {
        block.action = "add"; block.value = parseInt(values[2]) || 1; block.unit = values[1] || "tick"; block.segment = "";
      }
      break;
    case "use_item": block.type = "itemEffect"; block.action = "use"; block.itemName = values[0] || ""; break;
    case "bgm": block.trackName = values[0] || ""; break;
    case "sfx": block.soundName = values[0] || ""; break;
    case "bg": block.asset = values[0] || ""; break;
    case "delay": block.seconds = parseFloat(values[0]) || 1; break;
    default: block.label = values.join(" "); break;
  }
  return encodeURIComponent(JSON.stringify(block));
}
