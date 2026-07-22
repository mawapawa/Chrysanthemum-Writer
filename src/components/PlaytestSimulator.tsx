/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { VNProject, StoryChoice, SceneBlock, StatChange, InlineEffect } from "../types";
import { 
  RefreshCw, ChevronRight, ChevronLeft,
  Flag, AlertTriangle, Eye, EyeOff, Sliders, Search, Layout, X, Plus,
  Copy, GripHorizontal
} from "lucide-react";
import TravelMap from "./TravelMap";
import InspectorOverlay from "./InspectorOverlay";
import { REGISTRY, WidgetRenderer, WidgetRuntimeProps } from "../widgets";
import type { WidgetType, WidgetConfig } from "../types";
import {
  DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable
} from "@dnd-kit/core";
import { dateToTicks, ticksToTime } from "../utils/timeEngine";
import SaveLoadDialog from "./SaveLoadDialog";
import type { SaveData } from "../types";
import { GameUIRenderer } from "../widgets/renderGameUI";
import { EditorV2 } from "../editor/EditorV2";

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

const CANVAS_W = 800;
const CANVAS_H = 600;

function clampCanvas(v: number, max: number, min = 0): number {
  return Math.max(min, Math.min(max, v));
}

export default function PlaytestSimulator({ 
  project, 
  startNodeId, 
  onExit,
  onUpdateProject,
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
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [showNarrator, setShowNarrator] = useState(true);
  const [inspectorActive, setInspectorActive] = useState(false);
  const [showUIEditor, setShowUIEditor] = useState(false);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [showKeymapper, setShowKeymapper] = useState(false);
  const [pendingInput, setPendingInput] = useState<{ variableName: string; prompt: string; defaultValue: string } | null>(null);

  // Notification indicator of variable updates
  const [logs, setLogs] = useState<Array<{ text: string; type: "plus" | "minus" | "set" }>>([]);



  // Combat state per encounter — cloned instance protecting root template
  const [combatState, setCombatState] = useState<Record<string, {
    currentHp: number;
    maxHp: number;
    attack: number;
    defense: number;
    name: string;
  }>>({});
  const [globalTimeTicks, setGlobalTimeTicks] = useState(project.globalTimeTicks ?? 0);

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
    setCombatState({});
    setGlobalTimeTicks(project.globalTimeTicks ?? 0);

    // Trigger immediate entry effects of starting node
    const startingNode = project.nodes[startNodeId];
    if (startingNode) {
      if (startingNode.statChanges.length > 0) {
        applyStatChanges(startingNode.statChanges, initialVars);
      }
      processNodeBlocks(startingNode, initialVars, []);
    }
  };

  // Clone encounter data into activeEnemyState on entering an encounter node
  useEffect(() => {
    if (node?.nodeType === "encounter" && node.encounterData) {
      setCombatState(prev => {
        if (prev[node.id]) return prev;
        return {
          ...prev,
          [node.id]: {
            currentHp: node.encounterData!.hp,
            maxHp: node.encounterData!.hp,
            attack: node.encounterData!.attack,
            defense: node.encounterData!.defense,
            name: node.encounterData!.enemyName,
          }
        };
      });
    }
  }, [currentNodeId]);

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
        } else if (block.action === "take") {
          updatedInventory = updatedInventory.filter(i => i !== block.itemName);
          newLogs.push({ text: `🎒 - ${block.itemName}`, type: "set" as const });
        } else if (block.action === "use") {
          const item = project.inventory.find(i => i.name === block.itemName);
          if (item && updatedInventory.includes(item.id)) {
            updatedInventory = updatedInventory.filter(i => i !== item.id);
            if (item.statModifiers) {
              for (const [stat, val] of Object.entries(item.statModifiers)) {
                updatedVars[stat] = (updatedVars[stat] ?? 0) + val;
              }
            }
            newLogs.push({ text: `🧪 Used ${block.itemName}`, type: "set" as const });
          }
        }
      } else if (block.type === "bgm") {
        newLogs.push({ text: `🎵 BGM: ${block.trackName}`, type: "set" as const });
      } else if (block.type === "sfx") {
        newLogs.push({ text: `💥 SFX: ${block.soundName}`, type: "set" as const });
      } else if (block.type === "background") {
        newLogs.push({ text: `🖼️ BG: ${block.asset}`, type: "set" as const });
      } else if (block.type === "delay") {
        newLogs.push({ text: `⏳ Pause ${block.seconds}s`, type: "set" as const });
      } else if (block.type === "showOverlay") {
        setActiveOverlayId(block.overlayId);
        newLogs.push({ text: `📺 Overlay: ${block.overlayId}`, type: "set" as const });
      } else if (block.type === "hideOverlay") {
        setActiveOverlayId(null);
        newLogs.push({ text: `📺 Overlay closed`, type: "set" as const });
      } else if (block.type === "inputDialog") {
        setPendingInput({ variableName: block.variableName, prompt: block.prompt, defaultValue: block.defaultValue ?? "" });
        newLogs.push({ text: `✏️ Input dialog: ${block.variableName}`, type: "set" as const });
        break; // stop processing further blocks until dialog is resolved
      } else if (block.type === "time") {
        const config = project.customTimeConfig;
        if (config) {
          const tpd = config.segments.reduce((s: number, seg) => s + seg.ticks, 0);
          let newTicks = globalTimeTicks;
          if (block.action === "add") {
            const unit = block.unit || "tick";
            const amount = block.value || 1;
            if (unit === "day") {
              newTicks += amount * tpd;
            } else if (unit === "month") {
              const tc = ticksToTime(newTicks, config);
              let monthIdx = config.months.findIndex(m => m.name === tc.month);
              let targetMonth = (monthIdx + amount) % config.months.length;
              let yearOffset = Math.floor((monthIdx + amount) / config.months.length);
              if (targetMonth < 0) { targetMonth += config.months.length; yearOffset -= 1; }
              let totalDays = 0;
              for (let y = 0; y < tc.year + yearOffset; y++) {
                for (const m of config.months) totalDays += m.days;
              }
              for (let i = 0; i < targetMonth; i++) totalDays += config.months[i].days;
              totalDays += Math.min(tc.dayOfMonth - 1, config.months[targetMonth].days - 1);
              newTicks = totalDays * tpd + tc.tick;
            } else {
              newTicks += amount;
            }
          } else if (block.action === "set" && block.segment) {
            const segIdx = config.segments.findIndex(s => s.name === block.segment);
            if (segIdx >= 0) {
              const segStart = config.segments.slice(0, segIdx).reduce((s: number, seg) => s + seg.ticks, 0);
              const dayBase = Math.floor(newTicks / tpd) * tpd;
              newTicks = dayBase + segStart;
            }
          } else if (block.action === "set_date" && block.dateString) {
            const parts = block.dateString.split(" ");
            if (parts.length >= 2) {
              const day = parseInt(parts[parts.length - 1]) || 1;
              const monthName = parts.slice(0, -1).join(" ");
              newTicks = dateToTicks(monthName, day, config);
            }
          }
          setGlobalTimeTicks(newTicks);
          newLogs.push({ text: `⏰ Time set to tick ${newTicks}`, type: "set" as const });
        }
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

  // Compute effective stats by summing base vars with item statModifiers (equipment)
  const computeEffectiveStat = (statName: string, base: number): number => {
    let total = base;
    for (const itemId of playerInventory) {
      const item = project.inventory.find(i => i.id === itemId);
      if (item?.statModifiers?.[statName]) {
        total += item.statModifiers[statName];
      }
    }
    return total;
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
    setHistory(prev => [...prev, { nodeId: currentNodeId, variables: { ...vars } }]);

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
      setCurrentNodeId(triggeredNode.id);
      setLineIdx(0);
      setLogs(prev => [{ text: `📖 Story beat: ${triggeredNode.title}`, type: "plus" as const }, ...prev].slice(0, 20));
    }
  };

  const handleBack = () => {
    if (history.length === 0) return;
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setCurrentNodeId(previous.nodeId);
    setVars(previous.variables);
    setHistory(prev => prev.slice(0, -1));
    setLineIdx(0);
  };

  const handleInspectItem = (itemId: string) => {
    setInspectedItemId(itemId);
  };

  const handleUseItem = (itemId: string) => {
    const item = project.inventory.find(i => i.id === itemId);
    if (!item) return;
    setPlayerInventory(prev => {
      if (!prev.includes(itemId)) {
        setLogs(l => [{ text: `Don't have: ${item.name}`, type: "minus" as const }, ...l].slice(0, 20));
        return prev;
      }
      return prev.filter(id => id !== itemId);
    });
    if (item.statModifiers) {
      setVars(prev => { const n = { ...prev }; for (const [k, v] of Object.entries(item.statModifiers!)) { n[k] = (n[k] ?? 0) + v; } return n; });
    }
    setLogs(prev => [{ text: `Used ${item.name}`, type: "plus" as const }, ...prev].slice(0, 20));
  };

  const handleEquipItem = (itemId: string) => {
    const item = project.inventory.find(i => i.id === itemId);
    if (!item || !playerInventory.includes(itemId)) return;
    if (item.statModifiers) {
      setVars(prev => { const n = { ...prev }; for (const [k, v] of Object.entries(item.statModifiers!)) { n[k] = (n[k] ?? 0) + v; } return n; });
    }
    setLogs(prev => [{ text: `Equipped ${item.name}`, type: "set" as const }, ...prev].slice(0, 20));
  };

  // Global keydown listener for keymappings
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showSaveDialog || showLoadDialog || activeOverlayId) return;
      const mappings = project.keyMappings ?? [];
      for (const m of mappings) {
        if (e.key === m.key || e.code === m.key) {
          if (m.action === "rollback" && history.length > 0) handleBackRef.current();
          else if (m.action === "quit") onExitRef.current();
          else if (m.action === "save") setShowSaveDialog(true);
          else if (m.action === "load") setShowLoadDialog(true);
          else if (m.action.startsWith("open_overlay:")) setActiveOverlayId(m.action.slice("open_overlay:".length));
          else if (m.action === "close_overlay") setActiveOverlayId(null);
          else if (m.action.startsWith("goto_node:")) {
            const nid = m.action.slice("goto_node:".length);
            if (project.nodes[nid]) { setCurrentNodeId(nid); setLineIdx(0); }
          }
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [project.keyMappings, history.length, showSaveDialog, showLoadDialog, activeOverlayId]);

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

  const isOnLastLine = !hasDialogue || lineIdx === totalLines - 1;
  const choicesData = availableChoices.map(c => ({
    id: c.id,
    text: c.text,
    targetNodeTitle: c.targetNodeId && project.nodes[c.targetNodeId] ? project.nodes[c.targetNodeId].title : undefined,
    passed: checkChoiceCondition(c).passed,
    statChanges: c.statChanges,
  }));
  const showChoicesNow = isOnLastLine && availableChoices.length > 0;
  const widgetChoices = showChoicesNow ? choicesData : [];
  const runtimeVars = { ...vars, _hasChoices: showChoicesNow ? 1 : 0 };

  // Sequential block processing — determine ending state
  const endingBlock = (node.blocks || []).find((b): b is SceneBlock & { type: "ending" } => b.type === "ending");
  const showEndingNow = !!endingBlock && isOnLastLine && availableChoices.length === 0;
  const activeEndingType = endingBlock?.endingType || node.endingType;
  const activeEndingName = endingBlock?.endingName || node.endingName;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 divide-y md:divide-y-0 md:divide-x divide-slate-800" id="vn-player-screen">
      
      {/* Left variables registry bar — hidden during UI edit */}
      <div className={`${showUIEditor ? "hidden" : "md:w-72"} glass-card p-5 flex flex-col overflow-y-auto`} id="vn-player-sidebar">
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
              Playtest Mode
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
            <button onClick={() => setShowUIEditor(!showUIEditor)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                showUIEditor
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-300"
              }`}
              title="Customize UI layout">
              <Layout className="w-3.5 h-3.5" />
              UI
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
              onClick={() => setShowSaveDialog(true)}
              className="py-1.5 px-3 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/20 cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={() => setShowLoadDialog(true)}
              className="py-1.5 px-3 bg-indigo-950/20 hover:bg-indigo-900/30 text-indigo-300 text-xs font-bold rounded-xl border border-indigo-500/20 cursor-pointer"
            >
              Load
            </button>
            <button
              onClick={() => setShowKeymapper(!showKeymapper)}
              className={`py-1.5 px-3 text-xs font-bold rounded-xl border cursor-pointer ${
                showKeymapper
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-amber-500/50"
              }`}
            >
              Keys
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
        <div className="flex-1 flex flex-col justify-start py-4 overflow-y-auto relative" id="vn-player-expressive-stage">
          {showUIEditor ? (
            <EditorV2 project={project} onUpdateProject={onUpdateProject} onBack={() => setShowUIEditor(false)} />
          ) : (
          // If ending node is active (sequential), show giant beautiful ending splashes
           showEndingNow ? (
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
                              if (price > 0) { setVars(prev => ({ ...prev, gold: (prev.gold ?? 0) - price })); }
                              setPlayerInventory(prev => [...prev, li.itemId]);
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
                      <span className="text-xs font-mono text-slate-400">
                        HP: {(combatState[node.id]?.currentHp ?? node.encounterData.hp)} / {combatState[node.id]?.maxHp ?? node.encounterData.hp}
                        {' | '}ATK: {combatState[node.id]?.attack ?? node.encounterData.attack}
                        {' | '}DEF: {combatState[node.id]?.defense ?? node.encounterData.defense}
                      </span>
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
                      const es = combatState[node.id];
                      const effAtk = computeEffectiveStat("attack", vars["atk"] ?? 10);
                      const effDef = computeEffectiveStat("defense", vars["def"] ?? 5);
                      const dmgToEnemy = Math.max(1, effAtk - (es?.defense ?? ed.defense));
                      const dmgToPlayer = Math.max(1, (es?.attack ?? ed.attack) - effDef);
                      const prevHp = es?.currentHp ?? ed.hp;
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
                        setCombatState(prev => {
                          const existing = prev[node.id];
                          return { ...prev, [node.id]: { ...existing!, currentHp: newHp } };
                        });
                        const playerHp = (tv["hp"] ?? 20) - dmgToPlayer;
                        tv["hp"] = Math.max(0, playerHp);
                        nl.push({ text: `Enemy deals ${dmgToPlayer} damage. Player HP: ${Math.max(0, playerHp)}.`, type: "minus" });
                        if (tv["hp"] <= 0 && ed.onLoseNodeId) {
                          setCombatState(prev => { const n = { ...prev }; delete n[node.id]; return n; });
                          setVars(tv);
                          setLogs(prev => [...nl, ...prev].slice(0, 20));
                          setCurrentNodeId(ed.onLoseNodeId);
                          setLineIdx(0);
                          return;
                        }
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
            <>
            {(() => {
              // Render V2 screens: dialogue base + any active HUD overlay
              const allScreens = Object.keys(project.uiLayouts?.screens ?? {}).filter(s => project.uiLayouts!.screens[s].length > 0);
              const activeHud = activeOverlayId?.startsWith("hud_") ? activeOverlayId.slice(4) : null;
              const renderScreens = allScreens.filter(s => s === "dialogue" || s === activeHud);
              if (renderScreens.length > 0) {
                return (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      {renderScreens.map(screen => (
                        <GameUIRenderer key={screen}
                          screen={screen}
                          project={project}
                          ctx={{
                          currentNodeId,
                          interactionState: widgetChoices.length > 0 && showChoicesNow ? "choice" : "dialogue",
                          dialogueText: activeLine?.text,
                          dialogueSpeaker: activeLine?.speaker,
                          dialogueFormattedText: activeLine?.formattedText ? expandWiggleSpans(activeLine.formattedText) : undefined,
                          lineIdx, totalLines, hasDialogue,
                          choices: widgetChoices,
                          showContinue: !showEndingNow && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length === 0 && !!node.continueToNodeId && !!project.nodes[node.continueToNodeId],
                          vars: runtimeVars,
                          inventory: playerInventory,
                          onSelectChoice: (choiceId) => {
                            const choice = node.choices.find(c => c.id === choiceId);
                            if (choice) handleSelectChoice(choice);
                          },
                          onButtonAction: (action) => {
                            const showContinue = !showEndingNow && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length === 0 && !!node.continueToNodeId && !!project.nodes[node.continueToNodeId];
                            if (action === "next" && hasDialogue && lineIdx < totalLines - 1) setLineIdx(lineIdx + 1);
                            else if (action === "continue" && showContinue && node.continueToNodeId) {
                              setHistory(prev => [...prev, { nodeId: currentNodeId, variables: { ...vars } }]);
                              const next = project.nodes[node.continueToNodeId!];
                              if (next) { setCurrentNodeId(node.continueToNodeId!); setLineIdx(0); processNodeBlocks(next, vars, playerInventory); }
                            }
                            else if (action === "save") setShowSaveDialog(true);
                            else if (action === "load") setShowLoadDialog(true);
                            else if (action === "rollback" && history.length > 0) handleBack();
                            else if (action === "quit") onExit();
                            else if (action.startsWith("goto_node:")) {
                              const nid = action.slice("goto_node:".length);
                              if (project.nodes[nid]) { setCurrentNodeId(nid); setLineIdx(0); }
                            }
                            else if (action.startsWith("open_overlay:")) setActiveOverlayId(action.slice("open_overlay:".length));
                            else if (action === "close_overlay") setActiveOverlayId(null);
                            else if (action.startsWith("use_item:")) handleUseItem(action.slice("use_item:".length));
                            else if (action.startsWith("equip_item:")) handleEquipItem(action.slice("equip_item:".length));
                            else if (action.startsWith("inspect_item:")) handleInspectItem(action.slice("inspect_item:".length));
                            else if (action.startsWith("select:")) {
                              const choiceId = action.slice("select:".length);
                              if (choiceId && node.choices.some(c => c.id === choiceId)) {
                                const choice = node.choices.find(c => c.id === choiceId);
                                if (choice) handleSelectChoice(choice);
                              }
                            }
                            else if (action.startsWith("open_hud:")) {
                              const hudId = action.slice("open_hud:".length);
                              if (hudId && project.uiLayouts?.screens?.[hudId]) {
                                setActiveOverlayId(`hud_${hudId}`);
                              }
                            }
                          },
                          onNextLine: () => { if (lineIdx < totalLines - 1) setLineIdx(lineIdx + 1); },
                          onPrevLine: () => { if (lineIdx > 0) setLineIdx(lineIdx - 1); },
                          onContinue: () => {
                            if (node.continueToNodeId) {
                              setHistory(prev => [...prev, { nodeId: currentNodeId, variables: { ...vars } }]);
                              const next = project.nodes[node.continueToNodeId!];
                              if (next) { setCurrentNodeId(node.continueToNodeId!); setLineIdx(0); processNodeBlocks(next, vars, playerInventory); }
                            }
                          },
                          onOpenSave: () => setShowSaveDialog(true),
                          onOpenLoad: () => setShowLoadDialog(true),
                          onOpenOverlay: (oid) => setActiveOverlayId(oid),
                          onCloseOverlay: () => setActiveOverlayId(null),
                          onGoToNode: (nid) => { if (project.nodes[nid]) { setCurrentNodeId(nid); setLineIdx(0); } },
                          onRollback: () => { if (history.length > 0) handleBack(); },
                          onQuit: () => onExit(),
                          onInspectItem: handleInspectItem,
                          onUseItem: handleUseItem,
                          onEquipItem: handleEquipItem,
                        }}
                      />
                    ))}
                    </div>
                    {/* Scene navigator bar */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#0f172a", borderTop: "1px solid #1e293b" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                        Line {Math.min(lineIdx + 1, totalLines)} of {totalLines}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { if (lineIdx > 0) setLineIdx(lineIdx - 1); }}
                          style={{ padding: "4px 12px", fontSize: 11, fontFamily: "monospace", background: "#1e293b", color: lineIdx > 0 ? "#e2e8f0" : "#475569", border: "1px solid #334155", borderRadius: 4, cursor: lineIdx > 0 ? "pointer" : "default" }}>
                          &lt; Back
                        </button>
                        <button onClick={() => {
                          if (hasDialogue && lineIdx < totalLines - 1) setLineIdx(lineIdx + 1);
                          else if (!showEndingNow && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length === 0 && !!node.continueToNodeId && !!project.nodes[node.continueToNodeId]) {
                            setHistory(prev => [...prev, { nodeId: currentNodeId, variables: { ...vars } }]);
                            const next = project.nodes[node.continueToNodeId!];
                            if (next) { setCurrentNodeId(node.continueToNodeId!); setLineIdx(0); processNodeBlocks(next, vars, playerInventory); }
                          }
                        }}
                          style={{ padding: "4px 12px", fontSize: 11, fontFamily: "monospace", background: "#6366f1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                          Next &gt;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {project.dashboardLayout?.length && !(project.uiLayouts?.screens?.dialogue?.length) && (
              <div className="w-full">
                <WidgetPlaytestView
                  project={project}
                  layout={project.dashboardLayout}
                  runtime={{
                    dialogueText: activeLine?.text,
                    dialogueFormattedText: activeLine?.formattedText ? expandWiggleSpans(activeLine.formattedText) : undefined,
                    dialogueSpeaker: activeLine?.speaker,
                    runtimeValues: runtimeVars,
                    inventory: playerInventory,
                    choices: widgetChoices,
                    onSelectChoice: (choiceId) => {
                      const choice = node.choices.find(c => c.id === choiceId);
                      if (choice) handleSelectChoice(choice);
                    },
                  }}
                  lineIdx={lineIdx}
                  totalLines={totalLines}
                  hasDialogue={hasDialogue}
                  onNextLine={() => { if (lineIdx < totalLines - 1) setLineIdx(lineIdx + 1); }}
                  onPrevLine={() => { if (lineIdx > 0) setLineIdx(lineIdx - 1); }}
                  showContinue={!showEndingNow && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length === 0 && !!node.continueToNodeId && !!project.nodes[node.continueToNodeId]}
                  onContinue={() => {
                    if (node.continueToNodeId) {
                      setHistory(prev => [...prev, { nodeId: currentNodeId, variables: { ...vars } }]);
                      const next = project.nodes[node.continueToNodeId!];
                      if (next) { setCurrentNodeId(node.continueToNodeId!); setLineIdx(0); processNodeBlocks(next, vars, playerInventory); }
                    }
                  }}
                  choices={widgetChoices}
                  onSelectChoice={(choiceId) => {
                    const choice = node.choices.find(c => c.id === choiceId);
                    if (choice) handleSelectChoice(choice);
                  }}
                  onOpenSave={() => setShowSaveDialog(true)}
                  onOpenLoad={() => setShowLoadDialog(true)}
                  onOpenOverlay={(overlayId) => setActiveOverlayId(overlayId)}
                  onCloseOverlay={() => setActiveOverlayId(null)}
                  onGoToNode={(nodeId) => { if (project.nodes[nodeId]) { setCurrentNodeId(nodeId); setLineIdx(0); setLogs(prev => [{ text: `Jumped to: ${project.nodes[nodeId].title}`, type: "set" as const }, ...prev].slice(0, 20)); } }}
                  onUseItem={handleUseItem}
                  onEquipItem={handleEquipItem}
                  onRollback={() => { if (history.length > 0) handleBack(); }}
                  onQuit={() => onExit()}
                  onInspectItem={handleInspectItem}
                  inspectedItemId={inspectedItemId ?? ""}
                />
              </div>
            )}
            {!project.dashboardLayout?.length && (
            <div className="relative z-10 w-full" id="playtest-story-stage">
              {/* Standard dialogue box player */}
              <div className="glass-card p-6" style={{ minHeight: "160px" }}>

                {hasDialogue ? (
                  /* Dialogue screen lines navigation */
                  <div className="flex-1 flex flex-col justify-between" id="vn-player-interactive-box">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        {activeLine.speaker && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-indigo-300 text-xs font-bold border border-indigo-500/20">
                          {activeLine.speaker}
                        </span>
                        )}
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
                          {!activeLine.speaker ? activeLine.text : `"${activeLine.text}"`}
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
                          setHistory(prev => [...prev, { nodeId: currentNodeId, variables: { ...vars } }]);
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
            </>
          )
        )}
        </div>
      </div>
      {/* Overlay rendering */}
      {activeOverlayId && (() => {
        const overlay = (project.overlays ?? []).find(o => o.id === activeOverlayId);
        if (!overlay) return null;
        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: overlay.settings.backgroundColor || "#00000099" }}
            onClick={() => { if (overlay.settings.closeOnClickOutside) setActiveOverlayId(null); }}>
            <div className="relative w-full h-full p-8" onClick={e => e.stopPropagation()}>
              <button onClick={() => setActiveOverlayId(null)}
                className="absolute top-4 right-4 z-50 w-8 h-8 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-slate-700 cursor-pointer">
                <X className="w-4 h-4 text-white" />
              </button>
              {overlay.layout.length > 0 && (() => {
                return (
                  <FreeformCanvas gridId="overlay-dots">
                    {overlay.layout.map(widget => (
                      <div key={widget.id} style={{ position: "absolute", left: widget.x, top: widget.y, width: widget.w, height: widget.h, overflow: "hidden" }}>
                        <WidgetRenderer project={project} config={widget} runtime={{
                          runtimeValues: runtimeVars,
                          inventory: playerInventory,
                    choices: widgetChoices,
                          inspectedItemId: inspectedItemId ?? "",
                          onInspectItem: handleInspectItem,
                          onSelectChoice: (choiceId) => {
                            const choice = node.choices.find(c => c.id === choiceId);
                            if (choice) handleSelectChoice(choice);
                          },
                          onButtonAction: (action) => {
                            const showContinue = !showEndingNow && (!hasDialogue || lineIdx === totalLines - 1) && availableChoices.length === 0 && !!node.continueToNodeId && !!project.nodes[node.continueToNodeId];
                            if (action === "close_overlay") setActiveOverlayId(null);
                            else if (action.startsWith("inspect_item:")) { handleInspectItem(action.slice("inspect_item:".length)); }
                            else if (action.startsWith("goto_node:")) {
                              const nid = action.slice("goto_node:".length);
                              if (project.nodes[nid]) { setActiveOverlayId(null); setCurrentNodeId(nid); setLineIdx(0); }
                            }
                            else if (action === "rollback" && history.length > 0) { setActiveOverlayId(null); handleBack(); }
                            else if (action === "quit") onExit();
                            else if (action === "save") setShowSaveDialog(true);
                            else if (action === "load") setShowLoadDialog(true);
                            else if (action === "next" && hasDialogue && lineIdx < totalLines - 1) setLineIdx(lineIdx + 1);
                            else if (action === "continue" && showContinue && node.continueToNodeId) {
                              setHistory(prev => [...prev, { nodeId: currentNodeId, variables: { ...vars } }]);
                              const next = project.nodes[node.continueToNodeId!];
                              if (next) { setActiveOverlayId(null); setCurrentNodeId(node.continueToNodeId!); setLineIdx(0); processNodeBlocks(next, vars, playerInventory); }
                            }
                            else if (action.startsWith("use_item:")) { handleUseItem(action.slice("use_item:".length)); }
                            else if (action.startsWith("equip_item:")) { handleEquipItem(action.slice("equip_item:".length)); }
                          },
                        }} />
                      </div>
                    ))}
                  </FreeformCanvas>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {showSaveDialog && (
        <SaveLoadDialog mode="save"
          currentSaveData={{
            currentNodeId,
            lineIdx,
            vars,
            playerInventory,
            combatState,
            history,
            logs,
            nodeTitle: node?.title ?? activeLine?.speaker ?? "Unknown",
            inspectedItemId: inspectedItemId ?? undefined,
            globalTimeTicks,
            activeOverlayId,
          }}
          onLoad={() => {}}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
      {showLoadDialog && (
        <SaveLoadDialog mode="load"
          onLoad={(data: SaveData) => {
            setCurrentNodeId(data.currentNodeId);
            setLineIdx(data.lineIdx);
            setVars(data.vars);
            setPlayerInventory(data.playerInventory);
            setCombatState(data.combatState);
            setHistory(data.history);
            setLogs(data.logs);
            if (data.inspectedItemId !== undefined) setInspectedItemId(data.inspectedItemId);
            if (data.globalTimeTicks !== undefined) setGlobalTimeTicks(data.globalTimeTicks);
            if (data.activeOverlayId !== undefined) setActiveOverlayId(data.activeOverlayId);
            setShowLoadDialog(false);
          }}
          onClose={() => setShowLoadDialog(false)}
        />
      )}

      {/* Keymapper panel */}
      {showKeymapper && (
        <KeymapperPanel
          mappings={project.keyMappings ?? []}
          overlays={project.overlays ?? []}
          onUpdate={(mappings) => {
            onUpdateProject?.({ ...project, keyMappings: mappings, lastModified: Date.now() });
          }}
          onClose={() => setShowKeymapper(false)}
        />
      )}

      {/* Input Dialog */}
      {pendingInput && (
        <InputDialog
          prompt={pendingInput.prompt}
          defaultValue={pendingInput.defaultValue}
          onSubmit={(value) => {
            setVars(prev => ({ ...prev, [pendingInput.variableName]: value }));
            setLogs(prev => [{ text: `✏️ ${pendingInput.variableName} = "${value}"`, type: "set" as const }, ...prev].slice(0, 20));
            setPendingInput(null);
          }}
          onClose={() => setPendingInput(null)}
        />
      )}
    </div>
  );
}

function KeymapperPanel({ mappings, overlays, onUpdate, onClose }: {
  mappings: import("../types").KeyMapping[];
  overlays: import("../types").OverlayDef[];
  onUpdate: (mappings: import("../types").KeyMapping[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(mappings);

  const updateKey = (idx: number, field: "key" | "action" | "label", value: string) => {
    const next = local.map((m, i) => i === idx ? { ...m, [field]: value } : m);
    setLocal(next);
  };

  const addMapping = () => {
    setLocal([...local, { key: "", action: "", label: "" }]);
  };

  const removeMapping = (idx: number) => {
    setLocal(local.filter((_, i) => i !== idx));
  };

  const overlayActions = overlays.map(o => ({ value: `open_overlay:${o.id}`, label: `Open Overlay: ${o.name}` }));
  const baseActions = [
    { value: "save", label: "Save Game" },
    { value: "load", label: "Load Game" },
    { value: "rollback", label: "Rollback" },
    { value: "quit", label: "Quit to Menu" },
    { value: "close_overlay", label: "Close Overlay" },
    ...overlayActions,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-[500px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Global Key Mappings</h3>
          <button onClick={onClose} className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center hover:bg-slate-700 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mb-4">Map keyboard keys to actions. Press the key in-game to trigger the action.</p>

        {local.length === 0 && (
          <p className="text-xs text-slate-500 italic text-center py-4">No key mappings configured.</p>
        )}

        <div className="space-y-3">
          {local.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2">
              <input value={m.key} onChange={e => updateKey(idx, "key", e.target.value)}
                placeholder="e.g. Escape"
                className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-mono" />
              <input value={m.label} onChange={e => updateKey(idx, "label", e.target.value)}
                placeholder="Label"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500" />
              <select value={m.action} onChange={e => updateKey(idx, "action", e.target.value)}
                className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500">
                <option value="">Select action...</option>
                {baseActions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <button onClick={() => removeMapping(idx)}
                className="px-2 py-1.5 text-rose-400 hover:text-rose-300 text-xs font-bold cursor-pointer">✕</button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4 border-t border-slate-700 pt-4">
          <button onClick={addMapping}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer">
            <Plus className="w-3 h-3" /> Add Mapping
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg cursor-pointer">Cancel</button>
            <button onClick={() => { onUpdate(local); onClose(); }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputDialog({ prompt, defaultValue, onSubmit, onClose }: {
  prompt: string;
  defaultValue: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-[400px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-2">Input Required</h3>
        <p className="text-xs text-slate-300 mb-4">{prompt}</p>
        <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
          placeholder="Type your answer..."
          onKeyDown={e => { if (e.key === "Enter") onSubmit(value); }}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 mb-4" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg cursor-pointer">Cancel</button>
          <button onClick={() => onSubmit(value)}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer">Submit</button>
        </div>
      </div>
    </div>
  );
}

function WidgetEditor({ project, onUpdateProject }: { project: VNProject; onUpdateProject?: (project: VNProject) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"hud" | "overlay-list" | "overlay-edit">("hud");
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);

  const overlays = project.overlays ?? [];
  const editingOverlay = editingOverlayId ? overlays.find(o => o.id === editingOverlayId) : null;

  const defaultLayout = (): WidgetConfig[] => {
    const id = (t: WidgetType, n: number) => `${t}-${n}`;
    return [
      { id: id("image", 0),   type: "portrait", x: 20, y: 20, w: 140, h: 220, settings: { portraitShape: "rounded" } },
      { id: id("text", 0),    type: "text",     x: 190, y: 20, w: 400, h: 80,  settings: { content: "Story text appears here...", fontSize: "15px", textType: "dialogue" } },
      { id: id("statBar", 0), type: "statBar",  x: 190, y: 110, w: 250, h: 40, settings: { statLabel: "HP", statMin: 0, statMax: 10, barColor: "#ef4444" } },
      { id: id("button", 0),  type: "button",   x: 470, y: 110, w: 120, h: 40, settings: { buttonLabel: "Choices", buttonAction: "menu" } },
      { id: id("statText", 0), type: "statText", x: 20, y: 260, w: 150, h: 36, settings: { statLabel: "Gold", statSource: "" } },
      { id: id("button", 1),  type: "button",   x: 660, y: 20, w: 120, h: 40, settings: { buttonLabel: "Menu", buttonAction: "menu" } },
    ];
  };

  const getLayout = (): WidgetConfig[] => {
    if (editMode === "overlay-edit" && editingOverlay) return editingOverlay.layout ?? [];
    return project.dashboardLayout ?? [];
  };

  const projectRef = useRef(project);
  projectRef.current = project;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const editingOverlayIdRef = useRef(editingOverlayId);
  editingOverlayIdRef.current = editingOverlayId;

  const updateProject = (patch: Partial<VNProject>) => {
    onUpdateProject?.({ ...projectRef.current, ...patch, lastModified: Date.now() });
  };

  const updateLayout = (widgets: WidgetConfig[]) => {
    if (editModeRef.current === "overlay-edit") {
      updateProject({ overlays: overlaysRef.current.map((o: import("../types").OverlayDef) => o.id === editingOverlayIdRef.current ? { ...o, layout: widgets } : o) });
    } else {
      updateProject({ dashboardLayout: widgets });
    }
  };

  const layout = getLayout();
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const findWidget = (id: string, list: WidgetConfig[]): WidgetConfig | null => {
    for (const w of list) {
      if (w.id === id) return w;
      if (w.children) { const found = findWidget(id, w.children); if (found) return found; }
    }
    return null;
  };
  const selectedWidget = findWidget(selectedId ?? "", layout);

  const patchWidget = (id: string, patch: Partial<WidgetConfig>, list: WidgetConfig[]): WidgetConfig[] =>
    list.map(w => {
      if (w.id === id) return { ...w, ...patch };
      if (w.children) return { ...w, children: patchWidget(id, patch, w.children) };
      return w;
    });

  const updateWidget = (id: string, patch: Partial<WidgetConfig>) => {
    updateLayout(patchWidget(id, patch, layoutRef.current));
  };

  const removeWidget = (id: string) => {
    if (selectedId === id) setSelectedId(null);
    updateLayout(removeNested(id, layoutRef.current));
  };

  const removeNested = (id: string, list: WidgetConfig[]): WidgetConfig[] =>
    list.flatMap(w => {
      if (w.id === id) return [];
      if (w.children) {
        const filtered = removeNested(id, w.children);
        if (filtered.length !== w.children.length) return [{ ...w, children: filtered }];
      }
      return [w];
    });

  const addWidget = (type: WidgetType) => {
    const current = layoutRef.current;
    const desc = REGISTRY[type];
    const count = current.filter(w => w.type === type).length;
    const defaultSizes: Record<string, { w: number; h: number }> = {
      container: { w: 200, h: 200 }, text: { w: 300, h: 80 }, image: { w: 140, h: 220 },
      statText: { w: 150, h: 36 }, statBar: { w: 250, h: 40 }, button: { w: 120, h: 40 },
      choiceList: { w: 300, h: 200 }, portrait: { w: 140, h: 220 }, inventory: { w: 200, h: 200 },
      divider: { w: 300, h: 20 }, borderBox: { w: 300, h: 200 }, repeater: { w: 300, h: 250 },
      inspector: { w: 200, h: 200 },
    };
    const sz = defaultSizes[type] ?? { w: 200, h: 150 };
    const offset = 20 + (count * 30);
    updateLayout([...layout, { id: `${type}-${count}`, type, x: clampCanvas(offset, CANVAS_W - sz.w), y: clampCanvas(offset, CANVAS_H - sz.h), w: sz.w, h: sz.h, settings: {}, children: type === "container" ? [] : undefined }]);
  };

  const duplicateWidget = (widget: WidgetConfig) => {
    const current = layoutRef.current;
    const count = current.filter(w => w.type === widget.type).length;
    const clone: WidgetConfig = { ...widget, id: `${widget.type}-dup-${count}-${Date.now()}`, x: clampCanvas(widget.x + 20, CANVAS_W - widget.w), y: clampCanvas(widget.y + 20, CANVAS_H - widget.h) };
    if (clone.children) clone.children = clone.children.map(c => ({ ...c, id: `${c.id}-clone-${Date.now()}` }));
    updateLayout([...current, clone]);
  };

  const findNestedWidget = (id: string, list: WidgetConfig[]): WidgetConfig | null => {
    for (const w of list) {
      if (w.id === id) return w;
      if (w.children) { const f = findNestedWidget(id, w.children); if (f) return f; }
    }
    return null;
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const updateLayoutRef = useRef(updateLayout);
  updateLayoutRef.current = updateLayout;

  const handleDragEnd = (event: DragEndEvent) => {
    const currentLayout = layoutRef.current;
    const doUpdate = updateLayoutRef.current;
    const { active, delta } = event;
    if (delta.x === 0 && delta.y === 0) return;
    const activeId = active.id as string;

    const snap = (v: number) => Math.round(v / 10) * 10;

    // ── Resize handle drag ──
    if (activeId.startsWith("resize-")) {
      const lastDash = activeId.lastIndexOf("-");
      const dir = activeId.slice(lastDash + 1);
      const wId = activeId.slice(7, lastDash);
      const w = findNestedWidget(wId, currentLayout);
      if (!w) return;
      const dx = Math.round(delta.x);
      const dy = Math.round(delta.y);
      let patch: Partial<WidgetConfig> = {};
      if (dir.includes("e")) { patch.w = snap(Math.max(MIN_W, (w.w ?? 100) + dx)); }
      if (dir.includes("w")) { patch.x = snap(clampCanvas((w.x ?? 0) + dx, CANVAS_W - MIN_W)); patch.w = snap(Math.max(MIN_W, (w.w ?? 100) - dx)); }
      if (dir.includes("s")) { patch.h = snap(Math.max(MIN_H, (w.h ?? 100) + dy)); }
      if (dir.includes("n")) { patch.y = snap(clampCanvas((w.y ?? 0) + dy, CANVAS_H - MIN_H)); patch.h = snap(Math.max(MIN_H, (w.h ?? 100) - dy)); }
      doUpdate(patchWidget(w.id, patch, currentLayout));
      return;
    }

    // ── Container drop (position-based detection) ──
    const dragged = findNestedWidget(activeId, currentLayout);
    const isTopLevel = dragged && currentLayout.some(w => w.id === dragged.id);
    if (dragged && isTopLevel) {
      const destX = dragged.x + Math.round(delta.x);
      const destY = dragged.y + Math.round(delta.y);
      const destCX = destX + (dragged.w ?? 100) / 2;
      const destCY = destY + (dragged.h ?? 100) / 2 - 10;
      let dropContainer: WidgetConfig | null = null;
      for (const w of currentLayout) {
        if (w.id === dragged.id || w.type !== "container") continue;
        const topY = w.y - 20;
        const bottomY = w.y + (w.h ?? 200);
        if (destCX >= w.x && destCX <= w.x + (w.w ?? 200) && destCY >= topY && destCY <= bottomY) {
          dropContainer = w;
          break;
        }
      }
      if (dropContainer) {
        const dw = dragged.w ?? 100;
        const dh = dragged.h ?? 100;
        const relX = Math.max(0, snap(destX - dropContainer.x));
        const relY = Math.max(0, snap(destY - dropContainer.y));
        const updated = removeNested(dragged.id, currentLayout).map(w =>
          w.id === dropContainer!.id
            ? { ...w, children: [...(w.children ?? []), { ...dragged, x: relX, y: relY, w: dw, h: dh }] }
            : w
        );
        doUpdate(updated);
        return;
      }
    }

    // ── Freeform movement (top-level or nested) ──
    const a = findNestedWidget(activeId, currentLayout);
    if (!a) return;
    const newX = snap(clampCanvas(a.x + Math.round(delta.x), CANVAS_W - a.w));
    const newY = snap(clampCanvas(a.y + Math.round(delta.y), CANVAS_H - a.h));
    doUpdate(patchWidget(a.id, { x: newX, y: newY }, currentLayout));
  };

  const addOverlay = () => {
    const id = `overlay-${overlays.length}`;
    updateProject({
      overlays: [...overlays, { id, name: `Overlay ${overlays.length + 1}`, layout: [], settings: { closeOnClickOutside: true, transition: "fade", backgroundColor: "#00000099" } }],
    });
    setEditingOverlayId(id);
    setEditMode("overlay-edit");
  };

  const removeOverlay = (id: string) => {
    updateProject({ overlays: overlays.filter(o => o.id !== id) });
    if (editingOverlayId === id) { setEditingOverlayId(null); setEditMode("overlay-list"); }
  };

  const updateOverlay = (id: string, patch: Partial<typeof overlays[0]>) => {
    updateProject({ overlays: overlays.map(o => o.id === id ? { ...o, ...patch } : o) });
  };

  const AVAILABLE: WidgetType[] = ["container", "text", "image", "statText", "statBar", "button", "choiceList", "portrait", "inventory", "divider", "borderBox", "repeater", "inspector"];

  // ── Tab: Overlay list ──
  if (editMode === "overlay-list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setEditMode("hud")}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer">
            ← Back to HUD
          </button>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overlays</h3>
        </div>
        <div className="space-y-2">
          {overlays.length === 0 && (
            <p className="text-xs text-slate-500 italic">No overlays defined. Add one to create modal panels (pause menu, inventory, settings).</p>
          )}
          {overlays.map(o => (
            <div key={o.id} className="glass-card p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-white">{o.name}</span>
                <span className="text-[10px] text-slate-500 ml-2">{o.layout.length} widgets</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditingOverlayId(o.id); setEditMode("overlay-edit"); }}
                  className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[9px] font-bold rounded-lg cursor-pointer">Edit</button>
                <button onClick={() => removeOverlay(o.id)}
                  className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white text-[9px] font-bold rounded-lg cursor-pointer">Delete</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addOverlay}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Overlay
        </button>
      </div>
    );
  }

  // ── Tab: Overlay editing ──
  if (editMode === "overlay-edit" && editingOverlay) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setEditMode("overlay-list")}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer">
            ← Back to Overlays
          </button>
          <input value={editingOverlay.name} onChange={e => updateOverlay(editingOverlay.id, { name: e.target.value })}
            className="bg-transparent border-b border-slate-700 text-sm font-bold text-white outline-none focus:border-indigo-500 px-1 py-0.5" />
          <label className="flex items-center gap-1 text-[10px] text-slate-400 ml-4">
            <input type="checkbox" checked={editingOverlay.settings.closeOnClickOutside}
              onChange={e => updateOverlay(editingOverlay.id, { settings: { ...editingOverlay.settings, closeOnClickOutside: e.target.checked } })} />
            Close on outside click
          </label>
        </div>
        <WidgetLayoutEditor layout={layout} selectedId={selectedId} setSelectedId={setSelectedId}
          selectedWidget={selectedWidget} findWidget={findWidget}
          onUpdateWidget={updateWidget} onRemoveWidget={removeWidget}
          onAddWidget={addWidget} onDuplicateWidget={duplicateWidget}
          project={project} sensors={sensors} onDragEnd={handleDragEnd} AVAILABLE={AVAILABLE} />
      </div>
    );
  }

  // ── Tab: HUD editing (default) ──
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Layout className="w-3.5 h-3.5 text-indigo-400" /> HUD Layout
        </h3>
        <button onClick={() => setEditMode("overlay-list")}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer">
          Edit Overlays ({overlays.length})
        </button>
      </div>
      <WidgetLayoutEditor layout={layout} selectedId={selectedId} setSelectedId={setSelectedId}
        selectedWidget={selectedWidget} findWidget={findWidget}
        onUpdateWidget={updateWidget} onRemoveWidget={removeWidget}
        onAddWidget={addWidget} onDuplicateWidget={duplicateWidget}
        project={project} sensors={sensors} onDragEnd={handleDragEnd} AVAILABLE={AVAILABLE} />
    </div>
  );
}

// ── Freeform Canvas ──────────────────────────────────────────────
function FreeformCanvas({ children, scale, gridId, onDeselect }: { children: React.ReactNode; scale?: number; gridId?: string; onDeselect?: () => void }) {
  const s = scale ?? 1;
  const uid = gridId ?? "dot-grid";
  return (
    <div className="relative w-full overflow-auto" style={{ minHeight: CANVAS_H * s + 40 }}>
      <div className="relative bg-slate-900 rounded-xl border border-slate-800 overflow-hidden"
        onClick={(e) => { if (e.target === e.currentTarget) onDeselect?.(); }}
        style={{ width: CANVAS_W * s, height: CANVAS_H * s }}>
        <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W * s} height={CANVAS_H * s}>
          <defs>
            <pattern id={uid} x="0" y="0" width={24 * s} height={24 * s} patternUnits="userSpaceOnUse">
              <circle cx={1.5 * s} cy={1.5 * s} r={1.5 * s} fill="rgba(255,255,255,0.04)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${uid})`} />
        </svg>
        {children}
      </div>
    </div>
  );
}

