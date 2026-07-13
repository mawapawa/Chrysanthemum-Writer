import { useState, useEffect } from "react";
import { X, LogOut, RefreshCw, Cloud, AlertTriangle, FolderOpen, Link } from "lucide-react";
import { useDriveSync } from "../hooks/useDriveSync";
import { AuthUser } from "../services/auth";
import { VNProject } from "../types";
import { listUserFolders, driveFolderUrl, parseFolderIdFromUrl, setLinkedDriveMeta, clearLinkedDriveMeta } from "../services/drive";

interface SettingsDialogProps {
  project: VNProject | null;
  onUpdateProject: (project: VNProject) => void;
  onClose: () => void;
  user: AuthUser | null;
  signIn: () => Promise<AuthUser>;
  signOut: () => Promise<void>;
  onOpenTutorial?: () => void;
  onExportFolder?: (sceneId?: string) => void;
  onLoadFromDrive?: () => Promise<void>;
  syncNow?: () => Promise<string | null>;
}

type PickerMode = null | "browse" | "paste";

export default function SettingsDialog({ project, onUpdateProject, onClose, user, signIn, signOut, onOpenTutorial, onExportFolder, onLoadFromDrive, syncNow: propSyncNow }: SettingsDialogProps) {
  const { status, syncNow: hookSyncNow } = useDriveSync(project);
  const syncNow = propSyncNow || hookSyncNow;
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [pasteLink, setPasteLink] = useState("");
  const [exportMode, setExportMode] = useState(false);

  useEffect(() => {
    if (pickerMode === "browse") {
      setLoadingFolders(true);
      listUserFolders().then(setFolders).finally(() => setLoadingFolders(false));
    }
  }, [pickerMode]);

  const handleSelectFolder = (folderId: string) => {
    if (project) {
      onUpdateProject({ ...project, driveFolderId: folderId, lastModified: Date.now() });
      setLinkedDriveMeta({ folderId });
    }
    setPickerMode(null);
  };

  const handlePasteLink = () => {
    const id = parseFolderIdFromUrl(pasteLink);
    if (id) {
      handleSelectFolder(id);
    }
    setPasteLink("");
  };

  const handleUnlink = () => {
    if (project) {
      onUpdateProject({ ...project, driveFolderId: undefined, driveFileId: undefined, lastModified: Date.now() });
      clearLinkedDriveMeta();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xl">
      <div className="glass-card p-6 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Settings</h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google Account */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Google Account</h3>
          <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
            {user ? (
              <>
                <p className="text-xs text-slate-400">Signed in as:</p>
                <p className="text-sm font-semibold text-slate-200">{user.name}</p>
                {user.email && (
                  <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                )}
                <button onClick={signOut}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer">
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <p className="text-xs text-slate-500">Not signed in</p>
                <button onClick={async () => {
                    try { await signIn(); }
                    catch (err) {
                      const msg = err instanceof Error ? err.message : String(err);
                      if (msg.includes("Redirecting to Google")) return;
                      console.error("[AUTH] Sign-in failed:", msg);
                      alert(`Google sign-in failed: ${msg}`);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Google Drive */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Google Drive</h3>
          <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
            {project?.driveFolderId ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-xs text-slate-300 truncate font-mono" title={driveFolderUrl(project.driveFolderId)}>
                      {driveFolderUrl(project.driveFolderId)}
                    </span>
                  </div>
                  <button onClick={handleUnlink}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer shrink-0">
                    Unlink
                  </button>
                </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      {status === "idle" && <Cloud className="w-4 h-4 text-emerald-400" />}
                      {status === "syncing" && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                      {status === "error" && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      <span className="text-xs text-slate-300 font-medium capitalize">{status}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={syncNow} disabled={status === "syncing"}
                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
                        <RefreshCw className="w-3 h-3" />
                        Sync Up
                      </button>
                      <button onClick={onLoadFromDrive} disabled={status === "syncing"}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
                        <RefreshCw className="w-3 h-3" />
                        Load from Drive
                      </button>
                    </div>
                  </div>
              </>
            ) : pickerMode ? (
              <div className="space-y-3">
                {pickerMode === "browse" && (
                  <div>
                    {loadingFolders ? (
                      <p className="text-xs text-slate-500 text-center py-4">Loading folders...</p>
                    ) : folders.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No folders found. Create one in Google Drive first.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {folders.map(f => (
                          <button key={f.id} onClick={() => handleSelectFolder(f.id)}
                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer truncate">
                            <FolderOpen className="w-3.5 h-3.5 inline mr-2 text-indigo-400" />
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setPickerMode(null)}
                      className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer">
                      Cancel
                    </button>
                  </div>
                )}
                {pickerMode === "paste" && (
                  <div className="space-y-2">
                    <input type="text" value={pasteLink} onChange={e => setPasteLink(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="w-full bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                      onKeyDown={e => { if (e.key === "Enter") handlePasteLink(); if (e.key === "Escape") setPickerMode(null); }} />
                    <div className="flex gap-2">
                      <button onClick={handlePasteLink} disabled={!parseFolderIdFromUrl(pasteLink)}
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
                        Link Folder
                      </button>
                      <button onClick={() => setPickerMode(null)}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {!user && (
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <p className="text-[10px] text-amber-300">Sign in with Google above first to enable Drive sync.</p>
                  </div>
                )}
                <p className="text-xs text-slate-500">No Drive folder linked. Project saves locally only.</p>
                <div className="flex gap-2">
                  <button onClick={() => setPickerMode("browse")}
                    disabled={!user}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Browse Folders
                  </button>
                  <button onClick={() => setPickerMode("paste")}
                    disabled={!user}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 disabled:text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
                    <Link className="w-3.5 h-3.5" />
                    Paste Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Export</h3>
          <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
            {!exportMode ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">Download a scene folder or the full project</p>
                <button onClick={() => setExportMode(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer">
                  Choose Folder...
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-semibold mb-2">Select folder to export:</p>
                <button onClick={() => { onExportFolder?.(undefined); setExportMode(false); onClose(); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600/20 rounded-lg transition-colors cursor-pointer border border-slate-700 hover:border-indigo-500/50">
                  📦 Entire Project
                </button>
                {(project.scenes || []).map(scene => (
                  <button key={scene.id} onClick={() => { onExportFolder?.(scene.id); setExportMode(false); onClose(); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600/20 rounded-lg transition-colors cursor-pointer border border-slate-700 hover:border-indigo-500/50">
                    📂 {scene.name}
                  </button>
                ))}
                <button onClick={() => setExportMode(false)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer pt-1">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Help */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Help</h3>
          <div className="bg-slate-800/50 rounded-xl p-3">
            <button onClick={() => { onClose(); onOpenTutorial?.(); }}
              className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl cursor-pointer">
              📚 View Tutorial
            </button>
          </div>
        </div>

        {/* About */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">About</h3>
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-sm font-bold text-slate-200">Chrysanthemum</p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Version 0.2.0</p>
            <p className="text-xs text-slate-500 font-mono">Built with Tauri + React</p>
          </div>
        </div>
      </div>
    </div>
  );
}
