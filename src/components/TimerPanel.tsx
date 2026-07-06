import React from "react";
import { VNProject } from "../types";

interface TimerPanelProps {
  project: VNProject;
  onUpdateProject: (project: VNProject) => void;
}

export default function TimerPanel({ project, onUpdateProject }: TimerPanelProps) {
  const hasHourTracker = project.trackers.some(t => t.name === "hour");
  const hasDayTracker = project.trackers.some(t => t.name === "day");

  const ensureTrackers = () => {
    const updated = { ...project };
    if (!hasHourTracker) {
      updated.trackers = [...updated.trackers, {
        id: crypto.randomUUID(), name: "hour", defaultValue: 8, displayId: "TRK-hour",
        description: "Current hour (0-23). Advances with each action.",
      }];
    }
    if (!hasDayTracker) {
      updated.trackers = [...updated.trackers, {
        id: crypto.randomUUID(), name: "day", defaultValue: 1, displayId: "TRK-day",
        description: "Current day number. Advances when hour resets.",
      }];
    }
    updated.lastModified = Date.now();
    onUpdateProject(updated);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">⏰</span>
          <h2 className="text-lg font-semibold text-gray-900">Day/Night Timer</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Enable a day/night cycle. Each action (choice) advances the hour by 1.
          When hour reaches 24, it resets to 0 and the day advances by 1.
          Location cards can check the hour to determine if they're open.
        </p>

        {!hasHourTracker || !hasDayTracker ? (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-4">
            <p className="text-xs text-amber-700 mb-2">The timer needs two trackers to function:</p>
            <ul className="text-xs text-amber-600 space-y-1 mb-3">
              <li>• <strong>hour</strong> — tracks the current time of day</li>
              <li>• <strong>day</strong> — tracks the current day number</li>
            </ul>
            <button onClick={ensureTrackers}
              className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer">
              Create Timer Trackers
            </button>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="text-xs text-emerald-700 font-semibold">✅ Timer trackers active</p>
            <p className="text-[10px] text-emerald-500 mt-1">
              "hour" and "day" trackers exist. Each action in playtest will advance the hour.
              Location cards with open times will check these values.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
