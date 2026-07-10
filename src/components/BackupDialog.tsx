import { X, Clock } from "lucide-react";

interface BackupDialogProps {
  driveFolderId: string;
  onClose: () => void;
}

export default function BackupDialog({ driveFolderId, onClose }: BackupDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Backup History
          </h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 text-center py-8">
          Backups are created automatically each time the project syncs to Drive.
        </p>
      </div>
    </div>
  );
}
