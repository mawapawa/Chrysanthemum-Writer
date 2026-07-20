import type { UIElementV2, WidgetType } from "../types";

let _nextId = 1;
function nextId(type: string): string {
  return `${type}_${_nextId++}`;
}

// ─── Element factory type ───────────────────────────────────────

export interface ElementFactory {
  type: WidgetType;
  label: string;
  defaultW: number;
  defaultH: number;
  create: (overrides?: Partial<UIElementV2>) => UIElementV2;
}

// ─── Individual factories ───────────────────────────────────────

const text: ElementFactory = {
  type: "text",
  label: "Text",
  defaultW: 300,
  defaultH: 80,
  create(overrides) {
    return {
      id: nextId("text"),
      type: "text",
      layout: { mode: "freeform", x: 20, y: 20, width: 300, height: 80 },
      transform: { zIndex: 0 },
      style: {},
      bindings: { textTemplate: "Text" },
      properties: { textType: "custom", fontSize: "14px", color: "#e2e8f0", align: "left" },
      ...overrides,
    };
  },
};

const button: ElementFactory = {
  type: "button",
  label: "Button",
  defaultW: 200,
  defaultH: 50,
  create(overrides) {
    return {
      id: nextId("button"),
      type: "button",
      layout: { mode: "freeform", x: 20, y: 120, width: 200, height: 50 },
      transform: { zIndex: 0 },
      style: {},
      bindings: { textTemplate: "Button" },
      properties: { buttonAction: "custom" },
      ...overrides,
    };
  },
};

const container: ElementFactory = {
  type: "container",
  label: "Container",
  defaultW: 400,
  defaultH: 300,
  create(overrides) {
    return {
      id: nextId("container"),
      type: "container",
      layout: { mode: "freeform", x: 20, y: 200, width: 400, height: 300 },
      transform: { zIndex: 0 },
      style: {},
      bindings: {},
      properties: {},
      ...overrides,
    };
  },
};

const image: ElementFactory = {
  type: "image",
  label: "Image",
  defaultW: 200,
  defaultH: 200,
  create(overrides) {
    return {
      id: nextId("image"),
      type: "image",
      layout: { mode: "freeform", x: 20, y: 540, width: 200, height: 200 },
      transform: { zIndex: 0 },
      style: {},
      bindings: {},
      properties: { fit: "cover" },
      ...overrides,
    };
  },
};

// ─── Registry ────────────────────────────────────────────────────

export const elementFactories: Record<string, ElementFactory> = {
  text,
  button,
  container,
  image,
};

export const factoryList: ElementFactory[] = [text, button, container, image];
