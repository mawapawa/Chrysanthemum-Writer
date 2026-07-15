import { VNProject, CustomTimeConfig } from "../types";
import { Clock } from "lucide-react";
import { defaultTimeConfig, ticksPerDay, ticksToTime, timeToString, dateToTicks } from "../utils/timeEngine";
import { ManagerLayout } from "./ManagerLayout";

interface CalendarManagerProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function CalendarManager({ project, onUpdateProject }: CalendarManagerProps) {
  const config = project.customTimeConfig || defaultTimeConfig();
  const totalTicks = project.globalTimeTicks ?? 0;
  const timeContext = ticksToTime(totalTicks, config);

  const updateConfig = (cfg: CustomTimeConfig) => {
    onUpdateProject({ ...project, customTimeConfig: cfg, lastModified: Date.now() });
  };

  const updateSegment = (i: number, field: { name?: string; ticks?: number }) => {
    const segments = [...config.segments];
    segments[i] = { ...segments[i], ...field };
    updateConfig({ ...config, segments });
  };

  const addSegment = () => {
    updateConfig({ ...config, segments: [...config.segments, { name: "Segment", ticks: 2 }] });
  };

  const removeSegment = (i: number) => {
    updateConfig({ ...config, segments: config.segments.filter((_, idx) => idx !== i) });
  };

  const updateDay = (i: number, name: string) => {
    const days = [...config.daysOfWeek];
    days[i] = name;
    updateConfig({ ...config, daysOfWeek: days });
  };

  const updateMonth = (i: number, field: { name?: string; days?: number }) => {
    const months = [...config.months];
    months[i] = { ...months[i], ...field };
    updateConfig({ ...config, months });
  };

  return (
    <ManagerLayout icon={Clock} title="Time System" listTitle="Live Time Context"
      description="Configure how time works in your world — segments, days, months."
      form={
        <div className="space-y-4">
          {/* Segments (Day Pulse) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-400">Day Segments</label>
              <button onClick={addSegment} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">+ Add</button>
            </div>
            <p className="text-[10px] text-slate-500 mb-2">Total: {ticksPerDay(config)} ticks/day</p>
            {config.segments.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50 mb-1">
                <input type="text" value={s.name} onChange={e => updateSegment(i, { name: e.target.value })}
                  className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1" placeholder="Name" />
                <input type="number" min="1" value={s.ticks} onChange={e => updateSegment(i, { ticks: parseInt(e.target.value) || 1 })}
                  className="w-14 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1 text-center" title="Ticks" />
                <button onClick={() => removeSegment(i)} className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
              </div>
            ))}
          </div>

          {/* Starting Date */}
          <div className="glass-card p-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Starting Date</h4>
            <p className="text-[10px] text-slate-500">Set the in-game date that tick 0 represents.</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Month</label>
                <select value={timeContext.month} onChange={e => {
                  const month = config.months.find(m => m.name === e.target.value);
                  const day = Math.min(1, month?.days || 31);
                  const ticks = dateToTicks(e.target.value, day, config);
                  onUpdateProject({ ...project, globalTimeTicks: ticks, lastModified: Date.now() });
                }} className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1.5 mt-0.5">
                  {config.months.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Day</label>
                <input type="number" min="1" max="31" value={timeContext.dayOfMonth}
                  onChange={e => {
                    const d = parseInt(e.target.value) || 1;
                    const ticks = dateToTicks(timeContext.month, d, config);
                    onUpdateProject({ ...project, globalTimeTicks: ticks, lastModified: Date.now() });
                  }} className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1.5 mt-0.5 text-center" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Year</label>
                <input type="number" min="0" value={timeContext.year}
                  onChange={e => {
                    const y = parseInt(e.target.value) || 0;
                    const tpd = ticksPerDay(config);
                    const yearDays = config.months.reduce((s: number, m: any) => s + m.days, 0);
                    const base = dateToTicks("January", 1, config);
                    onUpdateProject({ ...project, globalTimeTicks: base + y * yearDays * tpd, lastModified: Date.now() });
                  }} className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1.5 mt-0.5 text-center" />
              </div>
            </div>
          </div>

          {/* Days of Week */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Days of the Week</label>
            {config.daysOfWeek.map((d, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <input type="text" value={d} onChange={e => updateDay(i, e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1" />
              </div>
            ))}
          </div>

          {/* Months */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Months</label>
            {config.months.map((m, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <input type="text" value={m.name} onChange={e => updateMonth(i, { name: e.target.value })}
                  className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1" placeholder="Name" />
                <input type="number" min="1" value={m.days} onChange={e => updateMonth(i, { days: parseInt(e.target.value) || 1 })}
                  className="w-14 bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded p-1 text-center" title="Days" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-slate-200 mb-2">Current Time</h3>
          <p className="text-lg font-mono text-indigo-300">{timeToString(timeContext)}</p>
          <p className="text-[10px] text-slate-500 mt-1">Total ticks: {totalTicks}</p>
        </div>
        <p className="text-xs text-slate-500 italic">Use the /time command in the inline editor to advance or set time during playtest.</p>
      </div>
    </ManagerLayout>
  );
}