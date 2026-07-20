import type { UIElementV2 } from "../types";

let _id = 1000;
function id(prefix: string): string {
  return `${prefix}_${_id++}`;
}

export interface VNComponent {
  type: string;
  label: string;
  icon: string;
  create: (x: number, y: number) => UIElementV2[];
}

// ─── Container ──────────────────────────────────────────────────

const container: VNComponent = {
  type: "container",
  label: "Container",
  icon: "▣",
  create(x, y) {
    return [{
      id: id("container"), type: "container",
      layout: { mode: "freeform", x, y, width: 300, height: 200 },
      transform: { zIndex: 0 },
      style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
      bindings: {}, properties: {},
    }];
  },
};

// ─── Text ───────────────────────────────────────────────────────

const text: VNComponent = {
  type: "text",
  label: "Text",
  icon: "T",
  create(x, y) {
    return [{
      id: id("text"), type: "text",
      layout: { mode: "freeform", x, y, width: 300, height: 60 },
      transform: { zIndex: 0 }, style: {},
      bindings: { textTemplate: "Text" },
      properties: { fontSize: "14px", color: "#e2e8f0" },
    }];
  },
};

// ─── Image ──────────────────────────────────────────────────────

const image: VNComponent = {
  type: "image",
  label: "Image",
  icon: "🖼",
  create(x, y) {
    return [{
      id: id("image"), type: "image",
      layout: { mode: "freeform", x, y, width: 160, height: 160 },
      transform: { zIndex: 0 }, style: {}, bindings: {},
      properties: { fit: "cover" },
    }];
  },
};

// ─── Button ─────────────────────────────────────────────────────

const button: VNComponent = {
  type: "button",
  label: "Button",
  icon: "▢",
  create(x, y) {
    return [{
      id: id("button"), type: "button",
      layout: { mode: "freeform", x, y, width: 160, height: 40 },
      transform: { zIndex: 0 }, style: {}, bindings: { textTemplate: "Button" },
      properties: { buttonAction: "custom" },
    }];
  },
};

// ─── Stat (text or bar) ─────────────────────────────────────────

const stat: VNComponent = {
  type: "statText",
  label: "Stat",
  icon: "📊",
  create(x, y) {
    return [{
      id: id("stat"), type: "statText",
      layout: { mode: "freeform", x, y, width: 200, height: 36 },
      transform: { zIndex: 0 }, style: {},
      bindings: { textTemplate: "Stat" },
      properties: { statSource: "", statLabel: "Stat" },
    }];
  },
};

// ─── Dialogue Box ───────────────────────────────────────────────

const dialogueBox: VNComponent = {
  type: "dialogueBox",
  label: "Dialogue Box",
  icon: "💬",
  create(x, y) {
    const panelId = id("panel");
    const speakerId = id("speaker");
    const textId = id("dialogue");
    return [
      { id: panelId, type: "container",
        layout: { mode: "freeform", x, y, width: 500, height: 130 },
        transform: { zIndex: 0 },
        style: { borderRadius: "12px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid", background: "#0f172a" },
        bindings: {}, properties: {},
      },
      { id: speakerId, type: "text", parentId: panelId,
        layout: { mode: "freeform", x: 16, y: 8, width: 200, height: 22 },
        transform: { zIndex: 1 }, style: {},
        bindings: { textTemplate: "[_dialogueSpeaker]" },
        properties: { fontSize: "13px", color: "#818cf8" },
      },
      { id: textId, type: "text", parentId: panelId,
        layout: { mode: "freeform", x: 16, y: 34, width: 468, height: 82 },
        transform: { zIndex: 1 }, style: {},
        bindings: { textTemplate: "[_dialogueText]" },
        properties: { fontSize: "15px", color: "#e2e8f0" },
      },
    ];
  },
};

// ─── Choices ────────────────────────────────────────────────────

const choiceList: VNComponent = {
  type: "choiceList",
  label: "Choices",
  icon: "📋",
  create(x, y) {
    const cid = id("choices");
    const b1 = id("choice");
    const b2 = id("choice");
    return [
      { id: cid, type: "container",
        layout: { mode: "freeform", x, y, width: 500, height: 100 },
        transform: { zIndex: 0 },
        style: {}, bindings: {}, properties: { direction: "column", gap: 6, padding: 8 },
      },
      { id: b1, type: "button", parentId: cid,
        layout: { mode: "freeform", x: 0, y: 0, width: 484, height: 38 },
        transform: { zIndex: 1 }, style: {}, bindings: { textTemplate: "Choice 1" },
        properties: { buttonAction: "choose_0" },
      },
      { id: b2, type: "button", parentId: cid,
        layout: { mode: "freeform", x: 0, y: 44, width: 484, height: 38 },
        transform: { zIndex: 1 }, style: {}, bindings: { textTemplate: "Choice 2" },
        properties: { buttonAction: "choose_1" },
      },
    ];
  },
};

// ─── Registry ───────────────────────────────────────────────────

export const vnComponents: Record<string, VNComponent> = {
  container, text, image, button, stat, dialogueBox, choiceList,
};

export const vnComponentList: VNComponent[] = [
  container, text, image, button, stat, dialogueBox, choiceList,
];
