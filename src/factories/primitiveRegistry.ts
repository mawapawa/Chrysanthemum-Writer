import type { UIElementV2 } from "../types";

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
      bindings: {}, properties: { direction: "row", gap: 8, padding: 12, pegboardColumns: 12, pegboardRows: 12 },
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

const choiceListTemplate: PrimitiveType = {
  type: "container",
  label: "Choice List",
  icon: "☰",
  create() {
    const containerId = id("container");
    return [
      {
        id: containerId, type: "container",
        layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 6, colSpan: 12 },
        transform: { zIndex: 0 },
        style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
        bindings: { repeat: "_choices", visibleDuring: ["choice"] },
        properties: { direction: "column", gap: 8, padding: 12, pegboardColumns: 12, pegboardRows: 12 },
      },
      {
        id: id("button"), type: "button", parentId: containerId,
        layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 2, colSpan: 12 },
        transform: { zIndex: 0 }, style: {},
        bindings: { textTemplate: "[choice.text]", actionTemplate: "select:[choice.id]" },
        properties: {},
      },
    ];
  },
};

const dialogueBoxTemplate: PrimitiveType = {
  type: "container",
  label: "Dialogue Box",
  icon: "💬",
  create() {
    const containerId = id("container");
    return [
      {
        id: containerId, type: "container",
        layout: { mode: "pegboard", row: 10, col: 1, rowSpan: 3, colSpan: 12 },
        transform: { zIndex: 0 },
        style: { borderRadius: "12px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid", background: "linear-gradient(to bottom, #1e293b, #0f172a)" },
        bindings: { visibleDuring: ["dialogue"] },
        properties: { direction: "column", gap: 4, padding: 16, pegboardColumns: 12, pegboardRows: 12 },
      },
      {
        id: id("text"), type: "text", parentId: containerId,
        layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 1, colSpan: 12 },
        transform: { zIndex: 0 }, style: {},
        bindings: { textTemplate: "[_dialogueSpeaker]" },
        properties: { fontSize: "12px", color: "#94a3b8" },
      },
      {
        id: id("text"), type: "text", parentId: containerId,
        layout: { mode: "pegboard", row: 2, col: 1, rowSpan: 1, colSpan: 12 },
        transform: { zIndex: 0 }, style: {},
        bindings: { textTemplate: "[_dialogueText]" },
        properties: { fontSize: "15px", color: "#e2e8f0" },
      },
    ];
  },
};

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
  // Templates (expand to primitives)
  dialogueBoxTemplate,
  choiceListTemplate,
];
