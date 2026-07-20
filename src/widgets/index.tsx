import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { Square, LayoutGrid, Type, Image, Hash, BarChart3, MousePointerClick, ListChecks, List, UserCircle, Backpack, SeparatorHorizontal, Search, CopyPlus } from "lucide-react";
import type { VNProject, VNItem, WidgetConfig, WidgetType } from "../types";

export interface WidgetRuntimeProps {
  dialogueText?: string;
  dialogueFormattedText?: string;
  dialogueSpeaker?: string;
  runtimeValues?: Record<string, number>;
  choices?: { id: string; text: string; targetNodeTitle?: string; passed: boolean }[];
  inventory?: string[];
  onButtonAction?: (action: string) => void;
  onSelectChoice?: (choiceId: string) => void;
  repeaterItemProps?: Record<string, any>;
  inspectedItemId?: string;
  onInspectItem?: (itemId: string) => void;
}

interface WidgetProps {
  project: VNProject;
  config: WidgetConfig;
  onSelectWidget?: (id: string) => void;
  runtime?: WidgetRuntimeProps;
  selectedWidgetId?: string;
}

export interface WidgetDescriptor {
  type: WidgetType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultW: number;
  defaultH: number;
  component: React.ComponentType<WidgetProps>;
}

// ── Helpers ──────────────────────────────────────────────────────
function isVarDefined(key: string, runtimeValues?: Record<string, any>): { defined: boolean; value: any } {
  if (runtimeValues && key in runtimeValues) return { defined: true, value: runtimeValues[key] };
  return { defined: false, value: undefined };
}

// Normalize comparison: handles boolean vs "1"/"0"/"true"/"false" mismatches
function valuesMatch(a: any, b: any): boolean {
  if (String(a) === String(b)) return true;
  const na = Number(a); const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na === nb) return true;
  if (typeof a === "boolean" && (b === "true" || b === "1") && a) return true;
  if (typeof a === "boolean" && (b === "false" || b === "0") && !a) return true;
  return false;
}

function interpolateText(text: string, values?: Record<string, any>): string {
  return text.replace(/\[(\w+)\]/g, (_, name) => {
    if (values?.[name] !== undefined) return String(values[name]);
    return `[${name}]`;
  });
}

function resolveStat(project: VNProject, source: string | undefined, runtimeValues?: Record<string, number>): { label: string; value: number; max?: number } | null {
  if (!source) return null;
  const [kind, ...rest] = source.split(".");
  const key = rest.join(".");
  if (!key) return null;
  const rv = isVarDefined(key, runtimeValues);
  if (kind === "tracker") {
    const t = project.trackers.find(t => t.name === key);
    if (!t && !rv.defined) return null;
    return { label: t?.name ?? key, value: rv.defined ? Number(rv.value) : (t?.defaultValue ?? 0) };
  }
  if (kind === "flag") {
    const f = project.flags.find(f => f.name === key);
    if (!f && !rv.defined) return null;
    return { label: f?.name ?? key, value: rv.defined ? Number(rv.value) : (f?.defaultValue ? 1 : 0), max: 1 };
  }
  return null;
}

const CHILD_HANDLE = 12;
const CHILD_BAR_H = 14;

function ChildDragBar({ childId }: { childId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: childId });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`flex items-center gap-1 px-1.5 bg-slate-800/60 cursor-grab active:cursor-grabbing select-none rounded-t ${isDragging ? "opacity-50" : ""}`}
      style={{ height: CHILD_BAR_H, fontSize: 0 }}
      onClick={(e) => e.stopPropagation()}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-slate-500 shrink-0">
        <circle cx="3" cy="2" r="1" fill="currentColor"/><circle cx="7" cy="2" r="1" fill="currentColor"/>
        <circle cx="3" cy="5" r="1" fill="currentColor"/><circle cx="7" cy="5" r="1" fill="currentColor"/>
        <circle cx="3" cy="8" r="1" fill="currentColor"/><circle cx="7" cy="8" r="1" fill="currentColor"/>
      </svg>
    </div>
  );
}

