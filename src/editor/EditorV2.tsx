import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { UIElementV2, ComputedLayout, ProjectAsset, BindingContext, ElementEvents, VNProject, UILayoutCollection, UILayer } from "../types";
import { createElementStore, ElementStore, createEmptyLayouts } from "./elementStore";
import { renderV2 } from "../widgets/pipelineV2";
import { primitiveRegistry, createRootContainer } from "../factories/primitiveRegistry";
import { runtimeWidgetRegistry } from "../factories/runtimeWidgetRegistry";

// ─── Props ──────────────────────────────────────────────────────

interface EditorV2Props {
  project: VNProject;
  onUpdateProject?: (project: VNProject) => void;
  onBack?: () => void;
}

// ─── Hierarchy Panel (with layer management) ────────────────────

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function HierarchyPanel({ store, activeLayer, onLayerChange, layers, onAddLayer, onToggleLayer, onToggleLock, onDeleteLayer, onRenameLayer, onReorderLayers }: {
  store: ElementStore; activeLayer: string; onLayerChange: (l: string) => void;
  layers: UILayer[];
  onAddLayer?: (id: string, name: string) => void; onToggleLayer?: (id: string) => void; onToggleLock?: (id: string) => void;
  onDeleteLayer?: (id: string) => void; onRenameLayer?: (id: string, newName: string) => void;
  onReorderLayers?: (fromIdx: number, toIdx: number) => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 100); return () => clearInterval(id); }, []);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const sorted = useMemo(() => [...layers].sort((a, b) => a.order - b.order), [layers]);

  const topLevel = useMemo(() => store.elements.filter(e => !e.parentId && e.type !== "container" && (e.layerId ?? e.layer ?? "default") === activeLayer), [store, tick, activeLayer]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, padding: "6px 8px", overflow: "auto" }}>
        <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Elements</div>
        {topLevel.length === 0 && <div style={{ color: "#475569", fontSize: 10, fontStyle: "italic", padding: 4 }}>No elements on this layer.</div>}
        {topLevel.map(el => <HierarchyNode key={el.id} element={el} store={store} depth={0} />)}
      </div>

      <div style={{ padding: "6px 8px", borderTop: "1px solid #1e293b", maxHeight: 240, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Layers</span>
          <button onClick={() => {
            const n = prompt("Layer name:");
            if (n && !layers.some(l => l.name === n)) { const lid = id("lyr"); onAddLayer?.(lid, n); onLayerChange(lid); }
          }} style={{ padding: "1px 6px", fontSize: 9, fontFamily: "monospace", background: "transparent", color: "#64748b", border: "1px dashed #475569", borderRadius: 4, cursor: "pointer" }}>+ New</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sorted.map((layer, idx) => {
            const isActive = activeLayer === layer.id;
            const isEditing = editingId === layer.id;
            const isDefault = layer.id === "default";
            return (
              <div key={layer.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) { onReorderLayers?.(dragIdx, idx); setDragIdx(idx); } }}
                onDragEnd={() => setDragIdx(null)}
                onClick={() => onLayerChange(layer.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", borderRadius: 4, cursor: "pointer", userSelect: "none",
                  background: isActive ? "#6366f120" : "transparent",
                  border: isActive ? "1px solid #6366f140" : "1px solid transparent",
                }}>
                <span style={{ fontSize: 10, color: "#475569", cursor: "grab" }}>⠿</span>
                <span onClick={(e) => { e.stopPropagation(); onToggleLayer?.(layer.id); }} style={{ fontSize: 11, cursor: "pointer", color: layer.visible ? "#94a3b8" : "#334155" }}>
                  {layer.visible ? "◉" : "◌"}
                </span>
                <span onClick={(e) => { e.stopPropagation(); onToggleLock?.(layer.id); }} style={{ fontSize: 10, cursor: "pointer", color: layer.locked ? "#f87171" : "#475569" }}>
                  {layer.locked ? "🔒" : "🔓"}
                </span>
                {isEditing ? (
                  <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => { if (editValue) onRenameLayer?.(layer.id, editValue); setEditingId(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { if (editValue) onRenameLayer?.(layer.id, editValue); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                    style={{ flex: 1, padding: "1px 4px", fontSize: 10, fontFamily: "monospace", background: "#0f172a", color: "#e2e8f0", border: "1px solid #6366f1", borderRadius: 2, outline: "none" }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 10, color: isActive ? "#a5b4fc" : layer.locked ? "#64748b" : "#cbd5e1", fontFamily: "monospace" }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(layer.id); setEditValue(layer.name); }}>
                    {layer.name}
                  </span>
                )}
                {!isDefault && (
                  <button onClick={(e) => { e.stopPropagation(); onDeleteLayer?.(layer.id); }}
                    style={{ padding: 0, fontSize: 10, background: "transparent", color: "#475569", border: "none", cursor: "pointer", opacity: 0.5 }}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
        {(element as any).properties?._role && (
          <span style={{ marginLeft: 4, fontSize: 8, color: "#818cf8", background: "#312e8120", padding: "0 4px", borderRadius: 3 }}>{(element as any).properties._role}</span>
        )}
        <span style={{ marginLeft: 4 }}>{element.id}</span>
      </div>
      {expanded && children.map(ch => <HierarchyNode key={ch.id} element={ch} store={store} depth={depth + 1} />)}
    </div>
  );
}

// ─── Selection overlay constants ─────────────────────────────────

const HANDLE = 8;
const SNAP = (v: number) => Math.round(v / 10) * 10;
const GRID = 10; // dot grid and snap spacing

// ─── CanvasV2 ────────────────────────────────────────────────────

function CanvasV2({ store, assets, activeLayer, canvasW, canvasH, storeVersion, hiddenLayerIds, layers }: {
  store: ElementStore; assets?: ProjectAsset[]; activeLayer?: string; canvasW?: number; canvasH?: number; storeVersion?: number; hiddenLayerIds?: Set<string>; layers?: UILayer[];
}) {
  const [, tick] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragRef = useRef<{
    elId: string; startX: number; startY: number;
    mode: 'move' | 'resize' | 'reparent' | 'pegboard-move' | 'pegboard-resize';
    dir?: string; layoutMode?: string; parentDir?: string;
    orig: { x?: number; y?: number; w?: number; h?: number; basis?: number;
            row?: number; col?: number; rowSpan?: number; colSpan?: number };
    dropTargetId?: string;
    dropIndex?: number;
  } | null>(null);
  const clickRef = useRef<{ elId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const layouts = useMemo(() => store.getLayouts(), [store, tick, storeVersion]);
  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;
  const hiddenRef = useRef(hiddenLayerIds ?? new Set());
  hiddenRef.current = hiddenLayerIds ?? new Set();

  const selectedLayout = store.selectedId ? layouts.get(store.selectedId) : null;

  // ── Mousedown: select element; start drag ──
  const handleMouseDown = useCallback((e: React.MouseEvent, elId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = store.getById(elId);
    if (!el || (!el.parentId && el.type === "container")) return;
    const elLayerId = el.layerId ?? el.layer ?? "default";
    if (layers?.some(l => l.id === elLayerId && l.locked)) return;
    store.select(elId);
    tick(n => n + 1);
    const l = el.layout as any;
    clickRef.current = null;
    if (l.mode === "pegboard") {
      dragRef.current = {
        elId, startX: e.clientX, startY: e.clientY,
        mode: 'pegboard-move',
        orig: { row: l.row ?? 1, col: l.col ?? 1, rowSpan: l.rowSpan ?? 1, colSpan: l.colSpan ?? 1 },
      };
      return;
    }
    if (l.mode === "freeform") {
      dragRef.current = {
        elId, startX: e.clientX, startY: e.clientY,
        mode: 'move',
        orig: { x: l.x ?? 0, y: l.y ?? 0, w: l.width ?? 100, h: l.height ?? 100 },
      };
      return;
    }
    dragRef.current = {
      elId, startX: e.clientX, startY: e.clientY,
      mode: 'reparent',
      orig: { x: 0, y: 0, w: 0, h: 0 },
      dropTargetId: undefined,
    };
  }, [store, layers]);

  const handleHandleMouseDown = useCallback((e: React.MouseEvent, elId: string, dir: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = store.getById(elId);
    if (!el) return;
    if (!el.parentId && el.type === "container") return;
    const elLayerId = el.layerId ?? el.layer ?? "default";
    if (layers?.some(l => l.id === elLayerId && l.locked)) return;
    store.select(elId);
    tick(n => n + 1);
    const l = el.layout as any;
    if (l.mode === "pegboard") {
      dragRef.current = {
        elId, startX: e.clientX, startY: e.clientY,
        mode: 'pegboard-resize', dir,
        orig: { row: l.row ?? 1, col: l.col ?? 1, rowSpan: l.rowSpan ?? 1, colSpan: l.colSpan ?? 1 },
      };
      return;
    }
    const parent = el.parentId ? store.getById(el.parentId) : undefined;
    const parentDir = (parent?.properties?.direction as string) || "column";
    dragRef.current = {
      elId, startX: e.clientX, startY: e.clientY,
      mode: 'resize', dir, layoutMode: l.mode ?? "freeform", parentDir,
      orig: { x: l.x ?? 0, y: l.y ?? 0, w: l.width ?? 100, h: l.height ?? 100, basis: l.basis },
    };
  }, [store, layers]);

  // ── Global mousemove / mouseup ──
  const lastDragUpdate = useRef(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Compute pegboard grid info from an element's parent container
    const parentGrid = (elId: string) => {
      const el = store.getById(elId);
      if (!el || !el.parentId) return null;
      const parent = store.getById(el.parentId);
      if (!parent) return null;
      const pp = (parent.properties ?? {}) as any;
      const cols = pp.pegboardColumns ?? 12;
      const rows = pp.pegboardRows ?? 12;
      const gap = pp.gap ?? 0;
      const pad = pp.padding ?? 0;
      const pl = layoutsRef.current.get(parent.id);
      if (!pl) return null;
      const cw = ((pl.width - pad * 2) - gap * (cols - 1)) / cols;
      const ch = ((pl.height - pad * 2) - gap * (rows - 1)) / rows;
      if (cw <= 0 || ch <= 0) return null;
      return { cols, rows, gap, pad, cw, ch, stepX: cw + gap, stepY: ch + gap };
    };

    const mm = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      const now = Date.now();
      if (now - lastDragUpdate.current < 50 && (d.mode === 'move' || d.mode === 'resize')) return;
      lastDragUpdate.current = now;

      if (d.mode === 'move') {
        const nx = SNAP(Math.max(0, d.orig.x + dx));
        const ny = SNAP(Math.max(0, d.orig.y + dy));
        store.update(d.elId, { layout: { mode: "freeform", x: nx, y: ny, width: d.orig.w, height: d.orig.h } });
        tick(n => n + 1);
      } else if (d.mode === 'resize' && d.dir) {
        if (d.layoutMode === "freeform") {
          let { x, y, w, h } = d.orig;
          const sdx = SNAP(dx);
          const sdy = SNAP(dy);
          if (d.dir.includes('e')) w = Math.max(20, d.orig.w + sdx);
          if (d.dir.includes('w')) { x = d.orig.x + sdx; w = Math.max(20, d.orig.w - sdx); }
          if (d.dir.includes('s')) h = Math.max(20, d.orig.h + sdy);
          if (d.dir.includes('n')) { y = d.orig.y + sdy; h = Math.max(20, d.orig.h - sdy); }
          store.update(d.elId, { layout: { mode: "freeform", x, y, width: w, height: h } });
          tick(n => n + 1);
        } else {
          // Only the layout-appropriate handles resize: vertical in column, horizontal in row
          const parentDir = d.parentDir ?? "column";
          const isVert = d.dir.includes('s') || d.dir.includes('n');
          const isHoriz = d.dir.includes('e') || d.dir.includes('w');
          const canResize = (parentDir === "column" && isVert) || (parentDir === "row" && isHoriz);
          if (!canResize) return;
          const isEastSouth = d.dir.includes('e') || d.dir.includes('s');
          const eff = isVert ? dy : dx;
          const raw = eff < 0 ? -Math.round(-eff / 5) * 5 : Math.round(eff / 5) * 5;
          const change = isEastSouth ? raw : -raw;
          if (change === 0) return;
          const cur = store.getById(d.elId);
          const curLayout = cur?.layout as any;
          const curBasis = curLayout.basis ?? 100;
          const newBasis = Math.max(20, curBasis + change);
          store.update(d.elId, { layout: { ...curLayout, basis: newBasis } as any });
          tick(n => n + 1);
        }
      } else if (d.mode === 'pegboard-move') {
        const pg = parentGrid(d.elId);
        if (!pg) return;
        const colDelta = Math.round(dx / pg.stepX);
        const rowDelta = Math.round(dy / pg.stepY);
        const newCol = Math.max(1, Math.min(pg.cols - (d.orig.colSpan ?? 1) + 1, (d.orig.col ?? 1) + colDelta));
        const newRow = Math.max(1, Math.min(pg.rows - (d.orig.rowSpan ?? 1) + 1, (d.orig.row ?? 1) + rowDelta));
        const cur = store.getById(d.elId);
        const curLayout = cur?.layout as any;
        if (newCol !== curLayout.col || newRow !== curLayout.row) {
          store.update(d.elId, { layout: { ...curLayout, row: newRow, col: newCol } as any });
          tick(n => n + 1);
        }
      } else if (d.mode === 'pegboard-resize' && d.dir) {
        const pg = parentGrid(d.elId);
        if (!pg) return;
        let row = d.orig.row ?? 1, col = d.orig.col ?? 1;
        let rowSpan = d.orig.rowSpan ?? 1, colSpan = d.orig.colSpan ?? 1;
        if (d.dir.includes('e')) {
          const delta = Math.round(dx / pg.stepX);
          colSpan = Math.max(1, Math.min(pg.cols - col + 1, colSpan + delta));
        }
        if (d.dir.includes('w')) {
          const delta = Math.round(dx / pg.stepX);
          const newSpan = Math.max(1, Math.min(pg.cols - col + 1, colSpan - delta));
          col = col + (colSpan - newSpan);
          colSpan = newSpan;
        }
        if (d.dir.includes('s')) {
          const delta = Math.round(dy / pg.stepY);
          rowSpan = Math.max(1, Math.min(pg.rows - row + 1, rowSpan + delta));
        }
        if (d.dir.includes('n')) {
          const delta = Math.round(dy / pg.stepY);
          const newSpan = Math.max(1, Math.min(pg.rows - row + 1, rowSpan - delta));
          row = row + (rowSpan - newSpan);
          rowSpan = newSpan;
        }
        const cur = store.getById(d.elId);
        const curLayout = cur?.layout as any;
        if (rowSpan !== curLayout.rowSpan || colSpan !== curLayout.colSpan || row !== curLayout.row || col !== curLayout.col) {
          store.update(d.elId, { layout: { ...curLayout, row, col, rowSpan, colSpan } as any });
          tick(n => n + 1);
        }
      } else if (d.mode === 'reparent') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let targetId: string | undefined;
        const el = store.getById(d.elId);
        for (const other of store.elements) {
          if (!other.parentId && other.type === "container") continue;
          if (other.id === d.elId) continue;
          if (other.type !== "container") continue;
          if (hiddenRef.current.has(other.layerId ?? other.layer ?? "default")) continue;
          const ol = layoutsRef.current.get(other.id);
          if (!ol) continue;
          if (mx >= ol.x && mx <= ol.x + ol.width && my >= ol.y && my <= ol.y + ol.height) {
            if (el && (el.parentId === other.id || store.getAncestors(other.id).some(a => a.id === d.elId))) continue;
            targetId = other.id;
            break;
          }
        }
        if (d.dropTargetId !== targetId) {
          d.dropTargetId = targetId;
          tick(n => n + 1);
        }
      }
    };

    const mu = () => {
      const d = dragRef.current;
      if (d?.mode === 'reparent' && d.dropTargetId) {
        const el = store.getById(d.elId);
        if (el && el.parentId !== d.dropTargetId) {
          store.reparent(d.elId, d.dropTargetId);
          tick(n => n + 1);
        }
      }
      dragRef.current = null;
      clickRef.current = null;
      lastDragUpdate.current = 0;
      setHoveredId(null);
    };

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [store, activeLayer]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) store.select(null);
  }, [store]);

  const cw = canvasW ?? 1280;
  const ch = canvasH ?? 720;
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 12, background: "#020617" }}>
      <div ref={canvasRef} style={{ position: "relative", width: cw, height: ch, background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b" }}
        onClick={handleCanvasClick}>
        {/* Dot grid */}
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width={cw} height={ch}>
          <defs>
            <pattern id="editorv2-dots" x="0" y="0" width={GRID * 2} height={GRID * 2} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.75} fill="rgba(255,255,255,0.04)" />
              <circle cx={GRID} cy={GRID} r={0.75} fill="rgba(255,255,255,0.04)" />
            </pattern>
          </defs>
          <rect width={cw} height={ch} fill="url(#editorv2-dots)" />
        </svg>

        {/* Elements — containers render as regions, elements render from pipeline */}
        {(() => {
          const visibleElements = store.elements.filter(e => !(hiddenLayerIds ?? new Set()).has(e.layerId ?? e.layer ?? "default"));
          const renderedNodes = renderV2(visibleElements, undefined, undefined, assets, cw, ch);
          const isRootEl = (el: UIElementV2) => !el.parentId && el.type === "container";
          const childCount = new Map<string, number>();
          store.elements.forEach(e => { if (e.parentId) childCount.set(e.parentId, (childCount.get(e.parentId) ?? 0) + 1); });
          const isDragging = dragRef.current?.mode === 'reparent';
          const dropTarget = isDragging ? dragRef.current?.dropTargetId : undefined;
          return visibleElements.map((el) => {
            if (isRootEl(el)) return null;
            const node = renderedNodes.get(el.id);
            const l = layouts.get(el.id);
            if (!l) return null;
            const isContainer = el.type === "container";
            const isEmpty = isContainer && (childCount.get(el.id) ?? 0) === 0;
            const isHovered = hoveredId === el.id;
            const isDropTarget = dropTarget === el.id;

            if (isContainer) {
              const lm = el.layout?.mode;
              const label = lm === "pegboard" ? `Peg ${(el.layout as any).col},${(el.layout as any).row}` :
                            el.properties?.direction === "row" ? "Row" :
                            el.properties?.direction === "column" ? "Column" :
                            lm === "freeform" ? "Overlay" : "Grid";
              return (
                <div key={el.id}>
                  {/* Region background + outline */}
                  <div style={{
                    position: "absolute", left: l.x, top: l.y,
                    width: l.width, height: l.height,
                    border: isDropTarget ? "2px solid #6366f1" :
                             isHovered ? "1px solid #818cf8" :
                             isEmpty ? "1px dashed #475569" :
                             "1px solid #334155",
                    borderRadius: 6,
                    background: isDropTarget ? "rgba(99, 102, 241, 0.08)" :
                                 isEmpty ? "rgba(15, 23, 42, 0.3)" :
                                 "rgba(15, 23, 42, 0.08)",
                    pointerEvents: "none", zIndex: 0,
                  }}>
                    <div style={{
                      position: "absolute", top: 2, left: 4,
                      fontSize: 9, color: "#94a3b8", fontFamily: "monospace",
                    }}>
                      {label}
                    </div>
                  </div>
                  {/* Hit area + empty placeholder */}
                  <div onMouseDown={(e) => handleMouseDown(e, el.id)}
                    onMouseEnter={() => setHoveredId(el.id)}
                    onMouseLeave={() => setHoveredId(prev => prev === el.id ? null : prev)}
                    style={{
                      position: "absolute", left: l.x, top: l.y,
                      width: l.width, height: l.height,
                      cursor: "pointer", zIndex: 1,
                    }}>
                    {isEmpty && !isDragging && (
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{
                          fontSize: 10, color: "#6366f1", fontFamily: "monospace",
                          padding: "4px 12px", background: "rgba(99, 102, 241, 0.12)",
                          borderRadius: 4, border: "1px dashed #6366f1", cursor: "pointer",
                          pointerEvents: "auto",
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const txt = primitiveRegistry.find(p => p.type === "text");
                          if (txt) {
                            const els = txt.create().map(e2 => ({ ...e2, parentId: el.id }));
                            els.forEach(e2 => store.add(e2));
                          }
                          tick(n => n + 1);
                        }}>
                          + Add Element
                        </span>
                      </div>
                    )}
                    {isDropTarget && (
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        pointerEvents: "none",
                      }}>
                        <span style={{
                          fontSize: 10, color: "#e2e8f0", fontFamily: "monospace",
                          padding: "4px 12px", background: "rgba(99, 102, 241, 0.25)",
                          borderRadius: 4, border: "1px solid #6366f1",
                        }}>
                          Drop here
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Non-container: pipeline output + hit area
            return (
              <div key={el.id} style={{ position: "relative" }}>
                {node}
                <div onMouseDown={(e) => handleMouseDown(e, el.id)}
                  onMouseEnter={() => setHoveredId(el.id)}
                  onMouseLeave={() => setHoveredId(prev => prev === el.id ? null : prev)}
                  style={{
                    position: "absolute", left: l.x, top: l.y,
                    width: l.width, height: l.height,
                    cursor: el.layout.mode === "freeform" ? "move" : "grab",
                    zIndex: 900,
                  }} />
              </div>
            );
          });
        })()}

        {/* Selection overlay — hidden for root container */}
        {selectedLayout && store.selectedId && (() => {
          const selEl = store.getById(store.selectedId);
          if (selEl && !selEl.parentId && selEl.type === "container") return null;
          return <>
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
          </>;
        })()}

        {/* Drop indicator for reparent drag */}
        {(() => {
          const dr = dragRef.current;
          if (!dr || dr.mode !== 'reparent' || !dr.dropTargetId) return null;
          const tl = layoutsRef.current.get(dr.dropTargetId);
          if (!tl) return null;
          const tgt = store.getById(dr.dropTargetId);
          const isRow = tgt?.properties?.direction === "row";
          if (isRow) {
            const x = tl.x + tl.width - 2;
            return <div style={{ position: "absolute", left: x, top: tl.y + 2, width: 4, height: tl.height - 4, background: "#818cf8", borderRadius: 2, boxShadow: "0 0 8px rgba(129,140,248,0.5)", zIndex: 1001, pointerEvents: "none" }} />;
          }
          const y = tl.y + tl.height - 2;
          return <div style={{ position: "absolute", left: tl.x + 2, top: y, width: tl.width - 4, height: 4, background: "#818cf8", borderRadius: 2, boxShadow: "0 0 8px rgba(129,140,248,0.5)", zIndex: 1001, pointerEvents: "none" }} />;
        })()}
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

  if (!sel || (!sel.parentId && sel.type === "container")) return <div style={{ width: 260, padding: 12, color: "#475569", fontSize: 10, fontStyle: "italic" }}>Select an element</div>;

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
        {/* Runtime widgets: fields from registry */}
        {(() => {
          const rwDef = runtimeWidgetRegistry[sel.type];
          if (rwDef) {
            return rwDef.inspectorGroups.map(group => (
              <div key={group.title} style={{ marginBottom: 12 }}>
                <div style={{ color: "#64748b", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{group.title}</div>
                {group.fields.map(f => (
                  <InspectField key={f.key} label={f.label}>
                    {f.type === "select" ? (
                      <select value={sel.properties[f.key] ?? ""} onChange={e => sp(f.key, e.target.value)} style={inspInput}>
                        {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === "boolean" ? (
                      <input type="checkbox" checked={!!sel.properties[f.key]} onChange={e => sp(f.key, e.target.checked)} style={{ cursor: "pointer" }} />
                    ) : f.type === "number" ? (
                      <input type="number" value={sel.properties[f.key] ?? ""} onChange={e => sp(f.key, Number(e.target.value))} style={inspInput} min={f.min} max={f.max} step={f.step} placeholder={f.placeholder} />
                    ) : (
                      <input value={sel.properties[f.key] ?? ""} onChange={e => sp(f.key, e.target.value)} style={inspInput} placeholder={f.placeholder} />
                    )}
                  </InspectField>
                ))}
              </div>
            ));
          }
          return null;
        })()}

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
          <input value={sel.layerId ?? sel.layer ?? "default"} onChange={e => store.update(sel.id, { layerId: e.target.value || undefined })}
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

  const [store, setStore] = useState<ElementStore | null>(null);
  const [storeVersion, setStoreVersion] = useState(0);
  const [editorLayers, setEditorLayers] = useState<UILayer[]>(
    () => layouts.layers ?? [{ id: "default", name: "Default", visible: true, locked: false, order: 0 }]
  );

  // Sync local layers when project changes (e.g. on mount / screen switch)
  useEffect(() => {
    setEditorLayers(layouts.layers ?? [{ id: "default", name: "Default", visible: true, locked: false, order: 0 }]);
  }, [layouts.layers]);

  const persistLayers = useCallback((layers: UILayer[]) => {
    onUpdateProject?.({ ...project, uiLayouts: { ...layouts, layers }, lastModified: Date.now() });
  }, [project, layouts, onUpdateProject]);

  const saveLayouts = useCallback((screens: Record<string, UIElementV2[]>, screen?: string) => {
    const next: UILayoutCollection = { screens, activeScreen: screen ?? activeScreen, layers: editorLayers };
    onUpdateProject?.({ ...project, uiLayouts: next, lastModified: Date.now() });
  }, [project, activeScreen, onUpdateProject, editorLayers]);

  const hiddenLayerIds = new Set(editorLayers.filter(l => !l.visible).map(l => l.id));

  // Find the container to insert new elements into
  const findContainerForAdd = useCallback((s: ElementStore): string | undefined => {
    const sel = s.selectedId ? s.getById(s.selectedId) : undefined;
    if (sel?.type === "container") return sel.id;
    if (sel?.parentId) {
      const parent = s.getById(sel.parentId);
      if (parent?.type === "container") return parent.id;
    }
    // Fallback to root container when nothing is selected
    const root = s.elements.find(e => !e.parentId && e.type === "container");
    return root?.id;
  }, []);

  // Initialize store from project data — auto-create root container on empty screens
  useEffect(() => {
    const s = createElementStore(elements, () => setStoreVersion(n => n + 1));
    if (s.elements.length === 0) {
      s.add(createRootContainer(canvasRes.w, canvasRes.h));
      s.select(null); // root is infrastructure, don't leave it selected
    }
    // Sync store -> project without causing re-render loop
    const unsub = setInterval(() => {
      const current = s.elements;
      const stored = layouts.screens[activeScreen] ?? [];
      if (JSON.stringify(current) !== JSON.stringify(stored)) {
        const screens = { ...layouts.screens, [activeScreen]: current };
        onUpdateProject?.({ ...project, uiLayouts: { screens, activeScreen, layers: editorLayers }, lastModified: Date.now() });
      }
    }, 600); // slower sync, only for persistence
    setStore(s);
    return () => { clearInterval(unsub); };
  }, [activeScreen]);

  // Sync root container dimensions with canvas resolution
  useEffect(() => {
    if (!store) return;
    const roots = store.elements.filter(e => !e.parentId);
    for (const root of roots) {
      const l = root.layout as { mode: string; width?: number; height?: number };
      if (l.mode === "freeform" && (l.width !== canvasRes.w || l.height !== canvasRes.h)) {
        store.update(root.id, { layout: { mode: "freeform", x: 0, y: 0, width: canvasRes.w, height: canvasRes.h } });
      }
    }
  }, [canvasRes, store]);

  // Delete selected element via keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (store && store.selectedId && e.target instanceof HTMLElement && !e.target.closest("input,select,textarea")) {
          const sel = store.getById(store.selectedId);
          if (sel && !sel.parentId && sel.type === "container") return; // cannot delete root
          store.remove(store.selectedId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  const allScreens = Object.keys(layouts.screens);

  if (!store) {
    return <div style={{ padding: 40, color: "#64748b" }}>Initializing...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#020617", color: "#e2e8f0", fontFamily: "monospace" }}>
      {/* Title bar: screen tabs + new screen + resolution + back */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderBottom: "1px solid #1e293b", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 8 }}>Menu Layouts</span>
        {allScreens.map(name => (
          <button key={name} onClick={() => setActiveScreen(name)}
            style={{
              padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 600,
              textTransform: "capitalize", borderRadius: 6,
              background: activeScreen === name ? "#6366f1" : "#1e293b",
              color: activeScreen === name ? "#fff" : "#94a3b8",
              border: "1px solid", borderColor: activeScreen === name ? "#6366f1" : "#334155",
              cursor: "pointer",
            }}>{name === "main" ? "Main" : name}</button>
        ))}
        <button onClick={() => {
          const name = prompt("Screen name:")?.trim().toLowerCase().replace(/\s+/g, "_");
          if (name && !layouts.screens[name]) {
            const screens = { ...layouts.screens, [name]: [] };
            onUpdateProject?.({ ...project, uiLayouts: { screens, activeScreen }, lastModified: Date.now() });
            setActiveScreen(name);
          }
        }}
          style={{ padding: "3px 8px", fontSize: 10, fontFamily: "monospace", background: "transparent", color: "#64748b", border: "1px dashed #475569", borderRadius: 6, cursor: "pointer" }}>
          + New
        </button>
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

      {/* Primitive palette — top toolbar */}
      <div style={{ display: "flex", gap: 4, padding: "5px 12px", borderBottom: "1px solid #1e293b", flexWrap: "wrap", background: "#0f172a", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginRight: 4 }}>Add</span>
        {primitiveRegistry.map(p => {
          const canAdd = findContainerForAdd(store) !== undefined;
          return (
            <button key={p.label} onClick={() => {
              if (!canAdd) return;
              const containerId = findContainerForAdd(store)!;
              const els = p.create().map(el => ({ ...el, parentId: el.parentId ?? containerId }));
              els.forEach(el => store.add(el));
            }}
              style={{
                padding: "3px 10px", fontSize: 11, fontFamily: "monospace",
                background: canAdd ? "#1e293b" : "#0f172a",
                color: canAdd ? "#e2e8f0" : "#475569",
                border: "1px solid", borderColor: canAdd ? "#334155" : "#1e293b",
                borderRadius: 6, cursor: canAdd ? "pointer" : "not-allowed",
              }}>
              {p.icon} {p.label}
            </button>
          );
        })}
      </div>

      {/* Main area: hierarchy | canvas | inspector */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 200, borderRight: "1px solid #1e293b", overflow: "auto" }}>
          <HierarchyPanel store={store} activeLayer={activeLayer} onLayerChange={setActiveLayer}
            layers={editorLayers}
            onAddLayer={(id, name) => {
              const next = [...editorLayers, { id, name, visible: true, locked: false, order: editorLayers.length }];
              setEditorLayers(next); persistLayers(next);
            }}
            onToggleLayer={(id) => {
              const next = editorLayers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
              setEditorLayers(next); persistLayers(next);
            }}
            onToggleLock={(id) => {
              const next = editorLayers.map(l => l.id === id ? { ...l, locked: !l.locked } : l);
              setEditorLayers(next); persistLayers(next);
            }}
            onDeleteLayer={(id) => {
              store.elements.filter(e => (e.layerId ?? e.layer ?? "default") === id).forEach(e => store.remove(e.id));
              const next = editorLayers.filter(l => l.id !== id);
              setEditorLayers(next); persistLayers(next);
              if (activeLayer === id) setActiveLayer("default");
            }}
            onRenameLayer={(id, newName) => {
              const next = editorLayers.map(l => l.id === id ? { ...l, name: newName } : l);
              setEditorLayers(next); persistLayers(next);
            }}
            onReorderLayers={(from, to) => {
              const arr = [...editorLayers]; const [item] = arr.splice(from, 1); arr.splice(to, 0, item);
              const next = arr.map((l, i) => ({ ...l, order: i }));
              setEditorLayers(next); persistLayers(next);
            }}
          />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <CanvasV2 store={store} assets={project.assets} activeLayer={activeLayer} canvasW={canvasRes.w} canvasH={canvasRes.h} storeVersion={storeVersion} hiddenLayerIds={hiddenLayerIds} layers={editorLayers} />
        </div>
        <InspectorV2 store={store} assets={project.assets} project={project} onUpdateProject={onUpdateProject} screenNames={Object.keys(layouts.screens)} />
      </div>
    </div>
  );
}
