import { X, LogOut, RefreshCw, Cloud, AlertTriangle } from "lucide-react";
import { useDriveSync } from "../hooks/useDriveSync";
import { AuthUser } from "../services/auth";
import { VNProject } from "../types";

interface SettingsDialogProps {
  project: VNProject | null;
  onClose: () => void;
  user: AuthUser | null;
  signIn: () => Promise<AuthUser>;
  signOut: () => Promise<void>;
  onOpenTutorial?: () => void;
  onExportProject?: () => void;
}

export default function SettingsDialog({ project, onClose, user, signIn, signOut, onOpenTutorial, onExportProject }: SettingsDialogProps) {
  const { status, syncNow } = useDriveSync(project);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
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
                <p className="text-xs text-slate-400">
                  Signed in as:
                </p>
                <p className="text-sm font-semibold text-slate-200">{user.name}</p>
                {user.email && (
                  <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                )}
                <button
                  onClick={signOut}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <p className="text-xs text-slate-500">Not signed in</p>
                <button
                  onClick={async () => {
                    try {
                      await signIn();
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err);
                      if (msg.includes("Redirecting to Google")) return;
                      console.error("[AUTH] Sign-in failed:", msg);
                      alert(`Google sign-in failed: ${msg}`);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status === "idle" && <Cloud className="w-4 h-4 text-emerald-400" />}
                {status === "saving" && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
                {status === "syncing" && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                {status === "error" && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                <span className="text-xs text-slate-300 font-medium capitalize">{status}</span>
              </div>
              <button
                onClick={syncNow}
                disabled={status === "saving" || status === "syncing"}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3 h-3" />
                Sync Now
              </button>
            </div>
          </div>
        </div>

        {/* Export */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Export</h3>
          <div className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs text-slate-300">Download project as JSON file</p>
            <button onClick={() => { onExportProject?.(); onClose(); }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer">
              Download
            </button>
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
