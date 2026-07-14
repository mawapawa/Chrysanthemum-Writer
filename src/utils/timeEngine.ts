import { CustomTimeConfig, TimeContext } from "../types";

export function defaultTimeConfig(): CustomTimeConfig {
  return {
    segments: [
      { name: "Morning", ticks: 4 },
      { name: "Afternoon", ticks: 4 },
      { name: "Evening", ticks: 3 },
      { name: "Night", ticks: 3 },
    ],
    daysOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    months: [
      { name: "January", days: 31 },
      { name: "February", days: 28 },
      { name: "March", days: 31 },
      { name: "April", days: 30 },
      { name: "May", days: 31 },
      { name: "June", days: 30 },
      { name: "July", days: 31 },
      { name: "August", days: 31 },
      { name: "September", days: 30 },
      { name: "October", days: 31 },
      { name: "November", days: 30 },
      { name: "December", days: 31 },
    ],
  };
}

export function ticksPerDay(config: CustomTimeConfig): number {
  return config.segments.reduce((sum, s) => sum + s.ticks, 0);
}

export function ticksToTime(globalTicks: number, config: CustomTimeConfig): TimeContext {
  const tpd = ticksPerDay(config);
  const tick = globalTicks % tpd;
  const totalDays = Math.floor(globalTicks / tpd);
  const dayOfWeekIndex = totalDays % config.daysOfWeek.length;
  const dayOfWeek = config.daysOfWeek[dayOfWeekIndex];

  // Walk months to find dayOfMonth, month, year
  let remainingDays = totalDays;
  let year = 0;
  for (let y = 0; ; y++) {
    let yearDays = 0;
    for (const m of config.months) yearDays += m.days;
    if (remainingDays < yearDays) { year = y; break; }
    remainingDays -= yearDays;
  }
  let dayOfMonth = 0;
  let month = config.months[0]?.name || "January";
  for (const m of config.months) {
    if (remainingDays < m.days) { dayOfMonth = remainingDays + 1; month = m.name; break; }
    remainingDays -= m.days;
  }
  if (dayOfMonth === 0) { dayOfMonth = 1; month = config.months[config.months.length - 1]?.name || month; }

  // Find segment
  let segment = config.segments[0]?.name || "Day";
  let accumulated = 0;
  for (const s of config.segments) {
    if (tick < accumulated + s.ticks) { segment = s.name; break; }
    accumulated += s.ticks;
  }

  return { tick, segment, dayOfWeek, dayOfMonth, month, year };
}

export function dateToTicks(monthName: string, day: number, config: CustomTimeConfig): number {
  const tpd = ticksPerDay(config);
  const monthIdx = config.months.findIndex(m => m.name.toLowerCase() === monthName.toLowerCase());
  if (monthIdx < 0) return 0;
  let totalDays = 0;
  for (let i = 0; i < monthIdx; i++) totalDays += config.months[i].days;
  totalDays += Math.min(day, config.months[monthIdx].days) - 1;
  return totalDays * tpd;
}

export function timeToString(tc: TimeContext): string {
  return `${tc.segment}, ${tc.dayOfWeek} ${tc.month} ${tc.dayOfMonth}, Year ${tc.year + 1} (Tick ${tc.tick})`;
}