function ChildResizeHandles({ widgetId }: { widgetId: string }) {
  const dirs = ["nw", "n", "ne", "w", "e", "sw", "s", "se"] as const;
  const pos: Record<string, React.CSSProperties> = {
    nw: { top: -CHILD_HANDLE/2, left: -CHILD_HANDLE/2, cursor: "nwse-resize" },
    n:  { top: -CHILD_HANDLE/2, left: "50%", marginLeft: -CHILD_HANDLE/2, cursor: "ns-resize" },
    ne: { top: -CHILD_HANDLE/2, right: -CHILD_HANDLE/2, cursor: "nesw-resize" },
    w:  { top: "50%", marginTop: -CHILD_HANDLE/2, left: -CHILD_HANDLE/2, cursor: "ew-resize" },
    e:  { top: "50%", marginTop: -CHILD_HANDLE/2, right: -CHILD_HANDLE/2, cursor: "ew-resize" },
    sw: { bottom: -CHILD_HANDLE/2, left: -CHILD_HANDLE/2, cursor: "nesw-resize" },
    s:  { bottom: -CHILD_HANDLE/2, left: "50%", marginLeft: -CHILD_HANDLE/2, cursor: "ns-resize" },
    se: { bottom: -CHILD_HANDLE/2, right: -CHILD_HANDLE/2, cursor: "nwse-resize" },
  };
  return (
    <>
      {dirs.map(d => {
        const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `resize-${widgetId}-${d}` });
        return (
          <div key={d} ref={setNodeRef} {...listeners} {...attributes}
            className={`absolute z-30 bg-white border-2 border-indigo-500 rounded-sm ${isDragging ? "opacity-80 scale-125" : ""}`}
            style={{ width: CHILD_HANDLE, height: CHILD_HANDLE, boxSizing: "border-box", ...pos[d] }} />
        );
      })}
    </>
  );
}

// ── Container ────────────────────────────────────────────────────
const ContainerWidget = ({ project, config, onSelectWidget, runtime, selectedWidgetId }: WidgetProps) => {
  const s = config.settings ?? {};
  const children = config.children ?? [];
  const direction = (s.direction as string) ?? "";
  const isFlex = direction === "row" || direction === "column";
  const showBorder = !runtime || s.containerBorder === true;
  return (
    <div className={`h-full w-full rounded-xl bg-slate-900/20 ${showBorder ? "border-2 border-dashed border-slate-600/50" : "border-0"}`}
      style={{
        position: "relative",
        display: isFlex ? "flex" : undefined,
        flexDirection: isFlex ? (direction as any) : undefined,
        gap: isFlex ? (s.gap ?? "8px") : undefined,
        padding: isFlex ? (s.padding ?? "8px") : undefined,
        backgroundColor: (s.bgColor as string) ?? undefined,
        borderColor: (s.borderColor as string) ?? undefined,
      }}>
      {children.length === 0 ? (
        <span onClick={(e) => { e.stopPropagation(); onSelectWidget?.(config.id); }} className={`text-[9px] text-slate-500 italic ${isFlex ? "" : "absolute inset-0"} flex items-center justify-center`}>Container — add child widgets</span>
      ) : isFlex ? (
        children.map(child => (
          <div key={child.id}
            onClick={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}
            className={`group ${selectedWidgetId === child.id ? "ring-1 ring-indigo-400" : ""}`}
            style={{
              position: "relative",
              flex: child.w ? `0 0 ${child.w}px` : undefined,
              minHeight: child.h ? `${child.h}px` : undefined,
            }}>
            {!runtime && <ChildDragBar childId={child.id} />}
            <WidgetRenderer project={project} config={child} onSelectWidget={onSelectWidget} runtime={runtime} selectedWidgetId={selectedWidgetId} />
            {selectedWidgetId === child.id && <ChildResizeHandles widgetId={child.id} />}
          </div>
        ))
      ) : (
        children.map(child => (
          <div key={child.id}
            style={{
              position: "absolute",
              left: (child.x ?? 0) + 2,
              top: (child.y ?? 0) + 2,
              width: Math.max(20, child.w ?? 100),
              height: Math.max(20, child.h ?? 100),
            }}
            className={`group ${selectedWidgetId === child.id ? "ring-1 ring-indigo-400" : ""}`}
            onClick={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}>
            {!runtime && <ChildDragBar childId={child.id} />}
            <WidgetRenderer project={project} config={child} onSelectWidget={onSelectWidget} runtime={runtime} selectedWidgetId={selectedWidgetId} />
            {selectedWidgetId === child.id && <ChildResizeHandles widgetId={child.id} />}
          </div>
        ))
      )}
    </div>
  );
};

