import React, { useMemo, useState } from "react";
import type { WidgetConfig } from "../types";
import type { WidgetRuntimeProps } from "../widgets/index";
import type { UIElementV2, BindingContext, ComputedLayout, ComputedStyle, RenderProperties, ResolvedBindings } from "../types";
import { WidgetRenderer, REGISTRY } from "../widgets/index";
import { evaluateBindings } from "../utils/bindingEvaluator";
import { resolveProperties } from "../utils/propertyResolver";
import { computeLayouts } from "../utils/layoutEngine";
import { resolveStyle } from "../utils/styleResolver";
import { ElementRenderer } from "../widgets/elementRenderer";
import { testCases, complexTestCase, generateStressTest } from "./testElements";

// ─── Pipeline Snapshot ───────────────────────────────────────────

interface PipelineSnapshot {
  bindings: ResolvedBindings | null;
  renderProps: RenderProperties | null;
  layout: ComputedLayout | null;
  style: ComputedStyle | null;
}

function capturePipeline(el: UIElementV2, allElements: UIElementV2[], context?: BindingContext): PipelineSnapshot {
  const bindings = evaluateBindings(el, context);
  const renderProps = resolveProperties(el, bindings, context);
  const layouts = computeLayouts(allElements);
  const layout = layouts.get(el.id) ?? null;
  const style = resolveStyle(el.style);
  return { bindings, renderProps, layout, style };
}

// ─── Comparison helpers ──────────────────────────────────────────

function shallowCompare(a: any, b: any, keys: string[]): { key: string; pass: boolean }[] {
  return keys.map(key => ({
    key,
    pass: String(a?.[key] ?? "") === String(b?.[key] ?? ""),
  }));
}

// ─── Single test case card ───────────────────────────────────────

