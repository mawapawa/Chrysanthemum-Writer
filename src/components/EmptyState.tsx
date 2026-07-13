import type { ComponentType } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  text: string;
  subtext: string;
}

export function EmptyState({ icon: Icon, text, subtext }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-800 rounded-xl">
      <Icon className="w-10 h-10 text-slate-600 mb-3" />
      <p className="text-sm font-medium text-slate-400">{text}</p>
      <p className="text-xs text-slate-500 mt-1 text-center">{subtext}</p>
    </div>
  );
}