// ── Resize Handle ────────────────────────────────────────────────
const HANDLE_SIZE = 10;
const MIN_W = 30;
const MIN_H = 20;

function ResizeHandles({ widgetId }: { widgetId: string }) {
  const dirs = ["nw", "n", "ne", "w", "e", "sw", "s", "se"] as const;
  const positions: Record<string, React.CSSProperties> = {
    nw: { top: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: "nwse-resize" },
    n:  { top: -HANDLE_SIZE/2, left: "50%", marginLeft: -HANDLE_SIZE/2, cursor: "ns-resize" },
    ne: { top: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: "nesw-resize" },
    w:  { top: "50%", marginTop: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: "ew-resize" },
    e:  { top: "50%", marginTop: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: "ew-resize" },
    sw: { bottom: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: "nesw-resize" },
    s:  { bottom: -HANDLE_SIZE/2, left: "50%", marginLeft: -HANDLE_SIZE/2, cursor: "ns-resize" },
    se: { bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: "nwse-resize" },
  };
  return (
    <>
      {dirs.map(d => {
        const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `resize-${widgetId}-${d}` });
        return (
          <div key={d} ref={setNodeRef} {...listeners} {...attributes}
            className={`absolute z-30 bg-white border-2 border-indigo-500 rounded-sm ${isDragging ? "opacity-80 scale-125" : ""}`}
            style={{ width: HANDLE_SIZE, height: HANDLE_SIZE, boxSizing: "border-box", ...positions[d] }} />
        );
      })}
    </>
  );
}

