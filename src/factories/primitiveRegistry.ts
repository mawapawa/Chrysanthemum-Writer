import type { UIElementV2, WidgetType } from "../types";
import { runtimeWidgetRegistry } from "./runtimeWidgetRegistry";

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export interface PrimitiveType {
  type: string;
  label: string;
  icon: string;
  create: () => UIElementV2[];
}

// ─── Root Container (infrastructure, not in palette) ─────────────

export function createRootContainer(w = 1280, h = 720): UIElementV2 {
  return {
    id: id("root"),
    type: "container",
    layout: { mode: "freeform", x: 0, y: 0, width: w, height: h },
    transform: { zIndex: 0 },
    style: {},
    bindings: {},
    properties: { direction: "column", gap: 8, padding: 12, pegboardColumns: 12, pegboardRows: 12 },
  };
}

// ─── Container variants ──────────────────────────────────────────

const rowContainer: PrimitiveType = {
  type: "container",
  label: "Row",
  icon: "⇉",
  create() {
    return [{
      id: id("container"), type: "container",
      layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 2, colSpan: 12 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
      bindings: {}, properties: { direction: "row", gap: 8, padding: 12, pegboardColumns: 12, pegboardRows: 2 },
    }];
  },
};

const columnContainer: PrimitiveType = {
  type: "container",
  label: "Column",
  icon: "⇅",
  create() {
    return [{
      id: id("container"), type: "container",
      layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 12, colSpan: 4 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
      bindings: {}, properties: { direction: "column", gap: 8, padding: 12, pegboardColumns: 12, pegboardRows: 12 },
    }];
  },
};

const gridContainer: PrimitiveType = {
  type: "container",
  label: "Grid",
  icon: "⊞",
  create() {
    return [{
      id: id("container"), type: "container",
      layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 12, colSpan: 12 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
      bindings: {}, properties: { direction: "grid", gap: 4, padding: 8, gridColumns: 3, pegboardColumns: 12, pegboardRows: 12 },
    }];
  },
};

const overlayContainer: PrimitiveType = {
  type: "container",
  label: "Overlay",
  icon: "▣",
  create() {
    return [{
      id: id("container"), type: "container",
      layout: { mode: "freeform", x: 0, y: 0, width: 400, height: 300 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "dashed" },
      bindings: {}, properties: {},
    }];
  },
};

// ─── Game UI Templates (expand to primitives at create time) ────

// ─── Element primitives ──────────────────────────────────────────

const textPrimitive: PrimitiveType = {
  type: "text",
  label: "Text",
  icon: "T",
  create() {
    return [{
      id: id("text"), type: "text",
      layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 1, colSpan: 12 },
      transform: { zIndex: 0 }, style: {},
      bindings: { textTemplate: "Text" },
      properties: { fontSize: "14px", color: "#e2e8f0" },
    }];
  },
};

const imagePrimitive: PrimitiveType = {
  type: "image",
  label: "Image",
  icon: "🖼",
  create() {
    return [{
      id: id("image"), type: "image",
      layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 2, colSpan: 12 },
      transform: { zIndex: 0 }, style: {}, bindings: {},
      properties: { fit: "cover" },
    }];
  },
};

const buttonPrimitive: PrimitiveType = {
  type: "button",
  label: "Button",
  icon: "▢",
  create() {
    return [{
      id: id("button"), type: "button",
      layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 1, colSpan: 12 },
      transform: { zIndex: 0 }, style: {},
      bindings: { textTemplate: "Button" },
      properties: { buttonAction: "custom" },
    }];
  },
};

// ─── Registry ────────────────────────────────────────────────────

// ─── Runtime Widgets (powered by registry) ─────────────────────

function runtimeWidgetPrimitive(defName: string): PrimitiveType {
  const def = runtimeWidgetRegistry[defName];
  if (!def) throw new Error(`Unknown runtime widget: ${defName}`);
  return {
    type: def.type,
    label: def.label,
    icon: def.icon,
    create() {
      const containerId = id("rw_container");
      const result: UIElementV2[] = [
        {
          id: containerId,
          type: def.type as WidgetType,
          layout: { ...def.defaultLayout } as any,
          transform: { zIndex: 0 },
          style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
          bindings: {},
          properties: { ...def.defaultProperties },
        },
      ];
      for (const ct of def.childTemplates) {
        result.push({
          id: id("rw_child"),
          type: ct.type as WidgetType,
          parentId: containerId,
          layout: { ...ct.layout } as any,
          transform: { zIndex: 0 },
          style: ct.style ? { ...ct.style } : {},
          bindings: ct.bindings ? { ...ct.bindings } : {},
          properties: { ...ct.properties },
        });
      }
      return result;
    },
  };
}

export const primitiveRegistry: PrimitiveType[] = [
  // Containers
  columnContainer,
  rowContainer,
  gridContainer,
  overlayContainer,
  // Elements
  textPrimitive,
  imagePrimitive,
  buttonPrimitive,
  // Runtime Widgets
  runtimeWidgetPrimitive("dialogueBox"),
  runtimeWidgetPrimitive("choiceList"),
  runtimeWidgetPrimitive("nameBox"),
  runtimeWidgetPrimitive("portrait"),
];
