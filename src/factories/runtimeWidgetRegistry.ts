import type { WidgetType, LayoutV2 } from "../types";

export interface InspectorField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'color' | 'boolean';
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface AutoBindingSpec {
  target: string;
  source: string;
}

export interface ChildTemplateSpec {
  type: WidgetType;
  layout: Record<string, any>;
  properties: Record<string, any>;
  bindings?: Record<string, string>;
  style?: Record<string, any>;
}

export interface RuntimeWidgetDefinition {
  type: WidgetType;
  label: string;
  icon: string;
  version: number;
  category: string;
  description: string;
  supportsAdvancedMode: boolean;
  defaultLayout: Record<string, any>;
  defaultProperties: Record<string, any>;
  visibleDuring: string[];
  autoBindings: AutoBindingSpec[];
  inspectorGroups: {
    title: string;
    fields: InspectorField[];
  }[];
  childTemplates: ChildTemplateSpec[];
}

const dialogueBox: RuntimeWidgetDefinition = {
  type: "dialogueBox" as WidgetType,
  label: "Dialogue Box",
  icon: "\u{1F4AC}",
  version: 1,
  category: "Game UI",
  description: "Displays current dialogue text and speaker name. Auto-hides during choices.",
  supportsAdvancedMode: false,
  defaultLayout: { mode: "pegboard", row: 10, col: 1, rowSpan: 3, colSpan: 12 },
  defaultProperties: { direction: "column", gap: 4, padding: 16 },
  visibleDuring: ["dialogue"],
  autoBindings: [],
  inspectorGroups: [
    { title: "Content", fields: [
      { key: "typingSpeed", label: "Typing Speed (ms/char)", type: "number", min: 0, max: 500, step: 10, placeholder: "30" },
      { key: "autoAdvance", label: "Auto Advance", type: "boolean" },
    ]},
    { title: "Appearance", fields: [
      { key: "padding", label: "Padding", type: "number", min: 0, max: 64, step: 4 },
      { key: "gap", label: "Spacing", type: "number", min: 0, max: 32, step: 2 },
    ]},
  ],
  childTemplates: [
    { type: "text" as WidgetType, layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 1, colSpan: 12 }, properties: { fontSize: "12px", color: "#94a3b8" }, bindings: { textTemplate: "[_dialogueSpeaker]" }, style: {} },
    { type: "text" as WidgetType, layout: { mode: "pegboard", row: 2, col: 1, rowSpan: 1, colSpan: 12 }, properties: { fontSize: "15px", color: "#e2e8f0" }, bindings: { textTemplate: "[_dialogueText]" }, style: {} },
  ],
};

const choiceList: RuntimeWidgetDefinition = {
  type: "choiceList" as WidgetType,
  label: "Choice List",
  icon: "\u2630",
  version: 1,
  category: "Game UI",
  description: "Displays available story choices. Automatically shows during choice states.",
  supportsAdvancedMode: false,
  defaultLayout: { mode: "pegboard", row: 1, col: 1, rowSpan: 6, colSpan: 12 },
  defaultProperties: { direction: "column", gap: 8, padding: 12 },
  visibleDuring: ["choice"],
  autoBindings: [{ target: "repeat", source: "_choices" }],
  inspectorGroups: [
    { title: "Layout", fields: [
      { key: "direction", label: "Direction", type: "select", options: [{ label: "Vertical", value: "column" }, { label: "Horizontal", value: "row" }] },
      { key: "gap", label: "Spacing", type: "number", min: 0, max: 64, step: 2 },
      { key: "maxVisible", label: "Max Visible", type: "number", min: 0, max: 20, step: 1, placeholder: "0 (unlimited)" },
    ]},
    { title: "Button Style", fields: [
      { key: "buttonHeight", label: "Button Height", type: "number", min: 20, max: 200, step: 10, placeholder: "40" },
    ]},
  ],
  childTemplates: [
    {
      type: "button" as WidgetType,
      layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 2, colSpan: 12 },
      properties: {},
      bindings: { textTemplate: "[choice.text]", actionTemplate: "select:[choice.id]" },
      style: {},
    },
  ],
};

const nameBox: RuntimeWidgetDefinition = {
  type: "nameBox" as WidgetType,
  label: "Name Box",
  icon: "N",
  version: 1,
  category: "Game UI",
  description: "Displays the current speaker's name. Tracks the dialogue box speaker.",
  supportsAdvancedMode: false,
  defaultLayout: { mode: "pegboard", row: 9, col: 1, rowSpan: 1, colSpan: 3 },
  defaultProperties: { direction: "column", gap: 0, padding: 8 },
  visibleDuring: ["dialogue"],
  autoBindings: [],
  inspectorGroups: [
    { title: "Appearance", fields: [
      { key: "padding", label: "Padding", type: "number", min: 0, max: 64, step: 4 },
    ]},
  ],
  childTemplates: [
    { type: "text" as WidgetType, layout: { mode: "pegboard", row: 1, col: 1, rowSpan: 1, colSpan: 12 }, properties: { fontSize: "11px", color: "#cbd5e1", fontWeight: "600" }, bindings: { textTemplate: "[_dialogueSpeaker]" }, style: {} },
  ],
};

const portrait: RuntimeWidgetDefinition = {
  type: "portrait" as WidgetType,
  label: "Portrait",
  icon: "\u{1F9D1}",
  version: 1,
  category: "Game UI",
  description: "Displays the speaking character's portrait. Responds to expression changes.",
  supportsAdvancedMode: false,
  defaultLayout: { mode: "pegboard", row: 1, col: 1, rowSpan: 8, colSpan: 3 },
  defaultProperties: { fit: "contain" },
  visibleDuring: ["dialogue"],
  autoBindings: [{ target: "assetId", source: "_speakerPortrait" }],
  inspectorGroups: [
    { title: "Image", fields: [
      { key: "fit", label: "Fit", type: "select", options: [{ label: "Cover", value: "cover" }, { label: "Contain", value: "contain" }, { label: "Stretch", value: "stretch" }] },
      { key: "borderRadius", label: "Border Radius", type: "text", placeholder: "8px" },
    ]},
  ],
  childTemplates: [],
};

export const runtimeWidgetRegistry: Record<string, RuntimeWidgetDefinition> = {
  dialogueBox,
  choiceList,
  nameBox,
  portrait,
};
