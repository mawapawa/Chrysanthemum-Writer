import type { ComponentType } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  text: string;
  subtext: string;
}

export function EmptyState({ icon: Icon, text, subtext }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-xl">
      <Icon className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-500">{text}</p>
      <p className="text-xs text-gray-400 mt-1 text-center">{subtext}</p>
    </div>
  );
}
