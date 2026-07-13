import React, { useState, useCallback, useMemo } from "react";
import { VNProject, StoryNode, VNScene } from "../types";
import { generateDisplayId } from "../utils/displayIds";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { 
  Folder, FolderPlus, ChevronRight, ChevronDown, Edit2, Trash2, 
  Plus, Search, Eye, EyeOff, CornerDownRight, Move, HelpCircle, FolderOpen
} from "lucide-react";
import {
  DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SceneDirectoryProps {
  project: VNProject;
  onUpdateProject: (project: VNProject | ((prev: VNProject) => VNProject)) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  hiddenFolderIds: string[];
  onToggleFolderVisibility: (sceneId: string) => void;
  onTriggerCenterNode: (nodeId: string) => void;
}

function SortableFolderItem({ folderId, children }: { folderId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-${folderId}`,
  });
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
      position: "relative",
      zIndex: isDragging ? 10 : undefined,
    }} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function SortableNodeItem({ nodeId, isEditMode, children }: { nodeId: string; isEditMode: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `node-${nodeId}`,
    disabled: isEditMode,
  });
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
      position: "relative",
      zIndex: isDragging ? 10 : undefined,
    }} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function SceneDirectory({
  project, onUpdateProject, selectedNodeId, onSelectNode,
  hiddenFolderIds, onToggleFolderVisibility, onTriggerCenterNode,
}: SceneDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Record<string, boolean>>({});
  const { confirmId: sceneConfirmId, requestDelete: requestSceneDelete } = useConfirmDelete();
  const [isBulkDeleteConfirming, setIsBulkDeleteConfirming] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ root: true });
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  const scenes = (project.scenes || []).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const nodes = Object.values(project.nodes);

  // Build scene tree
  const sceneChildren = useMemo(() => {
    const map: Record<string, VNScene[]> = {};
    for (const s of scenes) {
      const parent = s.parentId || "__root__";
      if (!map[parent]) map[parent] = [];
      map[parent].push(s);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }
    return map;
  }, [scenes]);

  const rootScenes = sceneChildren["__root__"] || [];

  const toggleFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderId]: prev[folderId] === undefined ? false : !prev[folderId] }));
  };

  const allDescendantFolderIds = useCallback((sceneId: string): string[] => {
    const result: string[] = [sceneId];
    const children = sceneChildren[sceneId] || [];
    for (const c of children) {
      result.push(...allDescendantFolderIds(c.id));
    }
    return result;
  }, [sceneChildren]);

  const handleCreateScene = () => {
    if (!newFolderName.trim()) return;
    const newScene: VNScene = {
      id: crypto.randomUUID(),
      name: newFolderName.trim(),
      color: "border-indigo-500",
      order: (sceneChildren[newFolderParentId || "__root__"] || []).length,
      parentId: newFolderParentId,
    };
    onUpdateProject({
      ...project,
      scenes: [...scenes, newScene],
      lastModified: Date.now(),
    });
    setNewFolderName("");
    setNewFolderParentId(undefined);
    setShowCreateFolder(false);
  };

  const handleOpenCreateFolder = (parentId?: string) => {
    setNewFolderName("");
    setNewFolderParentId(parentId);
    setShowCreateFolder(true);
  };

  const handleAddNodeToFolder = (sceneId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = crypto.randomUUID();
    const folderNodes = Object.values(project.nodes).filter(n => n.sceneId === sceneId);
    const newNode: StoryNode = {
      id: newId, displayId: generateDisplayId("SCN"), title: "New Scene Point",
      description: "Brief plot summary outlines what occurs in this branching point...",
      speaker: "Narrator", dialogueLines: [], choices: [], statChanges: [],
      position: { x: 200 + Math.random() * 50, y: 250 + Math.random() * 50 },
      isEnding: false, nodeType: "story", sceneId, order: folderNodes.length,
    };
    onUpdateProject({ ...project, nodes: { ...project.nodes, [newId]: newNode }, lastModified: Date.now() });
    onSelectNode(newId);
    onTriggerCenterNode(newId);
  };

  const handleStartRename = (scene: VNScene, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSceneId(scene.id);
    setRenameValue(scene.name);
  };

  const handleSaveRename = (sceneId: string) => {
    if (!renameValue.trim()) return;
    onUpdateProject({
      ...project,
      scenes: scenes.map(s => s.id === sceneId ? { ...s, name: renameValue.trim() } : s),
      lastModified: Date.now(),
    });
    setEditingSceneId(null);
  };

  const handleDeleteScene = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!requestSceneDelete(sceneId)) return;
    const allIds = allDescendantFolderIds(sceneId);
    const updatedNodes = { ...project.nodes };
    Object.keys(updatedNodes).forEach(k => {
      if (updatedNodes[k].sceneId && allIds.includes(updatedNodes[k].sceneId!)) {
        updatedNodes[k] = { ...updatedNodes[k], sceneId: undefined };
      }
    });
    onUpdateProject({
      ...project,
      scenes: scenes.filter(s => !allIds.includes(s.id)),
      nodes: updatedNodes,
      lastModified: Date.now(),
    });
  };

  const handleMoveNode = (nodeId: string, targetSceneId: string | undefined) => {
    onUpdateProject({
      ...project,
      nodes: { ...project.nodes, [nodeId]: { ...project.nodes[nodeId], sceneId: targetSceneId } },
      lastModified: Date.now(),
    });
  };

  const handleBulkMove = (targetSceneId: string | undefined) => {
    const checkedIds = Object.keys(selectedNodeIds).filter(id => selectedNodeIds[id]);
    if (checkedIds.length === 0) { alert("No story nodes selected to move."); return; }
    const updatedNodes = { ...project.nodes };
    checkedIds.forEach(id => { if (updatedNodes[id]) updatedNodes[id] = { ...updatedNodes[id], sceneId: targetSceneId }; });
    onUpdateProject({ ...project, nodes: updatedNodes, lastModified: Date.now() });
    setSelectedNodeIds({}); setIsEditMode(false);
  };

  const handleBulkDelete = () => {
    const checkedIds = Object.keys(selectedNodeIds).filter(id => selectedNodeIds[id]);
    if (checkedIds.length === 0) { alert("No story nodes selected to delete."); return; }
    if (!isBulkDeleteConfirming) { setIsBulkDeleteConfirming(true); setTimeout(() => setIsBulkDeleteConfirming(false), 5000); return; }
    setIsBulkDeleteConfirming(false);
    const updatedNodes = { ...project.nodes };
    checkedIds.forEach(id => { delete updatedNodes[id]; });
    let newStartNodeId = project.startNodeId;
    if (checkedIds.includes(project.startNodeId)) {
      const remainingKeys = Object.keys(updatedNodes);
      newStartNodeId = remainingKeys[0] || "";
    }
    onUpdateProject({ ...project, startNodeId: newStartNodeId, nodes: updatedNodes, lastModified: Date.now() });
    if (selectedNodeId && checkedIds.includes(selectedNodeId)) onSelectNode(newStartNodeId || null);
    setSelectedNodeIds({}); setIsEditMode(false);
  };

  const handleSelectAll = () => {
    const allVisible = filteredNodes.map(n => n.id);
    const allChecked = allVisible.every(id => selectedNodeIds[id]);
    const newSelected: Record<string, boolean> = {};
    if (!allChecked) allVisible.forEach(id => newSelected[id] = true);
    setSelectedNodeIds(newSelected);
  };

  const allVisibleFolderIds = useMemo(() => {
    const ids = new Set<string>();
    const walk = (folderIds: string[]) => {
      for (const id of folderIds) {
        ids.add(id);
        const children = sceneChildren[id] || [];
        if (children.length) walk(children.map(c => c.id));
      }
    };
    walk(rootScenes.map(s => s.id));
    return ids;
  }, [sceneChildren, rootScenes]);

  const filteredNodes = nodes.filter(n => {
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      (n.speaker && n.speaker.toLowerCase().includes(q));
  });

  const nodesByScene: Record<string, StoryNode[]> = { unassigned: [] };
  allVisibleFolderIds.forEach(id => { nodesByScene[id] = []; });
  filteredNodes.forEach(node => {
    const sId = node.sceneId && allVisibleFolderIds.has(node.sceneId) ? node.sceneId : "unassigned";
    nodesByScene[sId].push(node);
  });
  Object.keys(nodesByScene).forEach(key => {
    nodesByScene[key].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  });

  // ─── Drag & Drop ──────────────────────────────────────
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeStr = String(active.id);
    const overStr = String(over.id);

    // Folder drag
    if (activeStr.startsWith("folder-") && overStr.startsWith("folder-")) {
      const activeFolderId = activeStr.replace("folder-", "");
      const overFolderId = overStr.replace("folder-", "");
      const activeParent = scenes.find(s => s.id === activeFolderId)?.parentId || "__root__";
      const overParent = scenes.find(s => s.id === overFolderId)?.parentId || "__root__";

      // Same parent — reorder
      if (activeParent === overParent) {
        const siblings = [...(sceneChildren[activeParent] || [])];
        const oldIdx = siblings.findIndex(s => s.id === activeFolderId);
        const newIdx = siblings.findIndex(s => s.id === overFolderId);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(siblings, oldIdx, newIdx);
          const updated = reordered.map((s, i) => ({ ...s, order: i }));
          const otherScenes = scenes.filter(s => (s.parentId || "__root__") !== activeParent);
          onUpdateProject({ ...project, scenes: [...otherScenes, ...updated], lastModified: Date.now() });
        }
      } else {
        // Different parent — reparent (nest into target's parent's level)
        const folder = scenes.find(s => s.id === activeFolderId);
        if (folder) {
          const targetParent = scenes.find(s => s.id === overFolderId)?.parentId;
          const updated = scenes.map(s =>
            s.id === activeFolderId ? { ...s, parentId: targetParent, order: (sceneChildren[targetParent || "__root__"] || []).length } : s
          );
          onUpdateProject({ ...project, scenes: updated, lastModified: Date.now() });
        }
      }
      return;
    }

    // Node drag
    if (activeStr.startsWith("node-")) {
      const nodeId = activeStr.replace("node-", "");
      const node = project.nodes[nodeId];
      if (!node) return;

      // Dropped on a folder — reparent
      if (overStr.startsWith("folder-")) {
        const targetSceneId = overStr.replace("folder-", "");
        const folderNodes = filteredNodes.filter(n => n.sceneId === targetSceneId && n.id !== nodeId);
        onUpdateProject({
          ...project,
          nodes: { ...project.nodes, [nodeId]: { ...node, sceneId: targetSceneId, order: folderNodes.length } },
          lastModified: Date.now(),
        });
        return;
      }

      // Dropped on another node — reorder
      if (overStr.startsWith("node-")) {
        const overNodeId = overStr.replace("node-", "");
        const overNode = project.nodes[overNodeId];
        if (!overNode) return;
        const folderId = node.sceneId || "unassigned";
        const overFolderId = overNode.sceneId || "unassigned";

        if (folderId !== overFolderId) {
          const folderNodes = filteredNodes.filter(n => n.sceneId === overFolderId && n.id !== nodeId);
          onUpdateProject({
            ...project,
            nodes: {
              ...project.nodes,
              [nodeId]: { ...node, sceneId: overFolderId === "unassigned" ? undefined : overFolderId, order: folderNodes.length },
            },
            lastModified: Date.now(),
          });
          return;
        }

        const folderNodeIds = nodesByScene[folderId]?.map(n => n.id).filter(id => project.nodes[id]) || [];
        const oldIdx = folderNodeIds.indexOf(nodeId);
        const newIdx = folderNodeIds.indexOf(overNodeId);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reorderedIds = arrayMove(folderNodeIds, oldIdx, newIdx);
          const updatedNodes = { ...project.nodes };
          reorderedIds.forEach((id, i) => { updatedNodes[id] = { ...updatedNodes[id], order: i }; });
          onUpdateProject({ ...project, nodes: updatedNodes, lastModified: Date.now() });
        }
      }
    }
  }, [project, scenes, sceneChildren, filteredNodes, nodesByScene, onUpdateProject]);

  // ─── Render helpers ────────────────────────────────────
  const renderNodeItem = (node: StoryNode) => {
    const isSelected = selectedNodeId === node.id;
    const isChecked = !!selectedNodeIds[node.id];

    if (isEditMode) {
      return (
        <div key={node.id} onClick={() => setSelectedNodeIds(prev => ({ ...prev, [node.id]: !prev[node.id] }))}
          className={`flex items-center justify-between pl-6 pr-2 py-1.5 text-xs rounded-lg cursor-pointer transition-all ${
            isChecked ? "bg-indigo-600/20 border-l-2 border-indigo-500 text-white" : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2 truncate flex-1">
            <input type="checkbox" checked={isChecked} className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer pointer-events-none" />
            <span className="truncate">{node.title}</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono italic shrink-0">{node.choices.length} choices</span>
        </div>
      );
    }

    return (
      <SortableNodeItem key={node.id} nodeId={node.id} isEditMode={isEditMode}>
        <div onClick={() => { onSelectNode(node.id); onTriggerCenterNode(node.id); }}
          className={`group flex items-center justify-between pl-8 pr-2 py-1.5 text-xs rounded-lg cursor-pointer transition-all ${
            isSelected ? "bg-indigo-600/35 border-l-2 border-indigo-400 text-white font-medium"
              : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-1.5 truncate flex-1">
            <CornerDownRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{node.title}</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono italic shrink-0 mr-1">{node.choices.length}→</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <select value={node.sceneId || "unassigned"} onChange={e => handleMoveNode(node.id, e.target.value === "unassigned" ? undefined : e.target.value)}
              onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 text-[10px] rounded px-1 text-slate-400 max-w-[80px]">
              <option value="unassigned">Move to...</option>
              <option value="unassigned">Root Dir</option>
              {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </SortableNodeItem>
    );
  };

  const renderFolder = (scene: VNScene, depth: number = 0) => {
    const isHidden = hiddenFolderIds.includes(scene.id);
    const childScenes = sceneChildren[scene.id] || [];
    const folderNodes = nodesByScene[scene.id] || [];
    const isExpanded = expandedFolders[scene.id] !== false;
    const items = [
      ...childScenes.map(s => `folder-${s.id}`),
      ...(isEditMode ? [] : folderNodes.map(n => `node-${n.id}`)),
    ];

    return (
      <div key={scene.id} className="rounded-lg border border-transparent">
        <SortableFolderItem folderId={scene.id}>
          <div className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
            isHidden ? "text-slate-500 hover:bg-slate-900/40 hover:text-slate-300"
              : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
          }`}>
            <div className="flex items-center gap-1.5 truncate flex-1 min-w-0" onClick={(e) => toggleFolder(scene.id, e)}>
              <button className="text-slate-500 hover:text-white cursor-pointer">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              <Folder className={`w-3.5 h-3.5 shrink-0 ${isHidden ? "text-slate-600" : "text-indigo-400"}`} />
              {editingSceneId === scene.id ? (
                <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => handleSaveRename(scene.id)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveRename(scene.id); if (e.key === "Escape") setEditingSceneId(null); }}
                  autoFocus onClick={e => e.stopPropagation()}
                  className="bg-slate-950 border border-indigo-500 text-xs px-1 text-white rounded w-28 focus:outline-none" />
              ) : (
                <span className={`text-xs font-semibold truncate ${isHidden ? "text-slate-500" : "text-slate-200"}`}>{scene.name}</span>
              )}
              <span className="text-[10px] text-slate-500 font-mono">({folderNodes.length + childScenes.length})</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => handleOpenCreateFolder(scene.id)} className="p-0.5 text-slate-500 hover:text-emerald-400 rounded cursor-pointer" title="Add subfolder"><FolderPlus className="w-3 h-3" /></button>
              <button onClick={(e) => handleAddNodeToFolder(scene.id, e)} className="p-0.5 text-slate-500 hover:text-emerald-400 rounded cursor-pointer" title="Add Scene Point"><Plus className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => handleStartRename(scene, e)} className="p-0.5 text-slate-500 hover:text-white rounded cursor-pointer" title="Rename"><Edit2 className="w-3 h-3" /></button>
              <button onClick={(e) => handleDeleteScene(scene.id, e)}
                className={`p-0.5 rounded transition-all duration-150 ${sceneConfirmId === scene.id ? "text-rose-400 bg-rose-500/20 px-1.5 animate-pulse" : "text-slate-500 hover:text-rose-400"}`}
                title={sceneConfirmId === scene.id ? "Click again to confirm" : "Delete"}>
                {sceneConfirmId === scene.id ? <span className="text-[9px] font-bold">Confirm?</span> : <Trash2 className="w-3 h-3" />}
              </button>
              <button onClick={e => { e.stopPropagation(); onToggleFolderVisibility(scene.id); }}
                className="p-0.5 text-slate-500 hover:text-indigo-400 rounded cursor-pointer"
                title={isHidden ? "Show on canvas" : "Hide from canvas"}>
                {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </SortableFolderItem>

        {isExpanded && (
          <div className="space-y-0.5 mt-1 pr-1" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
            {childScenes.length === 0 && folderNodes.length === 0 ? (
              <p className="text-[10px] text-slate-600 pl-8 py-1 italic">Empty</p>
            ) : (
              <>
                {!isEditMode && childScenes.length > 0 && (
                  <SortableContext items={childScenes.map(s => `folder-${s.id}`)} strategy={verticalListSortingStrategy}>
                    {childScenes.map(s => renderFolder(s, depth + 1))}
                  </SortableContext>
                )}
                {!isEditMode ? (
                  <SortableContext items={folderNodes.map(n => `node-${n.id}`)} strategy={verticalListSortingStrategy}>
                    {folderNodes.map(n => renderNodeItem(n))}
                  </SortableContext>
                ) : (
                  <>{folderNodes.map(n => renderNodeItem(n))}</>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(180, Math.min(500, startW + (ev.clientX - startX)));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  if (!isSidebarExpanded) {
    return (
      <div className="w-12 h-full glass-card border-r border-white/10 flex flex-col items-center py-4 gap-4 shrink-0" id="collapsed-directory">
        <button onClick={() => setIsSidebarExpanded(true)} className="p-1.5 glass-button text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer" title="Expand Sidebar">
          <FolderOpen className="w-4 h-4" />
        </button>
        <div className="h-[1px] w-6 bg-slate-800" />
        <button onClick={() => handleOpenCreateFolder()} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer" title="Add New Folder">
          <FolderPlus className="w-4 h-4" />
        </button>
        <div className="flex-1" />
      </div>
    );
  }

  const renderFolderContent = () => (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      {/* ROOT DIRECTORY */}
      <div className="rounded-lg border border-transparent">
        <div className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-default text-slate-400">
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0" onClick={(e) => toggleFolder("root", e)}>
            <button className="text-slate-500 hover:text-white cursor-pointer">
              {expandedFolders["root"] !== false ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold truncate">Root Directory</span>
            <span className="text-[10px] text-slate-500 font-mono">({nodesByScene["unassigned"].length})</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => handleAddNodeToFolder(undefined, e)}
              className="p-0.5 text-slate-500 hover:text-emerald-400 rounded cursor-pointer" title="Add Scene Point">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {expandedFolders["root"] !== false && (
          <div className="space-y-0.5 mt-1 pr-1">
            {nodesByScene["unassigned"].length === 0 && rootScenes.length === 0 ? (
              <p className="text-[10px] text-slate-600 pl-8 py-1 italic">No scene nodes inside</p>
            ) : (
              <>
                {rootScenes.map(s => renderFolder(s, 0))}
                {!isEditMode ? (
                  <SortableContext items={nodesByScene["unassigned"].map(n => `node-${n.id}`)} strategy={verticalListSortingStrategy}>
                    {nodesByScene["unassigned"].map(n => renderNodeItem(n))}
                  </SortableContext>
                ) : (
                  nodesByScene["unassigned"].map(n => renderNodeItem(n))
                )}
              </>
            )}
          </div>
        )}
      </div>

      {scenes.length === 0 && (
        <div className="p-4 text-center text-slate-600 text-xs space-y-1 bg-slate-900/20 rounded-xl border border-dashed border-slate-800 mt-2">
          <HelpCircle className="w-8 h-8 mx-auto text-slate-700" />
          <p>No Scene folders created yet.</p>
          <p className="text-[10px] opacity-75">Click the Folder+ icon above to group branches into chapters or storylines!</p>
        </div>
      )}
    </DndContext>
  );

  return (
    <div className="h-full flex flex-row shrink-0 select-none" id="expanded-directory" style={{ width: sidebarWidth }}>
      <div className="flex-1 h-full glass-card border-r border-white/10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Scene Directory</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => handleOpenCreateFolder()} className="p-1 glass-button text-indigo-400 hover:text-indigo-200 rounded cursor-pointer" title="Add New Folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setIsSidebarExpanded(false)} className="p-1 glass-button text-slate-400 hover:text-white rounded transition-all cursor-pointer text-xs font-bold" title="Minimize Sidebar">Collapse</button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input type="text" placeholder="Search scene nodes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full glass-input text-xs pl-8 pr-3 py-1.5 rounded-lg font-sans" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {renderFolderContent()}
      </div>

      {/* Bottom controls */}
      <div className="p-3 border-t border-white/10 bg-black/20 space-y-2 shrink-0">
        {!isEditMode ? (
          <button onClick={() => { setIsEditMode(true); setSelectedNodeIds({}); }}
            className="w-full py-2 px-3 glass-button text-slate-300 hover:text-white font-mono font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Move className="w-3.5 h-3.5 text-indigo-400" /> Bulk Move & Delete
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-indigo-400 font-mono">{Object.values(selectedNodeIds).filter(Boolean).length} Selected</span>
              <button onClick={handleSelectAll} className="text-slate-400 hover:text-white font-bold underline font-mono cursor-pointer">
                {filteredNodes.length > 0 && filteredNodes.every(n => selectedNodeIds[n.id]) ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Move selected to:</label>
              <select onChange={e => { const v = e.target.value; if (v) handleBulkMove(v === "unassigned" ? undefined : v); }} defaultValue=""
                className="w-full glass-input text-xs rounded-lg p-1.5 cursor-pointer">
                <option value="" disabled>Select folder...</option>
                <option value="unassigned">Root Directory</option>
                {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={handleBulkDelete}
                className={`py-1.5 px-2 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                  isBulkDeleteConfirming ? "bg-rose-600 hover:bg-rose-700 border-rose-500 text-white animate-pulse"
                    : "bg-rose-600/20 hover:bg-rose-600 border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white"
                }`}>
                <Trash2 className="w-3 h-3" /> {isBulkDeleteConfirming ? "Confirm Delete?" : "Delete"}
              </button>
              <button onClick={() => { setIsEditMode(false); setSelectedNodeIds({}); }}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center cursor-pointer">Done</button>
            </div>
          </div>
        )}

        {showCreateFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl" onClick={() => setShowCreateFolder(false)}>
            <div className="glass-card p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-slate-200 mb-4">Create Folder</h3>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Folder Name</label>
              <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateScene(); if (e.key === "Escape") setShowCreateFolder(false); }}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm mb-4" placeholder="Enter folder name..." />
              {rootScenes.length > 0 && (
                <>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Parent Folder (optional)</label>
                  <select value={newFolderParentId || ""} onChange={e => setNewFolderParentId(e.target.value || undefined)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-sm mb-4 cursor-pointer">
                    <option value="">No parent (root level)</option>
                    {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreateFolder(false)} className="px-4 py-2 glass-button text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleCreateScene} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      <div
        onMouseDown={handleResizeStart}
        className="w-1.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors shrink-0"
      />
    </div>
  );
}