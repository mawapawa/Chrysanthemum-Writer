import React, { useState, useRef, useEffect } from "react";
import { VNProject, StoryNode, StoryChoice, StatChange, ChoiceCondition, DialogueLine, DialogueBlock, NodeLock, VNTracker, VNFlag, VNEntity } from "../types";
import { Plus, Trash2, HelpCircle, ChevronDown, ChevronRight, ListPlus } from "lucide-react";
import ScriptEditor from "./ScriptEditor";

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
}

export default function NodeEditor({ project, selectedNodeId, onUpdateProject, onSelectNode }: NodeEditorProps) {
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

  const handleAddCondition = (choiceId: string) => {
    if (allVars.length === 0) {
      alert("Please define at least one tracker or flag first.");
      return;
    }
    const firstVar = allVars[0];
    const condition: ChoiceCondition = {
      variableName: firstVar.name,
      operator: "==",
      value: firstVar.type === "number" ? 0 : false,
    };
    handleUpdateChoice(choiceId, { condition });
  };

  const handleRemoveCondition = (choiceId: string) => {
    updateNode({
      choices: node.choices.map((c) => {
        if (c.id === choiceId) {
          const { condition, ...rest } = c;
          return rest;
        }
        return c;
      }),
    });
  };

  const handleAddChoiceStatChange = (choiceId: string) => {
    if (allVars.length === 0) {
      alert("Please define trackers or flags first.");
      return;
    }
    const firstVar = allVars[0];
    const newChange: StatChange = {
      variableName: firstVar.name,
      operation: firstVar.type === "number" ? "+" : "=",
      value: firstVar.type === "number" ? 1 : true,
    };

    const choice = node.choices.find(c => c.id === choiceId);
    if (choice) {
      const existingChanges = choice.statChanges || [];
      handleUpdateChoice(choiceId, {
        statChanges: [...existingChanges, newChange],
      });
    }
  };

  const handleRemoveChoiceStatChange = (choiceId: string, idx: number) => {
    const choice = node.choices.find(c => c.id === choiceId);
    if (choice && choice.statChanges) {
      const updated = [...choice.statChanges];
      updated.splice(idx, 1);
      handleUpdateChoice(choiceId, {
        statChanges: updated,
      });
    }
  };

  const handleUpdateChoiceStatChange = (choiceId: string, idx: number, fields: Partial<StatChange>) => {
    const choice = node.choices.find(c => c.id === choiceId);
    if (choice && choice.statChanges) {
      const updated = choice.statChanges.map((sc, i) => {
        if (i === idx) {
          const updatedSc = { ...sc, ...fields };
          const targetVar = allVars.find(v => v.name === updatedSc.variableName);
          if (targetVar) {
            if (targetVar.type === "number" && typeof updatedSc.value !== "number") {
              updatedSc.value = parseInt(String(updatedSc.value)) || 0;
            } else if (targetVar.type === "boolean" && typeof updatedSc.value !== "boolean") {
              updatedSc.value = String(updatedSc.value) === "true";
            }
          }
          return updatedSc;
        }
        return sc;
      });
      handleUpdateChoice(choiceId, { statChanges: updated });
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

  const nodeLock: NodeLock | undefined = (project.locks || []).find(l => l.nodeId === selectedNodeId);

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 divide-y divide-slate-800" id="node-editor-sidebar">
      {nodeLock && (
        <div className="bg-amber-500/15 border-b border-amber-500/25 px-4 py-2 flex items-center gap-2 text-xs text-amber-300 shrink-0">
          <span className="font-bold">Read-only</span>
          <span className="text-amber-400/70">—</span>
          <span>Locked by {nodeLock.userName}</span>
        </div>
      )}
      <div className={`flex-1 overflow-y-auto p-5 space-y-6 ${nodeLock ? "pointer-events-none opacity-70" : ""}`}>

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
            project={project}
            nodeId={selectedNodeId}
            dialogueTimeline={node.dialogueTimeline ?? convertDialogueLines(node.dialogueLines)}
            onUpdateTimeline={(blocks) => updateNode({ dialogueTimeline: blocks })}
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
                        {!choice.condition ? (
                          <button
                            onClick={() => handleAddCondition(choice.id)}
                            className="px-1.5 py-1 bg-slate-900 border border-slate-800 text-[9px] text-slate-400 hover:text-white rounded-md cursor-pointer font-semibold"
                          >
                            + Condition
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRemoveCondition(choice.id)}
                            className="px-1.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 hover:bg-slate-900 hover:text-slate-400 rounded-md cursor-pointer font-semibold"
                          >
                            - Condition
                          </button>
                        )}

                        <button
                          onClick={() => handleAddChoiceStatChange(choice.id)}
                          className="px-1.5 py-1 bg-slate-900 border border-slate-800 text-[9px] text-slate-400 hover:text-white rounded-md cursor-pointer font-semibold"
                        >
                          + Effect
                        </button>
                      </div>
                    </div>

                    {choice.condition && (
                      <div className="p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg space-y-1">
                        <span className="block text-[8px] font-bold text-amber-500 uppercase tracking-wider">Choice Visibility Requirement</span>
                        <div className="flex items-center gap-1">
                          <select
                            value={choice.condition.variableName}
                            onChange={(e) => {
                              const vName = e.target.value;
                              const matchedVar = allVars.find(v => v.name === vName);
                              handleUpdateChoice(choice.id, {
                                condition: {
                                  ...choice.condition!,
                                  variableName: vName,
                                  value: matchedVar?.type === "number" ? 0 : false,
                                },
                              });
                            }}
                            className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1 max-w-[100px]"
                          >
                            {allVars.map((v) => (
                              <option key={v.name} value={v.name}>
                                {v.name}
                              </option>
                            ))}
                          </select>

                          <select
                            value={choice.condition.operator}
                            onChange={(e) =>
                              handleUpdateChoice(choice.id, {
                                condition: { ...choice.condition!, operator: e.target.value as any },
                              })
                            }
                            className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1"
                          >
                            <option value="==">==</option>
                            <option value="!=">!=</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                          </select>

                          {allVars.find((v) => v.name === choice.condition?.variableName)?.type === "number" ? (
                            <input
                              type="number"
                              value={typeof choice.condition.value === "number" ? choice.condition.value : 0}
                              onChange={(e) =>
                                handleUpdateChoice(choice.id, {
                                  condition: { ...choice.condition!, value: parseInt(e.target.value) || 0 },
                                })
                              }
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1 w-12 font-mono text-center"
                            />
                          ) : (
                            <select
                              value={String(choice.condition.value)}
                              onChange={(e) =>
                                handleUpdateChoice(choice.id, {
                                  condition: { ...choice.condition!, value: e.target.value === "true" },
                                })
                              }
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1"
                            >
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          )}
                        </div>
                      </div>
                    )}

                    {choice.statChanges && choice.statChanges.length > 0 && (
                      <div className="p-2 bg-indigo-500/5 border border-indigo-500/15 rounded-lg space-y-1.5">
                        <span className="block text-[8px] font-bold text-indigo-400 uppercase tracking-wider">Instant Selection Effects</span>
                        {choice.statChanges.map((sc, scIdx) => {
                          const matchedVar = allVars.find((v) => v.name === sc.variableName);
                          return (
                            <div key={scIdx} className="flex items-center gap-1.5 text-xs">
                              <select
                                value={sc.variableName}
                                onChange={(e) => handleUpdateChoiceStatChange(choice.id, scIdx, { variableName: e.target.value })}
                                className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5 max-w-[80px]"
                              >
                                {allVars.map((v) => (
                                  <option key={v.name} value={v.name}>
                                    {v.name}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={sc.operation}
                                onChange={(e) => handleUpdateChoiceStatChange(choice.id, scIdx, { operation: e.target.value as any })}
                                className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5"
                              >
                                {matchedVar?.type === "number" ? (
                                  <>
                                    <option value="+">+</option>
                                    <option value="-">-</option>
                                    <option value="=">=</option>
                                  </>
                                ) : (
                                  <option value="=">=</option>
                                )}
                              </select>

                              {matchedVar?.type === "number" ? (
                                <input
                                  type="number"
                                  value={typeof sc.value === "number" ? sc.value : 0}
                                  onChange={(e) => handleUpdateChoiceStatChange(choice.id, scIdx, { value: parseInt(e.target.value) || 0 })}
                                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5 w-10 text-center"
                                />
                              ) : (
                                <select
                                  value={String(sc.value)}
                                  onChange={(e) => handleUpdateChoiceStatChange(choice.id, scIdx, { value: e.target.value === "true" })}
                                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-0.5"
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              )}

                              <button
                                onClick={() => handleRemoveChoiceStatChange(choice.id, scIdx)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 ml-auto cursor-pointer"
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

      </div>
    </div>
  );
}
