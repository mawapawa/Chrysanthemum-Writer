import React from "react";
import type { UIElementV2, ComputedLayout, ComputedStyle, VNProject } from "../types";
import type { WidgetRuntimeProps } from "./index";
import { REGISTRY } from "./index";
import { resolveStyle } from "../utils/styleResolver";

export interface WidgetPropsV2 {
  element: UIElementV2;
  computed: ComputedLayout;
  computedStyle?: ComputedStyle;
  project: VNProject;
  runtime?: WidgetRuntimeProps;
}

export function WidgetRendererV2({ element, computed, computedStyle, project, runtime }: WidgetPropsV2) {
  const desc = REGISTRY[element.type];
  if (!desc) return null;

  const C = desc.component;
  const vis = computedStyle ?? resolveStyle(element.style);
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
        opacity: vis.opacity,
        padding: vis.padding || undefined,
        margin: vis.margin || undefined,
        background: vis.background || undefined,
        boxShadow: vis.boxShadow || undefined,
        borderRadius: vis.borderRadius || undefined,
        borderWidth: vis.borderWidth || undefined,
        borderColor: vis.borderColor || undefined,
        borderStyle: (vis.borderStyle as any) || undefined,
        overflow: computed.clip ? "hidden" : undefined,
        pointerEvents: "auto",
        transform: computed.rotation ? `rotate(${computed.rotation}deg)` : undefined,
      }}
    >
      <C project={project} config={oldConfig as any} runtime={runtime} />
    </div>
  );
}