// ── Text ─────────────────────────────────────────────────────────
const TextWidget = ({ config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const textType = (s.textType as string) ?? "custom";
  const isDialogueBox = textType === "dialogue";

  const dialogueText = runtime?.dialogueText;
  const hasDialogueText = isDialogueBox && dialogueText !== undefined && dialogueText !== null;
  const displayText = hasDialogueText
    ? dialogueText
    : interpolateText((s.content as string) ?? "", { ...runtime?.runtimeValues, ...runtime?.repeaterItemProps });
  const displayFormatted = hasDialogueText && runtime?.dialogueFormattedText;

  const style: React.CSSProperties = {
    fontSize: s.fontSize as string ?? "12px",
    color: s.color as string ?? "#e2e8f0",
    textAlign: (s.align as any) ?? "left",
    justifyContent: s.align === "center" ? "center" : s.align === "right" ? "flex-end" : "flex-start",
  };

  if (textType === "label") {
    style.fontSize = "10px";
    style.color = "#94a3b8";
    style.fontWeight = 500;
  } else if (textType === "title") {
    style.fontSize = "16px";
    style.fontWeight = 700;
  } else if (textType === "characterName") {
    style.fontSize = "13px";
    style.fontWeight = 600;
    style.color = "#818cf8";
  } else if (isDialogueBox) {
    style.fontSize = "15px";
    style.lineHeight = 1.6;
  }

  const boxStyle = isDialogueBox
    ? { background: "linear-gradient(to bottom, #1e293b, #0f172a)", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }
    : {};

  return (
    <div className="h-full flex items-center overflow-y-auto"
      style={{ ...style, ...boxStyle }}>
      {displayText ? (
        displayFormatted
          ? <span dangerouslySetInnerHTML={{ __html: displayFormatted }} />
          : <span>{displayText}</span>
      ) : (
        <span className="text-slate-500 italic text-[10px]">
          {isDialogueBox ? "Dialogue will appear here during playtest" : "Double-click to edit text"}
        </span>
      )}
    </div>
  );
};

// ── Image ────────────────────────────────────────────────────────
const ImageWidget = ({ config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const src = interpolateText(String(s.src ?? ""), { ...runtime?.runtimeValues, ...runtime?.repeaterItemProps });
  return (
    <div className="h-full glass-card p-2 flex items-center justify-center overflow-hidden">
      {src ? (
        <img src={src} alt=""
          className="w-full h-full rounded-lg"
          style={{ objectFit: (s.fit as any) ?? "cover", aspectRatio: (s.aspectRatio as string) ?? undefined }}
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-slate-500">
          <Image className="w-5 h-5" />
          <span className="text-[9px] italic">No image set</span>
        </div>
      )}
    </div>
  );
};

// ── Stat Text ────────────────────────────────────────────────────
const StatTextWidget = ({ project, config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const stat = resolveStat(project, s.statSource as string, runtime?.runtimeValues);
  return (
    <div className="h-full glass-card p-3 flex items-center gap-2">
      {stat ? (
        <>
          <span className="text-[10px] text-slate-400 font-medium">{interpolateText(s.statLabel ?? stat.label, { ...runtime?.runtimeValues, ...runtime?.repeaterItemProps })}</span>
          <span className="text-sm font-mono font-bold text-indigo-300">{stat.value}{stat.max ? ` / ${stat.max}` : ""}</span>
        </>
      ) : (
        <span className="text-[9px] text-slate-500 italic">Bind a tracker or flag</span>
      )}
    </div>
  );
};

// ── Stat Bar ─────────────────────────────────────────────────────
const StatBarWidget = ({ project, config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const stat = resolveStat(project, s.statSource as string, runtime?.runtimeValues);
  const combined = { ...runtime?.runtimeValues, ...runtime?.repeaterItemProps };
  const rawMinVal = s.statMin != null ? interpolateText(String(s.statMin), combined) : "0";
  const rawMaxVal = s.statMax != null ? interpolateText(String(s.statMax), combined) : String(stat?.max ?? 100);
  function toNum(v: string, def: number): number { const n = Number(v); return Number.isNaN(n) ? def : Math.max(0, n); }
  const min = toNum(rawMinVal, 0);
  const max = toNum(rawMaxVal, 100);
  const pct = max > min ? Math.min(100, Math.max(0, ((stat?.value ?? 0) - min) / (max - min) * 100)) : 0;
  return (
    <div className="h-full glass-card p-3 flex flex-col justify-center gap-1">
      <span className="text-[10px] text-slate-400 font-medium">{interpolateText(s.statLabel ?? stat?.label ?? "Unbound", combined)}</span>
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: (s.barColor as string) ?? "#6366f1" }} />
      </div>
    </div>
  );
};

// ── Button ───────────────────────────────────────────────────────
const ButtonWidget = ({ config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const combined = { ...runtime?.runtimeValues, ...runtime?.repeaterItemProps };
  const action = interpolateText((s.buttonAction as string) ?? "custom", combined);
  const actionLabel = action.split(":")[0];
  const defaultLabel = actionLabel ? actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1) : "Button";
  const label = interpolateText((s.buttonLabel as string) ?? defaultLabel, combined);
  return (
    <div className="h-full flex items-center justify-center p-2">
      <button onClick={() => runtime?.onButtonAction?.(action)}
        className="w-full py-2 px-3 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-bold text-center cursor-pointer transition-colors">
        {label}
      </button>
    </div>
  );
};

// ── Choice List ──────────────────────────────────────────────────
const ChoiceListWidget = ({ config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const choices = runtime?.choices ?? [];
  if (!runtime) {
    return (
      <div className="h-full glass-card p-3 flex items-center justify-center border-2 border-dashed border-indigo-400/30">
        <span className="text-[9px] text-slate-500 italic">Choice List — choices appear here during playtest</span>
      </div>
    );
  }
  if (choices.length === 0) return null;
  return (
    <div className="h-full glass-card p-3 flex flex-col gap-2 overflow-y-auto">
      {(s.choiceListLabel as string) && (
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{interpolateText(s.choiceListLabel as string, { ...runtime?.runtimeValues, ...runtime?.repeaterItemProps })}</span>
      )}
      {choices.map(choice => (
        <button key={choice.id}
          disabled={!choice.passed}
          onClick={() => runtime?.onSelectChoice?.(choice.id)}
          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            choice.passed
              ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-indigo-500"
              : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
          }`}>
          <span>{choice.text}</span>
          {choice.targetNodeTitle && (
            <span className="text-[9px] text-slate-500 ml-2">→ {choice.targetNodeTitle}</span>
          )}
          {!choice.passed && <span className="text-[9px] text-rose-400 ml-2">Locked</span>}
        </button>
      ))}
    </div>
  );
};

// ── Portrait ─────────────────────────────────────────────────────
const PortraitWidget = ({ config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const shape = (s.portraitShape as string) ?? "rounded";
  const shapeClass = shape === "circle" ? "rounded-full" : shape === "square" ? "rounded-none" : "rounded-xl";
  const speaker = runtime?.dialogueSpeaker || "";
  const src = (s.portraitSrc as string) || (speaker ? `portraits/${speaker.toLowerCase().replace(/\s+/g, "_")}.png` : "");
  const [imgError, setImgError] = React.useState(false);
  const showImg = !!src && !imgError;
  return (
    <div className="h-full glass-card p-2 flex items-center justify-center">
      {showImg ? (
        <img src={src} alt={speaker || "portrait"}
          className={`w-full h-full object-cover ${shapeClass}`}
          onError={() => setImgError(true)} />
      ) : null}
      <div className={`flex flex-col items-center gap-1 text-slate-500 ${showImg ? "hidden" : ""}`}>
        <UserCircle className="w-8 h-8" />
        <span className="text-[9px] italic">{speaker || "Portrait"}</span>
      </div>
    </div>
  );
};

// ── Inventory ────────────────────────────────────────────────────
const InventoryWidget = ({ project, config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const inv = runtime?.inventory ?? [];
  return (
    <div className="h-full glass-card p-3 flex flex-col gap-1.5 overflow-y-auto">
      {(s.inventoryLabel as string) && (
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{interpolateText(s.inventoryLabel as string, { ...runtime?.runtimeValues, ...runtime?.repeaterItemProps })}</span>
      )}
      {inv.length === 0 ? (
        <span className="text-[9px] text-slate-500 italic m-auto">No items</span>
      ) : (
        inv.map((itemId, i) => {
          const item = project.inventory.find(it => it.id === itemId);
          return (
            <div key={itemId} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-2 py-1.5">
              <span className="text-[10px] font-mono text-indigo-300 font-bold">{item?.name || itemId}</span>
            </div>
          );
        })
      )}
    </div>
  );
};

// ── Divider ──────────────────────────────────────────────────────
const DividerWidget = ({ config }: WidgetProps) => {
  const s = config.settings ?? {};
  const color = (s.dividerColor as string) ?? "#334155";
  const style = (s.dividerStyle as string) ?? "solid";
  return (
    <div className="h-full flex items-center justify-center px-2">
      <hr className="w-full"
        style={{ border: "none", borderTop: `1px ${style} ${color}` }} />
    </div>
  );
};

// ── Border Box (9-Slice) ─────────────────────────────────────────
const BorderBoxWidget = ({ project, config, onSelectWidget, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const children = config.children ?? [];
  const hasImage = !!s.borderImage;
  function sliceVal(v: unknown, def: number): number { const n = Number(v ?? def); return Number.isNaN(n) || n < 0 ? def : n; }
  const top = sliceVal(s.borderSliceTop, 12);
  const right = sliceVal(s.borderSliceRight, 12);
  const bottom = sliceVal(s.borderSliceBottom, 12);
  const left = sliceVal(s.borderSliceLeft, 12);
  const borderW = s.borderWidth ?? `${Math.max(top, right, bottom, left)}px`;
  const padding = s.borderPadding ?? "16px";

  const style: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    padding,
    borderWidth: borderW,
    borderStyle: "solid",
    borderColor: "transparent",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  if (hasImage) {
    style.borderImage = `url(${s.borderImage}) ${top} ${right} ${bottom} ${left} fill / ${borderW} stretch`;
    style.borderStyle = "solid";
    style.borderColor = "transparent";
  }

  return (
    <div className="h-full flex flex-col" style={style}>
      {!hasImage && (
        <div className="absolute inset-0 rounded-xl border-2 border-slate-600/50 bg-slate-900/20 pointer-events-none" />
      )}
      {children.length === 0 && !hasImage ? (
        <span className="text-[9px] text-slate-500 italic m-auto">Border Box — set a 9-slice image or add children</span>
      ) : children.length === 0 ? (
        <span className="text-[9px] text-slate-500 italic m-auto">Drop widgets here</span>
      ) : (
        children.map(child => (
          <div key={child.id} className="flex-1" onClick={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}>
            <WidgetRenderer project={project} config={child} onSelectWidget={onSelectWidget} runtime={runtime} />
          </div>
        ))
      )}
    </div>
  );
};

// ── Helpers: data source resolution ─────────────────────────────
function resolveRepeaterSource(project: VNProject, source: string, runtime?: WidgetRuntimeProps): { items: any[]; label: string } {
  switch (source) {
    case "items":
      return { items: project.inventory, label: "Items" };
    case "trackers":
      return { items: project.trackers, label: "Trackers" };
    case "flags":
      return { items: project.flags, label: "Flags" };
    case "entities":
      return { items: project.entities, label: "Entities" };
    case "inventory": {
      const itemIds = runtime?.inventory ?? [];
      const items = itemIds.map(id => project.inventory.find(i => i.id === id)).filter((x): x is VNItem => x !== undefined);
      return { items, label: "Inventory" };
    }
    default:
      return { items: [], label: source };
  }
}

function getRepeaterItemProps(item: any): Record<string, any> {
  if (typeof item !== "object" || item === null) return { value: String(item) };
  const props: Record<string, any> = {};
  for (const key of Object.keys(item)) {
    const v = item[key];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      props[key] = v;
    }
  }
  return props;
}

// ── Repeater ─────────────────────────────────────────────────────
const RepeaterWidget = ({ project, config, onSelectWidget, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const source = (s.repeaterSource as string) ?? "";
  const children = config.children ?? [];

  if (!source) {
    return (
      <div className="h-full glass-card p-3 flex items-center justify-center">
        <span className="text-[9px] text-slate-500 italic">Repeater — set a data source</span>
      </div>
    );
  }

  const { items } = resolveRepeaterSource(project, source, runtime);

  // Editor mode: show single template card
  if (!runtime) {
    return (
      <div className="h-full glass-card p-2 flex flex-col gap-1 overflow-y-auto">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
            Repeater: {source} ({items.length} items)
          </span>
        </div>
        {children.length === 0 ? (
          <span className="text-[9px] text-slate-500 italic m-auto">Design a template card by adding child widgets</span>
        ) : (
          <div className="border-2 border-dashed border-indigo-500/30 rounded-lg p-2 bg-slate-900/40">
            {children.map(child => (
              <div key={child.id} onClick={(e) => { e.stopPropagation(); onSelectWidget?.(child.id); }}>
                <WidgetRenderer project={project} config={child} onSelectWidget={onSelectWidget} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Runtime mode: auto-instantiate for each item
  if (items.length === 0) {
    return (
      <div className="h-full glass-card p-3 flex items-center justify-center">
        <span className="text-[9px] text-slate-500 italic">No items in {source}</span>
      </div>
    );
  }

  return (
    <div className="h-full glass-card p-2 flex flex-col gap-2 overflow-y-auto">
      <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-400/60 px-1 shrink-0">
        {source} ({items.length})
      </span>
      <div className="flex flex-col gap-2">
        {items.map((item: any, idx: number) => {
          const itemProps = getRepeaterItemProps(item);
          return (
            <div key={item.id ?? idx} className="border border-slate-700/50 rounded-lg p-2 bg-slate-900/30">
              {children.map(child => (
                <div key={child.id}>
                  <WidgetRenderer
                    project={project}
                    config={child}
                    onSelectWidget={onSelectWidget}
                    runtime={{ ...runtime, repeaterItemProps: itemProps }}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Inspector ────────────────────────────────────────────────────
const InspectorWidget = ({ project, config, runtime }: WidgetProps) => {
  const s = config.settings ?? {};
  const itemId = runtime?.inspectedItemId ?? (s.trackedItemId as string) ?? "";
  if (!itemId) {
    return (
      <div className="h-full glass-card p-3 flex items-center justify-center">
        <div className="flex flex-col items-center gap-1 text-slate-500">
          <Search className="w-5 h-5" />
          <span className="text-[9px] italic">No item selected</span>
          <span className="text-[8px] text-slate-600">Click an item to inspect</span>
        </div>
      </div>
    );
  }
  const item = project.inventory.find(i => i.id === itemId)
    || project.trackers.find(t => t.id === itemId)
    || project.flags.find(f => f.id === itemId)
    || project.entities.find(e => e.id === itemId);
  if (!item) {
    return (
      <div className="h-full glass-card p-3 flex items-center justify-center">
        <span className="text-[9px] text-slate-500 italic">Item not found: {itemId}</span>
      </div>
    );
  }
  const iObj = item as any;
  const mods: [string, any][] = iObj.statModifiers ? Object.entries(iObj.statModifiers) : [];
  const tags: string[] = iObj.tags ?? [];
  return (
    <div className="h-full glass-card p-3 flex flex-col gap-2 overflow-y-auto">
      <h4 className="text-xs font-bold text-white">{(item as any).name || itemId}</h4>
      {"description" in item && (item as any).description && (
        <p className="text-[10px] text-slate-400 leading-relaxed">{(item as any).description}</p>
      )}
      <div className="flex flex-wrap gap-1">
        <span className="text-[8px] font-mono text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">{(item as any).id || itemId}</span>
        {"type" in item && (item as any).type && (
          <span className="text-[8px] font-mono text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">{(item as any).type}</span>
        )}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t: string) => (
            <span key={t} className="text-[8px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
      {mods.length > 0 && (
        <div className="border-t border-slate-700/50 pt-2">
          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Stat Modifiers</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {mods.map(([k, v]) => (
              <span key={k} className="text-[9px] font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">{k}: {v}</span>
            ))}
          </div>
        </div>
      )}
      {"defaultValue" in item && (
        <div className="border-t border-slate-700/50 pt-2">
          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Default Value</span>
          <span className="text-[10px] font-mono text-slate-300 ml-2">{String((item as any).defaultValue)}</span>
        </div>
      )}
    </div>
  );
};

// ── Registry ─────────────────────────────────────────────────────
export const REGISTRY: Record<WidgetType, WidgetDescriptor> = {
  container:   { type: "container",   label: "Container",   icon: LayoutGrid,        defaultW: 1, defaultH: 1, component: ContainerWidget },
  text:        { type: "text",        label: "Text",        icon: Type,               defaultW: 2, defaultH: 1, component: TextWidget },
  image:       { type: "image",       label: "Image",       icon: Image,              defaultW: 1, defaultH: 2, component: ImageWidget },
  statText:    { type: "statText",    label: "Stat Text",   icon: Hash,               defaultW: 1, defaultH: 1, component: StatTextWidget },
  statBar:     { type: "statBar",     label: "Stat Bar",    icon: BarChart3,          defaultW: 2, defaultH: 1, component: StatBarWidget },
  button:      { type: "button",      label: "Button",      icon: MousePointerClick,  defaultW: 1, defaultH: 1, component: ButtonWidget },
  choiceList:  { type: "choiceList",  label: "Choice List", icon: List,               defaultW: 2, defaultH: 2, component: ChoiceListWidget },
  portrait:    { type: "portrait",    label: "Portrait",    icon: UserCircle,         defaultW: 1, defaultH: 2, component: PortraitWidget },
  inventory:   { type: "inventory",   label: "Inventory",   icon: Backpack,           defaultW: 1, defaultH: 2, component: InventoryWidget },
  divider:     { type: "divider",     label: "Divider",     icon: SeparatorHorizontal, defaultW: 2, defaultH: 1, component: DividerWidget },
  borderBox:   { type: "borderBox",   label: "Border Box", icon: Square,              defaultW: 2, defaultH: 2, component: BorderBoxWidget },
  repeater:    { type: "repeater",    label: "Repeater",    icon: CopyPlus,           defaultW: 2, defaultH: 2, component: RepeaterWidget },
  inspector:   { type: "inspector",   label: "Inspector",   icon: Search,             defaultW: 1, defaultH: 2, component: InspectorWidget },
};

// ── Conditional visibility ───────────────────────────────────────
function checkShowIf(settings: Record<string, any>, runtimeValues?: Record<string, number>): boolean {
  const source = settings.showIfSource as string | undefined;
  if (!source) return true;
  // In editor mode (no runtime), always show so widgets don't disappear during design
  if (runtimeValues === undefined) return true;
  const operator = (settings.showIfOperator as string) ?? "exists";
  const value = settings.showIfValue as string | undefined;
  const [kind, ...rest] = source.split(".");
  const key = rest.join(".");
  const rv = isVarDefined(key, runtimeValues);
  if (!rv.defined) return false;
  const actual = rv.value;
  if (operator === "exists") return kind === "flag" ? Boolean(actual) : actual !== undefined;
  if (value === undefined) return false;
  if (operator === "==") return valuesMatch(actual, value);
  if (operator === "!=") return !valuesMatch(actual, value);
  const numVal = Number(value);
  const numActual = Number(actual);
  if (operator === ">=") return numActual >= numVal;
  if (operator === "<=") return numActual <= numVal;
  if (operator === ">") return numActual > numVal;
  if (operator === "<") return numActual < numVal;
  return false;
}

function getStateFilterStyle(settings: Record<string, any>, runtimeValues?: Record<string, number>): React.CSSProperties {
  const style = settings.stateFilterStyle as string;
  if (!style || style === "none") return {};
  const source = settings.stateFilterSource as string | undefined;
  if (!source) return {};
  const operator = (settings.stateFilterOperator as string) ?? "exists";
  const value = settings.stateFilterValue as string | undefined;
  const [kind, ...rest] = source.split(".");
  const key = rest.join(".");
  let actual: number | boolean | undefined;
  if (runtimeValues?.[key] !== undefined) actual = runtimeValues[key];
  if (actual === undefined) return {};
  let matched = false;
  if (operator === "exists") matched = kind === "flag" ? Boolean(actual) : actual !== undefined;
  else if (operator === "==") matched = valuesMatch(actual, value);
  else if (operator === "!=") matched = !valuesMatch(actual, value);
  else {
    const n = Number(actual); const v = Number(value);
    if (operator === ">=") matched = n >= v; else if (operator === "<=") matched = n <= v;
    else if (operator === ">") matched = n > v; else if (operator === "<") matched = n < v;
  }
  if (!matched) return {};
  if (style === "grayscale") return { filter: "grayscale(1)", opacity: 0.7 };
  if (style === "low-opacity") return { opacity: 0.4 };
  if (style === "blur") return { filter: "blur(2px)", opacity: 0.6 };
  return {};
}

// ── WidgetRenderer ───────────────────────────────────────────────
export const WidgetRenderer: React.FC<WidgetProps> = (props) => {
  const desc = REGISTRY[props.config.type];
  if (!desc) return <div className="glass-card p-4 text-xs text-slate-500">Unknown widget type</div>;
  if (!checkShowIf(props.config.settings ?? {}, props.runtime?.runtimeValues)) return null;
  const s = props.config.settings ?? {};
  const stateFilter = getStateFilterStyle(s, props.runtime?.runtimeValues);
  const widgetStyle: React.CSSProperties = {
    ...stateFilter,
    opacity: s.widgetOpacity != null ? Number(s.widgetOpacity) / 100 : undefined,
    borderRadius: (s.widgetBorderRadius as string) ?? undefined,
    borderWidth: (s.widgetBorderWidth as string) ?? undefined,
    borderColor: (s.widgetBorderColor as string) ?? undefined,
    borderStyle: (s.widgetBorderStyle as string) ?? undefined,
  };
  const C = desc.component;
  return (
    <div style={widgetStyle} className="h-full min-h-0">
      <C project={props.project} config={props.config} onSelectWidget={props.onSelectWidget} runtime={props.runtime} selectedWidgetId={props.selectedWidgetId} />
    </div>
  );
};