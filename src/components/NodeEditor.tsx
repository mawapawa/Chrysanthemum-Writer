import React, { useState, useRef, useEffect, useCallback } from "react";
import { VNProject, StoryNode, StoryChoice, ChoiceRequirement, InlineEffect, DialogueLine, DialogueBlock, NodeLock, VNTracker, VNFlag } from "../types";
import { Plus, Trash2, HelpCircle, ChevronDown, ChevronRight, ListPlus } from "lucide-react";
import ScriptEditor from "./ScriptEditor";
import LocationEditor from "./LocationEditor";
import EncounterEditor from "./EncounterEditor";

function textColorForHex(hex: string): string {
  const val = parseInt(hex.replace("#", ""), 16);
  const r = (val >> 16) & 0xff, g = (val >> 8) & 0xff, b = val & 0xff;
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? "text-slate-950" : "text-white";
}

function CollapsibleSection({ title, defaultExpanded, children }: { title: string; defaultExpanded?: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);
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

  const [choiceToConfirmDelete, setChoiceToConfirmDelete] = useState<string | null>(null);
  const choiceConfirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (choiceConfirmRef.current && !choiceConfirmRef.current.contains(event.target as Node)) {
        setChoiceToConfirmDelete(null);
      }
    };
    if (choiceToConfirmDelete !== null) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [choiceToConfirmDelete]);

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
    if (choiceToConfirmDelete !== choiceId) {
      setChoiceToConfirmDelete(choiceId);
      setTimeout(() => {
        setChoiceToConfirmDelete((current) => (current === choiceId ? null : current));
      }, 4000);
      return;
    }

    setChoiceToConfirmDelete(null);
    updateNode({
      choices: node.choices.filter((c) => c.id !== choiceId),
    });
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

  const handleAddEffect = (choiceId: string, type: "give_item" | "take_item") => {
    if (project.inventory.length === 0) { alert("No items defined."); return; }
    const effect: InlineEffect = {
      id: crypto.randomUUID(),
      type,
      targetId: project.inventory[0].id,
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

  const convertDialogueLines = (lines: DialogueLine[]): DialogueBlock[] => {
    return lines.map(l => ({
      id: l.id,
      speaker: l.speaker,
      text: l.text,
      expression: l.expression,
      effects: [],
    }));
  };

  const resizeRef = useRef<HTMLDivElement>(null);

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
                    onChange={(e) => updateNode({ endingType: e.target.value as any })}
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

        {/* 📝 Script & Dialogue Editor */}
        <CollapsibleSection title="📝 Script & Dialogue Editor" defaultExpanded={true}>
          <ScriptEditor
            key={selectedNodeId}
            project={project}
            nodeId={selectedNodeId}
            dialogueTimeline={node.dialogueTimeline ?? convertDialogueLines(node.dialogueLines)}
            onUpdateTimeline={(blocks) => updateNode({ dialogueTimeline: blocks })}
            onCreateNode={(title: string) => {
              const newId = crypto.randomUUID();
              const newNode: StoryNode = {
                id: newId, title, description: "", speaker: "Narrator",
                dialogueLines: [], choices: [], statChanges: [],
                position: { x: 200 + Math.random() * 100, y: 250 + Math.random() * 100 },
                isEnding: false, nodeType: "story", sceneId: project.nodes[selectedNodeId || ""]?.sceneId,
              };
              onUpdateProject({
                ...project,
                nodes: { ...project.nodes, [newId]: newNode },
                lastModified: Date.now(),
              });
              return newId;
            }}
            onSelectNode={onSelectNode}
          />
        </CollapsibleSection>

        {/* 🔒 Choice Trees & Requirements */}
        <CollapsibleSection title="🔒 Choice Trees & Requirements" defaultExpanded={false}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <ListPlus className="w-4 h-4 text-indigo-400" />
              <label className="text-xs font-semibold text-slate-400">Story branch choices ({node.choices.length})</label>
            </div>
            <button
              onClick={handleAddChoice}
              className="text-[10px] font-mono font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Choice
            </button>
          </div>

          {node.choices.length === 0 ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-xl text-[11px] leading-relaxed">
              ⚠️ <strong>Dead End Warn:</strong> This node does not branch. Unless this is marked as a story ending above, players will be locked out and unable to progress further here.
            </div>
          ) : (
            <div className="space-y-4">
              {node.choices.map((choice) => {
                const targetNode = project.nodes[choice.targetNodeId];
                return (
                  <div key={choice.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2" id={`edit-choice-${choice.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={choice.text}
                        onChange={(e) => handleUpdateChoice(choice.id, { text: e.target.value })}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-semibold flex-1 focus:outline-none"
                        placeholder="Choice text (e.g., Run out of the room)"
                      />
                      <div ref={choiceConfirmRef}>
                        <button
                          onClick={() => handleDeleteChoice(choice.id)}
                          className={`text-xs px-2 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1 font-bold ${
                            choiceToConfirmDelete === choice.id
                              ? "bg-red-600 hover:bg-red-700 border-red-500 text-white animate-pulse"
                              : "text-gray-400 hover:text-red-500 hover:bg-red-50 border-transparent"
                          }`}
                          title={choiceToConfirmDelete === choice.id ? "Click again to confirm deletion" : "Delete choice"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {choiceToConfirmDelete === choice.id && <span className="text-[9px]">Confirm?</span>}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-slate-500 mb-0.5 font-mono">DESTINATION NODE</label>
                        <select
                          value={choice.targetNodeId}
                          onChange={(e) => handleUpdateChoice(choice.id, { targetNodeId: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 text-[11px] text-slate-200 rounded-lg p-1 cursor-pointer"
                        >
                          <option value="">-- Disconnected --</option>
                          {Object.values(project.nodes).map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.title} ({n.id.substring(0, 5)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end justify-end gap-1 pb-0.5">
                        <button
                          onClick={() => handleAddEffect(choice.id, "give_item")}
                          className="px-1.5 py-1 bg-slate-900 border border-slate-800 text-[9px] text-slate-400 hover:text-white rounded-md cursor-pointer font-semibold"
                        >
                          🎒 + Give Item
                        </button>
                        <button
                          onClick={() => handleAddEffect(choice.id, "take_item")}
                          className="px-1.5 py-1 bg-slate-900 border border-slate-800 text-[9px] text-slate-400 hover:text-white rounded-md cursor-pointer font-semibold"
                        >
                          🎒 + Take Item
                        </button>
                      </div>
                    </div>

                    {/* Requirement card */}
                    <div className="flex items-start gap-2">
                      {!choice.requirement ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddRequirement(choice.id, "flag")}
                            className="px-1.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 hover:text-white rounded-md cursor-pointer font-semibold"
                          >
                            🔒 Require Milestone
                          </button>
                          <button
                            onClick={() => handleAddRequirement(choice.id, "tracker")}
                            className="px-1.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 hover:text-white rounded-md cursor-pointer font-semibold"
                          >
                            🔒 Require Tracker
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">Requirement</span>
                            <button
                              onClick={() => handleRemoveRequirement(choice.id)}
                              className="text-amber-400 hover:text-rose-400 text-[9px] cursor-pointer"
                            >
                              ✕ Remove
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            {choice.requirement.source === "flag" ? (
                              <>
                                <span className="text-[10px] text-slate-400">Only show if</span>
                                <select
                                  value={choice.requirement.targetId}
                                  onChange={(e) => handleUpdateChoice(choice.id, {
                                    requirement: { ...choice.requirement!, targetId: e.target.value }
                                  })}
                                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5"
                                >
                                  {project.flags.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={String(choice.requirement.expect ?? true)}
                                  onChange={(e) => handleUpdateChoice(choice.id, {
                                    requirement: { ...choice.requirement!, expect: e.target.value === "true" }
                                  })}
                                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5"
                                >
                                  <option value="true">is checked</option>
                                  <option value="false">is unchecked</option>
                                </select>
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] text-slate-400">Only show if</span>
                                <select
                                  value={choice.requirement.targetId}
                                  onChange={(e) => handleUpdateChoice(choice.id, {
                                    requirement: { ...choice.requirement!, targetId: e.target.value }
                                  })}
                                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5"
                                >
                                  {project.trackers.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={choice.requirement.operator || ">="}
                                  onChange={(e) => handleUpdateChoice(choice.id, {
                                    requirement: { ...choice.requirement!, operator: e.target.value as any }
                                  })}
                                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5"
                                >
                                  <option value=">=">≥</option>
                                  <option value="<=">≤</option>
                                  <option value=">">&gt;</option>
                                  <option value="<">&lt;</option>
                                  <option value="==">=</option>
                                  <option value="!=">≠</option>
                                </select>
                                <input
                                  type="number"
                                  value={choice.requirement.compareValue ?? 1}
                                  onChange={(e) => handleUpdateChoice(choice.id, {
                                    requirement: { ...choice.requirement!, compareValue: parseInt(e.target.value) || 0 }
                                  })}
                                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5 w-12 font-mono text-center"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Inline effects */}
                    {choice.effects && choice.effects.length > 0 && (
                      <div className="p-2 bg-indigo-500/5 border border-indigo-500/15 rounded-lg space-y-1.5">
                        <span className="block text-[8px] font-bold text-indigo-400 uppercase tracking-wider">Selection Effects</span>
                        {choice.effects.map((ef) => {
                          const matchedItem = project.inventory.find(i => i.id === ef.targetId);
                          return (
                            <div key={ef.id} className="flex items-center gap-1.5 text-xs">
                              <span className="text-[10px] text-slate-400">
                                {ef.type === "give_item" ? "Give" : "Take"}
                              </span>
                              <select
                                value={ef.targetId}
                                onChange={(e) => handleUpdateEffect(choice.id, ef.id, { targetId: e.target.value })}
                                className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5"
                              >
                                {project.inventory.map(i => (
                                  <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleRemoveEffect(choice.id, ef.id)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleSection>
        </>
      )}

      </div>
    </div>
  );
}
