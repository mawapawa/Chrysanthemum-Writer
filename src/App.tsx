import React, { useState, useEffect, useCallback } from "react";
import { VNProject, StoryNode } from "./types";
import { generateDisplayId } from "./utils/displayIds";
import FlowchartCanvas from "./components/FlowchartCanvas";
import NodeEditor from "./components/NodeEditor";
import PlaytestSimulator from "./components/PlaytestSimulator";
import SyncIndicator from "./components/SyncIndicator";
import BackupDialog from "./components/BackupDialog";
import SettingsDialog from "./components/SettingsDialog";
import SceneDirectory from "./components/SceneDirectory";
import TrackersManager from "./components/TrackersManager";
import FlagsManager from "./components/FlagsManager";
import ItemsManager from "./components/ItemsManager";
import EntitiesManager from "./components/EntitiesManager";
import { migrateProject } from "./utils/schemaMigration";
import {
  Sliders, Flag, Package, Users, Download,
  RefreshCw, Layers, Plus, BookOpen, History, Settings, Pencil
} from "lucide-react";
import { useDriveSync } from "./hooks/useDriveSync";
import { useAuth } from "./hooks/useAuth";
import { tryHandleOAuthRedirect } from "./services/auth";

const DEFAULT_PROJECT: VNProject = {
  id: "ravenwood-manor-tracker",
  schemaVersion: 2,
  name: "Mystery of Ravenwood Manor",
  description: "A dark gothic branching visual novel where choices determine trust levels and survival.",
  startNodeId: "node-start",
  lastModified: Date.now(),
  entities: [
    { id: "char-astrid", name: "Astrid", color: "#f43f5e", displayId: "ENT-001", description: "Your courageous childhood friend with a hidden medallion." },
    { id: "char-jack", name: "Jack", color: "#0ea5e9", displayId: "ENT-002", description: "The cautious treasure hunter carrying the faded map." },
  ],
  trackers: [
    { id: "trk-courage", name: "courage", defaultValue: 10, displayId: "TRK-001", description: "Unlocks bolder, risky story options." },
    { id: "trk-affection", name: "affection_astrid", defaultValue: 0, displayId: "TRK-002", description: "Friendship with Astrid." },
  ],
  flags: [
    { id: "flg-key", name: "has_old_key", defaultValue: false, displayId: "FLG-001", description: "Unlocks the locked Grand Foyer." },
    { id: "flg-specter", name: "encountered_specter", defaultValue: false, displayId: "FLG-002", description: "Tracks if the ghost was witnessed." },
  ],
  inventory: [],
  nodes: {
    "node-start": {
      id: "node-start",
      title: "Manor Front Gates",
      description: "Astrid and Jack stand in the pouring rain looking up at the towering Ravenwood Gates.",
      speaker: "Narrator",
      dialogueLines: [
        { id: "line-1", speaker: "Narrator", text: "[The rain drums heavily against the rusty, wrought-iron gates of Ravenwood Manor.]", expression: "Neutral" },
        { id: "line-2", speaker: "Astrid", text: "Are you sure we should do this? It's completely abandoned...", expression: "Surprise" },
        { id: "line-3", speaker: "Jack", text: "Don't back out now, Astrid.", expression: "Neutral" }
      ],
      choices: [
        { id: "choice-1", text: "Search the dusty gardener's shed", targetNodeId: "node-shed" },
        { id: "choice-2", text: "Climb through the broken cellar window", targetNodeId: "node-cellar-climb", condition: { variableName: "courage", operator: ">=", value: 12 } }
      ],
      statChanges: [{ variableName: "courage", operation: "+", value: 5 }],
      position: { x: 100, y: 150 },
      isEnding: false
    },
    "node-shed": {
      id: "node-shed",
      title: "Dusty Gardener Shed",
      description: "You search through old spades and rusty chains.",
      speaker: "Narrator",
      dialogueLines: [
        { id: "line-s1", speaker: "Narrator", text: "[Spiders scramble away as you slide open the creaky wooden drawer.]", expression: "Neutral" },
        { id: "line-s2", speaker: "Astrid", text: "Jack! Look under that old spade. There's a bronze skeleton key!", expression: "Smile" }
      ],
      choices: [{ id: "choice-s1", text: "Return to Gates and Unlock Foyer", targetNodeId: "node-hallway" }],
      statChanges: [{ variableName: "has_old_key", operation: "=", value: true }],
      position: { x: 420, y: 80 },
      isEnding: false
    },
    "node-cellar-climb": {
      id: "node-cellar-climb",
      title: "Shattered Cellar Window",
      description: "Using your agility, you leap over the broken glass.",
      speaker: "Narrator",
      dialogueLines: [
        { id: "line-c1", speaker: "Narrator", text: "[You scale the mossy brickwork and land with a splash inside a dark basement vault.]", expression: "Neutral" },
        { id: "line-c2", speaker: "Jack", text: "Phew, that was close!", expression: "Smile" }
      ],
      choices: [{ id: "choice-c1", text: "Head upstairs to the Grand Hallway", targetNodeId: "node-hallway" }],
      statChanges: [{ variableName: "courage", operation: "+", value: 10 }, { variableName: "affection_astrid", operation: "+", value: 5 }],
      position: { x: 420, y: 340 },
      isEnding: false
    },
    "node-hallway": {
      id: "node-hallway",
      title: "Grand Manor Foyer",
      description: "You gather inside the silent, dust-laden hallway.",
      speaker: "Narrator",
      dialogueLines: [
        { id: "line-h1", speaker: "Narrator", text: "[The temperature drops instantly.]", expression: "Neutral" },
        { id: "line-h2", speaker: "Astrid", text: "Jack! Behind the grandfather clock! What is that light...?", expression: "Serious" }
      ],
      choices: [
        { id: "choice-h1", text: "Step forward to shield Astrid", targetNodeId: "node-good-end" },
        { id: "choice-h2", text: "Panic and bolt back outside", targetNodeId: "node-bad-end" }
      ],
      statChanges: [{ variableName: "encountered_specter", operation: "=", value: true }],
      position: { x: 740, y: 220 },
      isEnding: false
    },
    "node-good-end": {
      id: "node-good-end",
      title: "Heroic Sanctuary",
      description: "You step bravely before Astrid.",
      speaker: "Astrid",
      dialogueLines: [
        { id: "line-g1", speaker: "Astrid", text: "Jack... you stood up for me! Thank you!", expression: "Smile" }
      ],
      choices: [],
      statChanges: [{ variableName: "affection_astrid", operation: "+", value: 20 }],
      position: { x: 1060, y: 120 },
      isEnding: true,
      endingType: "GOOD",
      endingName: "True Manor Protectors"
    },
    "node-bad-end": {
      id: "node-bad-end",
      title: "Lost in Terror",
      description: "Fleeing in panic, you leave Astrid behind.",
      speaker: "Narrator",
      dialogueLines: [
        { id: "line-b1", speaker: "Narrator", text: "[The wind howls as you stumble out onto the muddy lawns.]", expression: "Neutral" }
      ],
      choices: [],
      statChanges: [{ variableName: "courage", operation: "-", value: 5 }],
      position: { x: 1060, y: 320 },
      isEnding: true,
      endingType: "BAD",
      endingName: "Locked Out Forever"
    }
  }
};

