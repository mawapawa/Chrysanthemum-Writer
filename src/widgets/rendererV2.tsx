import React from "react";
import type { UIElementV2, ComputedLayout, VNProject } from "../types";
import type { WidgetRuntimeProps } from "./index";
import { REGISTRY } from "./index";

export interface WidgetPropsV2 {
  element: UIElementV2;
  computed: ComputedLayout;
  project: VNProject;
  runtime?: WidgetRuntimeProps;
}

export function WidgetRendererV2({ element, computed, project, runtime }: WidgetPropsV2) {
  const desc = REGISTRY[element.type];
  if (!desc) return null;

  const C = desc.component;
  const oldConfig = {
    id: element.id,
    type: element.type,
    x: 0,
    y: 0,
    w: computed.width,
    h: computed.height,
    settings: { ...element.properties, ...element.style, ...element.bindings },
    children: [],
  };

  return (
    <div
      style={{
        position: "absolute",
        left: computed.x,
        top: computed.y,
        width: computed.width,
        height: computed.height,
        zIndex: computed.zIndex,
        opacity: computed.opacity,
        borderRadius: computed.borderRadius || undefined,
        borderWidth: computed.borderWidth || undefined,
        borderColor: computed.borderColor || undefined,
        borderStyle: (computed.borderStyle as any) || undefined,
        overflow: computed.clip ? "hidden" : undefined,
        pointerEvents: "auto",
        transform: computed.rotation ? `rotate(${computed.rotation}deg)` : undefined,
      }}
    >
      <C project={project} config={oldConfig as any} runtime={runtime} />
    </div>
  );
}

export function renderUITree(
  elements: UIElementV2[],
  layouts: Map<string, ComputedLayout>,
  project: VNProject,
  runtime?: WidgetRuntimeProps
) {
  // Render in z-order
  const sorted = [...elements]
    .map(el => ({ el, computed: layouts.get(el.id) }))
    .filter((x): x is { el: UIElementV2; computed: ComputedLayout } => x.computed != null)
    .sort((a, b) => a.computed.zIndex - b.computed.zIndex);

  return sorted.map(({ el, computed }) => (
    <WidgetRendererV2
      key={el.id}
      element={el}
      computed={computed}
      project={project}
      runtime={runtime}
    />
  ));
}
