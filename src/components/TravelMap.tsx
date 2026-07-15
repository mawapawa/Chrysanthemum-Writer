
import { VNProject } from "../types";

interface TravelMapProps {
  project: VNProject;
  currentNodeId: string;
  onTravel: (nodeId: string) => void;
}

export default function TravelMap({ project, currentNodeId, onTravel }: TravelMapProps) {
  const locations = Object.values(project.nodes).filter(n => n.nodeType === "location" && n.locationNodeData);
  if (locations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">🗺️ Travel Map</h4>
      <div className="relative w-full aspect-[4/3] bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
        {/* Grid dots background */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle, #475569 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }} />

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {locations.map(loc => {
            if (!loc.locationNodeData) return null;
            return loc.locationNodeData.connections.map(targetId => {
              const target = project.nodes[targetId];
              if (!target || !target.locationNodeData) return null;
              return (
                <line
                  key={`${loc.id}-${targetId}`}
                  x1={`${loc.locationNodeData!.mapPosition.x}%`}
                  y1={`${loc.locationNodeData!.mapPosition.y}%`}
                  x2={`${target.locationNodeData!.mapPosition.x}%`}
                  y2={`${target.locationNodeData!.mapPosition.y}%`}
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                  strokeDasharray="4 3"
                />
              );
            });
          })}
        </svg>

        {/* Location pins */}
        {locations.map(loc => {
          const isCurrent = loc.id === currentNodeId;
          const pos = loc.locationNodeData!.mapPosition;
          return (
            <button
              key={loc.id}
              onClick={() => onTravel(loc.id)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full transition-all cursor-pointer ${
                isCurrent
                  ? "w-4 h-4 bg-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-400/20 z-10"
                  : "w-3 h-3 bg-slate-600 hover:bg-indigo-400 hover:w-3.5 hover:h-3.5 z-0"
              }`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              title={loc.title}
            />
          );
        })}
      </div>

      {/* Location names */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {locations.map(loc => (
          <button
            key={loc.id}
            onClick={() => onTravel(loc.id)}
            className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
              loc.id === currentNodeId
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            {loc.title}
          </button>
        ))}
      </div>
    </div>
  );
}