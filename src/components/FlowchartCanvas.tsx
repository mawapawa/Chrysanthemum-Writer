/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { VNProject, StoryNode, StoryChoice, SceneBlock } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Crosshair, ZoomIn, ZoomOut, Compass, Play, Flag, Star, X } from "lucide-react";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import BlockEditor from "./BlockEditor";
import { blocksToNode, nodeToBlocks } from "../utils/blockSerializer";

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
  const dragDelta = useRef({ x: 0, y: 0 });
  const dragGroupRef = useRef<Array<{ id: string; startX: number; startY: number }>>([]);

  const collectDescendants = useCallback((nodeId: string): Array<{ id: string; startX: number; startY: number }> => {
    const collected = new Map<string, { x: number; y: number }>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (collected.has(id)) continue;
      const node = project.nodes[id];
      if (!node) continue;
      collected.set(id, { x: node.position.x, y: node.position.y });
      if (node.continueToNodeId && !collected.has(node.continueToNodeId)) queue.push(node.continueToNodeId);
      for (const choice of node.choices) {
        if (choice.targetNodeId && !collected.has(choice.targetNodeId)) queue.push(choice.targetNodeId);
      }
    }
    return Array.from(collected.entries()).map(([id, pos]) => ({ id, startX: pos.x, startY: pos.y }));
  }, [project.nodes]);

  const { confirmId: nodeConfirmId, ref: nodeConfirmRef, requestDelete: requestNodeDelete } = useConfirmDelete();

  const canvasRef = useRef<HTMLDivElement>(null);

  // Expanded node editor panel state
  const selectedNode = selectedNodeId ? project.nodes[selectedNodeId] : null;
  const [expandedBlocks, setExpandedBlocks] = useState<SceneBlock[]>(() =>
    selectedNode ? (selectedNode.blocks || nodeToBlocks(selectedNode)) : []
  );

  useEffect(() => {
    if (selectedNode) {
      setExpandedBlocks(selectedNode.blocks || nodeToBlocks(selectedNode));
    }
  }, [selectedNodeId, project.nodes[selectedNodeId || ""]?.blocks]);

  const handleBlocksChange = useCallback((newBlocks: SceneBlock[]) => {
    setExpandedBlocks(newBlocks);
    if (selectedNodeId && project.nodes[selectedNodeId]) {
      const node = project.nodes[selectedNodeId];
      const legacy = blocksToNode(newBlocks, node);
      onUpdateProject({
        ...project,
        nodes: {
          ...project.nodes,
          [selectedNodeId]: { ...node, ...legacy, blocks: newBlocks },
        },
        lastModified: Date.now(),
      });
    }
  }, [selectedNodeId, project]);

  const handleCreateNodeFromBlock = useCallback((): string => {
    const childId = crypto.randomUUID();
    const parent = selectedNodeId ? project.nodes[selectedNodeId] : null;
    const childNode: StoryNode = {
      id: childId,
      displayId: generateDisplayId("SCN"),
      title: "New Scene",
      description: "",
      speaker: "Narrator",
      dialogueLines: [],
      choices: [],
      statChanges: [],
      position: parent
        ? { x: parent.position.x + 320, y: parent.position.y + (parent.choices.length * 120) }
        : { x: 400, y: 300 },
      isEnding: false,
      nodeType: "story",
    };
    onUpdateProject({
      ...project,
      nodes: { ...project.nodes, [childId]: childNode },
      lastModified: Date.now(),
    });
    return childId;
  }, [selectedNodeId, project]);

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

  // Close expanded editor on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedNodeId) {
        onSelectNode(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedNodeId, onSelectNode]);

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
      wasDragged.current = true;
      dragDelta.current = {
        x: (e.clientX - dragStart.current.x) / zoom,
        y: (e.clientY - dragStart.current.y) / zoom,
      };
      forceUpdate({});
    }
  };

  const getGroupNodes = (): Record<string, { x: number; y: number }> => {
    if (!draggedNodeId || dragGroupRef.current.length === 0) return {};
    const result: Record<string, { x: number; y: number }> = {};
    for (const member of dragGroupRef.current) {
      result[member.id] = {
        x: Math.round(member.startX + dragDelta.current.x),
        y: Math.round(member.startY + dragDelta.current.y),
      };
    }
    return result;
  };

  const handleMouseUp = () => {
    const wasDrag = wasDragged.current;
    const wasPanning = isPanning;
    if (wasDrag && draggedNodeId) {
      const groupPositions = getGroupNodes();
      if (Object.keys(groupPositions).length > 0) {
        const updatedNodes = { ...project.nodes };
        for (const [id, pos] of Object.entries(groupPositions)) {
          if (updatedNodes[id]) {
            updatedNodes[id] = { ...updatedNodes[id], position: pos };
          }
        }
        onUpdateProject({ ...project, nodes: updatedNodes, lastModified: Date.now() });
      }
    }
    dragDelta.current = { x: 0, y: 0 };
    dragGroupRef.current = [];
    setIsPanning(false);
    setDraggedNodeId(null);
    if (!wasDrag && wasPanning) {
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
    dragGroupRef.current = collectDescendants(nodeId);
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!requestNodeDelete(nodeId)) return;
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
    const updatedNodes = { ...project.nodes };

    // Collect connected nodes via BFS following both choices and continue-to
    const visited = new Set<string>();
    const levels: Record<string, number> = {};
    const countsAtLevel: Record<number, Record<string, number>> = {};

    const traverse = (nodeId: string, level: number, branchKey: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = project.nodes[nodeId];
      if (!node) return;
      const isHidden = node.sceneId && hiddenSet.has(node.sceneId);

      if (!isHidden && (!node.nodeType || node.nodeType === "story")) {
        levels[nodeId] = level;
        if (!countsAtLevel[level]) countsAtLevel[level] = {};
        countsAtLevel[level][branchKey] = (countsAtLevel[level][branchKey] || 0) + 1;
      }

      if (node.nodeType && node.nodeType !== "story") return;

      // Follow continue-to link — same branch, half-level deeper (stays close)
      if (node.continueToNodeId) {
        traverse(node.continueToNodeId, level + 0.5, branchKey);
      }

      // Follow choices — each spawns a new branch
      node.choices.forEach((choice, ci) => {
        if (choice.targetNodeId && project.nodes[choice.targetNodeId]) {
          traverse(choice.targetNodeId, level + 1, `${branchKey}-ch${ci}`);
        }
      });
    };

    if (project.startNodeId && project.nodes[project.startNodeId]) {
      traverse(project.startNodeId, 0, "spine");
    }
    // Orphan nodes
    Object.keys(project.nodes).forEach((nodeId) => {
      const n = project.nodes[nodeId];
      if (!visited.has(nodeId) && n && (!n.nodeType || n.nodeType === "story")) {
        traverse(nodeId, 0, `orphan-${nodeId}`);
      }
    });

    // --- Position nodes ---
    const isVert = flowDirection === "vertical";
    const storyPositions: Record<string, { x: number; y: number }> = {};

    // Group story nodes by (level, branchKey) for clean placement
    const grouped: Record<number, Array<{ id: string; branch: string }>> = {};
    for (const [id, lvl] of Object.entries(levels)) {
      if (!grouped[lvl]) grouped[lvl] = [];
      const node = project.nodes[id];
      const branch = node?.choices.length ? "choice" : "spine";
      grouped[lvl].push({ id, branch });
    }

    // Place spine nodes (continue-to chain) as the primary axis
    const spineIds = new Set<string>();
    let spineIdx = 0;
    let spineNodeId = project.startNodeId;
    while (spineNodeId && project.nodes[spineNodeId] && !spineIds.has(spineNodeId)) {
      spineIds.add(spineNodeId);
      if (!project.nodes[spineNodeId].sceneId || !hiddenSet.has(project.nodes[spineNodeId].sceneId!)) {
        if (isVert) {
          storyPositions[spineNodeId] = { x: 400, y: spineIdx * 260 + 120 };
        } else {
          storyPositions[spineNodeId] = { x: spineIdx * 320 + 80, y: 240 };
        }
      }
      spineIdx++;
      spineNodeId = project.nodes[spineNodeId]?.continueToNodeId || "";
    }

    // Place remaining nodes: spread around their level
    const placedBranchOffsets: Record<string, number> = {};
    for (const [lvlStr, entries] of Object.entries(grouped)) {
      const lvl = Number(lvlStr);
      let branchCount = 0;
      for (const { id, branch } of entries) {
        if (storyPositions[id]) continue; // already placed by spine
        const node = project.nodes[id];
        if (!node || (node.sceneId && hiddenSet.has(node.sceneId))) continue;

        const branchKey = `${lvl}-${branch}-${entries.indexOf({ id, branch })}`;
        placedBranchOffsets[branchKey] = (placedBranchOffsets[branchKey] || 0) + 1;

        if (isVert) {
          const baseX = 400 + (branchCount - entries.length / 2) * 280;
          storyPositions[id] = { x: baseX, y: lvl * 260 + 120 };
        } else {
          const yOffset = (branchCount - entries.length / 2) * 220;
          storyPositions[id] = { x: lvl * 320 + 80, y: 240 + yOffset };
        }
        branchCount++;
      }
    }

    // Apply story positions
    for (const [id, pos] of Object.entries(storyPositions)) {
      if (updatedNodes[id]) {
        updatedNodes[id] = { ...updatedNodes[id], position: pos };
      }
    }

    // Place location/encounter nodes in their own lane below all story nodes
    const maxStoryY = Math.max(...Object.values(storyPositions).map(p => p.y), 0) + 100;
    const maxStoryX = Math.max(...Object.values(storyPositions).map(p => p.x), 0) + 100;
    const nonStoryLaneY = isVert ? 120 : maxStoryY;
    const nonStoryLaneX = isVert ? maxStoryX : 80;
    const placedNonStory = new Set<string>();
    for (const node of Object.values(project.nodes) as StoryNode[]) {
      if (!node.nodeType || node.nodeType === "story") continue;
      if (node.sceneId && hiddenSet.has(node.sceneId)) continue;
      if (placedNonStory.has(node.id)) continue;
      placedNonStory.add(node.id);

      const typeOffset = node.nodeType === "location" ? 0 : 1;
      if (isVert) {
        updatedNodes[node.id] = { ...node, position: { x: nonStoryLaneX + typeOffset * 320, y: nonStoryLaneY + (placedNonStory.size - 1) * 220 } };
      } else {
        updatedNodes[node.id] = { ...node, position: { x: nonStoryLaneX + (placedNonStory.size - 1) * 320, y: nonStoryLaneY + typeOffset * 240 } };
      }
    }

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
            <marker
              id="arrow-continue"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#14b8a6" />
            </marker>
          </defs>

          {/* Group choices by source→target pair for merged wire rendering */}
          {(() => {
            const pairs: Array<{ sourceNode: typeof visibleNodes[0]; targetNode: typeof project.nodes[string]; choices: StoryChoice[] }> = [];
            for (const node of visibleNodes) {
              const grouped: Record<string, StoryChoice[]> = {};
              for (const choice of node.choices) {
                const targetNode = project.nodes[choice.targetNodeId];
                if (!targetNode) continue;
                const targetVisible = visibleNodesMap.has(targetNode.id);
                if (!targetVisible && !hiddenSet.has(targetNode.sceneId ?? "")) continue;
                if (!grouped[targetNode.id]) grouped[targetNode.id] = [];
                grouped[targetNode.id].push(choice);
              }
              for (const [targetId, choices] of Object.entries(grouped)) {
                const targetNode = project.nodes[targetId];
                if (targetNode) pairs.push({ sourceNode: node, targetNode, choices });
              }
            }

            const renderWires: Array<React.ReactElement> = [];
            const isVertical = flowDirection === "vertical";

            for (const { sourceNode, targetNode, choices } of pairs) {
              const hasConditioned = choices.some(c => c.condition || c.requirement);
              const isCond = hasConditioned;
              const color1 = isCond ? "#f59e0b" : "#4f46e5";
              const color2 = isCond ? "#d97706" : "#6366f1";
              const arrowId = isCond ? "arrow-conditioned" : "arrow";
              const targetVisible = visibleNodesMap.has(targetNode.id) ? 1 : 0.25;

              let sX: number, sY: number, tX: number, tY: number, pathD: string;

              if (isVertical) {
                sX = sourceNode.position.x * zoom + pan.x + 120 * zoom;
                sY = sourceNode.position.y * zoom + pan.y + 115 * zoom;
                tX = targetNode.position.x * zoom + pan.x + 120 * zoom;
                tY = targetNode.position.y * zoom + pan.y;
                const dy = Math.abs(tY - sY) * 0.5;
                const midY = (sY + tY) / 2;
                pathD = `M ${sX} ${sY} C ${sX} ${sY + dy}, ${tX} ${tY - dy}, ${tX} ${tY}`;

                // Stack labels vertically along the midpoint
                renderWires.push(
                  <g key={`${sourceNode.id}-${targetNode.id}`}>
                    <path d={pathD} fill="none" stroke={color1} strokeOpacity={0.12 * targetVisible} strokeWidth="5" />
                    <path d={pathD} fill="none" stroke={color2} strokeWidth="2" strokeOpacity={targetVisible} strokeDasharray={isCond ? "4 4" : "none"} markerEnd={`url(#${arrowId})`} />
                    {choices.map((c, i) => {
                      const labelY = midY - ((choices.length - 1) * 11) / 2 + i * 11;
                      return (
                        <g key={c.id} transform={`translate(${(sX + tX) / 2}, ${labelY})`} opacity={targetVisible}>
                          <rect x="-52" y="-8" width="104" height="16" rx="8" fill="#1e293b" stroke={c.condition || c.requirement ? "#d97706" : "#475569"} strokeWidth="1" />
                          <text textAnchor="middle" dominantBaseline="middle" fill={c.condition || c.requirement ? "#f59e0b" : "#e2e8f0"} className="text-[9px] font-mono font-medium">
                            {c.text.length > 14 ? c.text.substring(0, 12) + ".." : c.text}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              } else {
                sX = sourceNode.position.x * zoom + pan.x + 240 * zoom;
                sY = sourceNode.position.y * zoom + pan.y + 70 * zoom;
                tX = targetNode.position.x * zoom + pan.x;
                tY = targetNode.position.y * zoom + pan.y + 40 * zoom;
                const dx = Math.abs(tX - sX) * 0.5;
                const midY = (sY + tY) / 2;
                pathD = `M ${sX} ${sY} C ${sX + dx} ${sY}, ${tX - dx} ${tY}, ${tX} ${tY}`;

                // Stack labels vertically along the midpoint
                renderWires.push(
                  <g key={`${sourceNode.id}-${targetNode.id}`}>
                    <path d={pathD} fill="none" stroke={color1} strokeOpacity={0.12 * targetVisible} strokeWidth="5" />
                    <path d={pathD} fill="none" stroke={color2} strokeWidth="2" strokeOpacity={targetVisible} strokeDasharray={isCond ? "4 4" : "none"} markerEnd={`url(#${arrowId})`} />
                    {choices.map((c, i) => {
                      const labelY = midY - ((choices.length - 1) * 11) / 2 + i * 11;
                      return (
                        <g key={c.id} transform={`translate(${(sX + tX) / 2}, ${labelY})`} opacity={targetVisible}>
                          <rect x="-52" y="-8" width="104" height="16" rx="8" fill="#1e293b" stroke={c.condition || c.requirement ? "#d97706" : "#475569"} strokeWidth="1" />
                          <text textAnchor="middle" dominantBaseline="middle" fill={c.condition || c.requirement ? "#f59e0b" : "#e2e8f0"} className="text-[9px] font-mono font-medium">
                            {c.text.length > 14 ? c.text.substring(0, 12) + ".." : c.text}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              }
            }

            return renderWires;
          })()}

          {/* Continue-to wires (teal dashed) */}
          {visibleNodes.filter(n => n.continueToNodeId && visibleNodesMap.has(n.continueToNodeId)).map((node) => {
            const targetNode = project.nodes[node.continueToNodeId!]!;
            const isVertical = flowDirection === "vertical";
            let sX: number, sY: number, tX: number, tY: number;

            if (isVertical) {
              sX = node.position.x * zoom + pan.x + 120 * zoom;
              sY = node.position.y * zoom + pan.y + 115 * zoom;
              tX = targetNode.position.x * zoom + pan.x + 120 * zoom;
              tY = targetNode.position.y * zoom + pan.y;
            } else {
              sX = node.position.x * zoom + pan.x + 240 * zoom;
              sY = node.position.y * zoom + pan.y + 70 * zoom;
              tX = targetNode.position.x * zoom + pan.x;
              tY = targetNode.position.y * zoom + pan.y + 40 * zoom;
            }

            const dy = Math.abs(tY - sY) * 0.5;
            const dx = Math.abs(tX - sX) * 0.5;
            const pathD = isVertical
              ? `M ${sX} ${sY} C ${sX} ${sY + dy}, ${tX} ${tY - dy}, ${tX} ${tY}`
              : `M ${sX} ${sY} C ${sX + dx} ${sY}, ${tX - dx} ${tY}, ${tX} ${tY}`;

            return (
              <g key={`continue-${node.id}`}>
                <path d={pathD} fill="none" stroke="#14b8a6" strokeOpacity={0.08} strokeWidth="5" />
                <path d={pathD} fill="none" stroke="#14b8a6" strokeWidth="2" strokeOpacity={0.5} strokeDasharray="6 4" markerEnd="url(#arrow-continue)" />
              </g>
            );
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
                className={`node-card absolute pointer-events-auto ${isSelected ? "w-[400px]" : "w-[240px]"} bg-slate-800 border-2 rounded-xl shadow-xl ${draggedNodeId !== node.id ? "transition-all duration-150" : ""} cursor-grab active:cursor-grabbing hover:shadow-2xl ${isSelected ? "" : "overflow-hidden"} ${
                  isSelected
                    ? "border-indigo-500 ring-4 ring-indigo-500/20 scale-105 z-40"
                    : "border-slate-700/80 hover:border-slate-600 z-10"
                }`}
                style={{
                  transform: `translate(${node.position.x * zoom + pan.x + (dragGroupRef.current.some(g => g.id === node.id) ? dragDelta.current.x * zoom : 0)}px, ${
                    node.position.y * zoom + pan.y + (dragGroupRef.current.some(g => g.id === node.id) ? dragDelta.current.y * zoom : 0)
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
                            nodeConfirmId === node.id
                              ? "bg-rose-600 text-white px-2 animate-pulse"
                              : "text-slate-400 hover:text-rose-400 hover:bg-slate-700"
                          }`}
                          title={nodeConfirmId === node.id ? "Click again to confirm deletion" : "Delete scene node"}
                        >
                          {nodeConfirmId === node.id ? (
                            <span className="text-[9px] font-bold">Confirm?</span>
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isSelected ? (
                    <textarea
                      value={node.description}
                      onChange={(e) => onUpdateProject({ ...project, nodes: { ...project.nodes, [node.id]: { ...node, description: e.target.value } }, lastModified: Date.now() })}
                      className="w-full bg-transparent text-[10px] text-slate-300 mb-2 leading-relaxed resize-none focus:outline-none border border-transparent focus:border-slate-600 rounded p-1"
                      rows={2} placeholder="Scene summary..."
                    />
                  ) : (
                    <p className="text-[10px] text-slate-400 line-clamp-3 mb-2 leading-relaxed">
                      {node.description || <span className="italic opacity-60">No plot details set yet.</span>}
                    </p>
                  )}

                  {node.nodeType === "location" && node.locationData && (
                    <div className="mt-2 space-y-0.5">
                      <div className="text-[9px] text-amber-300 font-mono">Items: {node.locationData.inventory.length} | Open: {node.locationData.openTime || "any"}</div>
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

                  {/* Continue-to indicator */}
                  {node.continueToNodeId && project.nodes[node.continueToNodeId] && (
                    <div className="text-[9px] text-teal-400 font-mono font-semibold mb-1 flex items-center gap-1">
                      <span className="text-teal-500/70">→</span> Continues to: {project.nodes[node.continueToNodeId].title}
                    </div>
                  )}

                  {/* Expanded editor — shown when selected */}
                  {isSelected && (
                    <div className="border-t border-slate-700/50 mt-2 pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-slate-500">Press Esc or click canvas to close</span>
                        <button onClick={() => onSelectNode(null)}
                          className="p-0.5 text-slate-500 hover:text-white cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <BlockEditor
                        project={project}
                        blocks={expandedBlocks}
                        onChange={handleBlocksChange}
                        onCreateNode={handleCreateNodeFromBlock}
                      />
                    </div>
                  )}
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
          onClick={() => onEnterPlaytest(selectedNodeId ?? project.startNodeId)}
          className="absolute bottom-4 right-4 z-20 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all shadow-xl hover:shadow-2xl flex items-center gap-2 text-xs font-sans uppercase tracking-wider cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Test Walkthrough
        </button>
      )}
    </div>
  );
}
