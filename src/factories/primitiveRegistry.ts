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
    properties: { direction: "column", gap: 8, padding: 12 },
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
      layout: { mode: "column", grow: 0, shrink: 0, basis: 120 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
      bindings: {}, properties: { direction: "row", gap: 8, padding: 12 },
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
      layout: { mode: "column", grow: 0, shrink: 0, basis: 200 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
      bindings: {}, properties: { direction: "column", gap: 8, padding: 12 },
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
      layout: { mode: "column", grow: 0, shrink: 0, basis: 200 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
      bindings: {}, properties: { direction: "grid", gap: 4, padding: 8, gridColumns: 3 },
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

// ─── Element primitives ──────────────────────────────────────────

const textPrimitive: PrimitiveType = {
  type: "text",
  label: "Text",
  icon: "T",
  create() {
    return [{
      id: id("text"), type: "text",
      layout: { mode: "column", grow: 0, shrink: 0, basis: 30 },
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
      layout: { mode: "column", grow: 0, shrink: 0, basis: 160 },
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
      layout: { mode: "column", grow: 0, shrink: 0, basis: 40 },
      transform: { zIndex: 0 }, style: {},
      bindings: { textTemplate: "Button" },
      properties: { buttonAction: "custom" },
    }];
  },
};

// ─── Registry ────────────────────────────────────────────────────

export const primitiveRegistry: PrimitiveType[] = [
  columnContainer,
  rowContainer,
  gridContainer,
  overlayContainer,
  textPrimitive,
  imagePrimitive,
  buttonPrimitive,
];
