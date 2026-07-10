import React, { useState, useRef, useEffect, useCallback } from "react";
import { VNProject, StoryNode, StoryChoice, ChoiceRequirement, InlineEffect, DialogueLine, NodeLock } from "../types";
import { Plus, Trash2, HelpCircle, ChevronDown, ChevronRight, ListPlus } from "lucide-react";
import ScriptEditor from "./ScriptEditor";
import LocationEditor from "./LocationEditor";
import EncounterEditor from "./EncounterEditor";
import { textColorForHex } from "../utils/color";
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

  const { confirmId: choiceConfirmId, ref: choiceConfirmRef, requestDelete: requestChoiceDelete } = useConfirmDelete();
  const { confirmId: lineConfirmId, ref: lineConfirmRef, requestDelete: requestLineDelete } = useConfirmDelete();
  const [dialogueSpeaker, setDialogueSpeaker] = useState("Narrator");
  const [dialogueExpression, setDialogueExpression] = useState("Neutral");
  const [dialogueHTML, setDialogueHTML] = useState("");
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
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
    if (!requestChoiceDelete(choiceId)) return;
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

        {/* 📝 Script & Dialogue Editor */}
        <CollapsibleSection title="📝 Script & Dialogue Editor" defaultExpanded={true}>
          <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
            {node.dialogueLines.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2 text-center">No dialogue yet. Write below and click "Add Line".</p>
            ) : (
              node.dialogueLines.map((line, idx) => {
                const entity = project.entities.find(e => e.name === line.speaker);
                const color = entity?.color || "#64748b";
                const textColor = entity ? textColorForHex(color) : "text-white";
                return (
                  <div key={line.id} className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs ${editingLineIdx === idx ? "bg-indigo-950/40 border-indigo-500/40" : "bg-slate-900 border-slate-800/40"}`}>
                    <span className="text-slate-500 cursor-grab text-[10px] select-none">⠿</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 max-w-[65px] truncate ${textColor}`} style={{ backgroundColor: color }}>
                      {line.speaker}
                    </span>
                    <span className="text-slate-300 flex-1 truncate text-[11px]">
                      {line.speaker === "Narrator" ? line.text : `"${line.text}"`}
                    </span>
                    <button onClick={() => {
                      setDialogueSpeaker(line.speaker);
                      setDialogueExpression(line.expression || "Neutral");
                      setDialogueHTML(line.formattedText || "");
                      setEditingLineIdx(idx);
                    }} className="p-0.5 text-slate-500 hover:text-indigo-400 cursor-pointer text-[10px]" title="Edit line">✏️</button>
                    <button onClick={() => {
                      if (requestLineDelete(line.id)) {
                        updateNode({ dialogueLines: node.dialogueLines.filter(l => l.id !== line.id) });
                      }
                    }} className={`p-0.5 cursor-pointer text-[10px] ${lineConfirmId === line.id ? "text-rose-400 animate-pulse" : "text-slate-500 hover:text-rose-400"}`} title={lineConfirmId === line.id ? "Confirm delete" : "Delete line"}>
                      {lineConfirmId === line.id ? "✕" : "🗑"}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <select value={dialogueSpeaker} onChange={(e) => setDialogueSpeaker(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 text-[11px] text-slate-200 rounded-lg p-1.5">
              <option value="Narrator">Narrator</option>
              {project.entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select value={dialogueExpression} onChange={(e) => setDialogueExpression(e.target.value)}
              className="w-28 bg-slate-900 border border-slate-800 text-[11px] text-slate-200 rounded-lg p-1.5">
              <option value="Neutral">Neutral</option>
              <option value="Smile">Smile</option>
              <option value="Surprise">Surprise</option>
              <option value="Serious">Serious</option>
              <option value="Sad">Sad</option>
              <option value="Angry">Angry</option>
            </select>
          </div>

          <div className="flex gap-1.5">
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <ScriptEditor
                key={editingLineIdx !== null ? `edit-${editingLineIdx}` : 'new'}
                initialContent={dialogueHTML}
                onChange={(html) => setDialogueHTML(html)}
                placeholder="Write dialogue..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => {
                const cleanHTML = dialogueHTML || `<p>${(node.title || "Dialogue")}</p>`;
                const parser = new DOMParser();
                const doc = parser.parseFromString(cleanHTML, "text/html");
                const plainText = doc.body.textContent || "";
                if (editingLineIdx !== null) {
                  const updated = [...node.dialogueLines];
                  updated[editingLineIdx] = { ...updated[editingLineIdx], speaker: dialogueSpeaker, expression: dialogueExpression, text: plainText, formattedText: cleanHTML };
                  updateNode({ dialogueLines: updated });
                  setEditingLineIdx(null);
                } else {
                  const newLine: DialogueLine = { id: crypto.randomUUID(), speaker: dialogueSpeaker, text: plainText, expression: dialogueExpression, formattedText: cleanHTML };
                  updateNode({ dialogueLines: [...node.dialogueLines, newLine] });
                }
                setDialogueHTML("");
              }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer shrink-0">
                {editingLineIdx !== null ? "Save" : "Add"}
              </button>
              {editingLineIdx !== null && (
                <button onClick={() => { setEditingLineIdx(null); setDialogueHTML(""); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-lg cursor-pointer shrink-0">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* 🔒 Choice Trees & Requirements */}
        <CollapsibleSection title="🔒 Choice Trees & Requirements" defaultExpanded={node.choices.length > 0}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <ListPlus className="w-4 h-4 text-indigo-400" />
              <label className="text-xs font-semibold text-slate-400">Choices ({node.choices.length})</label>
            </div>
            <button onClick={handleAddChoice} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">
              <Plus className="w-3 h-3 inline" /> Add
            </button>
          </div>

          {node.choices.length === 0 ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-xl text-[11px] leading-relaxed">
              ⚠️ Dead end. Add a choice or mark as ending above.
            </div>
          ) : (
            <div className="space-y-4">
              {node.choices.map((choice) => {
                const targetNode = project.nodes[choice.targetNodeId];
                return (
                  <div key={choice.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input type="text" value={choice.text} onChange={(e) => handleUpdateChoice(choice.id, { text: e.target.value })}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-semibold flex-1 focus:outline-none"
                        placeholder="Choice text..." />
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-slate-500 font-mono">→</span>
                        <select value={choice.targetNodeId} onChange={(e) => handleUpdateChoice(choice.id, { targetNodeId: e.target.value })}
                          className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded p-1 max-w-[110px]">
                          <option value="">-- None --</option>
                          {Object.values(project.nodes).map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                        </select>
                        <div ref={choiceConfirmRef} className="shrink-0">
                          <button onClick={() => handleDeleteChoice(choice.id)}
                            className={`text-xs px-2 py-1 rounded-lg cursor-pointer border font-bold whitespace-nowrap ${choiceConfirmId === choice.id ? "bg-red-600 border-red-500 text-white animate-pulse" : "text-gray-400 hover:text-red-500 border-transparent"}`}>
                            {choiceConfirmId === choice.id ? "Confirm?" : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Rewards */}
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] text-indigo-400 font-semibold">Rewards</span>
                        {(!choice.effects || choice.effects.length === 0) && (
                          <span className="text-[9px] text-slate-600 italic">— none</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(choice.effects || []).map((ef) => {
                          if (ef.type === "give_item" || ef.type === "take_item") {
                            const item = project.inventory.find(i => i.id === ef.targetId);
                            return (
                              <span key={ef.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                {ef.type === "give_item" ? "🎒" : "➖"}{" "}
                                <select value={ef.targetId} onChange={(e) => handleUpdateEffect(choice.id, ef.id, { targetId: e.target.value })}
                                  className="bg-transparent text-indigo-300 focus:outline-none cursor-pointer text-[9px]">
                                  {project.inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <button onClick={() => handleRemoveEffect(choice.id, ef.id)} className="text-indigo-400 hover:text-indigo-200">✕</button>
                              </span>
                            );
                          }
                          if (ef.type === "adjust_tracker") {
                            const tracker = project.trackers.find(t => t.id === ef.targetId);
                            return (
                              <span key={ef.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                ❤️
                                <select value={ef.targetId} onChange={(e) => handleUpdateEffect(choice.id, ef.id, { targetId: e.target.value })}
                                  className="bg-transparent text-emerald-300 focus:outline-none cursor-pointer text-[9px]">
                                  {project.trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <select value={ef.operation || "add"} onChange={(e) => handleUpdateEffect(choice.id, ef.id, { operation: e.target.value as "add" | "subtract" | "set" })}
                                  className="bg-transparent text-emerald-300 focus:outline-none cursor-pointer text-[9px]">
                                  <option value="add">+</option>
                                  <option value="subtract">-</option>
                                  <option value="set">=</option>
                                </select>
                                <input type="number" value={ef.value ?? 1} onChange={(e) => handleUpdateEffect(choice.id, ef.id, { value: parseInt(e.target.value) || 0 })}
                                  className="w-10 bg-slate-800 text-emerald-300 text-[9px] text-center rounded p-0.5" />
                                <button onClick={() => handleRemoveEffect(choice.id, ef.id)} className="text-emerald-400 hover:text-emerald-200">✕</button>
                              </span>
                            );
                          }
                          if (ef.type === "set_flag" || ef.type === "clear_flag") {
                            const flag = project.flags.find(f => f.id === ef.targetId);
                            return (
                              <span key={ef.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                {ef.type === "set_flag" ? "🏁" : "🏳️"}{" "}
                                <select value={ef.targetId} onChange={(e) => handleUpdateEffect(choice.id, ef.id, { targetId: e.target.value })}
                                  className="bg-transparent text-amber-300 focus:outline-none cursor-pointer text-[9px]">
                                  {project.flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                <span className="text-[9px] text-amber-400">{ef.type === "set_flag" ? "✔" : "✘"}</span>
                                <button onClick={() => handleRemoveEffect(choice.id, ef.id)} className="text-amber-400 hover:text-amber-200">✕</button>
                              </span>
                            );
                          }
                          return null;
                        })}
                        <select value="" onChange={(e) => { if (e.target.value) { handleAddEffect(choice.id, e.target.value as "give_item" | "take_item" | "adjust_tracker" | "set_flag" | "clear_flag"); } }}
                          className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 rounded px-1 py-0.5 cursor-pointer">
                          <option value="">+ Add Reward</option>
                          <option value="give_item">🎒 Give Item</option>
                          <option value="take_item">➖ Take Item</option>
                          <option value="adjust_tracker">❤️ Adjust Stat</option>
                          <option value="set_flag">🏁 Set Milestone</option>
                          <option value="clear_flag">🏳️ Clear Milestone</option>
                        </select>
                      </div>
                    </div>

                    {/* Requirements */}
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] text-amber-400 font-semibold">Requires</span>
                        {!choice.requirement && <span className="text-[9px] text-slate-600 italic">— none</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {choice.requirement && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            🔒
                            {choice.requirement.source === "flag" ? (
                              <>
                                <select value={choice.requirement.targetId} onChange={(e) => handleUpdateChoice(choice.id, { requirement: { ...choice.requirement!, targetId: e.target.value } })}
                                  className="bg-transparent text-amber-300 focus:outline-none cursor-pointer text-[9px]">
                                  {project.flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                <select value={String(choice.requirement.expect ?? true)} onChange={(e) => handleUpdateChoice(choice.id, { requirement: { ...choice.requirement!, expect: e.target.value === "true" } })}
                                  className="bg-transparent text-amber-300 focus:outline-none cursor-pointer text-[9px]">
                                  <option value="true">is checked</option>
                                  <option value="false">is unchecked</option>
                                </select>
                              </>
                            ) : (
                              <>
                                <select value={choice.requirement.targetId} onChange={(e) => handleUpdateChoice(choice.id, { requirement: { ...choice.requirement!, targetId: e.target.value } })}
                                  className="bg-transparent text-amber-300 focus:outline-none cursor-pointer text-[9px]">
                                  {project.trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <select value={choice.requirement.operator || ">="} onChange={(e) => handleUpdateChoice(choice.id, { requirement: { ...choice.requirement!, operator: e.target.value as ">=" | "<=" | ">" | "<" | "==" | "!=" } })}
                                  className="bg-transparent text-amber-300 focus:outline-none cursor-pointer text-[9px]">
                                  <option value=">=">≥</option><option value="<=">≤</option><option value=">">&gt;</option>
                                  <option value="<">&lt;</option><option value="==">=</option><option value="!=">≠</option>
                                </select>
                                <input type="number" value={choice.requirement.compareValue ?? 1} onChange={(e) => handleUpdateChoice(choice.id, { requirement: { ...choice.requirement!, compareValue: parseInt(e.target.value) || 0 } })}
                                  className="w-10 bg-slate-800 text-amber-300 text-[9px] text-center rounded p-0.5" />
                              </>
                            )}
                            <button onClick={() => handleRemoveRequirement(choice.id)} className="text-amber-400 hover:text-amber-200">✕</button>
                          </span>
                        )}
                        {!choice.requirement && (
                          <select value="" onChange={(e) => { if (e.target.value === "flag") handleAddRequirement(choice.id, "flag"); if (e.target.value === "tracker") handleAddRequirement(choice.id, "tracker"); }}
                            className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 rounded px-1 py-0.5 cursor-pointer">
                            <option value="">+ Add Requirement</option>
                            <option value="flag">🔒 Milestone</option>
                            <option value="tracker">📊 Tracker</option>
                          </select>
                        )}
                      </div>
                    </div>
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
