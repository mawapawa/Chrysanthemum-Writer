import React from "react";
import type { VNProject, UIRuntimeContext, ElementEvents, BindingContext } from "../types";
import { renderV2 } from "./pipelineV2";

/**
 * Render a game UI screen from project.uiLayouts.
 *
 * If the screen has V2 UIElementV2 elements, renders through PipelineV2.
 * Otherwise returns null (caller should fall back to legacy rendering).
 */
export function renderGameUI(
  screen: string,
  project: VNProject,
  ctx: UIRuntimeContext
): React.ReactNode[] | null {
  const elements = project.uiLayouts?.screens?.[screen];
  if (!elements || elements.length === 0) return null;

  const context: BindingContext = {
    vars: ctx.vars,
    dialogueText: ctx.dialogueText,
    dialogueSpeaker: ctx.dialogueSpeaker,
    dialogueFormattedText: ctx.dialogueFormattedText,
  };

  const events: ElementEvents = {
    onButtonAction: ctx.onButtonAction,
  };

  return renderV2(elements, context, events, project.assets);
}

/**
 * React component wrapper around renderGameUI.
 * Renders nothing (null) when no V2 layout exists — caller falls back.
 */
export function GameUIRenderer({ screen, project, ctx, fallback }: {
  screen: string;
  project: VNProject;
  ctx: UIRuntimeContext;
  fallback?: React.ReactNode;
}): React.ReactNode {
  const nodes = renderGameUI(screen, project, ctx);
  if (nodes && nodes.length > 0) {
    return <div className="v2-ui-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{nodes}</div>;
  }
  return fallback ?? null;
}
