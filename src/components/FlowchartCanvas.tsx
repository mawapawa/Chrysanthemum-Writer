/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useReducer } from "react";
import { VNProject, StoryNode, StoryChoice, SceneBlock } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { Plus, Trash2, Crosshair, ZoomIn, ZoomOut, Compass, Play, Flag, Star } from "lucide-react";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import BlockEditor from "./BlockEditor";
import { blocksToNode, nodeToBlocks } from "../utils/blockSerializer";

interface FlowchartCanvasProps {
  project: VNProject;
  onUpdateProject: (project: VNProject | ((prev: VNProject) => VNProject)) => void;
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

  // Focus editing state and single block editor state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editorBlocks, setEditorBlocks] = useState<SceneBlock[]>([]);
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const editingTargetRef = useRef<string | null>(null);

  const activeEditNodeId = editingNodeId || selectedNodeId;
  const activeEditNode = activeEditNodeId ? project.nodes[activeEditNodeId] : null;

  // Keep ref in sync so handleEditorBlocksChange always sees the latest target
  editingTargetRef.current = activeEditNodeId;

  // Load blocks when the active node changes
  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevActiveIdRef.current === activeEditNodeId) return;
    prevActiveIdRef.current = activeEditNodeId;
    if (activeEditNode) {
      const blocks = activeEditNode.blocks || nodeToBlocks(activeEditNode);
      setEditorBlocks(blocks);
      setEditorNodeId(activeEditNodeId);
    } else {
      setEditorBlocks([]);
      setEditorNodeId(null);
    }
  }, [activeEditNodeId, project.nodes[activeEditNodeId || ""]?.blocks]);

  // Single handler for saving blocks
  const handleEditorBlocksChange = useCallback((newBlocks: SceneBlock[]) => {
    setEditorBlocks(newBlocks);
    const targetId = editingTargetRef.current;
    if (targetId && project.nodes[targetId]) {
      const node = project.nodes[targetId];
      const legacy = blocksToNode(newBlocks, node);
      onUpdateProject({
        ...project,
        nodes: {
          ...project.nodes,
          [targetId]: { ...node, ...legacy, blocks: newBlocks },
        },
        lastModified: Date.now(),
      });
    }
  }, [project]);

  const handleCreateNodeFromBlock = useCallback((): string => {
    const childId = crypto.randomUUID();
    const parentId = activeEditNodeId;
    const parent = parentId ? project.nodes[parentId] : null;
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
  }, [activeEditNodeId, project]);

  const handleCreateNodeWithTitle = useCallback((title: string): string => {
    const childId = crypto.randomUUID();
    const parentId = activeEditNodeId;
    const parent = parentId ? project.nodes[parentId] : null;
    const childNode: StoryNode = {
      id: childId,
      displayId: generateDisplayId("SCN"),
      title: title || "New Scene",
      description: "",
      speaker: "Narrator",
      dialogueLines: [],
      choices: [],
      statChanges: [],
      position: parent
        ? { x: parent.position.x + 320, y: parent.position.y + 500 }
        : { x: 400, y: 300 },
      isEnding: false,
      nodeType: "story",
    };
    // Deferred to avoid batched state conflict with handleEditorBlocksChange
    setTimeout(() => {
      onUpdateProject((prev: VNProject) => ({
        ...prev,
        nodes: { ...prev.nodes, [childId]: childNode },
        lastModified: Date.now(),
      }));
    }, 0);
    return childId;
  }, [activeEditNodeId, project]);

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
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  const [editingTitleNodeId, setEditingTitleNodeId] = useState<string | null>(null);

  // Close focus mode on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingNodeId) setEditingNodeId(null);
        else if (selectedNodeId) onSelectNode(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editingNodeId, selectedNodeId, onSelectNode]);

  useEffect(() => {
    // Redraw connections when project updates
    forceUpdate();
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
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // If we're in editing mode and click outside the card, close it
    if (editingNodeId && !target.closest(".node-card") && !target.closest(".canvas-btn")) {
      setEditingNodeId(null);
      return;
    }
    if (target.closest(".node-card") || target.closest(".canvas-btn") ||
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest("[contenteditable]")) return;

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
      forceUpdate();
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
    const isVert = flowDirection === "vertical";
    const CARD_W = 240;
    const CARD_H = 140;
    const GAP_X = 80;
    const GAP_Y = 60;
    const PADDING = 30;

    // 1. Assign integer layer depths via BFS from the start node
    const layers: Record<string, number> = {};
    const queue: string[] = [];
    const visited = new Set<string>();
    const childrenOf: Record<string, string[]> = {};
    const parentOf: Record<string, string> = {};

    const enqueue = (id: string, depth: number, parentId?: string) => {
      if (visited.has(id) || !project.nodes[id]) return;
      visited.add(id);
      layers[id] = depth;
      queue.push(id);
      if (parentId) {
        parentOf[id] = parentId;
        if (!childrenOf[parentId]) childrenOf[parentId] = [];
        childrenOf[parentId].push(id);
      }
    };

    if (project.startNodeId) enqueue(project.startNodeId, 0);

    // BFS traversal
    for (let i = 0; i < queue.length; i++) {
      const curId = queue[i];
      const curNode = project.nodes[curId];
      if (!curNode) continue;
      const curDepth = layers[curId] || 0;

      if (curNode.nodeType && curNode.nodeType !== "story") continue;

      // Continue-to link — same depth level (stays on main axis)
      if (curNode.continueToNodeId && !visited.has(curNode.continueToNodeId)) {
        enqueue(curNode.continueToNodeId, curDepth, curId);
      }

      // Choices — next depth level
      for (const choice of curNode.choices) {
        if (choice.targetNodeId && !visited.has(choice.targetNodeId)) {
          enqueue(choice.targetNodeId, curDepth + 1, curId);
        }
      }
    }

    // 2. Calculate subtree heights per layer for vertical spacing
    const subtreeHeight: Record<string, number> = {};
    const calcSubtreeHeight = (nodeId: string): number => {
      if (subtreeHeight[nodeId] !== undefined) return subtreeHeight[nodeId];
      const children = childrenOf[nodeId] || [];
      if (children.length === 0) {
        subtreeHeight[nodeId] = CARD_H + PADDING;
        return subtreeHeight[nodeId];
      }
      let totalHeight = 0;
      for (const childId of children) {
        totalHeight += calcSubtreeHeight(childId);
      }
      subtreeHeight[nodeId] = Math.max(CARD_H + PADDING, totalHeight);
      return subtreeHeight[nodeId];
    };

    for (const id of queue) calcSubtreeHeight(id);

    // 3. Position nodes layer by layer with subtree-aware spacing
    const positions: Record<string, { x: number; y: number }> = {};
    const layerYOffsets: Record<number, number> = {};
    const layerCounts: Record<number, number> = {};

    // Process in BFS order to assign Y positions
    const placed = new Set<string>();
    const getLayerCenter = (layer: number): number => {
      // Find all nodes in this layer, spread them based on subtree heights
      const nodesAtLayer = queue.filter(id => (layers[id] || 0) === layer && !placed.has(id));
      const layerHeight = layerYOffsets[layer] || 0;
      return layerHeight;
    };

    for (const id of queue) {
      if (placed.has(id)) continue;
      const layer = layers[id] || 0;
      if (isVert) {
        // Vertical layout: X = subtree position, Y = layer
        const parentId = parentOf[id];
        if (parentId && positions[parentId]) {
          // Place below parent at center of subtree
          const siblings = childrenOf[parentId] || [];
          const siblingIdx = siblings.indexOf(id);
          let xOffset = positions[parentId].x;
          if (siblings.length > 1) {
            const totalW = siblings.length * CARD_W + (siblings.length - 1) * GAP_X;
            xOffset = positions[parentId].x - totalW / 2 + siblingIdx * (CARD_W + GAP_X) + CARD_W / 2;
          }
          const yPos = positions[parentId].y + CARD_H + GAP_Y;
          positions[id] = { x: xOffset, y: yPos };
        } else {
          const count = layerCounts[layer] || 0;
          layerCounts[layer] = count + 1;
          positions[id] = { x: 400 + count * (CARD_W + GAP_X), y: layer * (CARD_H + GAP_Y) + 120 };
        }
      } else {
        // Horizontal layout: X = layer, Y = spread based on subtree height
        const parentId = parentOf[id];
        if (parentId && positions[parentId]) {
          // Place to the right of parent
          const xPos = positions[parentId].x + CARD_W + GAP_X;
          // Stack vertically based on sibling index
          const siblings = childrenOf[parentId] || [];
          const siblingIdx = siblings.indexOf(id);
          let totalSubH = 0;
          for (let si = 0; si < siblingIdx; si++) {
            totalSubH += calcSubtreeHeight(siblings[si]);
          }
          const yPos = positions[parentId].y + (CARD_H / 2) + totalSubH - calcSubtreeHeight(id) / 2;
          positions[id] = { x: xPos, y: yPos };
        } else {
          // Root-level placement
          const yOffset = layerYOffsets[layer] || 0;
          const xPos = layer * (CARD_W + GAP_X) + 80;
          const yPos = 240 + yOffset;
          positions[id] = { x: xPos, y: yPos };
          layerYOffsets[layer] = yOffset + calcSubtreeHeight(id);
        }
      }
      placed.add(id);
    }

    // 4. Apply positions to all story nodes
    for (const [id, pos] of Object.entries(positions)) {
      if (updatedNodes[id]) {
        const node = updatedNodes[id];
        if (!node.nodeType || node.nodeType === "story") {
          updatedNodes[id] = { ...node, position: { x: Math.round(pos.x), y: Math.round(pos.y) } };
        }
      }
    }

    // 5. Place location/encounter nodes in their own lane below story nodes
    const maxStoryY = Math.max(...Object.values(positions).map(p => p.y), 0) + CARD_H + GAP_Y * 2;
    const maxStoryX = Math.max(...Object.values(positions).map(p => p.x), 0) + CARD_W + GAP_X;
    const nonStoryIds = Object.keys(project.nodes).filter(id => {
      const n = project.nodes[id];
      return n && n.nodeType && n.nodeType !== "story" && !(n.sceneId && hiddenSet.has(n.sceneId));
    });
    for (let i = 0; i < nonStoryIds.length; i++) {
      const id = nonStoryIds[i];
      const n = project.nodes[id];
      const typeOffset = n.nodeType === "location" ? 0 : 1;
      if (isVert) {
        updatedNodes[id] = { ...n, position: { x: maxStoryX + typeOffset * 320, y: i * (CARD_H + GAP_Y) + 120 } };
      } else {
        updatedNodes[id] = { ...n, position: { x: i * (CARD_W + GAP_X) + 80, y: maxStoryY + typeOffset * (CARD_H + GAP_Y) } };
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
        {/* Ambient underglow blobs */}
        <div className="ambient-blob ambient-blob-1" />
        <div className="ambient-blob ambient-blob-2" />
        <div className="ambient-blob ambient-blob-3" />
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
            const isEditing = editingNodeId === node.id;
            const isSelected = selectedNodeId === node.id;
            const isStart = project.startNodeId === node.id;

            return (
              <div
                key={node.id}
                ref={(el) => {
                  nodeRefs.current[node.id] = el;
                }}
                onMouseDown={(e) => { if (!isEditing) handleNodeMouseDown(node.id, e); }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingNodeId(node.id); }}
                className={`node-card pointer-events-auto glass-card ${isEditing ? "" : "absolute w-52"} ${isEditing ? "z-50" : (isSelected ? "z-40" : "z-10")} ${
                  isEditing
                    ? "absolute overflow-y-auto flex flex-col"
                    : (draggedNodeId !== node.id ? "transition-all duration-150" : "") + (isSelected ? "" : " overflow-hidden") + " cursor-grab active:cursor-grabbing"
                } ${
                  isEditing
                    ? "ring-4 ring-indigo-500/20"
                    : isSelected
                      ? "selected"
                      : ""
                }`}
                style={isEditing ? {
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "100%",
                  maxWidth: "650px",
                  height: "calc(100% - 32px)",
                } : {
                  transform: `translate(${node.position.x * zoom + pan.x + (dragGroupRef.current.some(g => g.id === node.id) ? dragDelta.current.x * zoom : 0)}px, ${
                    node.position.y * zoom + pan.y + (dragGroupRef.current.some(g => g.id === node.id) ? dragDelta.current.y * zoom : 0)
                  }px) scale(${zoom * (isSelected ? 1.08 : 1)})`,
                  transformOrigin: "top left",
                }}
                id={`canvas-node-${node.id}`}
              >
                <div className="glass-titlebar">
                  {editingTitleNodeId === node.id || isEditing ? (
                    <input
                      type="text"
                      value={node.title}
                      onChange={(e) => onUpdateProject({ ...project, nodes: { ...project.nodes, [node.id]: { ...node, title: e.target.value } }, lastModified: Date.now() })}
                      onBlur={() => setEditingTitleNodeId(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingTitleNodeId(null); if (e.key === "Escape") { setEditingTitleNodeId(null); if (isEditing) setEditingNodeId(null); } }}
                      className="bg-transparent text-xs font-semibold text-white/90 w-full focus:outline-none"
                      autoFocus={!isEditing}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3
                      className="text-xs font-semibold text-white/90 truncate font-sans cursor-text flex-1"
                      title={node.title}
                      onDoubleClick={() => setEditingTitleNodeId(node.id)}
                    >
                      {node.title}
                    </h3>
                  )}
                  <div className="window-controls-group">
                    {!isStart && (
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleSetStartNode(node.id, e)}
                        className="ctrl-btn star"
                        title="Set as Story Entrypoint"
                      >
                        <Star />
                      </button>
                    )}
                    {!isStart && <div className="window-controls-divider" />}
                    <div ref={nodeConfirmRef}>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleDeleteNode(node.id, e)}
                        className={`ctrl-btn trash ${nodeConfirmId === node.id ? "!bg-[rgba(232,17,35,0.7)] !text-white !w-auto !px-2" : ""}`}
                        title={nodeConfirmId === node.id ? "Click again to confirm deletion" : "Delete scene node"}
                      >
                        {nodeConfirmId === node.id ? (
                          <span className="text-[9px] font-bold">Confirm?</span>
                        ) : (
                          <Trash2 />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-body p-3">

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

                  {/* Editor — shows in focus mode (inline expansion removed) */}
                  {isEditing && (
                    <div className="border-t border-slate-700/50 mt-2 pt-2 space-y-2 flex-1 flex flex-col overflow-y-auto">
                      <BlockEditor
                        project={project}
                        blocks={editorBlocks}
                        onChange={handleEditorBlocksChange}
                        onCreateNode={handleCreateNodeFromBlock}
                        onCreateNodeWithTitle={handleCreateNodeWithTitle}
                      />
                    </div>
                  )}
                </div>

                {/* Choice count ribbon */}
                {node.choices.length > 0 && (
                  <div className="bg-indigo-500/15 text-indigo-300 text-[9px] font-bold py-0.5 px-3 uppercase text-center tracking-wider font-mono border-t border-indigo-500/10">
                    {node.choices.length} Choice{node.choices.length > 1 ? "s" : ""} →
                  </div>
                )}
                {/* Ribbon badges — bottom of card */}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Toolbar controls */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 glass-card p-2 rounded-xl">
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
