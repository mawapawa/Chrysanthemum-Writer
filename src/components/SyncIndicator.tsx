import { SyncStatus } from "../services/sync";
import { Cloud, RefreshCw, AlertTriangle } from "lucide-react";

interface SyncIndicatorProps {
  status: SyncStatus;
  onSyncNow: () => void;
}

const STATUS_CONFIG: Record<SyncStatus, { icon: typeof Cloud; label: string; color: string }> = {
  idle: { icon: Cloud, label: "Saved", color: "text-emerald-400" },
  saving: { icon: RefreshCw, label: "Saving...", color: "text-amber-400" },
  syncing: { icon: RefreshCw, label: "Syncing...", color: "text-blue-400" },
  error: { icon: AlertTriangle, label: "Sync error", color: "text-rose-400" },
};

export default function SyncIndicator({ status, onSyncNow }: SyncIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <button
      onClick={onSyncNow}
      disabled={status === "saving" || status === "syncing"}
      className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
      title="Click to sync now"
    >
      <Icon className={`w-3 h-3 ${config.color} ${status === "saving" || status === "syncing" ? "animate-spin" : ""}`} />
      <span>{config.label}</span>
    </button>
  );
}
