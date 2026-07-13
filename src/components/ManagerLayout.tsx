import type { ComponentType, ReactNode } from "react";

interface ManagerLayoutProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  form: ReactNode;
  listTitle: string;
  children: ReactNode;
}

export function ManagerLayout({ icon: Icon, title, description, form, listTitle, children }: ManagerLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full overflow-y-auto">
      <div className="lg:col-span-1 glass-card p-6 h-fit">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">{description}</p>
        {form}
      </div>
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">{listTitle}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