function TestCard({ name, legacyConfig, v2Elements, runtime, context, assets }: {
  name: string;
  legacyConfig: WidgetConfig;
  v2Elements: UIElementV2[];
  runtime?: WidgetRuntimeProps;
  context?: BindingContext;
  assets?: import("../types").ProjectAsset[];
}) {
  const [showPipeline, setShowPipeline] = useState(false);
  const [showSources, setShowSources] = useState(false);

  // For V2 we render the last non-container element (usually the text widget)
  const lastTextElement = useMemo(() => {
    const all = v2Elements.filter(e => e.type !== "container");
    return all[all.length - 1] ?? v2Elements[0];
  }, [v2Elements]);

  const snapshot = useMemo(() => capturePipeline(lastTextElement, v2Elements, context), [lastTextElement, v2Elements, context]);

  // Compute legacy computed position (simple — no parent offset, just x/y)
  function legacyComputed(config: WidgetConfig): { left: number; top: number; width: number; height: number } {
    return { left: config.x, top: config.y, width: config.w, height: config.h };
  }
  const legPos = legacyComputed(legacyConfig.type === "container" && legacyConfig.children?.[0] ? legacyConfig.children[0] : legacyConfig);

  // Comparisons
  const v2TextEl = lastTextElement;
  const comparisons = v2TextEl ? shallowCompare(
    { x: legPos.left, y: legPos.top, w: legPos.width, h: legPos.height, opacity: 1 },
    snapshot.layout ? { x: snapshot.layout.x - (v2Elements.find(e => e.id === v2TextEl.parentId)?.layout?.["x" as any] ?? 0), y: snapshot.layout.y - (v2Elements.find(e => e.id === v2TextEl.parentId)?.layout?.["y" as any] ?? 0), w: snapshot.layout.width, h: snapshot.layout.height, opacity: snapshot.style?.opacity ?? 1 } : {},
    ["x", "y", "w", "h", "opacity"]
  ) : [];

  // Legacy render
  const renderLegacy = () => {
    // If container, render children directly for simplicity
    const items = legacyConfig.type === "container" ? (legacyConfig.children ?? [legacyConfig]) : [legacyConfig];
    return items.map(cfg => (
      <WidgetRenderer
        key={cfg.id}
        project={{ inventory: [], trackers: [], flags: [], entities: [], nodes: {} } as any}
        config={cfg}
        runtime={runtime}
      />
    ));
  };

  return (
    <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 16, marginBottom: 16, background: "#0f172a" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: 14, margin: "0 0 12px 0", fontFamily: "monospace" }}>{name}</h3>

      {/* Side-by-side renderers */}
      <div style={{ display: "flex", gap: 24 }}>
        {/* Legacy */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4, fontWeight: 600 }}>LEGACY</div>
          <div style={{
            position: "relative", width: legPos.width + legPos.left + 40, height: legPos.height + legPos.top + 40,
            background: "#1e293b", borderRadius: 8, overflow: "hidden",
          }}>
            {renderLegacy()}
          </div>
        </div>

        {/* V2 */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4, fontWeight: 600 }}>V2</div>
          <div style={{
            position: "relative", width: 800, height: 600,
            background: "#1e293b", borderRadius: 8, overflow: "hidden",
          }}>
            {snapshot.bindings?.visible !== false && v2Elements.map(el => {
              const layouts = computeLayouts(v2Elements);
              const comp = layouts.get(el.id);
              if (!comp) return null;
              const bindings = evaluateBindings(el, context);
              if (!bindings.visible) return null;
              const rp = resolveProperties(el, bindings, context, assets);
              const cs = resolveStyle(el.style, assets);
              return <ElementRenderer key={el.id} computed={comp} computedStyle={cs} renderProps={rp} />;
            })}
            {snapshot.bindings?.visible === false && (
              <div style={{ padding: 8, color: "#64748b", fontStyle: "italic", fontSize: 11 }}>(hidden — showIf condition false)</div>
            )}
          </div>
        </div>
      </div>

      {/* Comparisons */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {comparisons.map(c => (
          <span key={c.key} style={{
            fontSize: 10, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4,
            background: c.pass ? "#065f4620" : "#7f1d1d20",
            color: c.pass ? "#34d399" : "#f87171",
          }}>
            {c.pass ? "✓" : "✗"} {c.key}
          </span>
        ))}
      </div>

      {/* Expandable pipeline snapshot */}
      <button onClick={() => setShowPipeline(p => !p)} style={{
        background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8",
        fontSize: 10, padding: "4px 10px", cursor: "pointer", marginTop: 8,
      }}>
        {showPipeline ? "Hide" : "Show"} Pipeline
      </button>

      <button onClick={() => setShowSources(p => !p)} style={{
        background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8",
        fontSize: 10, padding: "4px 10px", cursor: "pointer", marginTop: 8, marginLeft: 8,
      }}>
        {showSources ? "Hide" : "Show"} Sources
      </button>

      {showPipeline && snapshot.bindings && (
        <div style={{ marginTop: 8, fontSize: 11, fontFamily: "monospace", color: "#cbd5e1", background: "#0f172a", padding: 12, borderRadius: 8 }}>
          <strong>Bindings:</strong> {JSON.stringify(snapshot.bindings, null, 2)}
          <br /><strong>Layout:</strong> {JSON.stringify(snapshot.layout, null, 2)}
          <br /><strong>Style:</strong> {JSON.stringify(snapshot.style, null, 2)}
          <br /><strong>Props:</strong> {JSON.stringify({ ...snapshot.renderProps, type: undefined }, null, 2)}
        </div>
      )}

      {showSources && (
        <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 10, fontFamily: "monospace" }}>
          <details style={{ flex: 1 }}>
            <summary style={{ color: "#94a3b8", cursor: "pointer" }}>Legacy WidgetConfig</summary>
            <pre style={{ color: "#94a3b8", background: "#0f172a", padding: 8, borderRadius: 4, overflow: "auto", maxHeight: 200 }}>
              {JSON.stringify(legacyConfig, null, 2)}
            </pre>
          </details>
          <details style={{ flex: 1 }}>
            <summary style={{ color: "#94a3b8", cursor: "pointer" }}>V2 UIElementV2</summary>
            <pre style={{ color: "#94a3b8", background: "#0f172a", padding: 8, borderRadius: 4, overflow: "auto", maxHeight: 200 }}>
              {JSON.stringify(v2Elements, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// ─── Main harness ────────────────────────────────────────────────

export function VerticalSlice() {
  const [stressCount, setStressCount] = useState(50);
  const stressTest = useMemo(() => generateStressTest(stressCount), [stressCount]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, background: "#020617", minHeight: "100vh" }}>
      <h1 style={{ color: "#e2e8f0", fontSize: 20, fontFamily: "monospace" }}>
        Layout Engine V2 — Vertical Slice
      </h1>
      <p style={{ color: "#64748b", fontSize: 11, marginBottom: 24 }}>
        Side-by-side comparison of legacy renderer (left) and V2 pipeline (right).
        Green badges indicate matching values, red indicates differences.
      </p>

      {testCases.map((tc, i) => (
        <TestCard key={i} {...tc} />
      ))}

      <TestCard {...complexTestCase} />

      {/* Stress test */}
      <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 16, marginBottom: 16, background: "#0f172a" }}>
        <h3 style={{ color: "#e2e8f0", fontSize: 14, margin: "0 0 12px 0", fontFamily: "monospace" }}>
          Stress — {stressCount} text elements
        </h3>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4, fontWeight: 600 }}>LEGACY</div>
            <div style={{ position: "relative", width: 820, height: 620, background: "#1e293b", borderRadius: 8, overflow: "hidden" }}>
              {Array.from({ length: Math.min(stressCount, 100) }).map((_, i) => {
                const col = i % 10;
                const row = Math.floor(i / 10);
                return (
                  <WidgetRenderer key={`stress_leg_${i}`}
                    project={{ inventory: [], trackers: [], flags: [], entities: [], nodes: {} } as any}
                    config={{ id: `stress_${i}`, type: "text", x: col * 80, y: row * 30, w: 75, h: 25, settings: { content: `Item ${i}`, fontSize: "9px" } }}
                    runtime={{ runtimeValues: {} }}
                  />
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4, fontWeight: 600 }}>V2</div>
            <div style={{ position: "relative", width: 820, height: 620, background: "#1e293b", borderRadius: 8, overflow: "hidden" }}>
              {Array.from({ length: Math.min(stressCount, 100) }).map((_, i) => {
                const col = i % 10;
                const row = Math.floor(i / 10);
                const el: UIElementV2 = {
                  id: `stress_v2_${i}`, type: "text",
                  layout: { mode: "freeform", x: col * 80, y: row * 30, width: 75, height: 25 },
                  transform: { zIndex: 0 }, style: {}, bindings: { textTemplate: `Item ${i}` },
                  properties: { fontSize: "9px", color: "#e2e8f0", align: "left" },
                };
                const layouts = computeLayouts([el]);
                const comp = layouts.get(el.id);
                if (!comp) return null;
                const b = evaluateBindings(el, { vars: {} });
                const rp = resolveProperties(el, b, { vars: {} });
                const cs = resolveStyle(el.style);
                return <ElementRenderer key={el.id} computed={comp} computedStyle={cs} renderProps={rp} />;
              })}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>Count:</span>
          {[10, 50, 100, 200].map(n => (
            <button key={n} onClick={() => setStressCount(n)} style={{
              padding: "2px 10px", fontSize: 10, fontFamily: "monospace",
              background: stressCount === n ? "#6366f1" : "#1e293b",
              color: stressCount === n ? "#fff" : "#94a3b8",
              border: "1px solid #334155", borderRadius: 4, cursor: "pointer",
            }}>{n}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
