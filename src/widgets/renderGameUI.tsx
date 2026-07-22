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
    vars: { ...ctx.vars, _choices: ctx.choices, _dialogueText: ctx.dialogueText, _dialogueSpeaker: ctx.dialogueSpeaker },
    dialogueText: ctx.dialogueText,
    dialogueSpeaker: ctx.dialogueSpeaker,
    dialogueFormattedText: ctx.dialogueFormattedText,
    interactionState: ctx.interactionState,
  };

  const events: ElementEvents = {
    onButtonAction: ctx.onButtonAction,
  };

  const nodeMap = renderV2(elements, context, events, project.assets);
  return [...nodeMap.values()];
}

/**
 * React component wrapper around renderGameUI.
 */
export function GameUIRenderer({ screen, project, ctx, fallback }: {
  screen: string;
  project: VNProject;
  ctx: UIRuntimeContext;
  fallback?: React.ReactNode;
}): React.ReactNode {
  const nodes = renderGameUI(screen, project, ctx);
  if (nodes && nodes.length > 0) {
    const hasNextLine = ctx.hasDialogue && ctx.lineIdx < ctx.totalLines - 1;
    return (
      <div className="v2-ui-layer" style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
        onClick={() => {
          if (hasNextLine) ctx.onNextLine?.();
          else if (ctx.showContinue) ctx.onContinue?.();
        }}
      >
        {nodes}
      </div>
    );
  }
  return fallback ?? null;
}
