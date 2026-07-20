import type { WidgetConfig, WidgetType } from "../types";
import type { UIElementV2, BindingContext } from "../types";
import type { WidgetRuntimeProps } from "../widgets/index";

export interface TestCase {
  name: string;
  legacyConfig: WidgetConfig;
  v2Elements: UIElementV2[];
  runtime?: WidgetRuntimeProps;
  context?: BindingContext;
}

// Shared runtime values used across test cases
const baseRuntimeVars: Record<string, any> = {
  playerName: "Alice",
  gold: 500,
  hasMap: true,
  hp: 75,
  maxHp: 100,
};

const baseRuntime: WidgetRuntimeProps = {
  runtimeValues: baseRuntimeVars,
};

const baseContext: BindingContext = {
  vars: baseRuntimeVars,
};

// Helper: build a legacy button WidgetConfig
function legacyButton(
  id: string,
  x: number, y: number, w: number, h: number,
  overrides: Record<string, any> = {}
): WidgetConfig {
  return {
    id, type: "button", x, y, w, h,
    settings: {
      buttonLabel: "Click Me",
      buttonAction: "custom",
      ...overrides,
    },
  };
}

// Helper: build a v2 button UIElementV2
function v2Button(
  id: string,
  x: number, y: number, w: number, h: number,
  overrides: Partial<UIElementV2> = {}
): UIElementV2 {
  return {
    id, type: "button",
    layout: { mode: "freeform", x, y, width: w, height: h },
    transform: { zIndex: 0 },
    style: {},
    bindings: { textTemplate: "Click Me" },
    properties: { buttonAction: "custom" },
    ...overrides,
  };
}

// Helper: build a legacy text WidgetConfig
function legacyText(
  id: string,
  x: number, y: number, w: number, h: number,
  overrides: Record<string, any> = {}
): WidgetConfig {
  return {
    id,
    type: "text",
    x, y, w, h,
    settings: {
      textType: "custom",
      content: "Hello World",
      fontSize: "14px",
      color: "#e2e8f0",
      align: "left",
      ...overrides,
    },
  };
}

// Helper: build a v2 text UIElementV2
function v2Text(
  id: string,
  x: number, y: number, w: number, h: number,
  overrides: Partial<UIElementV2> = {}
): UIElementV2 {
  return {
    id,
    type: "text",
    layout: { mode: "freeform", x, y, width: w, height: h },
    transform: { zIndex: 0 },
    style: {},
    bindings: {
      textTemplate: "Hello World",
    },
    properties: {
      textType: "custom",
      fontSize: "14px",
      color: "#e2e8f0",
      align: "left",
    },
    ...overrides,
  };
}

