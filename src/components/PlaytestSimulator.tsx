/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { VNProject, StoryNode, StoryChoice, SceneBlock, StatChange, InlineEffect } from "../types";
import { 
  RefreshCw, ChevronRight, ChevronLeft, 
  Flag, AlertTriangle, Eye, EyeOff, Sliders, Search
} from "lucide-react";
import TravelMap from "./TravelMap";
import InspectorOverlay from "./InspectorOverlay";

interface PlaytestSimulatorProps {
  project: VNProject;
  startNodeId: string;
  onExit: () => void;
  onUpdateProject?: (project: VNProject) => void;
}

function expandWiggleSpans(html: string): string {
  return html.replace(
    /<span([^>]*class="[^"]*animate-wiggle[^"]*"[^>]*)>([^<]+)<\/span>/g,
    (_match, attrs, text: string) => {
      const chars = text
        .split("")
        .map((ch: string, i: number) =>
          `<span style="animation-delay:${(i * 0.12).toFixed(2)}s">${ch === " " ? "\u00A0" : ch}</span>`
        )
        .join("");
      return `<span ${attrs} style="display:inline-flex">${chars}</span>`;
    }
  );
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
  const [playerInventory, setPlayerInventory] = useState<string[]>([]);

  // Current dialog script index inside current node
  const [lineIdx, setLineIdx] = useState<number>(0);

  // Debug options: show disabled choice condition locks
  const [showLockedChoices, setShowLockedChoices] = useState(true);
  const [showNarrator, setShowNarrator] = useState(true);
  const [inspectorActive, setInspectorActive] = useState(false);

  // Notification indicator of variable updates
  const [logs, setLogs] = useState<Array<{ text: string; type: "plus" | "minus" | "set" }>>([]);

  // Room memory for location-specific state
  const [roomMemory, setRoomMemory] = useState<Record<string, { localVariables: Record<string, any> }>>({});

  // Combat state per encounter for persistent HP between rounds
  const [combatState, setCombatState] = useState<Record<string, { currentHp: number }>>({});

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
    setRoomMemory({});
    setCombatState({});

    // Trigger immediate entry effects of starting node
    const startingNode = project.nodes[startNodeId];
    if (startingNode) {
      if (startingNode.statChanges.length > 0) {
        applyStatChanges(startingNode.statChanges, initialVars);
      }
      processNodeBlocks(startingNode, initialVars, []);
    }
  };

  const processNodeBlocks = (n: any, currentVars: Record<string, any>, currentInventory: string[]) => {
    if (!n.blocks) return;
    const newLogs: typeof logs = [];
    let updatedVars = { ...currentVars };
    let updatedInventory = [...currentInventory];

    for (const block of n.blocks) {
      if (block.type === "flag") {
        updatedVars[block.flagName] = block.flagValue;
        newLogs.push({ text: `🚩 ${block.flagName} = ${block.flagValue}`, type: "set" as const });
      } else if (block.type === "itemEffect") {
        if (block.action === "give") {
          updatedInventory.push(block.itemName);
          newLogs.push({ text: `🎒 + ${block.itemName}`, type: "set" as const });
        } else {
          updatedInventory = updatedInventory.filter(i => i !== block.itemName);
          newLogs.push({ text: `🎒 - ${block.itemName}`, type: "set" as const });
        }
      } else if (block.type === "bgm") {
        newLogs.push({ text: `🎵 BGM: ${block.trackName}`, type: "set" as const });
      } else if (block.type === "sfx") {
        newLogs.push({ text: `💥 SFX: ${block.soundName}`, type: "set" as const });
      } else if (block.type === "background") {
        newLogs.push({ text: `🖼️ BG: ${block.asset}`, type: "set" as const });
      } else if (block.type === "delay") {
        newLogs.push({ text: `⏳ Pause ${block.seconds}s`, type: "set" as const });
      }
    }

    if (newLogs.length > 0) {
      setVars(updatedVars);
      setPlayerInventory(updatedInventory);
      setLogs((prev) => [...newLogs, ...prev].slice(0, 20));
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

  const applyEffects = (effects: InlineEffect[], currentVars: Record<string, any>, currentInventory: string[]) => {
    const updatedVars = { ...currentVars };
    let updatedInventory = [...currentInventory];
    const newLogs: typeof logs = [];

    effects.forEach((ef) => {
      const item = project.inventory.find(i => i.id === ef.targetId);
      const itemName = item?.name || ef.targetId;
      const entry = [...project.trackers, ...project.flags].find(e => e.id === ef.targetId);
      const varName = entry?.name;

      if (ef.type === "give_item") {
        if (!updatedInventory.includes(ef.targetId)) {
          updatedInventory.push(ef.targetId);
          newLogs.push({ text: `Got item: ${itemName}`, type: "plus" });
        }
      } else if (ef.type === "take_item") {
        updatedInventory = updatedInventory.filter(id => id !== ef.targetId);
        newLogs.push({ text: `Lost item: ${itemName}`, type: "minus" });
      } else if (ef.type === "adjust_tracker" && varName) {
        const prevVal = updatedVars[varName];
        if (typeof prevVal === "number") {
          const op = ef.operation || "set";
          const val = ef.value ?? 1;
          if (op === "add") updatedVars[varName] = prevVal + val;
          else if (op === "subtract") updatedVars[varName] = prevVal - val;
          else updatedVars[varName] = val;
          newLogs.push({ text: `${varName}: ${prevVal} → ${updatedVars[varName]}`, type: "set" });
        }
      } else if (ef.type === "set_flag" && varName) {
        updatedVars[varName] = ef.flagValue ?? true;
        newLogs.push({ text: `Flag: ${varName} = ${updatedVars[varName]}`, type: "set" });
      } else if (ef.type === "clear_flag" && varName) {
        updatedVars[varName] = false;
        newLogs.push({ text: `Cleared: ${varName}`, type: "minus" });
      }
    });

    return { vars: updatedVars, inventory: updatedInventory, logs: newLogs };
  };

  // Condition evaluation (legacy + requirement)
  const checkChoiceCondition = (choice: StoryChoice): { passed: boolean; message?: string } => {
    // Legacy condition check
    if (choice.condition) {
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
        message: passed ? undefined : `Requires [${variableName} ${operator} ${value}] (Current: ${currentVal})`,
      };
    }

    // New requirement check
    if (choice.requirement) {
      const req = choice.requirement;
      const entry = [...project.trackers, ...project.flags].find(e => e.id === req.targetId);
      if (!entry) return { passed: false, message: `Requirement target not found` };

      const currentVal = vars[entry.name];
      if (currentVal === undefined) return { passed: false, message: `Logic Missing: ${entry.name} not initialized` };

      if (req.source === "flag") {
        const expectTrue = req.expect ?? true;
        const passed = Boolean(currentVal) === expectTrue;
        return {
          passed,
          message: passed ? undefined : `Requires [${entry.name} is ${expectTrue ? "checked" : "unchecked"}] (Current: ${currentVal ? "checked" : "unchecked"})`,
        };
      }

      if (req.source === "tracker") {
        const numCur = Number(currentVal);
        const numVal = req.compareValue ?? 1;
        const op = req.operator || ">=";
        let passed = false;
        if (op === ">=") passed = numCur >= numVal;
        else if (op === "<=") passed = numCur <= numVal;
        else if (op === ">") passed = numCur > numVal;
        else if (op === "<") passed = numCur < numVal;
        else if (op === "==") passed = numCur === numVal;
        else if (op === "!=") passed = numCur !== numVal;
        return {
          passed,
          message: passed ? undefined : `Requires [${entry.name} ${op} ${numVal}] (Current: ${numCur})`,
        };
      }
    }

    return { passed: true };
  };

  const handleSelectChoice = (choice: StoryChoice) => {
    const nextNode = project.nodes[choice.targetNodeId];
    if (!nextNode) {
      alert("This choice link points to a non-existent scene node.");
      return;
    }

    // Capture history for rollback
    setHistory([...history, { nodeId: currentNodeId, variables: { ...vars } }]);

    // Apply immediate selection rewards/costs
    let tempVars = { ...vars };
    let tempInventory = [...playerInventory];
    const allLogs: typeof logs = [];

    if (choice.statChanges && choice.statChanges.length > 0) {
      choice.statChanges.forEach((sc) => {
        const prevVal = tempVars[sc.variableName];
        if (prevVal === undefined) return;
        if (sc.operation === "+") tempVars[sc.variableName] = (Number(prevVal) || 0) + (Number(sc.value) || 0);
        else if (sc.operation === "-") tempVars[sc.variableName] = (Number(prevVal) || 0) - (Number(sc.value) || 0);
        else tempVars[sc.variableName] = sc.value;
        allLogs.push({ text: `${sc.variableName} ${sc.operation} ${sc.value}`, type: "set" });
      });
    }

    // Apply choice effects (give_item, take_item, adjust_tracker, set_flag, clear_flag)
    if (choice.effects && choice.effects.length > 0) {
      const result = applyEffects(choice.effects, tempVars, tempInventory);
      tempVars = result.vars;
      tempInventory = result.inventory;
      allLogs.push(...result.logs);
    }

    // Apply entry level effects of next node
    if (nextNode.statChanges && nextNode.statChanges.length > 0) {
      nextNode.statChanges.forEach((sc) => {
        const prevVal = tempVars[sc.variableName];
        if (prevVal === undefined) return;
        if (sc.operation === "+") tempVars[sc.variableName] = (Number(prevVal) || 0) + (Number(sc.value) || 0);
        else if (sc.operation === "-") tempVars[sc.variableName] = (Number(prevVal) || 0) - (Number(sc.value) || 0);
        else tempVars[sc.variableName] = sc.value;
      });
    }

    // Advance hour tracker (timer)
    if (typeof tempVars["hour"] === "number") {
      const newHour = (tempVars["hour"] + 1) % 24;
      tempVars["hour"] = newHour;
      if (newHour === 0) {
        tempVars["day"] = (tempVars["day"] || 1) + 1;
      }
      allLogs.push({ text: `⏰ Time advances. Hour: ${tempVars["hour"]}, Day: ${tempVars["day"]}`, type: "set" as const });
    }

    setVars(tempVars);
    setPlayerInventory(tempInventory);
    setLogs((prev) => [...allLogs, ...prev].slice(0, 20));
    setCurrentNodeId(choice.targetNodeId);
    setLineIdx(0);
    processNodeBlocks(nextNode, tempVars, tempInventory);

    // Story beat auto-trigger check
    const triggeredNode = Object.values(project.nodes).find(n => {
      if (!n.trigger || n.id === choice.targetNodeId) return false;
      const entry = [...project.trackers, ...project.flags].find(e => e.id === n.trigger!.targetId);
      if (!entry) return false;
      const val = tempVars[entry.name];
      if (n.trigger.source === "flag") {
        return (val === true) === (n.trigger.expect ?? true);
      }
      if (n.trigger.source === "tracker") {
        return typeof val === "number" && val >= (n.trigger.min ?? 1);
      }
      return false;
    });
    if (triggeredNode) {
      setTimeout(() => {
        setCurrentNodeId(triggeredNode.id);
        setLineIdx(0);
        setLogs(prev => [{ text: `📖 Story beat: ${triggeredNode.title}`, type: "plus" as const }, ...prev].slice(0, 20));
      }, 0);
    }
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
      <div className="p-8 text-center text-slate-300 max-w-lg mx-auto glass-card mt-12" id="playtest-error">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold">Simulator Startup Error</h2>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          The starting node for this playtest could not be loaded or was deleted. Return to visual storyboard canvas, click any scene node, and click &quot;Test Walkthrough&quot; to set a correct entry scene.
        </p>
        <button onClick={onExit} className="mt-5 px-5 py-2 glass-button rounded-xl font-bold text-xs">
          Back to Canvas
        </button>
      </div>
    );
  }

  // Active dialogue line (from dialogueLines)
  const visibleLines = showNarrator
    ? (node.dialogueLines || [])
    : (node.dialogueLines || []).filter(l => l.speaker !== "Narrator" && l.speaker !== "");
  const hasDialogue = visibleLines.length > 0;
  const totalLines = visibleLines.length;
  const activeLine = visibleLines[Math.min(lineIdx, Math.max(0, totalLines - 1))] ?? null;

  // Initialize room memory on entering a location
  useEffect(() => {
    if (node.nodeType === "location") {
      setRoomMemory(prev => {
        if (prev[node.id]) return prev;
        return { ...prev, [node.id]: { localVariables: {} } };
      });
    }
  }, [node.id]);

  // Narrative Intercept scan — check for story overrides when entering a location
  const prevNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!node || prevNodeIdRef.current === currentNodeId) return;
    prevNodeIdRef.current = currentNodeId;
    if (node.nodeType === "location") {
      const intercept = Object.values(project.nodes).find(n => {
        if (!n.interceptFlag || n.id === currentNodeId) return false;
        if (n.interceptFlag.targetLocationId !== currentNodeId) return false;
        const req = n.interceptFlag.condition;
        const entry = [...project.trackers, ...project.flags].find(e => e.id === req.targetId);
        if (!entry) return false;
        const val = vars[entry.name];
        if (req.source === "flag") {
          return Boolean(val) === (req.expect ?? true);
        }
        if (req.source === "tracker") {
          const numVal = Number(val);
          const cmp = Number(req.compareValue ?? 1);
          const op = req.operator || ">=";
          if (op === ">=") return numVal >= cmp;
          if (op === "<=") return numVal <= cmp;
          if (op === ">") return numVal > cmp;
          if (op === "<") return numVal < cmp;
          if (op === "==") return String(numVal) === String(cmp);
          if (op === "!=") return String(numVal) !== String(cmp);
        }
        return false;
      });
      if (intercept) {
        setLogs(prev => [{ text: `📖 Intercept: ${intercept.title}`, type: "set" as const }, ...prev].slice(0, 20));
        setCurrentNodeId(intercept.id);
        setLineIdx(0);
      }
    }
  }, [currentNodeId]);

  // Pre-compute visible choices — single evaluation pass
  const availableChoices = node.choices.filter((choice) => {
    const evalResult = checkChoiceCondition(choice);
    return evalResult.passed || showLockedChoices;
  });

  // Sequential block processing — determine ending state
  const isOnLastLine = !hasDialogue || lineIdx === totalLines - 1;
  const endingBlock = (node.blocks || []).find((b): b is SceneBlock & { type: "ending" } => b.type === "ending");
  const showEndingNow = !!endingBlock && isOnLastLine && availableChoices.length === 0;
  const activeEndingType = endingBlock?.endingType || node.endingType;
  const activeEndingName = endingBlock?.endingName || node.endingName;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 divide-y md:divide-y-0 md:divide-x divide-slate-800" id="vn-player-screen">
      
      {/* Left variables registry bar */}
      <div className="md:w-72 glass-card p-5 flex flex-col overflow-y-auto" id="vn-player-sidebar">
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
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
                    <div key={v.name} className="flex flex-col gap-1 glass-card p-2.5">
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

        {/* Player Inventory */}
        <div className="mt-4 border-t border-slate-800 pt-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Inventory ({playerInventory.length})</h4>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {playerInventory.length === 0 ? (
              <p className="text-[10px] text-slate-600 italic">No items collected.</p>
            ) : (
              playerInventory.map((itemId) => {
                const item = project.inventory.find(i => i.id === itemId);
                return (
                  <div key={itemId} className="flex items-center gap-1.5 glass-card p-1.5">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">{item?.name || itemId}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Dynamic Action Audit Trail Log */}
        <div className="mt-4 border-t border-slate-800 pt-4" id="vn-player-logs">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Live Operation Feed</h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto glass-card p-2.5">
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

        {/* Travel Map */}
        {node.nodeType === "location" && (
          <TravelMap project={project} currentNodeId={currentNodeId} onTravel={(id) => { setCurrentNodeId(id); setLineIdx(0); }} />
        )}

        {/* Inspector Overlay */}
        <div className="mt-2">
          <button
            onClick={() => setInspectorActive(!inspectorActive)}
            className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer w-full ${
              inspectorActive ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Search className="w-3 h-3" />
            Inspector: {inspectorActive ? "Active" : "Off"}
          </button>
          {inspectorActive && <InspectorOverlay node={node} />}
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

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setShowNarrator(!showNarrator)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                showNarrator
                  ? "bg-sky-500/15 border-sky-500/30 text-sky-300"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
              title="Toggle narrator dialogue visibility"
            >
              {showNarrator ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Narrator: {showNarrator ? "On" : "Off"}
            </button>
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
              className="py-1.5 px-3 glass-button disabled:opacity-40 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
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
        <div className="flex-1 flex flex-col justify-start py-4" id="vn-player-expressive-stage">
          {/* If ending node is active (sequential), show giant beautiful ending splashes */}
           {showEndingNow ? (
            <div className="text-center p-8 max-w-md glass-card" id="ending-splash-card">
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
              <Flag className="w-14 h-14 text-rose-400 mx-auto mb-4 animate-bounce" />
              <span className={`text-[10px] font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full ${
                activeEndingType === "GOOD"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : activeEndingType === "BAD"
                  ? "bg-rose-500/20 text-rose-400"
                  : "bg-cyan-500/20 text-cyan-400"
              }`}>
                {activeEndingType || "NORMAL"} ENDING
              </span>

              <h3 className="text-2xl font-black text-white mt-4 tracking-tight">{activeEndingName || "Story Completed"}</h3>
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
          ) : node.nodeType === "location" && (node.locationNodeData || node.locationData) ? (
            <div className="w-full">
              <div className="glass-card p-6 border-amber-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏪</span>
                  <h2 className="text-lg font-bold text-white">{node.title}</h2>
                </div>
                <p className="text-xs text-slate-300 mb-4">{node.description}</p>

                {/* Encounter pool — wireless exploration roll */}
                {node.locationNodeData && node.locationNodeData.encounterPool.length > 0 && (
                  <div className="mb-4">
                    <button onClick={() => {
                      const pool = node.locationNodeData!.encounterPool;
                      const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
                      if (totalWeight === 0) return;
                      const roll = Math.random() * totalWeight;
                      let cumulative = 0;
                      for (const entry of pool) {
                        cumulative += entry.weight;
                        if (roll < cumulative) {
                          setLogs(prev => [{ text: `🎲 Random encounter triggered!`, type: "set" as const }, ...prev].slice(0, 20));
                          if (project.nodes[entry.encounterId]) {
                            setCurrentNodeId(entry.encounterId);
                            setLineIdx(0);
                          }
                          return;
                        }
                      }
                    }} className="w-full py-2 px-3 glass-button text-amber-300 font-bold text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer">
                      🔍 Explore
                    </button>
                  </div>
                )}

                {/* Base actions */}
                {node.locationNodeData && node.locationNodeData.baseActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {node.locationNodeData.baseActions.map((a, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 bg-slate-800/50 rounded-lg text-slate-400 border border-slate-700/50">
                        {a.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Connections display */}
                {node.locationNodeData && node.locationNodeData.connections.length > 0 && (
                  <div className="text-[10px] text-slate-500 mb-3 flex flex-wrap gap-1.5">
                    <span className="text-slate-600">Connected to:</span>
                    {node.locationNodeData.connections.map(cId => {
                      const loc = project.nodes[cId];
                      return loc ? (
                        <button key={cId} onClick={() => { setCurrentNodeId(cId); setLineIdx(0); }}
                          className="px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-300 hover:bg-indigo-800/40 cursor-pointer">
                          {loc.title}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Shop inventory — supports both new and old schema */}
                {((node.locationNodeData?.inventory || [])?.length > 0 || (node.locationData?.inventory || [])?.length > 0) && (
                  <div className="space-y-2 border-t border-white/10 pt-3 mt-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shop</h3>
                    {(node.locationNodeData?.inventory || node.locationData?.inventory || []).map((li: any, i: number) => {
                      const item = project.inventory.find(it => it.id === li.itemId);
                      const gold = vars["gold"] ?? 0;
                      const price = li.price ?? 0;
                      const canAfford = gold >= price;
                      return (
                        <div key={i} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <div>
                            <span className="text-xs font-semibold text-white">{item?.name || li.itemId}</span>
                            <span className="text-[10px] text-slate-500 ml-2">{price} gold</span>
                          </div>
                          <button
                            disabled={!canAfford}
                            onClick={() => {
                              let tv = { ...vars };
                              if (price > 0) { tv["gold"] = (tv["gold"] ?? 0) - price; setVars(tv); }
                              setPlayerInventory([...playerInventory, li.itemId]);
                              setLogs(prev => [{ text: `Bought: ${item?.name || li.itemId} for ${price} gold`, type: "plus" as const }, ...prev].slice(0, 20));
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${canAfford ? "glass-button text-white" : "bg-slate-800 text-slate-600 cursor-not-allowed"}`}
                          >
                            {canAfford ? "Buy" : `Need ${price - gold} more`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : node.nodeType === "encounter" && node.encounterData ? (
            <div className="w-full">
              <div className="glass-card p-6 border-rose-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⚔️</span>
                  <h2 className="text-lg font-bold text-white">{node.title}</h2>
                </div>
                <p className="text-xs text-slate-300 mb-4">{node.description}</p>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-rose-400">{node.encounterData.enemyName}</span>
                    <span className="text-xs font-mono text-slate-400">HP: {node.encounterData.hp} | ATK: {node.encounterData.attack} | DEF: {node.encounterData.defense}</span>
                  </div>
                  {node.encounterData.drops.length > 0 && (
                    <div className="text-[10px] text-slate-500">Drops: {node.encounterData.drops.map(d => {
                      const item = project.inventory.find(it => it.id === d.itemId);
                      return `${item?.name || d.itemId} (${d.chance}%)`;
                    }).join(", ")}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const ed = node.encounterData!;
                    const playerAtk = vars["atk"] ?? 10;
                    const playerDef = vars["def"] ?? 5;
                    const dmgToEnemy = Math.max(1, playerAtk - ed.defense);
                    const dmgToPlayer = Math.max(1, ed.attack - playerDef);
                    const prevHp = combatState[node.id]?.currentHp ?? ed.hp;
                    const newHp = Math.max(0, prevHp - dmgToEnemy);
                    let tv = { ...vars };
                    let ti = [...playerInventory];
                    const nl: Array<{ text: string; type: "set" | "plus" | "minus" }> = [];
                    nl.push({ text: `You deal ${dmgToEnemy} damage. Enemy at ${newHp} HP.`, type: "set" });
                    if (newHp <= 0) {
                      setCombatState(prev => { const n = { ...prev }; delete n[node.id]; return n; });
                      nl.push({ text: `Victory! ${ed.enemyName} defeated.`, type: "plus" as const });
                      ed.drops.forEach(d => {
                        if (Math.random() * 100 < d.chance) {
                          ti.push(d.itemId);
                          const item = project.inventory.find(it => it.id === d.itemId);
                          nl.push({ text: `Dropped: ${item?.name || d.itemId}`, type: "plus" });
                        }
                      });
                      setVars(tv);
                      setPlayerInventory(ti);
                      setLogs(prev => [...nl, ...prev].slice(0, 20));
                      if (ed.onWinNodeId) { setCurrentNodeId(ed.onWinNodeId); setLineIdx(0); }
                    } else {
                      setCombatState(prev => ({ ...prev, [node.id]: { currentHp: newHp } }));
                      const playerHp = (tv["hp"] ?? 20) - dmgToPlayer;
                      tv["hp"] = Math.max(0, playerHp);
                      nl.push({ text: `Enemy deals ${dmgToPlayer} damage. Player HP: ${Math.max(0, playerHp)}.`, type: "minus" });
                      setVars(tv);
                      setLogs(prev => [...nl, ...prev].slice(0, 20));
                    }
                  }} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer">⚔️ Fight</button>
                  <button onClick={() => {
                    setCombatState(prev => { const n = { ...prev }; delete n[node.id]; return n; });
                    const ed = node.encounterData;
                    if (ed?.onFleeNodeId) { setCurrentNodeId(ed.onFleeNodeId); setLineIdx(0); }
                  }} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer">🏃 Flee</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full" id="playtest-story-stage">
              {/* Standard dialogue box player */}
              <div className="glass-card p-6" style={{ minHeight: "160px" }}>
                
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

                      {activeLine.formattedText ? (
                        <div className="text-sm text-slate-100 leading-relaxed font-sans italic" style={{ minHeight: "60px" }} dangerouslySetInnerHTML={{ __html: expandWiggleSpans(activeLine.formattedText) }} />
                      ) : (
                        <p className="text-sm text-slate-100 leading-relaxed font-sans italic" style={{ minHeight: "60px" }}>
                          {(activeLine.speaker === "Narrator" || !activeLine.speaker) ? activeLine.text : `"${activeLine.text}"`}
                        </p>
                      )}
                    </div>

                    {/* Stat displays and entity cards from blocks */}
                    {node.blocks && !hasDialogue && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {node.blocks.filter(b => b.type === "statDisplay" || b.type === "entity").map((block, i) => {
                          if (block.type === "statDisplay") {
                            const val = vars[block.variableName] ?? project.trackers.find(t => t.name === block.variableName)?.defaultValue ?? "?";
                            return (
                              <span key={`sd-${i}`} className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                                {block.variableName}: {String(val)}
                              </span>
                            );
                          }
                          if (block.type === "entity") {
                            const entity = project.entities.find(e => e.id === block.entityId);
                            if (!entity) return null;
                            return (
                              <div key={`ent-${i}`} className="px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono flex items-center gap-2">
                                <span className="font-bold">{entity.name}</span>
                                {entity.ownedTrackers?.map((t, ti) => {
                                  const trackerName = `${entity.name.toLowerCase()}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, "_");
                                  const val = vars[trackerName] ?? t.defaultValue;
                                  return <span key={ti} className="text-purple-400">{t.name}: {val}</span>;
                                })}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}

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

                {/* Continue-to auto-advance */}
                {!showEndingNow && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length === 0 && node.continueToNodeId && project.nodes[node.continueToNodeId] && (
                  <div className="border-t border-slate-800/60 pt-4 mt-4">
                    <div className="flex justify-center">
                      <button
                        onClick={() => {
                          setHistory([...history, { nodeId: currentNodeId, variables: { ...vars } }]);
                          const next = project.nodes[node.continueToNodeId!];
                          if (next) {
                            setCurrentNodeId(node.continueToNodeId!);
                            setLineIdx(0);
                            processNodeBlocks(next, vars, playerInventory);
                          }
                        }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer flex items-center gap-2"
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {/* Choices inside the dialogue card */}
                {!showEndingNow && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length > 0 && (
                  <div className="border-t border-slate-800/60 pt-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                ? "bg-slate-900 border-slate-800 text-white hover:border-indigo-500 hover:bg-slate-800 shadow-md hover:shadow-lg hover:scale-105"
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
                              <p className="text-[9px] text-red-400 font-mono mt-1.5 border-t border-red-950/10 pt-1">{evalResult.message}</p>
                            )}
                            {canSelect && choice.statChanges && choice.statChanges.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {choice.statChanges.map((sc, i) => (
                                  <span key={i} className="text-[8px] font-mono px-1 bg-slate-950 text-indigo-400 rounded">{sc.variableName} {sc.operation}{sc.value}</span>
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
          )}
        </div>
      </div>
    </div>
  );
}
