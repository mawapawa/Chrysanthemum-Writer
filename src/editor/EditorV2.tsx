import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { UIElementV2, ComputedLayout, ProjectAsset, BindingContext, ElementEvents, VNProject, UILayoutCollection } from "../types";
import { UI_SCREENS } from "../types";
import { createElementStore, ElementStore, createEmptyLayouts } from "./elementStore";
import { elementFactories, factoryList } from "../factories/elementFactories";
import { renderV2 } from "../widgets/pipelineV2";

// ─── Props ──────────────────────────────────────────────────────

interface EditorV2Props {
  project: VNProject;
  onUpdateProject?: (project: VNProject) => void;
  onBack?: () => void;
}

// ─── Helper: build tree indent from parentId ─────────────────────

function depthOf(id: string, store: ElementStore): number {
  return store.getAncestors(id).length;
}

// ─── Hierarchy Panel ─────────────────────────────────────────────

function HierarchyPanel({ store }: { store: ElementStore }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const topLevel = useMemo(() => store.elements.filter(e => !e.parentId), [store, tick]);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Elements</div>
      {topLevel.length === 0 && (
        <div style={{ color: "#475569", fontSize: 10, fontStyle: "italic", padding: 8 }}>No elements. Add one above.</div>
      )}
      {topLevel.map(el => <HierarchyNode key={el.id} element={el} store={store} depth={0} />)}
    </div>
  );
}

