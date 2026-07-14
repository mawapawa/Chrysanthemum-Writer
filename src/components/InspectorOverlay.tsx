import React, { useState } from "react";
import { StoryNode } from "../types";

interface InspectorOverlayProps {
  node: StoryNode;
}

export default function InspectorOverlay({ node }: InspectorOverlayProps) {
  const [expanded, setExpanded] = useState(true);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const entries: Array<{ key: string; value: any }> = [
    { key: "id", value: node.id },
    { key: "title", value: node.title },
    { key: "type", value: node.nodeType },
    { key: "sceneId", value: node.sceneId || "—" },
    { key: "choices", value: node.choices.length },
    { key: "dialogueLines", value: node.dialogueLines?.length || 0 },
    { key: "blocks", value: node.blocks?.length || 0 },
  ];

  if (node.locationNodeData) {
    entries.push(
      { key: "connections", value: node.locationNodeData.connections.length },
      { key: "encounterPool", value: node.locationNodeData.encounterPool.length },
      { key: "mapPosition", value: `(${node.locationNodeData.mapPosition.x}%, ${node.locationNodeData.mapPosition.y}%)` },
    );
  }
  if (node.encounterData) {
    entries.push(
      { key: "enemy", value: node.encounterData.enemyName },
      { key: "hp", value: node.encounterData.hp },
      { key: "attack", value: node.encounterData.attack },
      { key: "defense", value: node.encounterData.defense },
      { key: "drops", value: node.encounterData.drops.length },
    );
  }

  return (
    <div className="border-t border-white/10 pt-3 mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 cursor-pointer w-full text-left"
      >
        {expanded ? "▼" : "▶"} Inspector
      </button>
      {expanded && (
        <div className="mt-1 space-y-0.5 font-mono">
          {entries.map(e => (
            <div key={e.key} className="flex items-center justify-between text-[9px]">
              <span className="text-slate-500">{e.key}:</span>
              <span className="text-slate-300 truncate ml-2 max-w-[140px]" title={String(e.value)}>
                {String(e.value)}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-slate-600 pt-1 italic">Read-only view</div>
        </div>
      )}
    </div>
  );
}