// ── Droppable Container Wrapper (editor only) ───────────────────
function DroppableContainer({ containerId, children }: { containerId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-${containerId}` });
  return (
    <div ref={setNodeRef} className={`w-full h-full ${isOver ? "ring-2 ring-indigo-400 ring-inset brightness-110" : ""}`}
      style={{ pointerEvents: "auto", position: "relative" }}>
      {children}
      {isOver && (
        <div className="absolute inset-0 bg-indigo-500/10 rounded-xl border-2 border-dashed border-indigo-400 pointer-events-none z-10 flex items-center justify-center">
          <span className="text-[9px] font-bold text-indigo-300 bg-slate-900/80 px-2 py-1 rounded">Drop to nest</span>
        </div>
      )}
    </div>
  );
}

// ── Shared Layout Editor ─────────────────────────────────────────
function WidgetLayoutEditor({ layout, selectedId, setSelectedId, selectedWidget, findWidget,
  onUpdateWidget, onRemoveWidget, onAddWidget, onDuplicateWidget,
  project, sensors, onDragEnd, AVAILABLE }: {
  layout: WidgetConfig[]; selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedWidget: WidgetConfig | null;
  findWidget: (id: string, list: WidgetConfig[]) => WidgetConfig | null;
  onUpdateWidget: (id: string, patch: Partial<WidgetConfig>) => void;
  onRemoveWidget: (id: string) => void;
  onAddWidget: (type: WidgetType) => void;
  onDuplicateWidget: (widget: WidgetConfig) => void;
  project: VNProject; sensors: any; onDragEnd: (event: DragEndEvent) => void;
  AVAILABLE: WidgetType[];
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <FreeformCanvas gridId="editor-dots" onDeselect={() => setSelectedId(null)}>
            {layout.map(widget => (
              <DraggableWidget key={widget.id}
                widget={widget}
                selected={selectedId === widget.id}
                onSelect={() => setSelectedId(widget.id)}
                onRemove={(e) => { e.stopPropagation(); onRemoveWidget(widget.id); }}
                onDuplicate={(e) => { e.stopPropagation(); onDuplicateWidget(widget); }}
                onUpdate={(patch) => onUpdateWidget(widget.id, patch)}>
                {widget.type === "container" ? (
                  <DroppableContainer containerId={widget.id}>
                    <WidgetRenderer project={project} config={widget} onSelectWidget={(id) => setSelectedId(id)} selectedWidgetId={selectedId ?? undefined} />
                  </DroppableContainer>
                ) : (
                  <WidgetRenderer project={project} config={widget} onSelectWidget={(id) => setSelectedId(id)} />
                )}
              </DraggableWidget>
            ))}
          </FreeformCanvas>
        </DndContext>

        <div className="mt-4 glass-card p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Widget
          </h3>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE.map(type => {
              const desc = REGISTRY[type];
              const Icon = desc.icon;
              return (
                <button key={type} onClick={() => onAddWidget(type)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 transition-all bg-slate-800/50">
                  <Icon className="w-3 h-3" />
                  {desc.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedWidget && (
        <WidgetSettingsPanel
          widget={selectedWidget}
          project={project}
          onChange={(patch) => onUpdateWidget(selectedWidget.id, patch)}
          onRemoveChild={(childId) => {
            const w = findWidget(selectedWidget!.id, layout);
            if (w) onUpdateWidget(w.id, { children: (w.children ?? []).filter(c => c.id !== childId) });
          }}
        />
      )}
    </div>
  );
}

// ── Widget Playtest View ─────────────────────────────────────────
function WidgetPlaytestView({ project, layout, runtime, lineIdx, totalLines, hasDialogue, onNextLine, onPrevLine, showContinue, onContinue, choices, onSelectChoice, onOpenSave, onOpenLoad, onOpenOverlay, onCloseOverlay, onGoToNode, onUseItem, onEquipItem, onRollback, onQuit, onInspectItem, inspectedItemId }: {
  project: VNProject;
  layout: WidgetConfig[];
  runtime: WidgetRuntimeProps;
  lineIdx?: number;
  totalLines?: number;
  hasDialogue?: boolean;
  onNextLine?: () => void;
  onPrevLine?: () => void;
  showContinue?: boolean;
  onContinue?: () => void;
  choices?: { id: string; text: string; targetNodeTitle?: string; passed: boolean; statChanges?: { variableName: string; operation: string; value: string | number | boolean }[] }[];
  onSelectChoice: (id: string) => void;
  onOpenSave?: () => void;
  onOpenLoad?: () => void;
  onOpenOverlay?: (overlayId: string) => void;
  onCloseOverlay?: () => void;
  onGoToNode?: (nodeId: string) => void;
  onUseItem?: (itemId: string) => void;
  onEquipItem?: (itemId: string) => void;
  onRollback?: () => void;
  onQuit?: () => void;
  onInspectItem?: (itemId: string) => void;
  inspectedItemId?: string;
}) {
  const handleButtonAction = (action: string) => {
    if (action === "next" && hasDialogue && onNextLine) onNextLine();
    else if (action === "continue" && showContinue && onContinue) onContinue();
    else if (action === "save") onOpenSave?.();
    else if (action === "load") onOpenLoad?.();
    else if (action === "rollback") onRollback?.();
    else if (action === "quit") onQuit?.();
    else if (action === "close_overlay") onCloseOverlay?.();
    else if (action.startsWith("open_overlay:")) onOpenOverlay?.(action.slice("open_overlay:".length));
    else if (action.startsWith("goto_node:")) onGoToNode?.(action.slice("goto_node:".length));
    else if (action.startsWith("use_item:")) onUseItem?.(action.slice("use_item:".length));
    else if (action.startsWith("equip_item:")) onEquipItem?.(action.slice("equip_item:".length));
    else if (action.startsWith("inspect_item:")) onInspectItem?.(action.slice("inspect_item:".length));
    else if (action.startsWith("choose_")) {
      const idx = parseInt(action.split("_")[1]);
      if (choices && !isNaN(idx) && choices[idx]) onSelectChoice(choices[idx].id);
    }
  };
  return (
    <div className="w-full flex flex-col gap-3">
      {hasDialogue && (
        <div className="flex items-center justify-between glass-card p-2 shrink-0">
          <span className="text-slate-500 font-mono text-xs">
            Script line {lineIdx + 1} of {totalLines}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={onPrevLine} disabled={lineIdx === 0}
              className="p-1 px-2 bg-slate-950 text-slate-400 hover:text-white rounded-lg disabled:opacity-30 cursor-pointer text-xs">
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={onNextLine} disabled={lineIdx === totalLines - 1}
              className="py-1 px-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-30 cursor-pointer text-xs flex items-center gap-0.5">
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      <FreeformCanvas gridId="playtest-dots">
        {layout.map(widget => (
          <div key={widget.id} style={{ position: "absolute", left: widget.x, top: widget.y, width: widget.w, height: widget.h, overflow: "hidden" }}>
            <WidgetRenderer project={project} config={widget} runtime={{ ...runtime, onButtonAction: handleButtonAction, inspectedItemId, onInspectItem }} />
          </div>
        ))}
      </FreeformCanvas>
    </div>
  );
}

// ── Draggable Widget Wrapper (Freeform) ─────────────────────────
function DraggableWidget({ widget, selected, onSelect, onRemove, onDuplicate, onUpdate, children }: {
  widget: WidgetConfig;
  selected: boolean;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onDuplicate?: (e: React.MouseEvent) => void;
  onUpdate?: (patch: Partial<WidgetConfig>) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: widget.id });
  const desc = REGISTRY[widget.type];
  const label = desc?.label ?? widget.type;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: widget.x,
    top: widget.y - 20,
    width: widget.w,
    height: widget.h + 20,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : selected ? 10 : 1,
    transition: isDragging ? "none" : "box-shadow 0.15s",
  };

  return (
    <div ref={setNodeRef}
      className={`rounded-xl group ${
        selected ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20" : "hover:ring-1 hover:ring-slate-600"
      }`}
      style={baseStyle}
      {...attributes}>
      {/* Drag handle bar */}
      <div {...listeners}
        className="h-5 bg-slate-800/80 flex items-center gap-1.5 px-2 cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <GripHorizontal className="w-3 h-3 text-slate-500 shrink-0" />
        <span className="text-[7px] text-slate-500 uppercase tracking-widest font-bold">{label}</span>
      </div>

      {/* Content body */}
      <div onClick={onSelect} className="h-[calc(100%-20px)] overflow-hidden">
        {children}
      </div>

      {/* Resize handles when selected */}
      {selected && <ResizeHandles widgetId={widget.id} />}

      {/* Action buttons */}
      <div className="absolute -top-1.5 -right-1.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onDuplicate && (
          <button onClick={onDuplicate}
            className="w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-600 shadow-lg">
            <Copy className="w-2.5 h-2.5 text-slate-300" />
          </button>
        )}
        <button onClick={onRemove}
          className="w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center hover:bg-rose-500 shadow-lg">
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Widget Settings Panel ────────────────────────────────────────
function WidgetSettingsPanel({ widget, project, onChange, onRemoveChild }: {
  widget: WidgetConfig;
  project: VNProject;
  onChange: (patch: Partial<WidgetConfig>) => void;
  onRemoveChild?: (childId: string) => void;
}) {
  const s = widget.settings ?? {};

  const set = (key: string, value: any) => {
    onChange({ settings: { ...s, [key]: value } });
  };

  const trackers = project.trackers.map(t => ({ value: `tracker.${t.name}`, label: `${t.name} (tracker)` }));
  const flags = project.flags.map(f => ({ value: `flag.${f.name}`, label: `${f.name} (flag)` }));
  const statOptions = [...trackers, ...flags];

  const field = (label: string, input: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</label>
      {input}
    </div>
  );

  const textInput = (key: string, placeholder?: string) => (
    <input value={(s as any)[key] ?? ""} onChange={e => set(key, e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500" />
  );

  const colorInput = (key: string) => (
    <div className="flex items-center gap-2">
      <input type="color" value={(s as any)[key] ?? "#6366f1"} onChange={e => set(key, e.target.value)}
        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
      <span className="text-[10px] text-slate-500 font-mono">{(s as any)[key] ?? "#6366f1"}</span>
    </div>
  );

  const selectInput = (key: string, options: { value: string; label: string }[], placeholder?: string) => (
    <select value={(s as any)[key] ?? ""} onChange={e => set(key, e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="w-64 shrink-0 glass-card p-4 space-y-4 h-fit max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          {REGISTRY[widget.type]?.label ?? widget.type} Settings
        </h4>
        <span className="text-[9px] text-slate-500 font-mono">{widget.w}×{widget.h}</span>
      </div>

      {/* ── Container ─────────────────────────── */}
      {widget.type === "container" && <>
        {field("Direction", selectInput("direction", [
          { value: "row", label: "Row" }, { value: "column", label: "Column" },
        ], "None (freeform)"))}
        {field("Padding", textInput("padding", "e.g. 8px"))}
        {field("Gap", textInput("gap", "e.g. 4px"))}
        {field("Background", colorInput("bgColor"))}
        {field("Border", colorInput("borderColor"))}
        {field("Show Border in Playtest", selectInput("containerBorder", [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ], "No"))}
        <div className="border-t border-slate-700 pt-2">
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Children ({widget.children?.length ?? 0})</label>
          <div className="mt-1 space-y-1">
            {(widget.children ?? []).length === 0 ? (
              <p className="text-[9px] text-slate-500 italic">Drag widgets here to nest them</p>
            ) : (
              (widget.children ?? []).map(child => (
                <div key={child.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-slate-300">{REGISTRY[child.type]?.label ?? child.type}</span>
                  <button onClick={() => onRemoveChild?.(child.id)}
                    className="text-rose-400 hover:text-rose-300 text-[9px] font-bold">✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      </>}

      {/* ── Text ──────────────────────────────── */}
      {widget.type === "text" && <>
        {field("Type", selectInput("textType", [
          { value: "label", label: "Label" },
          { value: "title", label: "Title" },
          { value: "characterName", label: "Character Name" },
          { value: "dialogue", label: "Dialogue Box" },
          { value: "custom", label: "Custom" },
        ], "Select type..."))}
        {field("Content", textInput("content", "Enter text..."))}
        {field("Font Size", textInput("fontSize", "e.g. 14px"))}
        {field("Color", colorInput("color"))}
        {field("Alignment", selectInput("align", [
          { value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" },
        ]))}
      </>}

      {/* ── Image ─────────────────────────────── */}
      {widget.type === "image" && <>
        {field("Image URL / Path", textInput("src", "e.g. characters/portrait.png"))}
        {field("Aspect Ratio", textInput("aspectRatio", "e.g. 3/4"))}
        {field("Fit", selectInput("fit", [
          { value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }, { value: "fill", label: "Fill" },
        ]))}
      </>}

      {/* ── Stat Text / Stat Bar ──────────────── */}
      {(widget.type === "statText" || widget.type === "statBar") && <>
        {field("Label", textInput("statLabel", "Display label"))}
        {field("Data Source", selectInput("statSource", statOptions, "Select tracker or flag..."))}
        {field("Min Value", textInput("statMin", "0"))}
        {field("Max Value", textInput("statMax", "100"))}
        {widget.type === "statBar" && field("Bar Color", colorInput("barColor"))}
        <p className="text-[9px] text-slate-500 italic">Min/Max support [var] syntax — e.g. [player_max_hp]</p>
      </>}

      {/* ── Button ────────────────────────────── */}
      {widget.type === "button" && (() => {
        const rawAction = (s.buttonAction as string) ?? "";
        const actionKind = rawAction.includes(":") ? rawAction.split(":")[0] : rawAction;
        const nodeOptions = Object.entries(project.nodes).map(([id, n]) => ({ value: id, label: n.title || id }));
        const itemOptions = project.inventory.map(item => ({ value: item.id, label: item.name || item.id }));
        return <>
          {field("Button Label", textInput("buttonLabel", "Button"))}
          {field("Action", selectInput("buttonAction", [
            { value: "next", label: "Next Line" },
            { value: "continue", label: "Continue" },
            { value: "menu", label: "Menu" },
            { value: "save", label: "Save" },
            { value: "load", label: "Load" },
            { value: "rollback", label: "Rollback" },
            { value: "quit", label: "Quit to Menu" },
            { value: "close_overlay", label: "Close Overlay" },
            ...(project.overlays ?? []).map(o => ({ value: `open_overlay:${o.id}`, label: `Open Overlay: ${o.name}` })),
            { value: "goto_node:", label: "Go to Node..." },
            { value: "use_item:", label: "Use Item..." },
            { value: "equip_item:", label: "Equip Item..." },
            { value: "custom", label: "Custom" },
          ]))}
          {actionKind === "goto_node" && field("Target Node", selectInput("buttonAction",
            nodeOptions.map(opt => ({ ...opt, value: `goto_node:${opt.value}` })), "Select a node..."))}
          {actionKind === "use_item" && field("Item", selectInput("buttonAction",
            itemOptions.map(opt => ({ ...opt, value: `use_item:${opt.value}` })), "Select an item..."))}
          {actionKind === "equip_item" && field("Item", selectInput("buttonAction",
            itemOptions.map(opt => ({ ...opt, value: `equip_item:${opt.value}` })), "Select an item..."))}
        </>;
      })()}

      {/* ── Choice List ────────────────────────── */}
      {widget.type === "choiceList" && <>
        {field("Header Label", textInput("choiceListLabel", "Choices"))}
      </>}

      {/* ── Portrait ───────────────────────────── */}
      {widget.type === "portrait" && <>
        {field("Image Source", textInput("portraitSrc", "path/to/portrait.png"))}
        {field("Shape", selectInput("portraitShape", [
          { value: "rounded", label: "Rounded" },
          { value: "circle", label: "Circle" },
          { value: "square", label: "Square" },
        ]))}
        <p className="text-[9px] text-slate-500 italic">Leave image source empty to auto-detect from speaker name</p>
      </>}

      {/* ── Inventory ──────────────────────────── */}
      {widget.type === "inventory" && <>
        {field("Header Label", textInput("inventoryLabel", "Inventory"))}
        {field("Show when empty", selectInput("inventoryShowEmpty", [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]))}
      </>}

      {/* ── Divider ────────────────────────────── */}
      {widget.type === "divider" && <>
        {field("Color", colorInput("dividerColor"))}
        {field("Style", selectInput("dividerStyle", [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ]))}
      </>}

      {/* ── Border Box (9-Slice) ────────────────── */}
      {widget.type === "borderBox" && <>
        {field("Border Image URL", textInput("borderImage", "path/to/border-slice.png"))}
        {field("Slice Top (px)", textInput("borderSliceTop", "12"))}
        {field("Slice Right (px)", textInput("borderSliceRight", "12"))}
        {field("Slice Bottom (px)", textInput("borderSliceBottom", "12"))}
        {field("Slice Left (px)", textInput("borderSliceLeft", "12"))}
        {field("Border Width", textInput("borderWidth", "e.g. 12px"))}
        {field("Inner Padding", textInput("borderPadding", "e.g. 16px"))}
        <p className="text-[9px] text-slate-500 italic">Uses CSS border-image with the 4 slice values to preserve corners while stretching edges and center.</p>
      </>}

      {/* ── Repeater ────────────────────────────── */}
      {widget.type === "repeater" && <>
        {field("Data Source", selectInput("repeaterSource", [
          { value: "items", label: "All Items (Inventory)" },
          { value: "inventory", label: "Runtime Player Inventory" },
          { value: "trackers", label: "Trackers" },
          { value: "flags", label: "Flags" },
          { value: "entities", label: "Entities (Characters)" },
        ], "Select data source..."))}
        <p className="text-[9px] text-slate-500 italic">Design the template card by dragging child widgets inside. Each child text field supports [name], [id], [description] etc.</p>
        <div className="border-t border-slate-700 pt-2">
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Template Children ({widget.children?.length ?? 0})</label>
          <p className="text-[9px] text-slate-500 italic mt-1">Add widgets as children to design the card template. They will repeat for each item at runtime.</p>
        </div>
      </>}

      {/* ── Inspector ──────────────────────────── */}
      {widget.type === "inspector" && <>
        {field("Track Item ID (optional)", textInput("trackedItemId", "e.g. item_001"))}
        <p className="text-[9px] text-slate-500 italic">Leave empty to auto-display the currently inspected item (click an item with inspect_item action).</p>
      </>}

      {/* ── Styling (all widget types) ──── */}
      <div className="border-t border-slate-700/50 pt-3 mt-2">
        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Styling</h4>
        {field("Opacity (%)", textInput("widgetOpacity", "100"))}
        {field("Border Radius", textInput("widgetBorderRadius", "e.g. 8px"))}
        {field("Border Width", textInput("widgetBorderWidth", "e.g. 1px"))}
        {field("Border Color", colorInput("widgetBorderColor"))}
        {field("Border Style", selectInput("widgetBorderStyle", [
          { value: "none", label: "None" },
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ]))}
      </div>

      {/* ── Conditional Visibility (all widget types) ──── */}
      <div className="border-t border-slate-700/50 pt-3 mt-2">
        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Visibility Rule</h4>
        {field("Show when", selectInput("showIfSource", [
          { value: "tracker._hasChoices", label: "Choices are present (built-in)" },
          ...project.trackers.map(t => ({ value: `tracker.${t.name}`, label: `${t.name} (tracker)` })),
          ...project.flags.map(f => ({ value: `flag.${f.name}`, label: `${f.name} (flag)` })),
        ], "Always visible"))}
        {(s.showIfSource as string) && (
          <div className="flex items-center gap-2">
            {widget.type !== "choiceList" && field("Operator", selectInput("showIfOperator", [
              { value: "exists", label: "is truthy" },
              { value: "==", label: "==" },
              { value: "!=", label: "!=" },
              { value: ">=", label: ">=" },
              { value: "<=", label: "<=" },
              { value: ">", label: ">" },
              { value: "<", label: "<" },
            ]))}
            {widget.type !== "choiceList" && (s.showIfOperator as string) && (s.showIfOperator as string) !== "exists" && (
              field("Value", textInput("showIfValue", "0"))
            )}
          </div>
        )}
      </div>

      {/* ── State Filter (all widget types) ──── */}
      <div className="border-t border-slate-700/50 pt-3 mt-2">
        <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">State Filter</h4>
        {field("Style", selectInput("stateFilterStyle", [
          { value: "none", label: "None" },
          { value: "grayscale", label: "Grayscale (locked)" },
          { value: "low-opacity", label: "Low Opacity" },
          { value: "blur", label: "Blur" },
        ]))}
        {(s.stateFilterStyle as string) && (s.stateFilterStyle as string) !== "none" && (
          <>
            {field("When", selectInput("stateFilterSource", [
              { value: "tracker._hasChoices", label: "Choices are present (built-in)" },
              ...project.trackers.map(t => ({ value: `tracker.${t.name}`, label: `${t.name} (tracker)` })),
              ...project.flags.map(f => ({ value: `flag.${f.name}`, label: `${f.name} (flag)` })),
            ], "Select condition..."))}
            {(s.stateFilterSource as string) && (
              <div className="flex items-center gap-2">
                {field("Operator", selectInput("stateFilterOperator", [
                  { value: "exists", label: "is truthy" },
                  { value: "==", label: "==" },
                  { value: "!=", label: "!=" },
                  { value: ">=", label: ">=" },
                  { value: "<=", label: "<=" },
                  { value: ">", label: ">" },
                  { value: "<", label: "<" },
                ]))}
                {(s.stateFilterOperator as string) && (s.stateFilterOperator as string) !== "exists" && (
                  field("Value", textInput("stateFilterValue", "0"))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
