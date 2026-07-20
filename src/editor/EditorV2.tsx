import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { UIElementV2, ComputedLayout, ProjectAsset, BindingContext, ElementEvents, VNProject, UILayoutCollection } from "../types";
import { UI_SCREENS } from "../types";
import { createElementStore, ElementStore, createEmptyLayouts } from "./elementStore";
import { renderV2 } from "../widgets/pipelineV2";
import { vnComponentList } from "../factories/vnComponents";

// ─── Props ──────────────────────────────────────────────────────

interface EditorV2Props {
  project: VNProject;
  onUpdateProject?: (project: VNProject) => void;
  onBack?: () => void;
}

// ─── Hierarchy Panel (with layer management) ────────────────────

function HierarchyPanel({ store, activeLayer, onLayerChange }: {
  store: ElementStore; activeLayer: string; onLayerChange: (l: string) => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 100); return () => clearInterval(id); }, []);

  // Collect unique layer names from elements, plus "default"
  const layers = useMemo(() => {
    const s = new Set<string>(["default"]);
    store.elements.forEach(e => { if (e.layer) s.add(e.layer); });
    return [...s].sort();
  }, [store, tick]);

  const topLevel = useMemo(() => store.elements.filter(e => !e.parentId && (e.layer ?? "default") === activeLayer), [store, tick, activeLayer]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Layer tabs */}
      <div style={{ padding: "6px 8px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Layers</div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {layers.map(l => (
            <button key={l} onClick={() => onLayerChange(l)}
              style={{
                padding: "2px 8px", fontSize: 9, fontFamily: "monospace", fontWeight: 600,
                background: activeLayer === l ? "#6366f1" : "#1e293b",
                color: activeLayer === l ? "#fff" : "#94a3b8",
                border: "1px solid #334155", borderRadius: 4, cursor: "pointer",
              }}>
              {l}
            </button>
          ))}
          <button onClick={() => { const n = prompt("Layer name:"); if (n) { store.elements.filter(e => !e.layer).forEach(e => store.update(e.id, { layer: n })); onLayerChange(n); } }}
            style={{ padding: "2px 6px", fontSize: 8, fontFamily: "monospace", background: "transparent", color: "#64748b", border: "1px dashed #334155", borderRadius: 4, cursor: "pointer" }}>
            + New
          </button>
        </div>
      </div>

      {/* Elements for active layer */}
      <div style={{ flex: 1, padding: "6px 8px", overflow: "auto" }}>
        <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Elements</div>
        {topLevel.length === 0 && <div style={{ color: "#475569", fontSize: 10, fontStyle: "italic", padding: 4 }}>No elements on this layer.</div>}
        {topLevel.map(el => <HierarchyNode key={el.id} element={el} store={store} depth={0} />)}
      </div>
    </div>
  );
}

