import type { UIElementV2 } from "../types";

let _id = 1000;
function id(prefix: string): string {
  return `${prefix}_${_id++}`;
}

// ─── VN Component descriptor ────────────────────────────────────

export interface VNComponent {
  type: string;
  label: string;
  icon: string;
  create: (x: number, y: number) => UIElementV2[];
}

// ─── Dialog Box ─────────────────────────────────────────────────

const dialogueBox: VNComponent = {
  type: "dialogueBox",
  label: "Dialogue Box",
  icon: "💬",
  create(x, y) {
    const panelId = id("panel");
    const speakerId = id("speaker");
    const textId = id("dialogue");
    const btnId = id("continueBtn");
    return [
      { id: panelId, type: "container",
        layout: { mode: "freeform", x, y, width: 500, height: 160 },
        transform: { zIndex: 0 },
        style: { appearance: { type: "color", backgroundColor: "#0f172ae0" }, borderRadius: "12px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
        bindings: {}, properties: {},
      },
      { id: speakerId, type: "text", parentId: panelId,
        layout: { mode: "freeform", x: 16, y: 12, width: 200, height: 24 },
        transform: { zIndex: 1 },
        style: {}, bindings: { textTemplate: "Speaker" },
        properties: { textType: "characterName", fontSize: "13px", color: "#818cf8" },
      },
      { id: textId, type: "text", parentId: panelId,
        layout: { mode: "freeform", x: 16, y: 40, width: 468, height: 80 },
        transform: { zIndex: 1 },
        style: {}, bindings: { textTemplate: "Dialogue text appears here..." },
        properties: { textType: "dialogue", fontSize: "15px", color: "#e2e8f0" },
      },
      { id: btnId, type: "button", parentId: panelId,
        layout: { mode: "freeform", x: 420, y: 128, width: 64, height: 24 },
        transform: { zIndex: 1 },
        style: {}, bindings: { textTemplate: "Next" },
        properties: { buttonAction: "next" },
      },
    ];
  },
};

// ─── Character Portrait ─────────────────────────────────────────

const portrait: VNComponent = {
  type: "portrait",
  label: "Portrait",
  icon: "🖼️",
  create(x, y) {
    const containerId = id("portraitContainer");
    const imgId = id("portraitImg");
    return [
      { id: containerId, type: "container",
        layout: { mode: "freeform", x, y, width: 120, height: 200 },
        transform: { zIndex: 0 },
        style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
        bindings: {}, properties: {},
      },
      { id: imgId, type: "image", parentId: containerId,
        layout: { mode: "freeform", x: 0, y: 0, width: 120, height: 200 },
        transform: { zIndex: 1 },
        style: { borderRadius: "8px" },
        bindings: {}, properties: { fit: "cover" },
      },
    ];
  },
};

// ─── Choice List ────────────────────────────────────────────────

const choiceList: VNComponent = {
  type: "choiceList",
  label: "Choice List",
  icon: "📋",
  create(x, y) {
    const containerId = id("choiceContainer");
    const btn1 = id("choice1");
    const btn2 = id("choice2");
    return [
      { id: containerId, type: "container",
        layout: { mode: "freeform", x, y, width: 500, height: 100 },
        transform: { zIndex: 0 },
        style: {}, bindings: {}, properties: { direction: "column", gap: 8, padding: 8 },
      },
      { id: btn1, type: "button", parentId: containerId,
        layout: { mode: "freeform", x: 0, y: 0, width: 484, height: 36 },
        transform: { zIndex: 1 },
        style: {}, bindings: { textTemplate: "Choice 1" },
        properties: { buttonAction: "choose_0" },
      },
      { id: btn2, type: "button", parentId: containerId,
        layout: { mode: "freeform", x: 0, y: 44, width: 484, height: 36 },
        transform: { zIndex: 1 },
        style: {}, bindings: { textTemplate: "Choice 2" },
        properties: { buttonAction: "choose_1" },
      },
    ];
  },
};

// ─── Inventory Grid ─────────────────────────────────────────────

const inventoryGrid: VNComponent = {
  type: "inventoryGrid",
  label: "Inventory Grid",
  icon: "🎒",
  create(x, y) {
    const containerId = id("invContainer");
    const items: UIElementV2[] = [
      { id: containerId, type: "container",
        layout: { mode: "freeform", x, y, width: 300, height: 220 },
        transform: { zIndex: 0 },
        style: { borderRadius: "8px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
        bindings: {}, properties: {},
      },
    ];
    // 3x3 grid of image slots
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        items.push({
          id: id("invSlot"), type: "image", parentId: containerId,
          layout: { mode: "freeform", x: 10 + col * 96, y: 10 + row * 68, width: 86, height: 58 },
          transform: { zIndex: 1 },
          style: { borderRadius: "4px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
          bindings: {}, properties: { fit: "cover" },
        });
      }
    }
    return items;
  },
};

// ─── Status Bar ─────────────────────────────────────────────────

const statusBar: VNComponent = {
  type: "statusBar",
  label: "Status Bar",
  icon: "📊",
  create(x, y) {
    const containerId = id("statContainer");
    const labelId = id("statLabel");
    const fillId = id("statFill");
    return [
      { id: containerId, type: "container",
        layout: { mode: "freeform", x, y, width: 250, height: 32 },
        transform: { zIndex: 0 },
        style: { borderRadius: "6px", borderWidth: "1px", borderColor: "#334155", borderStyle: "solid" },
        bindings: {}, properties: {},
      },
      { id: labelId, type: "text", parentId: containerId,
        layout: { mode: "freeform", x: 8, y: 6, width: 80, height: 20 },
        transform: { zIndex: 1 },
        style: {}, bindings: { textTemplate: "HP" },
        properties: { fontSize: "11px", color: "#94a3b8" },
      },
      { id: fillId, type: "container", parentId: containerId,
        layout: { mode: "freeform", x: 92, y: 6, width: 148, height: 20 },
        transform: { zIndex: 1 },
        style: { borderRadius: "4px", appearance: { type: "color", backgroundColor: "#6366f1" } },
        bindings: {}, properties: {},
      },
    ];
  },
};

// ─── Menu Panel ─────────────────────────────────────────────────

const menuPanel: VNComponent = {
  type: "menuPanel",
  label: "Menu Panel",
  icon: "☰",
  create(x, y) {
    const containerId = id("menuContainer");
    const items: UIElementV2[] = [
      { id: containerId, type: "container",
        layout: { mode: "freeform", x, y, width: 200, height: 260 },
        transform: { zIndex: 0 },
        style: { borderRadius: "8px", appearance: { type: "color", backgroundColor: "#1e293be0" } },
        bindings: {}, properties: { direction: "column", gap: 8, padding: 12 },
      },
    ];
    for (const [label, action] of [["Save", "save"], ["Load", "load"], ["Settings", "open_overlay:settings"], ["Quit", "quit"]]) {
      items.push({
        id: id("menuBtn"), type: "button", parentId: containerId,
        layout: { mode: "freeform", x: 0, y: 0, width: 176, height: 40 },
        transform: { zIndex: 1 },
        style: {}, bindings: { textTemplate: label },
        properties: { buttonAction: action },
      });
    }
    return items;
  },
};

// ─── Standalone primitives (for advanced users) ─────────────────

const standaloneText: VNComponent = {
  type: "text",
  label: "Text",
  icon: "T",
  create(x, y) {
    return [{
      id: id("text"), type: "text",
      layout: { mode: "freeform", x, y, width: 300, height: 60 },
      transform: { zIndex: 0 }, style: {}, bindings: { textTemplate: "Text" },
      properties: { fontSize: "14px", color: "#e2e8f0" },
    }];
  },
};

const standaloneButton: VNComponent = {
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

const standaloneImage: VNComponent = {
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

const standaloneContainer: VNComponent = {
  type: "container",
  label: "Empty Container",
  icon: "▣",
  create(x, y) {
    return [{
      id: id("container"), type: "container",
      layout: { mode: "freeform", x, y, width: 300, height: 200 },
      transform: { zIndex: 0 }, style: {}, bindings: {}, properties: {},
    }];
  },
};

// ─── Registry ───────────────────────────────────────────────────

export const vnComponents: Record<string, VNComponent> = {
  dialogueBox,
  portrait,
  choiceList,
  standaloneButton,
  standaloneImage,
  standaloneText,
  inventoryGrid,
  statusBar,
  menuPanel,
  standaloneContainer,
};

export const vnComponentList: VNComponent[] = [
  dialogueBox,
  portrait,
  choiceList,
  standaloneButton,
  standaloneImage,
  standaloneText,
  inventoryGrid,
  statusBar,
  menuPanel,
  standaloneContainer,
];