export const testCases = Object.freeze([
  // 1 — Static text
  Object.freeze({
    name: "1 — Static text",
    legacyConfig: legacyText("t1", 10, 10, 300, 80),
    v2Elements: [v2Text("t1", 10, 10, 300, 80)],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 2 — Variable interpolation
  Object.freeze({
    name: "2 — [playerName] interpolation",
    legacyConfig: legacyText("t2", 10, 10, 300, 80, { content: "[playerName]'s Adventure" }),
    v2Elements: [v2Text("t2", 10, 10, 300, 80, {
      properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: "[playerName]'s Adventure" },
    })],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 3 — showIf visible (hasMap === true → visible)
  Object.freeze({
    name: "3 — showIf visible",
    legacyConfig: legacyText("t3", 10, 10, 300, 80, {
      content: "Visible when hasMap",
      showIfSource: "flag.hasMap",
      showIfOperator: "==",
      showIfValue: "true",
    }),
    v2Elements: [v2Text("t3", 10, 10, 300, 80, {
      properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: "Visible when hasMap", showIfSource: "flag.hasMap", showIfOperator: "==", showIfValue: "true" },
    })],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 4 — showIf hidden (gold < 1000 → hidden because gold=500)
  Object.freeze({
    name: "4 — showIf hidden",
    legacyConfig: legacyText("t4", 10, 10, 300, 80, {
      content: "Hidden (gold > 1000)",
      showIfSource: "tracker.gold",
      showIfOperator: ">",
      showIfValue: "1000",
    }),
    v2Elements: [v2Text("t4", 10, 10, 300, 80, {
      properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: "Hidden (gold > 1000)", showIfSource: "tracker.gold", showIfOperator: ">", showIfValue: "1000" },
    })],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 5 — Font sizes
  Object.freeze({
    name: "5 — Font sizes (10/16/24)",
    legacyConfig: legacyText("t5", 10, 10, 300, 80, { content: "Font size 24", fontSize: "24px" }),
    v2Elements: [v2Text("t5", 10, 10, 300, 80, {
      properties: { textType: "custom", fontSize: "24px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: "Font size 24" },
    })],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 6 — Colors
  Object.freeze({
    name: "6 — Color (#ef4444)",
    legacyConfig: legacyText("t6", 10, 10, 300, 80, { content: "Red text", color: "#ef4444" }),
    v2Elements: [v2Text("t6", 10, 10, 300, 80, {
      properties: { textType: "custom", fontSize: "14px", color: "#ef4444", align: "left" },
      bindings: { textTemplate: "Red text" },
    })],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 7 — Rotation
  Object.freeze({
    name: "7 — Rotation 45deg",
    legacyConfig: legacyText("t7", 10, 10, 200, 80, { content: "Rotated" }),
    v2Elements: [v2Text("t7", 10, 10, 200, 80, {
      properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: "Rotated" },
      layout: { mode: "freeform", x: 10, y: 10, width: 200, height: 80, rotation: 45 },
    })],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 8 — Opacity
  Object.freeze({
    name: "8 — Opacity 0.5",
    legacyConfig: legacyText("t8", 10, 10, 300, 80, { content: "Half opacity" }),
    v2Elements: [v2Text("t8", 10, 10, 300, 80, {
      properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: "Half opacity" },
      style: { opacity: 0.5 },
    })],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 9 — Nested in container (one level)
  Object.freeze({
    name: "9 — Nested in container",
    legacyConfig: {
      id: "container_01",
      type: "container",
      x: 50, y: 50, w: 400, h: 300,
      settings: {},
      children: [
        legacyText("t9", 30, 20, 200, 60, { content: "Inside container" }),
      ],
    } satisfies WidgetConfig,
    v2Elements: [
      { id: "container_01", type: "container",
        layout: { mode: "freeform", x: 50, y: 50, width: 400, height: 300 },
        transform: { zIndex: 0 }, style: {}, bindings: {}, properties: {}
      } satisfies UIElementV2,
      v2Text("t9", 30, 20, 200, 60, {
        properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
        bindings: { textTemplate: "Inside container" },
        parentId: "container_01",
      }),
    ],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 10 — Two-level nesting
  Object.freeze({
    name: "10 — Two-level nesting",
    legacyConfig: {
      id: "outer_01",
      type: "container",
      x: 20, y: 20, w: 500, h: 400,
      settings: {},
      children: [{
        id: "inner_01",
        type: "container",
        x: 40, y: 30, w: 300, h: 200,
        settings: {},
        children: [
          legacyText("t10", 10, 10, 150, 50, { content: "Two levels deep" }),
        ],
      }],
    } satisfies WidgetConfig,
    v2Elements: [
      { id: "outer_01", type: "container",
        layout: { mode: "freeform", x: 20, y: 20, width: 500, height: 400 },
        transform: { zIndex: 0 }, style: {}, bindings: {}, properties: {}
      } satisfies UIElementV2,
      { id: "inner_01", type: "container",
        layout: { mode: "freeform", x: 40, y: 30, width: 300, height: 200 },
        transform: { zIndex: 0 }, style: {}, bindings: {}, properties: {},
        parentId: "outer_01",
      } satisfies UIElementV2,
      v2Text("t10", 10, 10, 150, 50, {
        properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
        bindings: { textTemplate: "Two levels deep" },
        parentId: "inner_01",
      }),
    ],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),

  // 11 — Missing binding (playerName not in vars)
  Object.freeze({
    name: "11 — Missing binding",
    legacyConfig: legacyText("t11", 10, 10, 300, 80, { content: "Hello [missingVar]" }),
    v2Elements: [v2Text("t11", 10, 10, 300, 80, {
      properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: "Hello [missingVar]" },
    })],
    runtime: { runtimeValues: { gold: 500 } },
    context: { vars: { gold: 500 } },
  } satisfies TestCase),

  // 12 — Button basic
  Object.freeze({
    name: "12 — Button basic",
    legacyConfig: legacyButton("t12", 10, 10, 200, 50),
    v2Elements: [v2Button("t12", 10, 10, 200, 50)],
    runtime: baseRuntime,
    context: baseContext,
  } satisfies TestCase),
]);

// ─── Complex mixed test ─────────────────────────────────────────

export const complexTestCase: TestCase = Object.freeze({
  name: "Complex — Container with Text + Image + Button",
  legacyConfig: {
    id: "complex_container",
    type: "container",
    x: 10, y: 10, w: 500, h: 400,
    settings: { bgColor: "#1e293b80" },
    children: [
      legacyText("comp_t", 20, 20, 300, 60, { content: "Complex layout", fontSize: "18px", color: "#818cf8" }),
      { id: "comp_img", type: "image", x: 350, y: 20, w: 100, h: 120, settings: { src: "", fit: "cover" } },
      { id: "comp_btn", type: "button", x: 20, y: 300, w: 200, h: 50, settings: { buttonLabel: "Test Button", buttonAction: "custom" } },
    ],
  } satisfies WidgetConfig,
  v2Elements: [
    {
      id: "complex_container", type: "container",
      layout: { mode: "freeform", x: 10, y: 10, width: 500, height: 400 },
      transform: { zIndex: 0 }, style: { bgColor: "#1e293b80" }, bindings: {}, properties: {},
    } satisfies UIElementV2,
    v2Text("comp_t", 20, 20, 300, 60, {
      properties: { textType: "custom", fontSize: "18px", color: "#818cf8", align: "left" },
      bindings: { textTemplate: "Complex layout" },
      parentId: "complex_container",
    }),
    { id: "comp_img", type: "image",
      layout: { mode: "freeform", x: 350, y: 20, width: 100, height: 120 },
      transform: { zIndex: 0 }, style: {}, bindings: {}, properties: { src: "", fit: "cover" },
      parentId: "complex_container",
    } satisfies UIElementV2,
    { id: "comp_btn", type: "button",
      layout: { mode: "freeform", x: 20, y: 300, width: 200, height: 50 },
      transform: { zIndex: 0 }, style: {}, bindings: { textTemplate: "Test Button" }, properties: { buttonAction: "custom" },
      parentId: "complex_container",
    } satisfies UIElementV2,
  ],
  runtime: baseRuntime,
  context: baseContext,
});

// ─── Stress test — 100 text elements ────────────────────────────

export function generateStressTest(count = 100): TestCase {
  const legacyChildren: WidgetConfig[] = [];
  const v2Children: UIElementV2[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % 10;
    const row = Math.floor(i / 10);
    const id = `stress_${i}`;
    legacyChildren.push(legacyText(id, col * 80, row * 30, 75, 25, { content: `Item ${i}`, fontSize: "9px" }));
    v2Children.push(v2Text(id, col * 80, row * 30, 75, 25, {
      properties: { textType: "custom", fontSize: "9px", color: "#e2e8f0", align: "left" },
      bindings: { textTemplate: `Item ${i}` },
    }));
  }
  return Object.freeze({
    name: `Stress — ${count} text elements`,
    legacyConfig: { id: "stress_root", type: "container" as WidgetType, x: 0, y: 0, w: 800, h: 600, settings: {}, children: legacyChildren },
    v2Elements: v2Children,
    runtime: baseRuntime,
    context: baseContext,
  });
}