function HierarchyNode({ element, store, depth }: { element: UIElementV2; store: ElementStore; depth: number }) {
  const children = useMemo(() => store.getChildren(element.id), [store, element.id]);
  const [expanded, setExpanded] = useState(true);
  const isSelected = store.selectedId === element.id;

  return (
    <div>
      <div onClick={() => store.select(element.id)}
        style={{
          padding: "3px 6px", cursor: "pointer", borderRadius: 4, fontSize: 11, fontFamily: "monospace",
          marginLeft: depth * 16, display: "flex", alignItems: "center", gap: 4,
          background: isSelected ? "#6366f120" : "transparent",
          color: isSelected ? "#a5b4fc" : "#cbd5e1",
        }}>
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

// ─── Selection overlay constants ─────────────────────────────────

const HANDLE = 8;
const SNAP = (v: number) => Math.round(v / 10) * 10;

// ─── CanvasV2 ────────────────────────────────────────────────────

function CanvasV2({ store, assets, activeLayer, canvasW, canvasH }: {
  store: ElementStore; assets?: ProjectAsset[]; activeLayer?: string; canvasW?: number; canvasH?: number;
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
  const lastDragUpdate = useRef(0);
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      // Throttle store updates to every 50ms to avoid flooding React
      const now = Date.now();
      if (now - lastDragUpdate.current < 50 && (d.mode === 'move' || d.mode === 'resize')) return;
      lastDragUpdate.current = now;

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

    const mu = () => { dragRef.current = null; lastDragUpdate.current = 0; };

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [store]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) store.select(null);
  }, [store]);

  const cw = canvasW ?? 1280;
  const ch = canvasH ?? 720;
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 12, background: "#020617" }}>
      <div style={{ position: "relative", width: cw, height: ch, background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", overflow: "hidden" }}
        onClick={handleCanvasClick}>
        {/* Dot grid */}
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width={cw} height={ch}>
          <defs>
            <pattern id="editorv2-dots" x="0" y="0" width={24} height={24} patternUnits="userSpaceOnUse">
              <circle cx={1.5} cy={1.5} r={1.5} fill="rgba(255,255,255,0.04)" />
            </pattern>
          </defs>
          <rect width={cw} height={ch} fill="url(#editorv2-dots)" />
        </svg>

        {/* Elements — rendered by pipeline, overlaid with transparent hit areas */}
        {(() => {
          const visibleElements = store.elements.filter(e => (e.layer ?? "default") === activeLayer);
          return renderV2(visibleElements, undefined, undefined, assets, cw, ch).map((node, i) => {
          const el = visibleElements[i];
          if (!el) return node;
          const l = layouts.get(el.id);
          return (
            <div key={el.id}>
              {node}
              {l && (
                <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, el.id); }}
                  style={{ position: "absolute", left: l.x, top: l.y, width: l.width, height: l.height, cursor: "move", zIndex: 900 }} />
              )}
            </div>
          );
        });
        })()}

        {/* Selection overlay */}
        {selectedLayout && (
          <>
            <div style={{
              position: "absolute", left: selectedLayout.x - 1, top: selectedLayout.y - 1,
              width: selectedLayout.width + 2, height: selectedLayout.height + 2,
              border: "1px solid #6366f1", borderRadius: 1, pointerEvents: "none", zIndex: 999,
            }} />
            {([ 
              { d: "nw", cx: 0, cy: 0, cur: "nwse-resize" },
              { d: "n",  cx: 0.5, cy: 0, cur: "ns-resize" },
              { d: "ne", cx: 1, cy: 0, cur: "nesw-resize" },
              { d: "w",  cx: 0, cy: 0.5, cur: "ew-resize" },
              { d: "e",  cx: 1, cy: 0.5, cur: "ew-resize" },
              { d: "sw", cx: 0, cy: 1, cur: "nesw-resize" },
              { d: "s",  cx: 0.5, cy: 1, cur: "ns-resize" },
              { d: "se", cx: 1, cy: 1, cur: "nwse-resize" },
            ] as const).map(({ d, cx, cy, cur }) => (
              <div key={d} onMouseDown={(e) => handleHandleMouseDown(e, store.selectedId!, d)}
                style={{
                  position: "absolute", zIndex: 1000, cursor: cur,
                  width: HANDLE, height: HANDLE, boxSizing: "border-box",
                  background: "#fff", border: "2px solid #6366f1", borderRadius: 2,
                  left: selectedLayout.x + cx * selectedLayout.width - HANDLE/2,
                  top: selectedLayout.y + cy * selectedLayout.height - HANDLE/2,
                }} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── InspectorV2 ─────────────────────────────────────────────────

const inspInput: React.CSSProperties = {
  width: "100%", padding: "4px 6px", fontSize: 11, fontFamily: "monospace",
  background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155",
  borderRadius: 4, outline: "none", boxSizing: "border-box",
};

function InspectSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, borderBottom: "1px solid #1e293b", paddingBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InspectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>{label}</div>
      {children}
    </div>
  );
}

function InspectorV2({ store, assets, project, onUpdateProject, screenNames }: {
  store: ElementStore; assets?: ProjectAsset[]; project?: VNProject; onUpdateProject?: (p: VNProject) => void;
  screenNames?: string[];
}) {
  const sel = store.selectedId ? store.getById(store.selectedId) : null;
  const [, force] = useState(0);
  const flush = () => force(n => n + 1);

  if (!sel) return <div style={{ width: 260, padding: 12, color: "#475569", fontSize: 10, fontStyle: "italic" }}>Select an element</div>;

  const sp = (k: string, v: any) => { store.update(sel.id, { properties: { ...sel.properties, [k]: v } }); flush(); };
  const sb = (k: string, v: any) => { store.update(sel.id, { bindings: { ...sel.bindings, [k]: v } }); flush(); };
  const ss = (k: string, v: any) => { store.update(sel.id, { style: { ...sel.style, [k]: v } }); flush(); };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project || !onUpdateProject) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `asset_${Date.now()}`;
      onUpdateProject({ ...project, assets: [...(project.assets ?? []), { id, name: file.name, type: "image" as const, source: reader.result as string }], lastModified: Date.now() });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div style={{ width: 260, padding: 12, overflowY: "auto", borderLeft: "1px solid #1e293b" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>{sel.type} <span style={{ color: "#64748b", fontWeight: 400 }}>{sel.id}</span></span>
        <button onClick={() => store.remove(sel.id)}
          style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 9, fontFamily: "monospace", background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 4, cursor: "pointer" }}>
          Delete
        </button>
      </div>

      {/* Content */}
      <InspectSection title="Content">
        {sel.type === "text" && <>
          <InspectField label="Text"><input value={sel.bindings.textTemplate ?? ""} onChange={e => sb("textTemplate", e.target.value)} style={inspInput} /></InspectField>
          <InspectField label="Font Size"><input value={sel.properties.fontSize ?? ""} onChange={e => sp("fontSize", e.target.value)} style={inspInput} placeholder="14px" /></InspectField>
        </>}
        {sel.type === "button" && <>
          <InspectField label="Label"><input value={sel.bindings.textTemplate ?? ""} onChange={e => sb("textTemplate", e.target.value)} style={inspInput} /></InspectField>
          <InspectField label="Action">
            <select value={sel.properties.buttonAction ?? "custom"} onChange={e => sp("buttonAction", e.target.value)} style={inspInput}>
              <option value="custom">Custom</option>
              <option value="save">Save</option>
              <option value="load">Load</option>
              <option value="rollback">Rollback</option>
              <option value="quit">Quit</option>
              <option value="close_overlay">Close Overlay</option>
              {screenNames?.filter(s => !["dialogue","menu","inventory","status","custom"].includes(s)).map(s => (
                <option key={s} value={`open_hud:${s}`}>Open HUD: {s}</option>
              ))}
            </select>
          </InspectField>
        </>}
        {sel.type === "image" && <>
          <InspectField label="Asset ID"><input value={sel.properties.assetId ?? ""} onChange={e => sp("assetId", e.target.value)} style={inspInput} /></InspectField>
          <InspectField label="Fit">
            <select value={sel.properties.fit ?? "cover"} onChange={e => sp("fit", e.target.value)} style={inspInput}>
              <option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option>
            </select>
          </InspectField>
        </>}
        {sel.type === "container" && <>
          <InspectField label="Direction">
            <select value={sel.properties.direction ?? ""} onChange={e => sp("direction", e.target.value)} style={inspInput}>
              <option value="">Freeform</option><option value="row">Row</option><option value="column">Column</option>
            </select>
          </InspectField>
          <InspectField label="Gap"><input value={sel.properties.gap ?? 0} onChange={e => sp("gap", Number(e.target.value))} style={inspInput} type="number" /></InspectField>
        </>}
      </InspectSection>

      {/* Appearance */}
      <InspectSection title="Appearance">
        <InspectField label="Type">
          <select value={sel.style.appearance?.type ?? "default"} onChange={e => {
            const t = e.target.value as "default" | "color" | "image";
            if (t === "default") ss("appearance", undefined);
            else if (t === "color") ss("appearance", { type: "color", backgroundColor: "#1e293b" });
            else ss("appearance", { type: "image", assetId: assets?.[0]?.id ?? "", fitMode: "stretch" });
          }} style={inspInput}>
            <option value="default">Default</option><option value="color">Color</option><option value="image">Image</option>
          </select>
        </InspectField>
        {sel.style.appearance?.type === "color" && (
          <InspectField label="Color"><input value={sel.style.appearance.backgroundColor ?? ""} onChange={e => ss("appearance", { ...sel.style.appearance, backgroundColor: e.target.value })} style={{ ...inspInput, width: 100 }} /></InspectField>
        )}
        {sel.style.appearance?.type === "image" && (
          <>
            <InspectField label="Asset">
              <select value={sel.style.appearance.assetId ?? ""} onChange={e => ss("appearance", { ...sel.style.appearance, assetId: e.target.value })} style={inspInput}>
                <option value="">— Select —</option>{(assets ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </InspectField>
            <InspectField label="Fit">
              <select value={sel.style.appearance.fitMode ?? "stretch"} onChange={e => ss("appearance", { ...sel.style.appearance, fitMode: e.target.value as any })} style={inspInput}>
                <option value="stretch">Stretch</option><option value="fit">Fit</option><option value="fill">Fill</option><option value="tile">Tile</option><option value="center">Center</option>
              </select>
            </InspectField>
          </>
        )}
        <InspectField label="Border Radius"><input value={sel.style.borderRadius ?? ""} onChange={e => ss("borderRadius", e.target.value)} style={inspInput} placeholder="8px" /></InspectField>
        <InspectField label="Box Shadow"><input value={sel.style.boxShadow ?? ""} onChange={e => ss("boxShadow", e.target.value)} style={inspInput} placeholder="0 4px 12px rgba(0,0,0,0.5)" /></InspectField>
        <InspectField label="Opacity"><input value={sel.style.opacity ?? 1} onChange={e => ss("opacity", Number(e.target.value))} style={{ ...inspInput, width: 60 }} type="number" min={0} max={1} step={0.1} /></InspectField>
      </InspectSection>

      {/* Layers */}
      <InspectSection title="Layers">
        <InspectField label="Layer">
          <input value={sel.layer ?? "default"} onChange={e => store.update(sel.id, { layer: e.target.value || undefined })}
            style={inspInput} placeholder="default" />
        </InspectField>
        <InspectField label="Z-Index">
          <input value={sel.transform.zIndex} onChange={e => store.update(sel.id, { transform: { ...sel.transform, zIndex: Number(e.target.value) } })}
            style={{ ...inspInput, width: 60 }} type="number" />
        </InspectField>
      </InspectSection>

      {/* Assets */}
      {project && onUpdateProject && (
        <InspectSection title="Project Assets">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {(assets ?? []).map(a => <span key={a.id} style={{ fontSize: 9, padding: "2px 6px", background: "#1e293b", borderRadius: 4, color: "#94a3b8" }}>{a.name}</span>)}
          </div>
          <label style={{ display: "inline-block", padding: "4px 10px", fontSize: 10, fontFamily: "monospace", background: "#6366f1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            + Upload
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
          </label>
        </InspectSection>
      )}
    </div>
  );
}

// ─── EditorV2 Main ───────────────────────────────────────────────

export function EditorV2({ project, onUpdateProject, onBack }: EditorV2Props) {
  const RESOLUTIONS = [
    { label: "800×600 (SVGA)", w: 800, h: 600 },
    { label: "1024×768 (XGA)", w: 1024, h: 768 },
    { label: "1280×720 (HD)", w: 1280, h: 720 },
    { label: "1366×768", w: 1366, h: 768 },
    { label: "1920×1080 (Full HD)", w: 1920, h: 1080 },
    { label: "2560×1440 (QHD)", w: 2560, h: 1440 },
  ];
  const layouts = project.uiLayouts ?? createEmptyLayouts();
  const [activeScreen, setActiveScreen] = useState(layouts.activeScreen ?? "dialogue");
  const [activeLayer, setActiveLayer] = useState("default");
  const [canvasRes, setCanvasRes] = useState(RESOLUTIONS[2]); // default 1280x720
  const elements = layouts.screens[activeScreen] ?? [];

  const saveLayouts = useCallback((screens: Record<string, UIElementV2[]>, screen?: string) => {
    const next: UILayoutCollection = { screens, activeScreen: screen ?? activeScreen };
    onUpdateProject?.({ ...project, uiLayouts: next, lastModified: Date.now() });
  }, [project, activeScreen, onUpdateProject]);

  const [store, setStore] = useState<ElementStore | null>(null);

  // Initialize store once from project data — never rebuild
  useEffect(() => {
    const s = createElementStore(elements);
    // Sync store -> project without causing re-render loop
    const unsub = setInterval(() => {
      const current = s.elements;
      const stored = layouts.screens[activeScreen] ?? [];
      if (JSON.stringify(current) !== JSON.stringify(stored)) {
        const screens = { ...layouts.screens, [activeScreen]: current };
        onUpdateProject?.({ ...project, uiLayouts: { screens, activeScreen }, lastModified: Date.now() });
      }
    }, 600); // slower sync, only for persistence
    setStore(s);
    return () => { clearInterval(unsub); };
  }, [activeScreen]);

  // Delete selected element via keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (store && store.selectedId && e.target instanceof HTMLElement && !e.target.closest("input,select,textarea")) {
          store.remove(store.selectedId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#020617", color: "#e2e8f0", fontFamily: "monospace" }}>
      {/* Title bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 12px", borderBottom: "1px solid #1e293b" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>UI Editor</span>
        {UI_SCREENS.map(name => (
          <button key={name} onClick={() => setActiveScreen(name)}
            style={{
              padding: "2px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 600,
              textTransform: "uppercase", borderRadius: 6,
              background: activeScreen === name ? "#6366f1" : "transparent",
              color: activeScreen === name ? "#fff" : "#64748b",
              border: "none", cursor: "pointer",
            }}>{name}</button>
        ))}
        {/* Resolution selector */}
        <select value={`${canvasRes.w}×${canvasRes.h}`} onChange={e => {
          const opt = RESOLUTIONS.find(r => `${r.w}×${r.h}` === e.target.value);
          if (opt) setCanvasRes(opt);
        }} style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 10, fontFamily: "monospace", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 4, cursor: "pointer" }}>
          {RESOLUTIONS.map(r => <option key={`${r.w}×${r.h}`} value={`${r.w}×${r.h}`}>{r.label}</option>)}
        </select>
        {onBack && (
          <button onClick={onBack} style={{ padding: "3px 12px", fontSize: 10, fontFamily: "monospace", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            ← Back
          </button>
        )}
      </div>

      {/* New Screen button */}
      <div style={{ display: "flex", gap: 4, padding: "2px 12px", borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
        <button onClick={() => {
          const name = prompt("Screen name:")?.trim().toLowerCase().replace(/\s+/g, "_");
          if (name && !layouts.screens[name]) {
            const screens = { ...layouts.screens, [name]: [] };
            onUpdateProject?.({ ...project, uiLayouts: { screens, activeScreen }, lastModified: Date.now() });
            setActiveScreen(name);
          }
        }}
          style={{ padding: "2px 10px", fontSize: 10, fontFamily: "monospace", background: "#1e293b", color: "#94a3b8", border: "1px dashed #334155", borderRadius: 6, cursor: "pointer" }}>
          + New Screen
        </button>
        {Object.keys(layouts.screens).filter(s => !UI_SCREENS.includes(s as any)).map(name => (
          <button key={name} onClick={() => setActiveScreen(name)}
            style={{
              padding: "2px 8px", fontSize: 9, fontFamily: "monospace",
              background: activeScreen === name ? "#6366f1" : "transparent",
              color: activeScreen === name ? "#fff" : "#64748b",
              border: "none", borderRadius: 4, cursor: "pointer",
            }}>{name}</button>
        ))}
      </div>

      {/* Component palette — top toolbar */}
      <div style={{ display: "flex", gap: 4, padding: "5px 12px", borderBottom: "1px solid #1e293b", flexWrap: "wrap", background: "#0f172a", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginRight: 4 }}>Add</span>
        {vnComponentList.map(c => (
          <button key={c.type} onClick={() => { const els = c.create(30 + Math.random() * 100, 30 + Math.random() * 100); els.forEach(el => store.add(el)); }}
            style={{ padding: "3px 10px", fontSize: 11, fontFamily: "monospace", background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}>
            {c.icon} {c.label}
          </button>
        ))}
        {store.elements.length > 0 && (
          <button onClick={() => { store.elements.forEach(e => store.remove(e.id)); }}
            style={{ padding: "3px 10px", fontSize: 10, fontFamily: "monospace", background: "#1e293b", color: "#f87171", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>

      {/* Main area: hierarchy | canvas | inspector */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 200, borderRight: "1px solid #1e293b", overflow: "auto" }}>
          <HierarchyPanel store={store} activeLayer={activeLayer} onLayerChange={setActiveLayer} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <CanvasV2 store={store} assets={project.assets} activeLayer={activeLayer} canvasW={canvasRes.w} canvasH={canvasRes.h} />
        </div>
        <InspectorV2 store={store} assets={project.assets} project={project} onUpdateProject={onUpdateProject} screenNames={Object.keys(layouts.screens)} />
      </div>
    </div>
  );
}