function HierarchyNode({ element, store, depth }: { element: UIElementV2; store: ElementStore; depth: number }) {
  const children = useMemo(() => store.getChildren(element.id), [store, element.id]);
  const [expanded, setExpanded] = useState(true);
  const isSelected = store.selectedId === element.id;

  return (
    <div>
      <div
        onClick={() => store.select(element.id)}
        style={{
          padding: "3px 6px", cursor: "pointer", borderRadius: 4, fontSize: 11, fontFamily: "monospace",
          marginLeft: depth * 16, display: "flex", alignItems: "center", gap: 4,
          background: isSelected ? "#6366f120" : "transparent",
          color: isSelected ? "#a5b4fc" : "#cbd5e1",
        }}
      >
        {children.length > 0 && (
          <span onClick={(e) => { e.stopPropagation(); setExpanded(e => !e); }} style={{ cursor: "pointer", width: 14, fontSize: 9, color: "#64748b" }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {children.length === 0 && <span style={{ width: 14 }} />}
        <span style={{ color: "#64748b", fontSize: 9 }}>{element.type}</span>
        <span style={{ marginLeft: 4 }}>{element.id}</span>
      </div>
      {expanded && children.map(ch => <HierarchyNode key={ch.id} element={ch} store={store} depth={depth + 1} />)}
    </div>
  );
}

// ─── Factory Bar ─────────────────────────────────────────────────

function FactoryBar({ store, onBack }: { store: ElementStore; onBack?: () => void }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "6px 8px", borderBottom: "1px solid #1e293b", flexWrap: "wrap", alignItems: "center" }}>
      {factoryList.map(f => (
        <button key={f.type} onClick={() => store.add(f.create())}
          style={{
            padding: "4px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 600,
            background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155",
            borderRadius: 6, cursor: "pointer",
          }}
        >
          + {f.label}
        </button>
      ))}
      {store.elements.length > 0 && (
        <button onClick={() => { store.elements.forEach(e => store.remove(e.id)); }}
          style={{
            padding: "4px 12px", fontSize: 11, fontFamily: "monospace",
            background: "#1e293b", color: "#f87171", border: "1px solid #334155",
            borderRadius: 6, cursor: "pointer",
          }}
        >
          Clear All
        </button>
      )}
      {onBack && (
        <button onClick={onBack}
          style={{
            padding: "4px 12px", fontSize: 11, fontFamily: "monospace",
            background: "#6366f1", color: "#fff", border: "none",
            borderRadius: 6, cursor: "pointer", marginLeft: "auto",
          }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}

// ─── Selection overlay constants ─────────────────────────────────

const HANDLE = 8;
const SNAP = (v: number) => Math.round(v / 10) * 10;

const H_POS: Record<string, React.CSSProperties> = {
  nw: { top: -HANDLE/2, left: -HANDLE/2, cursor: "nwse-resize" },
  n:  { top: -HANDLE/2, left: "50%", marginLeft: -HANDLE/2, cursor: "ns-resize" },
  ne: { top: -HANDLE/2, right: -HANDLE/2, cursor: "nesw-resize" },
  w:  { top: "50%", marginTop: -HANDLE/2, left: -HANDLE/2, cursor: "ew-resize" },
  e:  { top: "50%", marginTop: -HANDLE/2, right: -HANDLE/2, cursor: "ew-resize" },
  sw: { bottom: -HANDLE/2, left: -HANDLE/2, cursor: "nesw-resize" },
  s:  { bottom: -HANDLE/2, left: "50%", marginLeft: -HANDLE/2, cursor: "ns-resize" },
  se: { bottom: -HANDLE/2, right: -HANDLE/2, cursor: "nwse-resize" },
};

// ─── CanvasV2 ────────────────────────────────────────────────────

function CanvasV2({ store, assets }: {
  store: ElementStore; assets?: ProjectAsset[];
}) {
  const [, tick] = useState(0);
  const dragRef = useRef<{
    elId: string; startX: number; startY: number;
    mode: 'move' | 'resize'; dir?: string;
    orig: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Force re-render periodically so layouts stay fresh
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const layouts = useMemo(() => store.getLayouts(), [store, tick]);

  const selectedLayout = store.selectedId ? layouts.get(store.selectedId) : null;

  // ── Mousedown: start drag or resize ──
  const handleMouseDown = useCallback((e: React.MouseEvent, elId: string) => {
    if (e.button !== 0) return;
    const el = store.getById(elId);
    if (!el) return;
    const l = el.layout;
    if (l.mode !== "freeform") return;
    store.select(elId);
    dragRef.current = {
      elId, startX: e.clientX, startY: e.clientY,
      mode: 'move',
      orig: { x: (l as any).x ?? 0, y: (l as any).y ?? 0, w: (l as any).width ?? 100, h: (l as any).height ?? 100 },
    };
  }, [store]);

  const handleHandleMouseDown = useCallback((e: React.MouseEvent, elId: string, dir: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = store.getById(elId);
    if (!el) return;
    const l = el.layout;
    if (l.mode !== "freeform") return;
    dragRef.current = {
      elId, startX: e.clientX, startY: e.clientY,
      mode: 'resize', dir,
      orig: { x: (l as any).x ?? 0, y: (l as any).y ?? 0, w: (l as any).width ?? 100, h: (l as any).height ?? 100 },
    };
  }, [store]);

  // ── Global mousemove / mouseup ──
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.mode === 'move') {
        const nx = SNAP(Math.max(0, d.orig.x + dx));
        const ny = SNAP(Math.max(0, d.orig.y + dy));
        store.update(d.elId, { layout: { mode: "freeform", x: nx, y: ny, width: d.orig.w, height: d.orig.h } });
      } else if (d.mode === 'resize' && d.dir) {
        let { x, y, w, h } = d.orig;
        const sdx = SNAP(dx);
        const sdy = SNAP(dy);
        if (d.dir.includes('e')) w = Math.max(20, d.orig.w + sdx);
        if (d.dir.includes('w')) { x = d.orig.x + sdx; w = Math.max(20, d.orig.w - sdx); }
        if (d.dir.includes('s')) h = Math.max(20, d.orig.h + sdy);
        if (d.dir.includes('n')) { y = d.orig.y + sdy; h = Math.max(20, d.orig.h - sdy); }
        store.update(d.elId, { layout: { mode: "freeform", x, y, width: w, height: h } });
      }
    };

    const mu = () => { dragRef.current = null; };

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [store]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) store.select(null);
  }, [store]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 12, background: "#020617" }}>
      <div style={{ position: "relative", width: 800, height: 600, background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", overflow: "hidden" }}
        onClick={handleCanvasClick}>
        {/* Dot grid */}
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width={800} height={600}>
          <defs>
            <pattern id="editorv2-dots" x="0" y="0" width={24} height={24} patternUnits="userSpaceOnUse">
              <circle cx={1.5} cy={1.5} r={1.5} fill="rgba(255,255,255,0.04)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#editorv2-dots)" />
        </svg>

        {/* Elements */}
        {renderV2(store.elements, undefined, undefined, assets, 800, 600).map((node, i) => {
          const el = store.elements[i];
          if (!el) return node;
          return (
            <div key={el.id} onMouseDown={(e) => handleMouseDown(e, el.id)} style={{ position: "absolute", inset: 0 }}>
              {node}
            </div>
          );
        })}

        {/* Selection overlay */}
        {selectedLayout && (
          <>
            <div style={{
              position: "absolute", left: selectedLayout.x - 1, top: selectedLayout.y - 1,
              width: selectedLayout.width + 2, height: selectedLayout.height + 2,
              border: "1px solid #6366f1", borderRadius: 1, pointerEvents: "none", zIndex: 999,
            }} />
            {["nw","n","ne","w","e","sw","s","se"].map(d => (
              <div key={d} onMouseDown={(e) => handleHandleMouseDown(e, store.selectedId!, d)}
                style={{
                  position: "absolute", zIndex: 1000,
                  width: HANDLE, height: HANDLE, boxSizing: "border-box",
                  background: "#fff", border: "2px solid #6366f1", borderRadius: 2,
                  left: selectedLayout.x + (H_POS[d].left as number ?? 0),
                  top: selectedLayout.y + (H_POS[d].top as number ?? 0),
                  right: H_POS[d].right as number ?? undefined,
                  bottom: H_POS[d].bottom as number ?? undefined,
                  marginLeft: H_POS[d].marginLeft as number ?? undefined,
                  marginTop: H_POS[d].marginTop as number ?? undefined,
                  cursor: H_POS[d].cursor,
                }} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── InspectorV2 (placeholder) ───────────────────────────────────

function InspectorV2({ store, assets, project, onUpdateProject }: {
  store: ElementStore; assets?: ProjectAsset[]; project?: VNProject; onUpdateProject?: (p: VNProject) => void;
}) {
  const sel = store.selectedId ? store.getById(store.selectedId) : null;
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  if (!sel) {
    return (
      <div style={{ width: 240, padding: 12, color: "#475569", fontSize: 10, fontStyle: "italic" }}>
        Select an element to inspect
      </div>
    );
  }

  const setProp = (key: string, value: any) => {
    store.update(sel.id, { properties: { ...sel.properties, [key]: value } });
  };
  const setBind = (key: string, value: any) => {
    store.update(sel.id, { bindings: { ...sel.bindings, [key]: value } });
  };

  const bindProps: Record<string, React.ReactNode> = {};

  // Content section — type-specific
  if (sel.type === "text") {
    bindProps["Content"] = (
      <input value={sel.properties.textType ?? "custom"} onChange={e => setProp("textType", e.target.value)}
        style={inputStyle} placeholder="textType" />
    );
    bindProps["Text"] = (
      <input value={(sel.bindings.textTemplate ?? "") as string} onChange={e => setBind("textTemplate", e.target.value)}
        style={inputStyle} placeholder="Text content" />
    );
    bindProps["Font Size"] = (
      <input value={(sel.properties.fontSize ?? "") as string} onChange={e => setProp("fontSize", e.target.value)}
        style={inputStyle} placeholder="e.g. 14px" />
    );
  } else if (sel.type === "button") {
    bindProps["Label"] = (
      <input value={(sel.bindings.textTemplate ?? "") as string} onChange={e => setBind("textTemplate", e.target.value)}
        style={inputStyle} placeholder="Button label" />
    );
    bindProps["Action"] = (
      <input value={(sel.properties.buttonAction ?? "") as string} onChange={e => setProp("buttonAction", e.target.value)}
        style={inputStyle} placeholder="custom" />
    );
  } else if (sel.type === "image") {
    bindProps["Asset ID"] = (
      <input value={(sel.properties.assetId ?? "") as string} onChange={e => setProp("assetId", e.target.value)}
        style={inputStyle} placeholder="asset_id" />
    );
  } else if (sel.type === "container") {
    bindProps["Direction"] = (
      <select value={(sel.properties.direction ?? "") as string} onChange={e => setProp("direction", e.target.value)}
        style={inputStyle}>
        <option value="">Freeform</option>
        <option value="row">Row</option>
        <option value="column">Column</option>
      </select>
    );
    bindProps["Gap"] = (
      <input value={(sel.properties.gap ?? "") as string} onChange={e => setProp("gap", Number(e.target.value))}
        style={inputStyle} type="number" placeholder="0" />
    );
  }

  return (
    <div style={{ width: 240, padding: 12, overflowY: "auto", borderLeft: "1px solid #1e293b" }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
        {sel.type} <span style={{ color: "#64748b", fontWeight: 400 }}>{sel.id}</span>
      </div>
      {Object.entries(bindProps).map(([label, input]) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>{label}</div>
          {input}
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "4px 8px", fontSize: 11, fontFamily: "monospace",
  background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155",
  borderRadius: 4, outline: "none", boxSizing: "border-box",
};

// ─── EditorV2 Main ───────────────────────────────────────────────

export function EditorV2({ project, onUpdateProject, onBack }: EditorV2Props) {
  const layouts = project.uiLayouts ?? createEmptyLayouts();
  const [activeScreen, setActiveScreen] = useState(layouts.activeScreen ?? "dialogue");
  const elements = layouts.screens[activeScreen] ?? [];

  const saveLayouts = useCallback((screens: Record<string, UIElementV2[]>, screen?: string) => {
    const next: UILayoutCollection = { screens, activeScreen: screen ?? activeScreen };
    onUpdateProject?.({ ...project, uiLayouts: next, lastModified: Date.now() });
  }, [project, activeScreen, onUpdateProject]);

  const [store, setStore] = useState<ElementStore | null>(null);

  // Rebuild store when elements or screen changes
  useEffect(() => {
    const s = createElementStore(elements);
    setStore(s);
  }, [project, activeScreen]);

  // Sync store changes back to project
  const onStoreChange = useCallback((newElements: UIElementV2[]) => {
    const screens = { ...layouts.screens, [activeScreen]: newElements };
    saveLayouts(screens);
  }, [layouts, activeScreen, saveLayouts]);

  // ── Screen selector ──
  const screenTabs = (
    <div style={{ display: "flex", gap: 4, padding: "4px 8px", borderBottom: "1px solid #1e293b", flexWrap: "wrap" }}>
      {UI_SCREENS.map(name => (
        <button key={name} onClick={() => setActiveScreen(name)}
          style={{
            padding: "3px 12px", fontSize: 10, fontFamily: "monospace", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: 0.5,
            background: activeScreen === name ? "#6366f1" : "#1e293b",
            color: activeScreen === name ? "#fff" : "#94a3b8",
            border: "1px solid #334155", borderRadius: 6, cursor: "pointer",
          }}>
          {name}
        </button>
      ))}
    </div>
  );

  if (!store) {
    return <div style={{ padding: 40, color: "#64748b" }}>Initializing...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#020617", color: "#e2e8f0", fontFamily: "monospace" }}>
      <FactoryBar store={store} onBack={onBack} />
      {screenTabs}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 240, borderRight: "1px solid #1e293b", overflowY: "auto" }}>
          <HierarchyPanel store={store} />
        </div>
        <CanvasV2 store={store} assets={project.assets} />
        <InspectorV2 store={store} assets={project.assets} project={project} onUpdateProject={onUpdateProject} />
      </div>
    </div>
  );
}
