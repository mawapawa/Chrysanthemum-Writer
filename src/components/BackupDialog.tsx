import { useState, useEffect } from "react";
import { listBackups } from "../services/drive";
import { X, Clock, RotateCcw } from "lucide-react";

interface BackupDialogProps {
  driveFolderId: string;
  onClose: () => void;
  onRestore: (fileId: string) => void;
}

interface BackupEntry {
  id: string;
  name: string;
  modified: number;
}

export default function BackupDialog({ driveFolderId, onClose, onRestore }: BackupDialogProps) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listBackups(driveFolderId)
      .then(setBackups)
      .finally(() => setLoading(false));
  }, [driveFolderId]);

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

        {loading ? (
          <p className="text-xs text-slate-500 text-center py-8">Loading backups...</p>
        ) : backups.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No backups found.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {backups.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <div className="text-xs">
                  <p className="text-slate-300 font-medium">{b.name}</p>
                  <p className="text-slate-500 font-mono mt-0.5">
                    {new Date(b.modified).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => onRestore(b.id)}
                  className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded cursor-pointer transition-colors"
                  title="Restore this backup"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
