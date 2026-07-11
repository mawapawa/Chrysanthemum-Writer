import React, { useState, useRef, useEffect, useCallback } from "react";
import { VNProject, StoryNode, StoryChoice, ChoiceRequirement, InlineEffect, DialogueLine, NodeLock, SceneBlock } from "../types";
import { Plus, Trash2, HelpCircle, ChevronDown, ChevronRight, ListPlus, GripVertical } from "lucide-react";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ScriptEditor from "./ScriptEditor";
import BlockEditor from "./BlockEditor";
import LocationEditor from "./LocationEditor";
import EncounterEditor from "./EncounterEditor";
import { textColorForHex } from "../utils/color";
import { blocksToNode, nodeToBlocks } from "../utils/blockSerializer";
import { useConfirmDelete } from "../hooks/useConfirmDelete";

function CollapsibleSection({ title, defaultExpanded, children }: { title: string; defaultExpanded?: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);
  useEffect(() => { setExpanded(defaultExpanded ?? true); }, [defaultExpanded]);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          {expanded ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-indigo-400" />}
          <span className="text-xs font-semibold text-slate-400">{title}</span>
        </button>
      </div>
      {expanded && <div className="space-y-4">{children}</div>}
    </div>
  );
}

const SortableDialogueLine = ({ line, idx, editingLineIdx, lineConfirmId, lineConfirmRef, requestLineDelete, entityColor, entityTextColor, onEdit, onDelete }: {
  line: DialogueLine;
  idx: number;
  editingLineIdx: number | null;
  lineConfirmId: string | null;
  lineConfirmRef: React.RefObject<HTMLDivElement | null>;
  requestLineDelete: (id: string) => boolean;
  entityColor: string;
  entityTextColor: string;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `dialogue-${line.id}`,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs ${editingLineIdx === idx ? "bg-indigo-950/40 border-indigo-500/40" : "bg-slate-900 border-slate-800/40"}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-slate-500 hover:text-indigo-400 cursor-grab active:cursor-grabbing text-[10px] p-0.5"
        title="Drag to reorder"
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 max-w-[65px] truncate ${entityTextColor}`} style={{ backgroundColor: entityColor }}>
        {line.speaker}
      </span>
      <span className="text-slate-300 flex-1 truncate text-[11px]">
        {line.speaker === "Narrator" ? line.text : `"${line.text}"`}
      </span>
      <button onClick={onEdit} className="p-0.5 text-slate-500 hover:text-indigo-400 cursor-pointer text-[10px]" title="Edit line">✏️</button>
      <button onClick={onDelete} className={`p-0.5 cursor-pointer text-[10px] ${lineConfirmId === line.id ? "text-rose-400 animate-pulse" : "text-slate-500 hover:text-rose-400"}`} title={lineConfirmId === line.id ? "Confirm delete" : "Delete line"}>
        {lineConfirmId === line.id ? "✕" : "🗑"}
      </button>
    </div>
  );
};

interface NodeEditorProps {
  project: VNProject;
  selectedNodeId: string;
  onUpdateProject: (project: VNProject) => void;
  onSelectNode: (nodeId: string | null) => void;
  editorWidth?: number;
  onResizeEditor?: (width: number) => void;
}

export default function NodeEditor({ project, selectedNodeId, onUpdateProject, onSelectNode, editorWidth, onResizeEditor }: NodeEditorProps) {
  const node = project.nodes[selectedNodeId];

  const allVars: { name: string; type: "number" | "boolean" }[] = [
    ...project.trackers.map(t => ({ name: t.name, type: "number" as const })),
    ...project.flags.map(f => ({ name: f.name, type: "boolean" as const })),
  ];

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { confirmId: lineConfirmId, ref: lineConfirmRef, requestDelete: requestLineDelete } = useConfirmDelete();
  const [dialogueSpeaker, setDialogueSpeaker] = useState("Narrator");
  const [dialogueExpression, setDialogueExpression] = useState("Neutral");
  const [dialogueHTML, setDialogueHTML] = useState("");
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const [blocks, setBlocks] = useState<SceneBlock[]>(() => node.blocks || nodeToBlocks(node));

  const handleBlocksChange = useCallback((newBlocks: SceneBlock[]) => {
    setBlocks(newBlocks);
    const legacy = blocksToNode(newBlocks, node);
    updateNode(legacy);
  }, [node]);

  const handleCreateNodeFromBlock = useCallback((): string => {
    const childId = crypto.randomUUID();
    const parentNode = project.nodes[node.id];
    const childNode: StoryNode = {
      id: childId,
      displayId: undefined,
      title: "New Scene",
      description: "",
      speaker: "Narrator",
      dialogueLines: [],
      choices: [],
      statChanges: [],
      position: {
        x: parentNode.position.x + 320,
        y: parentNode.position.y + (parentNode.choices.length * 120),
      },
      isEnding: false,
      nodeType: "story",
    };
    onUpdateProject({
      ...project,
      nodes: { ...project.nodes, [childId]: childNode },
      lastModified: Date.now(),
    });
    return childId;
  }, [project, node]);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const sensors = useSensors(pointerSensor);

  const handleDialogueDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = node.dialogueLines.findIndex(l => `dialogue-${l.id}` === active.id);
    const newIndex = node.dialogueLines.findIndex(l => `dialogue-${l.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(node.dialogueLines, oldIndex, newIndex);
    updateNode({ dialogueLines: reordered });
  }, [node?.dialogueLines]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = editorWidth || 420;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(700, startWidth + (startX - ev.clientX)));
      onResizeEditor?.(newWidth);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [editorWidth, onResizeEditor]);

  if (!node) {
    return (
      <div className="p-6 text-center text-gray-400">
        <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
        <p className="text-sm font-semibold">No scene selected</p>
        <p className="text-xs mt-1">Double-click on the visual canvas or click an existing scene card to begin editing its branch details.</p>
      </div>
    );
  }

  const updateNode = (updatedFields: Partial<StoryNode>) => {
    onUpdateProject({
      ...project,
      nodes: {
        ...project.nodes,
        [selectedNodeId]: {
          ...node,
          ...updatedFields,
        },
      },
      lastModified: Date.now(),
    });
  };

  const handleAddChoice = () => {
    const availableTargets = Object.keys(project.nodes).filter(id => id !== selectedNodeId);
    const firstTarget = availableTargets[0] || "";

    const newChoice: StoryChoice = {
      id: crypto.randomUUID(),
      text: "New Option Path",
      targetNodeId: firstTarget,
    };

    updateNode({
      choices: [...node.choices, newChoice],
    });
  };

  const handleUpdateChoice = (choiceId: string, fields: Partial<StoryChoice>) => {
    updateNode({
      choices: node.choices.map((c) => {
        if (c.id === choiceId) {
          return { ...c, ...fields };
        }
        return c;
      }),
    });
  };

  const handleDeleteChoice = (choiceId: string) => {
    if (deleteConfirmId !== choiceId) {
      setDeleteConfirmId(choiceId);
      setTimeout(() => setDeleteConfirmId(null), 4000);
      return;
    }
    setDeleteConfirmId(null);
    updateNode({ choices: node.choices.filter((c) => c.id !== choiceId) });
  };

  const handleAddRequirement = (choiceId: string, source: "flag" | "tracker") => {
    const flag = source === "flag" ? project.flags[0] : null;
    const tracker = source === "tracker" ? project.trackers[0] : null;
    if (source === "flag" && !flag) { alert("No milestones defined."); return; }
    if (source === "tracker" && !tracker) { alert("No trackers defined."); return; }
    const requirement: ChoiceRequirement = {
      source,
      targetId: source === "flag" ? flag!.id : tracker!.id,
      ...(source === "flag" ? { expect: true } : { operator: ">=", compareValue: 1 }),
    };
    handleUpdateChoice(choiceId, { requirement });
  };

  const handleRemoveRequirement = (choiceId: string) => {
    updateNode({
      choices: node.choices.map((c) => {
        if (c.id === choiceId) {
          const { requirement, ...rest } = c;
          return rest;
        }
        return c;
      }),
    });
  };

  const handleAddEffect = (choiceId: string, type: "give_item" | "take_item" | "adjust_tracker" | "set_flag" | "clear_flag") => {
    if ((type === "give_item" || type === "take_item") && project.inventory.length === 0) { alert("No items defined."); return; }
    if (type === "adjust_tracker" && project.trackers.length === 0) { alert("No stats defined."); return; }
    if ((type === "set_flag" || type === "clear_flag") && project.flags.length === 0) { alert("No milestones defined."); return; }
    const effect: InlineEffect = {
      id: crypto.randomUUID(),
      type,
      targetId: type === "adjust_tracker" ? project.trackers[0].id : type === "set_flag" || type === "clear_flag" ? project.flags[0].id : project.inventory[0].id,
      ...(type === "adjust_tracker" ? { operation: "add" as const, value: 1 } : {}),
      ...(type === "set_flag" ? { flagValue: true } : {}),
    };
    const choice = node.choices.find(c => c.id === choiceId);
    const existing = choice?.effects || [];
    handleUpdateChoice(choiceId, { effects: [...existing, effect] });
  };

  const handleRemoveEffect = (choiceId: string, effectId: string) => {
    const choice = node.choices.find(c => c.id === choiceId);
    if (choice?.effects) {
      handleUpdateChoice(choiceId, { effects: choice.effects.filter(e => e.id !== effectId) });
    }
  };

  const handleUpdateEffect = (choiceId: string, effectId: string, fields: Partial<InlineEffect>) => {
    const choice = node.choices.find(c => c.id === choiceId);
    if (choice?.effects) {
      handleUpdateChoice(choiceId, { effects: choice.effects.map(e => e.id === effectId ? { ...e, ...fields } : e) });
    }
  };

  const nodeLock: NodeLock | undefined = (project.locks || []).find(l => l.nodeId === selectedNodeId);

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 divide-y divide-slate-800 relative" id="node-editor-sidebar">
      <div
        ref={resizeRef}
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/30 transition-colors z-10"
      />
      {nodeLock && (
        <div className="bg-amber-500/15 border-b border-amber-500/25 px-4 py-2 flex items-center gap-2 text-xs text-amber-300 shrink-0">
          <span className="font-bold">Read-only</span>
          <span className="text-amber-400/70">—</span>
          <span>Locked by {nodeLock.userName}</span>
        </div>
      )}
      <div className={`flex-1 overflow-y-auto p-5 space-y-6 ${nodeLock ? "pointer-events-none opacity-70" : ""}`}>

        {node.nodeType === "location" && (
          <LocationEditor project={project} node={node} onUpdateNode={updateNode} />
        )}

        {node.nodeType === "encounter" && (
          <EncounterEditor project={project} node={node} onUpdateNode={updateNode} />
        )}

        {(!node.nodeType || node.nodeType === "story") && (
        <>
        {/* 📄 Scene Overview */}
        <CollapsibleSection title="📄 Scene Overview" defaultExpanded={true}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                SCENE ID: {node.id.substring(0, 10)}
              </span>
              <button
                onClick={() => updateNode({ isEnding: !node.isEnding })}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  node.isEnding
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                Is Game Ending?
              </button>
            </div>

            <input
              type="text"
              value={node.title}
              onChange={(e) => updateNode({ title: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-base font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Scene Title..."
            />

            <div className="mt-3">
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Scene Organizer Folder</label>
              <select
                value={node.sceneId || "unassigned"}
                onChange={(e) => updateNode({ sceneId: e.target.value === "unassigned" ? undefined : e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="unassigned">📂 Root Directory (Unassigned)</option>
                {(project.scenes || []).map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    📂 {scene.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Plot Summary Outline</label>
            <textarea
              value={node.description}
              onChange={(e) => updateNode({ description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              rows={3}
              placeholder="Outline what occurs in this branching point. (E.g. Jack unlocks the drawer. If jack likes Astrid, he shows her the map. Else, he pockets it.)"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">After Dialogue Ends</label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Continue to</span>
              <select
                value={node.continueToNodeId || ""}
                onChange={(e) => updateNode({ continueToNodeId: e.target.value || undefined })}
                className="flex-1 bg-slate-950 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">— End here (dead end) —</option>
                {Object.values(project.nodes)
                  .filter(n => n.id !== node.id)
                  .map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
              </select>
            </div>
          </div>

          {node.isEnding && (
            <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Configure Game Ending</h4>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Ending Style</label>
                  <select
                    value={node.endingType || "NORMAL"}
                    onChange={(e) => updateNode({ endingType: e.target.value as "GOOD" | "BAD" | "NEUTRAL" | "NORMAL" })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg p-1.5 text-slate-200"
                  >
                    <option value="GOOD">Good Ending</option>
                    <option value="BAD">Bad Ending</option>
                    <option value="NORMAL">Normal Ending</option>
                    <option value="NEUTRAL">Neutral Ending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Ending Label Name</label>
                  <input
                    type="text"
                    value={node.endingName || ""}
                    onChange={(e) => updateNode({ endingName: e.target.value })}
                    placeholder="e.g. True Love, Slashed"
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg p-1.5 text-slate-200"
                  />
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* 📝 Block Editor (dialogue, effects, choices, endings) */}
        <CollapsibleSection title="📝 Scene Content" defaultExpanded={true}>
          <BlockEditor
            project={project}
            blocks={blocks}
            onChange={handleBlocksChange}
            onCreateNode={handleCreateNodeFromBlock}
          />
        </CollapsibleSection>
        </>
      )}

      </div>
    </div>
  );
}