export default function App() {
  const [project, setProject] = useState<VNProject>(() => {
    const saved = localStorage.getItem("storyweaver_vn_project");
    if (!saved) return DEFAULT_PROJECT;
    try {
      return migrateProject(JSON.parse(saved));
    } catch {
      return DEFAULT_PROJECT;
    }
  });

  const [activeTab, setActiveTab] = useState<"storyboard" | "trackers" | "flags" | "items" | "entities">("storyboard");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("node-start");
  const [playtestStartId, setPlaytestStartId] = useState<string | null>(null);
  const [hiddenFolderIds, setHiddenFolderIds] = useState<string[]>([]);
  const [centerNodeTrigger, setCenterNodeTrigger] = useState<{ id: string; timestamp: number } | null>(null);

  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  const { user, signIn, signOut } = useAuth();

  useEffect(() => { tryHandleOAuthRedirect(); }, []);

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("[GLOBAL UNHANDLED PROMISE]", event.reason);
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  const handleFileId = useCallback((fileId: string) => {
    setProject(prev => ({ ...prev, driveFileId: fileId }));
  }, []);

  const { status: syncStatus, syncNow } = useDriveSync(project, handleFileId);

  const [allProjects, setAllProjects] = useState<VNProject[]>(() => {
    const savedList = localStorage.getItem("storyweaver_all_projects");
    if (savedList) {
      try {
        return JSON.parse(savedList).map(migrateProject);
      } catch {
        return [project];
      }
    }
    return [project];
  });

  useEffect(() => {
    setAllProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === project.id);
      let updated;
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = project;
      } else {
        updated = [...prev, project];
      }
      localStorage.setItem("storyweaver_all_projects", JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem("storyweaver_vn_project", JSON.stringify(project));
  }, [project]);

  const handleUpdateProject = (updatedProject: VNProject) => {
    setProject(updatedProject);
  };

  const handleCreateNewProject = (type: "blank" | "template") => {
    const name = prompt("Enter the name of your new Visual Novel project:");
    if (!name || !name.trim()) return;

    const newProj: VNProject = {
      id: crypto.randomUUID(),
      schemaVersion: 2,
      name: name.trim(),
      description: type === "blank"
        ? "A newly created blank visual novel story canvas."
        : "A branching visual novel mystery template.",
      startNodeId: "node-start",
      lastModified: Date.now(),
      entities: type === "blank" ? [] : [
        { id: "char-1", name: "Astrid", color: "#818cf8", displayId: "ENT-001", description: "Companion and enigmatic ally." }
      ],
      trackers: type === "blank" ? [] : [
        { id: crypto.randomUUID(), name: "courage", defaultValue: 10, displayId: "TRK-001", description: "Unlocks bolder options." },
        { id: crypto.randomUUID(), name: "affection", defaultValue: 0, displayId: "TRK-002", description: "Relationship affinity tracker." }
      ],
      flags: [],
      inventory: [],
      scenes: [],
      nodes: {
        "node-start": {
          id: "node-start",
          title: "The Beginning",
          description: type === "blank"
            ? "Your story starts here."
            : "A chilling draft sweep across the grand parlor.",
          speaker: "Narrator",
          dialogueLines: type === "blank" ? [] : [
            { id: "line-1", speaker: "Narrator", text: "You have arrived. The story has yet to unfold." }
          ],
          choices: [],
          statChanges: [],
          position: { x: 300, y: 150 },
          isEnding: false,
        }
      }
    };

    setProject(newProj);
    setSelectedNodeId("node-start");
    setIsProjectsModalOpen(false);
  };

  const handleDeleteProject = (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (allProjects.length <= 1) {
      alert("You must keep at least one project!");
      return;
    }
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;
    const remaining = allProjects.filter((p) => p.id !== projId);
    setAllProjects(remaining);
    localStorage.setItem("storyweaver_all_projects", JSON.stringify(remaining));
    if (project.id === projId) {
      setProject(remaining[0]);
      setSelectedNodeId(remaining[0].startNodeId);
    }
  };

  const handleSelectProject = (proj: VNProject) => {
    setProject(proj);
    setSelectedNodeId(proj.startNodeId);
    setIsProjectsModalOpen(false);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${project.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_storyboard.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.nodes) {
          setProject(migrateProject(parsed));
          setSelectedNodeId(parsed.startNodeId || Object.keys(parsed.nodes)[0] || null);
          alert("Blueprint imported successfully!");
        } else {
          alert("Invalid file format.");
        }
      } catch {
        alert("Error parsing JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleResetProject = () => {
    if (confirm("Reset to default template?")) {
      setProject(DEFAULT_PROJECT);
      setSelectedNodeId("node-start");
      setActiveTab("storyboard");
    }
  };

  const handleAddBlankNode = () => {
    const newId = crypto.randomUUID();
    const newNode: StoryNode = {
      id: newId,
      displayId: generateDisplayId("SCN"),
      title: "New Scene Point",
      description: "Brief plot summary...",
      speaker: "Narrator",
      dialogueLines: [],
      choices: [],
      statChanges: [],
      position: { x: 200, y: 250 },
      isEnding: false,
    };
    setProject({
      ...project,
      nodes: { ...project.nodes, [newId]: newNode },
      lastModified: Date.now(),
    });
    setSelectedNodeId(newId);
    setActiveTab("storyboard");
  };

  if (playtestStartId) {
    return (
      <PlaytestSimulator
        project={project}
        startNodeId={playtestStartId}
        onExit={() => setPlaytestStartId(null)}
        onUpdateProject={handleUpdateProject}
      />
    );
  }

  const trackerCount = project.trackers.length;
  const flagCount = project.flags.length;
  const itemCount = project.inventory.length;
  const entityCount = project.entities.length;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-800" id="app-root-container">
      <header className="bg-slate-900 text-white shrink-0 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl z-20">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsProjectsModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors shrink-0"
            title="Manage Visual Novel Projects (All Projects)"
          >
            <img src="/favicon.png" className="w-6 h-6" alt="Chrysanthemum" />
          </button>
          <div className="truncate flex-1">
            <div className="flex items-center gap-2">
              {editingName ? (
                <input
                  type="text"
                  defaultValue={project.name}
                  autoFocus
                  onBlur={(e) => { setProject({ ...project, name: e.target.value || project.name }); setEditingName(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setProject({ ...project, name: (e.target as HTMLInputElement).value || project.name }); setEditingName(false); }
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="bg-transparent border-b border-indigo-500 font-bold text-base text-white focus:outline-none focus:ring-0 px-1 py-0.5 max-w-[240px]"
                />
              ) : (
                <button onClick={() => setEditingName(true)} className="group flex items-center gap-1.5 font-bold text-base text-white truncate max-w-[240px] cursor-text">
                  <span className="truncate">{project.name}</span>
                  <Pencil className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 shrink-0 transition-colors" />
                </button>
              )}
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded border border-indigo-500/25 uppercase cursor-pointer" onClick={() => setIsProjectsModalOpen(true)}>VN Project</span>
            </div>
            {editingDescription ? (
              <input
                defaultValue={project.description}
                autoFocus
                onBlur={(e) => { setProject({ ...project, description: e.target.value || project.description }); setEditingDescription(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { setProject({ ...project, description: (e.target as HTMLInputElement).value || project.description }); setEditingDescription(false); }
                  if (e.key === "Escape") setEditingDescription(false);
                }}
                className="bg-transparent border-b border-indigo-500 text-xs text-slate-300 focus:outline-none focus:ring-0 px-1 py-0.5 w-full max-w-[320px] mt-0.5"
              />
            ) : (
              <button onClick={() => setEditingDescription(true)} className="group flex items-center gap-1 text-xs text-slate-400 truncate max-w-[320px] mt-0.5 cursor-text">
                <span className="truncate italic">{project.description}</span>
                <Pencil className="w-2.5 h-2.5 text-slate-600 group-hover:text-indigo-400 shrink-0 transition-colors" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
          <button onClick={handleExportJSON} className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs px-3 py-2 rounded-xl transition-all border border-slate-700 hover:border-slate-600 flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export Blueprint
          </button>
          <SyncIndicator status={syncStatus} onSyncNow={syncNow} />
          {project.driveFolderId && (
            <button onClick={() => setBackupDialogOpen(true)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 rounded-xl transition-all border border-slate-700 cursor-pointer">
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleResetProject} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-xl transition-all border border-slate-700 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 rounded-xl transition-all border border-slate-700 cursor-pointer">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-gray-150 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab("storyboard")} className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "storyboard" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}>
            <Layers className="w-4 h-4 text-indigo-500" /> Storyboard
          </button>
          <button onClick={() => setActiveTab("trackers")} className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "trackers" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}>
            <Sliders className="w-4 h-4 text-emerald-500" /> Trackers ({trackerCount})
          </button>
          <button onClick={() => setActiveTab("flags")} className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "flags" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}>
            <Flag className="w-4 h-4 text-amber-500" /> Flags ({flagCount})
          </button>
          <button onClick={() => setActiveTab("items")} className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "items" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}>
            <Package className="w-4 h-4 text-purple-500" /> Items ({itemCount})
          </button>
          <button onClick={() => setActiveTab("entities")} className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "entities" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}>
            <Users className="w-4 h-4 text-indigo-500" /> Entities ({entityCount})
          </button>
        </div>
        {activeTab === "storyboard" && (
          <button onClick={handleAddBlankNode} className="py-1.5 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer">
            <Plus className="w-4 h-4" /> Add Scene Point
          </button>
        )}
      </div>

      <main className="flex-1 overflow-hidden">
        {activeTab === "storyboard" && (
          <div className="h-full flex flex-row overflow-hidden">
            <SceneDirectory
              project={project}
              onUpdateProject={handleUpdateProject}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              hiddenFolderIds={hiddenFolderIds}
              onToggleFolderVisibility={(sceneId: string) => {
                setHiddenFolderIds(prev => prev.includes(sceneId) ? prev.filter(id => id !== sceneId) : [...prev, sceneId]);
              }}
              onTriggerCenterNode={(nodeId) => setCenterNodeTrigger({ id: nodeId, timestamp: Date.now() })}
            />
            <div className="flex-1 h-full relative border-r border-slate-200">
              <FlowchartCanvas
                project={project}
                onUpdateProject={handleUpdateProject}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onEnterPlaytest={(id) => setPlaytestStartId(id)}
                hiddenFolderIds={hiddenFolderIds}
                centerNodeTrigger={centerNodeTrigger}
              />
            </div>
            <div className="h-full shrink-0 bg-slate-900" style={{ width: 420 }}>
              <NodeEditor
                project={project}
                selectedNodeId={selectedNodeId || ""}
                onUpdateProject={handleUpdateProject}
                onSelectNode={setSelectedNodeId}
              />
            </div>
          </div>
        )}
        {activeTab === "trackers" && <TrackersManager project={project} onUpdateProject={handleUpdateProject} />}
        {activeTab === "flags" && <FlagsManager project={project} onUpdateProject={handleUpdateProject} />}
        {activeTab === "items" && <ItemsManager project={project} onUpdateProject={handleUpdateProject} />}
        {activeTab === "entities" && <EntitiesManager project={project} onUpdateProject={handleUpdateProject} />}
      </main>

      {isProjectsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="projects-modal-container">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider">All Projects</h3>
              </div>
              <button onClick={() => setIsProjectsModalOpen(false)} className="text-slate-500 hover:text-white text-xs font-mono cursor-pointer">Close</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {allProjects.map((proj) => (
                <div key={proj.id} onClick={() => handleSelectProject(proj)} className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${proj.id === project.id ? "bg-indigo-600/15 border-indigo-500/50 text-white" : "bg-slate-950/50 border-slate-850 hover:bg-slate-950 hover:border-slate-700 text-slate-400"}`}>
                  <div className="min-w-0 flex-1 pr-4">
                    <p className={`font-bold text-xs truncate ${proj.id === project.id ? "text-indigo-300" : "text-slate-200"}`}>{proj.name}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{proj.description}</p>
                  </div>
                  {proj.id === project.id ? (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono font-bold shrink-0">Active</span>
                  ) : (
                    <button onClick={(e) => handleDeleteProject(proj.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer transition-all">X</button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-3">
              <button onClick={() => handleCreateNewProject("blank")} className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs p-3 rounded-2xl cursor-pointer transition-colors">+ New Blank Project</button>
              <button onClick={() => handleCreateNewProject("template")} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs p-3 rounded-2xl cursor-pointer shadow-lg shadow-indigo-600/20 transition-all">+ Mystery Template</button>
            </div>
          </div>
        </div>
      )}

      {backupDialogOpen && project.driveFolderId && (
        <BackupDialog driveFolderId={project.driveFolderId} onClose={() => setBackupDialogOpen(false)} onRestore={() => setBackupDialogOpen(false)} />
      )}

      {isSettingsOpen && (
        <SettingsDialog project={project} onClose={() => setIsSettingsOpen(false)} user={user} signIn={signIn} signOut={signOut} />
      )}
    </div>
  );
}
