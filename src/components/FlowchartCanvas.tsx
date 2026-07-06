/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { VNProject, StoryNode, StoryChoice } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Crosshair, ZoomIn, ZoomOut, Compass, Play, Flag, Star } from "lucide-react";

interface FlowchartCanvasProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onEnterPlaytest: (startId: string) => void;
  hiddenFolderIds?: string[];
  centerNodeTrigger?: { id: string; timestamp: number } | null;
  onCanvasBackgroundClick?: () => void;
  onAddBlankNode?: () => void;
  onAddLocation?: () => void;
  onAddEncounter?: () => void;
}

export default function FlowchartCanvas({
  project,
  onUpdateProject,
  selectedNodeId,
  onSelectNode,
  onEnterPlaytest,
  hiddenFolderIds = [],
  centerNodeTrigger = null,
  onCanvasBackgroundClick,
  onAddBlankNode,
  onAddLocation,
  onAddEncounter,
}: FlowchartCanvasProps) {
  // Canvas viewing transformations
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false);

  // Node dragging state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const nodeOffset = useRef({ x: 0, y: 0 });

  // New connection drawing (visual only or click-to-connect)
  const [connectionSource, setConnectionSource] = useState<{ nodeId: string; choiceId: string } | null>(null);
  const [nodeToConfirmDelete, setNodeToConfirmDelete] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeConfirmRef = useRef<HTMLDivElement>(null);

  // Click-away dismiss for node delete confirmation
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (nodeConfirmRef.current && !nodeConfirmRef.current.contains(event.target as Node)) {
        setNodeToConfirmDelete(null);
      }
    };
    if (nodeToConfirmDelete !== null) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [nodeToConfirmDelete]);

  const flowDirection = project.flowDirection || "horizontal";
  const hiddenSet = new Set(hiddenFolderIds);

  // Filter nodes for canvas display — hide nodes in hidden folders
  const visibleNodes = Object.values(project.nodes).filter((node) => {
    return !(node.sceneId && hiddenSet.has(node.sceneId));
  });

  // Keep a map of visible nodes for quick check
  const visibleNodesMap = new Set(visibleNodes.map((n) => n.id));
  // Also track hidden nodes that have connections to visible nodes
  const hiddenNodesWithOutgoing = Object.values(project.nodes).filter(n =>
    (n.sceneId && hiddenSet.has(n.sceneId)) &&
    n.choices.some(c => c.targetNodeId && visibleNodesMap.has(c.targetNodeId))
  );
  const hiddenOutgoingTargets = new Set(
    hiddenNodesWithOutgoing.flatMap(n =>
      n.choices.filter(c => c.targetNodeId && visibleNodesMap.has(c.targetNodeId)).map(c => c.targetNodeId!)
    )
  );

  // Zoom limits
  const minZoom = 0.4;
  const maxZoom = 2;

  // Track node coordinate references for drawing wires
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Trigger state update to force line redraws when elements render or move
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // Redraw connections when project updates
    forceUpdate({});
  }, [project, pan, zoom, hiddenFolderIds]);

  // Handle camera centering trigger
  useEffect(() => {
    if (centerNodeTrigger && canvasRef.current) {
      const targetNode = project.nodes[centerNodeTrigger.id];
      if (targetNode) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = rect.width / 2 - targetNode.position.x * zoom;
        const y = rect.height / 2 - targetNode.position.y * zoom;
        setPan({ x, y });
      }
    }
  }, [centerNodeTrigger]);

  // Handle double click to create a node
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent trigger if clicking on cards
    if ((e.target as HTMLElement).closest(".node-card")) return;

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate canvas coordinates based on click, pan, and zoom
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const canvasX = Math.round((clickX - pan.x) / zoom);
    const canvasY = Math.round((clickY - pan.y) / zoom);

    createNewNode(canvasX, canvasY);
  };

  const createNewNode = (x: number, y: number) => {
    const newId = crypto.randomUUID();
    const newNode: StoryNode = {
      id: newId,
      displayId: generateDisplayId("SCN"),
      title: "New Story Scene",
      description: "A summary of what happens in this scene...",
      speaker: "Narrator",
      dialogueLines: [],
      choices: [],
      statChanges: [],
      position: { x, y },
      isEnding: false,
      nodeType: "story",
      sceneId: undefined,
    };

    onUpdateProject({
      ...project,
      nodes: {
        ...project.nodes,
        [newId]: newNode,
      },
      lastModified: Date.now(),
    });

    onSelectNode(newId);
  };

  // Dragging Canvas (Panning)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if ((e.target as HTMLElement).closest(".node-card") || (e.target as HTMLElement).closest(".canvas-btn")) return;

    setIsPanning(true);
    wasDragged.current = false;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      wasDragged.current = true;
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    } else if (draggedNodeId && project.nodes[draggedNodeId]) {
      // Scale drag displacement back to canvas coordinate space based on current zoom
      const deltaX = (e.clientX - dragStart.current.x) / zoom;
      const deltaY = (e.clientY - dragStart.current.y) / zoom;

      const updatedNodes = { ...project.nodes };
      updatedNodes[draggedNodeId] = {
        ...updatedNodes[draggedNodeId],
        position: {
          x: Math.round(nodeOffset.current.x + deltaX),
          y: Math.round(nodeOffset.current.y + deltaY),
        },
      };

      onUpdateProject({
        ...project,
        nodes: updatedNodes,
      });
    }
  };

  const handleMouseUp = () => {
    const wasDrag = wasDragged.current;
    setIsPanning(false);
    setDraggedNodeId(null);
    if (!wasDrag) {
      onCanvasBackgroundClick?.();
    }
  };

  const handleCanvasMouseLeave = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Node card interaction
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left-click drag

    onSelectNode(nodeId);
    setDraggedNodeId(nodeId);
    
    const node = project.nodes[nodeId];
    dragStart.current = { x: e.clientX, y: e.clientY };
    nodeOffset.current = { ...node.position };
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeToConfirmDelete !== nodeId) {
      setNodeToConfirmDelete(nodeId);
      setTimeout(() => {
        setNodeToConfirmDelete((current) => (current === nodeId ? null : current));
      }, 4000);
      return;
    }

    setNodeToConfirmDelete(null);
    const updatedNodes = { ...project.nodes };
    delete updatedNodes[nodeId];

    // Reset startNodeId if we deleted it
    let newStartNodeId = project.startNodeId;
    if (project.startNodeId === nodeId) {
      const remainingKeys = Object.keys(updatedNodes);
      newStartNodeId = remainingKeys[0] || "";
    }

    onUpdateProject({
      ...project,
      startNodeId: newStartNodeId,
      nodes: updatedNodes,
      lastModified: Date.now(),
    });

    if (selectedNodeId === nodeId) {
      onSelectNode(null);
    }
  };

  const handleSetStartNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateProject({
      ...project,
      startNodeId: nodeId,
      lastModified: Date.now(),
    });
  };

  const autoArrangeNodes = () => {
    // Basic auto-arrange using a simple layout tree mapping
    const updatedNodes = { ...project.nodes };
    const visited = new Set<string>();
    const levels: Record<string, number> = {};
    const colsAtLevel: Record<number, number> = {};

    const traverse = (nodeId: string, currentLevel: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      levels[nodeId] = currentLevel;
      colsAtLevel[currentLevel] = (colsAtLevel[currentLevel] || 0) + 1;

      const node = project.nodes[nodeId];
      if (node && node.choices) {
        node.choices.forEach((choice, idx) => {
          if (choice.targetNodeId && project.nodes[choice.targetNodeId]) {
            traverse(choice.targetNodeId, currentLevel + 1);
          }
        });
      }
    };

    // Start with start node
    if (project.startNodeId && project.nodes[project.startNodeId]) {
      traverse(project.startNodeId, 0);
    }

    // Process unreached nodes (orphans)
    Object.keys(project.nodes).forEach((nodeId) => {
      if (!visited.has(nodeId)) {
        traverse(nodeId, 0);
      }
    });

    // Arrange nodes based on flow direction
    const levelCounts: Record<number, number> = {};
    Object.keys(updatedNodes).forEach((nodeId) => {
      // Skip nodes in hidden folders during auto-tidy
      if (updatedNodes[nodeId].sceneId && hiddenSet.has(updatedNodes[nodeId].sceneId)) {
        return;
      }

      const lvl = levels[nodeId] !== undefined ? levels[nodeId] : 0;
      const count = levelCounts[lvl] || 0;
      levelCounts[lvl] = count + 1;

      const totalNodesAtLvl = colsAtLevel[lvl] || 1;
      
      let x = 0;
      let y = 0;

      if (flowDirection === "vertical") {
        // Vertical Top-to-Bottom / Org-Chart layout
        x = (count - (totalNodesAtLvl - 1) / 2) * 280 + 400;
        y = lvl * 220 + 120;
      } else {
        // Horizontal Left-to-Right layout
        x = lvl * 320 + 80;
        y = (count - (totalNodesAtLvl - 1) / 2) * 180 + 240;
      }

      updatedNodes[nodeId] = {
        ...updatedNodes[nodeId],
        position: { x, y },
      };
    });

    onUpdateProject({
      ...project,
      nodes: updatedNodes,
      lastModified: Date.now(),
    });
  };

  const centerOnStartNode = () => {
    const startNode = project.nodes[project.startNodeId];
    if (startNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = rect.width / 2 - startNode.position.x * zoom;
      const y = rect.height / 2 - startNode.position.y * zoom;
      setPan({ x, y });
    }
  };

  // Helper: Create a choice and immediately link it to a brand new node to make flow creation ultra-fast
  const handleQuickAddChild = (parentNodeId: string) => {
    const parentNode = project.nodes[parentNodeId];
    if (!parentNode) return;

    const childId = crypto.randomUUID();
    
    // Position child based on layout direction
    let newChildX = parentNode.position.x;
    let newChildY = parentNode.position.y;

    if (flowDirection === "vertical") {
      newChildX = parentNode.position.x + (parentNode.choices.length - 0.5) * 260;
      newChildY = parentNode.position.y + 220;
    } else {
      newChildX = parentNode.position.x + 320;
      newChildY = parentNode.position.y + parentNode.choices.length * 120;
    }

    const newChildNode: StoryNode = {
      id: childId,
      displayId: generateDisplayId("SCN"),
      title: "Scene Branch Continuation",
      description: "Brief plot outline for this branch path...",
      speaker: "Narrator",
      dialogueLines: [],
      choices: [],
      statChanges: [],
      position: { x: newChildX, y: newChildY },
      isEnding: false,
      nodeType: "story",
      sceneId: parentNode.sceneId, // inherit scene folder from parent node!
    };

    const newChoice: StoryChoice = {
      id: crypto.randomUUID(),
      text: `Option ${parentNode.choices.length + 1}`,
      targetNodeId: childId,
    };

    onUpdateProject({
      ...project,
      nodes: {
        ...project.nodes,
        [parentNodeId]: {
          ...parentNode,
          choices: [...parentNode.choices, newChoice],
        },
        [childId]: newChildNode,
      },
      lastModified: Date.now(),
    });

    onSelectNode(childId);
  };

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden select-none" id="canvas-container">
      {/* Grid Canvas Layer */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleCanvasMouseLeave}
        onDoubleClick={handleCanvasDoubleClick}
        className="absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(#ffffff0a 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        id="storyboard-grid"
      >
        {/* SVG Bezier wires connecting choices to target nodes */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full" id="canvas-wires-svg">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
            </marker>
            <marker
              id="arrow-conditioned"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Draw lines — cases 1 & 3: visible source to visible/hidden target */}
          {visibleNodes.map((node) => {
            return node.choices.map((choice) => {
              const targetNode = project.nodes[choice.targetNodeId];
              if (!targetNode) return null;

              const targetVisible = visibleNodesMap.has(targetNode.id);
              if (!targetVisible && !hiddenSet.has(targetNode.sceneId ?? "")) {
                // Target is neither visible nor in a hidden folder — normal hidden case
                return null;
              }

              // Calculate visual anchor points based on flow direction
              let sX = 0, sY = 0, tX = 0, tY = 0, pathD = "";

              if (flowDirection === "vertical") {
                sX = node.position.x * zoom + pan.x + 120 * zoom;
                sY = node.position.y * zoom + pan.y + 115 * zoom;
                tX = targetNode.position.x * zoom + pan.x + 120 * zoom;
                tY = targetNode.position.y * zoom + pan.y;
                const dy = Math.abs(tY - sY) * 0.5;
                pathD = `M ${sX} ${sY} C ${sX} ${sY + dy}, ${tX} ${tY - dy}, ${tX} ${tY}`;
              } else {
                sX = node.position.x * zoom + pan.x + 240 * zoom;
                sY = node.position.y * zoom + pan.y + 70 * zoom;
                tX = targetNode.position.x * zoom + pan.x;
                tY = targetNode.position.y * zoom + pan.y + 40 * zoom;
                const dx = Math.abs(tX - sX) * 0.5;
                pathD = `M ${sX} ${sY} C ${sX + dx} ${sY}, ${tX - dx} ${tY}, ${tX} ${tY}`;
              }

              const isConditioned = !!(choice.condition || choice.requirement);

              if (targetVisible) {
                // Case 1: both visible — normal line
                return (
                  <g key={choice.id}>
                    <path d={pathD} fill="none" stroke={isConditioned ? "#f59e0b" : "#4f46e5"} strokeOpacity="0.15" strokeWidth="5" />
                    <path d={pathD} fill="none" stroke={isConditioned ? "#d97706" : "#6366f1"} strokeWidth="2.5" strokeDasharray={isConditioned ? "4 4" : "none"} markerEnd={`url(#${isConditioned ? "arrow-conditioned" : "arrow"})`} />
                    <g transform={`translate(${(sX + tX) / 2}, ${(sY + tY) / 2 - 8})`}>
                      <rect x="-45" y="-8" width="90" height="16" rx="8" fill="#1e293b" stroke={isConditioned ? "#d97706" : "#475569"} strokeWidth="1" className="opacity-90" />
                      <text textAnchor="middle" dominantBaseline="middle" fill={isConditioned ? "#f59e0b" : "#e2e8f0"} className="text-[9px] font-mono font-medium">
                        {choice.text.length > 12 ? choice.text.substring(0, 10) + ".." : choice.text}
                      </text>
                    </g>
                  </g>
                );
              } else {
                // Case 3: source visible → target hidden — line fades out
                return (
                  <g key={choice.id}>
                    <path d={pathD} fill="none" stroke={isConditioned ? "#f59e0b" : "#4f46e5"} strokeOpacity="0.06" strokeWidth="5" />
                    <path d={pathD} fill="none" stroke={isConditioned ? "#d97706" : "#6366f1"} strokeWidth="2.5" strokeDasharray={isConditioned ? "4 4" : "none"} strokeOpacity="0.25" />
                    <g transform={`translate(${(sX + tX) / 2}, ${(sY + tY) / 2 - 8})`} opacity="0.25">
                      <rect x="-45" y="-8" width="90" height="16" rx="8" fill="#1e293b" stroke={isConditioned ? "#d97706" : "#475569"} strokeWidth="1" />
                      <text textAnchor="middle" dominantBaseline="middle" fill={isConditioned ? "#f59e0b" : "#e2e8f0"} className="text-[9px] font-mono font-medium">
                        {choice.text.length > 12 ? choice.text.substring(0, 10) + ".." : choice.text}
                      </text>
                    </g>
                  </g>
                );
              }
            });
          })}

          {/* Case 2: hidden → visible — faded arrow stubs */}
          {hiddenNodesWithOutgoing.map((node) => {
            return node.choices
              .filter(c => c.targetNodeId && visibleNodesMap.has(c.targetNodeId))
              .map((choice) => {
                const targetNode = project.nodes[choice.targetNodeId!]!;
                const isConditioned = !!(choice.condition || choice.requirement);
                const color = isConditioned ? "#d97706" : "#6366f1";

                let stubStartX: number, stubStartY: number, stubEndX: number, stubEndY: number;

                if (flowDirection === "vertical") {
                  stubEndX = targetNode.position.x * zoom + pan.x + 120 * zoom;
                  stubEndY = targetNode.position.y * zoom + pan.y;
                  stubStartX = stubEndX;
                  stubStartY = stubEndY - 20;
                } else {
                  stubEndX = targetNode.position.x * zoom + pan.x;
                  stubEndY = targetNode.position.y * zoom + pan.y + 40 * zoom;
                  stubStartX = stubEndX - 20;
                  stubStartY = stubEndY;
                }

                return (
                  <g key={`hid-${choice.id}`}>
                    <line x1={stubStartX} y1={stubStartY} x2={stubEndX} y2={stubEndY}
                      stroke={color} strokeWidth="2.5" strokeDasharray="3 3"
                      strokeOpacity="0.4"
                      markerEnd={`url(#${isConditioned ? "arrow-conditioned" : "arrow"})`}
                    />
                  </g>
                );
            });
          })}
        </svg>

        {/* Story Nodes Render list */}
        <div
          className="absolute pointer-events-none"
          style={{ width: "100%", height: "100%" }}
          id="nodes-container"
        >
          {visibleNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isStart = project.startNodeId === node.id;

            return (
              <div
                key={node.id}
                ref={(el) => {
                  nodeRefs.current[node.id] = el;
                }}
                onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                className={`node-card absolute pointer-events-auto w-[240px] bg-slate-800 border-2 rounded-xl shadow-xl transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-2xl overflow-hidden ${
                  isSelected
                    ? "border-indigo-500 ring-4 ring-indigo-500/20 scale-102 z-40"
                    : "border-slate-700/80 hover:border-slate-600 z-10"
                }`}
                style={{
                  transform: `translate(${node.position.x * zoom + pan.x}px, ${
                    node.position.y * zoom + pan.y
                  }px) scale(${zoom})`,
                  transformOrigin: "top left",
                }}
                id={`canvas-node-${node.id}`}
              >
                {/* Ribbon details */}
                {isStart && (
                  <div className="bg-emerald-500 text-slate-950 text-[9px] font-bold py-0.5 px-3 uppercase text-center tracking-wider flex items-center justify-center gap-1 font-mono">
                    <Star className="w-2.5 h-2.5 fill-slate-950 text-slate-950" />
                    Story Entrypoint
                  </div>
                )}
                {node.nodeType && node.nodeType !== "story" && (
                  <div className={`text-[9px] font-bold py-0.5 px-3 uppercase text-center tracking-wider flex items-center justify-center gap-1 font-mono ${
                    node.nodeType === "location" ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"
                  }`}>
                    {node.nodeType === "location" ? "🏪 Location Card" : "⚔️ Encounter"}
                  </div>
                )}
                {node.isEnding && (
                  <div
                    className={`text-[9px] font-bold py-0.5 px-3 uppercase text-center tracking-wider flex items-center justify-center gap-1 font-mono ${
                      node.endingType === "GOOD"
                        ? "bg-amber-400 text-amber-950"
                        : node.endingType === "BAD"
                        ? "bg-rose-500 text-rose-950"
                        : "bg-cyan-500 text-cyan-950"
                    }`}
                  >
                    <Flag className="w-2.5 h-2.5 fill-current" />
                    {node.endingName || "STORY ENDING"}
                  </div>
                )}

                {(project.locks || []).find(l => l.nodeId === node.id) && (
                  <div className="bg-amber-500/20 text-amber-400 text-[8px] font-bold py-0.5 px-3 uppercase text-center tracking-wider flex items-center justify-center gap-1 font-mono border-b border-amber-500/20">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Locked by {(project.locks || []).find(l => l.nodeId === node.id)?.userName}
                  </div>
                )}

                <div className="p-3">
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <h3 className="text-xs font-semibold text-white truncate max-w-[150px] font-sans" title={node.title}>
                      {node.title}
                    </h3>
                    <div className="flex items-center gap-1 opacity-70 hover:opacity-100 shrink-0">
                      {!isStart && (
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleSetStartNode(node.id, e)}
                          className="p-1 text-slate-400 hover:text-emerald-400 rounded-md hover:bg-slate-700 cursor-pointer transition-colors"
                          title="Set as Story Entrypoint"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      )}
                      <div ref={nodeConfirmRef}>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleDeleteNode(node.id, e)}
                          className={`p-1 rounded-md cursor-pointer transition-all flex items-center justify-center ${
                            nodeToConfirmDelete === node.id
                              ? "bg-rose-600 text-white px-2 animate-pulse"
                              : "text-slate-400 hover:text-rose-400 hover:bg-slate-700"
                          }`}
                          title={nodeToConfirmDelete === node.id ? "Click again to confirm deletion" : "Delete scene node"}
                        >
                          {nodeToConfirmDelete === node.id ? (
                            <span className="text-[9px] font-bold">Confirm?</span>
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 line-clamp-3 mb-2 leading-relaxed">
                    {node.description || <span className="italic opacity-60">No plot details set yet.</span>}
                  </p>

                  {node.nodeType === "location" && node.locationData && (
                    <div className="mt-2 space-y-0.5">
                      <div className="text-[9px] text-amber-300 font-mono">Items: {node.locationData.inventory.length} | Open: {node.locationData.openTime}</div>
                      {node.locationData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {node.locationData.tags.map(tag => (
                            <span key={tag} className="px-1 py-0.5 rounded text-[8px] bg-amber-500/10 text-amber-400">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {node.nodeType === "encounter" && node.encounterData && (
                    <div className="mt-2 space-y-0.5">
                      <div className="text-[9px] text-rose-300 font-mono">Enemy: {node.encounterData.enemyName}</div>
                      <div className="text-[8px] text-slate-400 font-mono">
                        HP:{node.encounterData.hp} ATK:{node.encounterData.attack} DEF:{node.encounterData.defense}
                      </div>
                    </div>
                  )}

                  {/* Node variables modifications indicators */}
                  {node.statChanges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {node.statChanges.map((sc, i) => (
                        <span
                          key={i}
                          className="text-[8px] font-mono px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-semibold"
                        >
                          {sc.variableName} {sc.operation}{sc.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Connect points & child builder button */}
                  <div className="flex items-center justify-between border-t border-slate-700/50 pt-2 mt-2 gap-1 bg-slate-800/40 -mx-3 -mb-3 px-3 pb-2.5">
                    <span className="text-[9px] font-mono font-bold text-slate-500">
                      {node.choices.length} Choice branches
                    </span>
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => handleQuickAddChild(node.id)}
                      className="py-1 px-2 hover:bg-indigo-600 bg-indigo-500 text-white font-semibold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Quick create linked option node"
                    >
                      <Plus className="w-3 h-3" />
                      Branch Out
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Instructions Banner */}
      <div className="absolute top-4 left-4 z-20 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 max-w-xs shadow-2xl pointer-events-none">
        <h3 className="text-xs font-bold text-white mb-1 tracking-wider uppercase">Visual VN Navigator</h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          • Drag the background canvas to pan.<br />
          • Double-click background to create scenes.<br />
          • Click and drag cards to move them.<br />
          • Click <strong>&quot;Branch Out&quot;</strong> to link a new choice Scene path.
        </p>
      </div>

      {/* Toolbar controls */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 p-2 rounded-xl shadow-2xl">
        <button
          onClick={() => setZoom(Math.max(minZoom, zoom - 0.1))}
          className="canvas-btn p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <select
          value={String(Math.round(zoom * 100))}
          onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
          className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-1 py-0.5 min-w-[60px] text-center cursor-pointer"
        >
          <option value="100">100%</option>
          <option value="75">75%</option>
          <option value="50">50%</option>
          <option value="25">25%</option>
        </select>
        <button
          onClick={() => setZoom(Math.min(maxZoom, zoom + 0.1))}
          className="canvas-btn p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="canvas-btn p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Reset Zoom"
        >
          <Compass className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-5 bg-slate-800 mx-1" />
        <button
          onClick={centerOnStartNode}
          className="canvas-btn p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Center on Entrance Node"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        {onAddBlankNode && (
          <>
            <div className="w-[1px] h-5 bg-slate-800 mx-1" />
            <button
              onClick={onAddBlankNode}
              className="canvas-btn p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Add Scene Point"
            >
              <Plus className="w-4 h-4" />
            </button>
            {onAddLocation && (
              <button
                onClick={onAddLocation}
                className="canvas-btn p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Add Location Card"
              >
                🏪
              </button>
            )}
            {onAddEncounter && (
              <button
                onClick={onAddEncounter}
                className="canvas-btn p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Add Encounter Card"
              >
                ⚔️
              </button>
            )}
          </>
        )}
        <button
          onClick={() => {
            const nextDir = flowDirection === "horizontal" ? "vertical" : "horizontal";
            onUpdateProject({
              ...project,
              flowDirection: nextDir,
              lastModified: Date.now(),
            });
          }}
          className="canvas-btn p-2 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold px-2.5 font-mono"
          title="Toggle Flow Layout orientation (Horizontal vs. Top-Down Org-Chart)"
        >
          Flow: <span className="uppercase text-white text-[10px]">{flowDirection}</span>
        </button>
        <button
          onClick={autoArrangeNodes}
          className="canvas-btn p-2 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold px-2.5 font-mono"
          title="Auto-tidy node layout"
        >
          Tidy Layout
        </button>
      </div>

      {/* Play simulation shortcut */}
      {project.startNodeId && (
        <button
          onClick={() => onEnterPlaytest(project.startNodeId)}
          className="absolute bottom-4 right-4 z-20 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all shadow-xl hover:shadow-2xl flex items-center gap-2 text-xs font-sans uppercase tracking-wider cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Test Walkthrough
        </button>
      )}
    </div>
  );
}
