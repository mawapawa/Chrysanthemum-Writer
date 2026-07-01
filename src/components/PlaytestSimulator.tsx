/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { VNProject, StoryNode, StoryChoice, StatChange, VNTracker, VNFlag } from "../types";
import { 
  Play, RefreshCw, ChevronRight, ChevronLeft, 
  Flag, AlertTriangle, HelpCircle, Eye, EyeOff, Sliders
} from "lucide-react";

interface PlaytestSimulatorProps {
  project: VNProject;
  startNodeId: string;
  onExit: () => void;
  onUpdateProject?: (project: VNProject) => void;
}

export default function PlaytestSimulator({ 
  project, 
  startNodeId, 
  onExit, 
  onUpdateProject 
}: PlaytestSimulatorProps) {
  // Current game node
  const [currentNodeId, setCurrentNodeId] = useState<string>(startNodeId);
  const [history, setHistory] = useState<Array<{ nodeId: string; variables: Record<string, any> }>>([]);

  // Active state variable values registry
  const [vars, setVars] = useState<Record<string, any>>({});

  // Current dialog script index inside current node
  const [lineIdx, setLineIdx] = useState<number>(0);

  // Debug options: show disabled choice condition locks
  const [showLockedChoices, setShowLockedChoices] = useState(true);

  // Notification indicator of variable updates
  const [logs, setLogs] = useState<Array<{ text: string; type: "plus" | "minus" | "set" }>>([]);

  const node = project.nodes[currentNodeId];

  // Initialize variables with project defaults
  useEffect(() => {
    resetSimulator();
  }, []);

  useEffect(() => {
    resetSimulator();
  }, [startNodeId]);

  const resetSimulator = () => {
    const initialVars: Record<string, any> = {};
    [...project.trackers, ...project.flags].forEach((v) => {
      initialVars[v.name] = v.defaultValue;
    });
    setVars(initialVars);
    setCurrentNodeId(startNodeId);
    setHistory([]);
    setLineIdx(0);
    setLogs([]);

    // Trigger immediate entry effects of starting node
    const startingNode = project.nodes[startNodeId];
    if (startingNode && startingNode.statChanges.length > 0) {
      applyStatChanges(startingNode.statChanges, initialVars);
    }
  };

  const applyStatChanges = (changes: StatChange[], currentVars: Record<string, any>) => {
    const updated = { ...currentVars };
    const newLogs: typeof logs = [];

    changes.forEach((sc) => {
      const prevVal = updated[sc.variableName];
      if (prevVal === undefined) return;

      if (sc.operation === "+") {
        updated[sc.variableName] = (Number(prevVal) || 0) + (Number(sc.value) || 0);
        newLogs.push({ text: `Stat updated: ${sc.variableName} +${sc.value} (Now: ${updated[sc.variableName]})`, type: "plus" });
      } else if (sc.operation === "-") {
        updated[sc.variableName] = (Number(prevVal) || 0) - (Number(sc.value) || 0);
        newLogs.push({ text: `Stat updated: ${sc.variableName} -${sc.value} (Now: ${updated[sc.variableName]})`, type: "minus" });
      } else if (sc.operation === "=") {
        updated[sc.variableName] = sc.value;
        newLogs.push({ text: `Flag set: ${sc.variableName} = ${sc.value}`, type: "set" });
      }
    });

    setVars(updated);
    setLogs((prev) => [...newLogs, ...prev].slice(0, 15));
  };

  // Condition evaluation
  const checkChoiceCondition = (choice: StoryChoice): { passed: boolean; message?: string } => {
    if (!choice.condition) return { passed: true };

    const { variableName, operator, value } = choice.condition;
    const currentVal = vars[variableName];

    if (currentVal === undefined) {
      return { passed: false, message: `Logic Missing: ${variableName} registry not initialized` };
    }

    let passed = false;
    if (operator === "==") passed = String(currentVal) === String(value);
    else if (operator === "!=") passed = String(currentVal) !== String(value);
    else {
      const numCur = Number(currentVal);
      const numVal = Number(value);
      if (operator === ">=") passed = numCur >= numVal;
      else if (operator === "<=") passed = numCur <= numVal;
      else if (operator === ">") passed = numCur > numVal;
      else if (operator === "<") passed = numCur < numVal;
    }

    return {
      passed,
      message: passed ? undefined : `Requires Flag Condition [${variableName} ${operator} ${value}] (Current: ${currentVal})`,
    };
  };

  const handleSelectChoice = (choice: StoryChoice) => {
    const nextNode = project.nodes[choice.targetNodeId];
    if (!nextNode) {
      alert("This choice link points to a non-existent scene node. Build the destination scene first on your canvas.");
      return;
    }

    // Capture history for rollback state undo
    setHistory([...history, { nodeId: currentNodeId, variables: { ...vars } }]);

    // Apply immediate selection rewards/costs first
    let tempVars = { ...vars };
    if (choice.statChanges && choice.statChanges.length > 0) {
      applyStatChanges(choice.statChanges, tempVars);
    }

    // Apply entry level effects of next node
    if (nextNode.statChanges && nextNode.statChanges.length > 0) {
      applyStatChanges(nextNode.statChanges, tempVars);
    }

    setCurrentNodeId(choice.targetNodeId);
    setLineIdx(0);
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setCurrentNodeId(previous.nodeId);
    setVars(previous.variables);
    setHistory(history.slice(0, -1));
    setLineIdx(0);
  };

  if (!node) {
    return (
      <div className="p-8 text-center text-gray-300 max-w-lg mx-auto bg-slate-900 rounded-3xl border border-slate-800 mt-12" id="playtest-error">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold">Simulator Startup Error</h2>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          The starting node for this playtest could not be loaded or was deleted. Return to visual storyboard canvas, click any scene node, and click &quot;Test Walkthrough&quot; to set a correct entry scene.
        </p>
        <button onClick={onExit} className="mt-5 px-5 py-2 bg-slate-800 rounded-xl font-bold text-xs hover:bg-slate-700">
          Back to Canvas
        </button>
      </div>
    );
  }

  // Active dialogue line
  const activeLine = node.dialogueLines && node.dialogueLines[lineIdx];
  const totalLines = node.dialogueLines ? node.dialogueLines.length : 0;
  const hasDialogue = totalLines > 0;

  // Pre-compute visible choices — single evaluation pass
  const availableChoices = node.choices.filter((choice) => {
    const evalResult = checkChoiceCondition(choice);
    return evalResult.passed || showLockedChoices;
  });

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-950 text-slate-100 divide-y md:divide-y-0 md:divide-x divide-slate-850" id="vn-player-screen">
      
      {/* Left variables registry bar */}
      <div className="md:w-72 bg-slate-900 p-5 flex flex-col overflow-y-auto" id="vn-player-sidebar">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Memory Registry</h3>
          </div>
          <button
            onClick={resetSimulator}
            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Reset simulation variables"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Variable List */}
        <div className="space-y-3.5 flex-1" id="vn-player-live-vars">
          {project.trackers.length === 0 && project.flags.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic py-6 text-center">No variables defined. Set up values in the Registry tab to watch them change live during playtesting walkthrough.</p>
          ) : (
            [...project.trackers, ...project.flags].map((v) => {
              const currentVal = vars[v.name] !== undefined ? vars[v.name] : v.defaultValue;
              const hasChanged = currentVal !== v.defaultValue;

              return (
                <div key={v.name} className="flex flex-col gap-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {v.name}
                    </span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                      hasChanged ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 text-slate-400"
                    }`}>
                      {String(currentVal)}
                    </span>
                  </div>
                  {v.description && (
                    <p className="text-[10px] text-slate-500 leading-normal line-clamp-1">{v.description}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Dynamic Action Audit Trail Log */}
        <div className="mt-6 border-t border-slate-800 pt-4" id="vn-player-logs">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Live Operation Feed</h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto bg-slate-950/80 p-2.5 rounded-xl border border-slate-850">
            {logs.length === 0 ? (
              <p className="text-[10px] text-slate-600 italic">Logs are empty. Feed will record stat updates live as you navigate choice branches.</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="text-[10px] font-mono leading-normal text-slate-400 border-b border-slate-900 pb-1 last:border-b-0">
                  <span className={log.type === "plus" ? "text-emerald-400" : log.type === "minus" ? "text-rose-400" : "text-cyan-400"}>
                    • {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main visual novel theatrical stage */}
      <div className="flex-1 flex flex-col justify-between bg-slate-950 p-6 relative" id="vn-player-stage">
        
        {/* Top bar controls */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4 z-10">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              Walkthrough Sandbox Mode
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Selected scene: <span className="text-slate-300 font-semibold">{node.title}</span></p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowLockedChoices(!showLockedChoices)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                showLockedChoices
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
              title="Toggle locked options visual debugger"
            >
              {showLockedChoices ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showLockedChoices ? "Showing Locked Paths" : "Hiding Locked Paths"}
            </button>

            <button
              onClick={handleBack}
              disabled={history.length === 0}
              className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Undo Branch
            </button>

            <button
              onClick={onExit}
              className="py-1.5 px-3 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/20 cursor-pointer"
            >
              Exit Test
            </button>
          </div>
        </div>

        {/* Narrative / Script stage visualization area */}
        <div className="flex-1 flex flex-col justify-center items-center py-6" id="vn-player-expressive-stage">
          {/* If ending node is active, show giant beautiful ending splashes */}
          {node.isEnding ? (
            <div className="text-center p-8 max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden" id="ending-splash-card">
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
              <Flag className="w-14 h-14 text-rose-400 mx-auto mb-4 animate-bounce" />
              <span className={`text-[10px] font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full ${
                node.endingType === "GOOD"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : node.endingType === "BAD"
                  ? "bg-rose-500/20 text-rose-400"
                  : "bg-cyan-500/20 text-cyan-400"
              }`}>
                {node.endingType || "NORMAL"} ENDING
              </span>

              <h3 className="text-2xl font-black text-white mt-4 tracking-tight">{node.endingName || "Story Completed"}</h3>
              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                {node.description || "You have charted a course through the branches and arrived at a distinct conclusion."}
              </p>

              <div className="mt-8 flex justify-center gap-3">
                <button
                  onClick={resetSimulator}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Start Story Over
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl items-stretch justify-center h-full overflow-hidden" id="playtest-dual-columns">
              {/* Standard dialogue box player */}
              <div className="flex-1 bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl relative flex flex-col justify-between" style={{ minHeight: "220px" }}>
                
                {/* Scene Outline Indicator */}
                <div className="absolute -top-3 left-4 bg-indigo-600 text-white text-[9px] font-bold tracking-widest px-2.5 py-0.5 rounded-full uppercase">
                  Active scene outline
                </div>

                {hasDialogue ? (
                  /* Dialogue screen lines navigation */
                  <div className="flex-1 flex flex-col justify-between" id="vn-player-interactive-box">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-indigo-300 text-xs font-bold border border-indigo-500/20">
                          {activeLine.speaker || "Narrator"}
                        </span>
                        {activeLine.expression && (
                          <span className="text-[10px] font-mono text-slate-500">
                            expression: <span className="text-slate-300 font-semibold">[{activeLine.expression}]</span>
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-100 leading-relaxed font-sans italic" style={{ minHeight: "60px" }}>
                        {(activeLine.speaker === "Narrator" || !activeLine.speaker) ? activeLine.text : `"${activeLine.text}"`}
                      </p>
                    </div>

                    {/* Lines pager */}
                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 mt-4 text-xs">
                      <span className="text-slate-500 font-mono">
                        Script line {lineIdx + 1} of {totalLines}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setLineIdx(Math.max(0, lineIdx - 1))}
                          disabled={lineIdx === 0}
                          className="p-1 px-2.5 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 cursor-pointer"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setLineIdx(Math.min(totalLines - 1, lineIdx + 1))}
                          disabled={lineIdx === totalLines - 1}
                          className="py-1 px-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-30 cursor-pointer flex items-center gap-0.5"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Static Outline Viewer if dialogue script lines isn't programmed */
                  <div className="flex flex-col justify-between h-full">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono">Narrative Synopsis</h4>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans" style={{ minHeight: "80px" }}>
                        {node.description || <span className="italic text-slate-500">No scene narration detailed yet. Edit scene details in the designer sidebar.</span>}
                      </p>
                    </div>
                    <div className="border-t border-slate-800/60 pt-3 mt-4 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>💡 Programming dialogue script lines under the designer panel will activate a speech box.</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Choice list — only renders when choices are visible */}
        {!node.isEnding && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length > 0 && (
          <div className="mt-4 border-t border-slate-800/60 pt-5 z-10">
            <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider mb-3">Choice Branch Pathways:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="vn-player-choices-grid">
              {availableChoices.map((choice) => {
                const evalResult = checkChoiceCondition(choice);
                const canSelect = evalResult.passed;

                return (
                  <button
                    key={choice.id}
                    disabled={!canSelect}
                    onClick={() => handleSelectChoice(choice)}
                    className={`relative text-left p-4 rounded-xl border transition-all text-xs font-bold cursor-pointer group ${
                      canSelect
                        ? "bg-slate-900 border-slate-800 text-white hover:border-indigo-500 hover:bg-slate-850 shadow-md hover:shadow-lg hover:scale-101"
                        : "bg-slate-950 border-red-950/20 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-sans text-xs font-bold leading-normal">{choice.text}</p>
                        {choice.targetNodeId && project.nodes[choice.targetNodeId] && (
                          <span className="text-[9px] font-mono text-slate-500 mt-1 block group-hover:text-indigo-400">
                            Leads to: {project.nodes[choice.targetNodeId]?.title}
                          </span>
                        )}
                      </div>

                      {!canSelect && (
                        <div className="text-[10px] text-rose-400 font-mono flex items-center gap-0.5 shrink-0 bg-rose-950/20 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> Locked
                        </div>
                      )}
                    </div>

                    {!canSelect && evalResult.message && (
                      <p className="text-[9px] text-red-400 font-mono mt-1.5 border-t border-red-950/10 pt-1">
                        {evalResult.message}
                      </p>
                    )}

                    {canSelect && choice.statChanges && choice.statChanges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {choice.statChanges.map((sc, i) => (
                          <span key={i} className="text-[8px] font-mono px-1 bg-slate-950 text-indigo-400 rounded">
                            {sc.variableName} {sc.operation}{sc.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
