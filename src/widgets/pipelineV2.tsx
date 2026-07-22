import React from "react";
import type { UIElementV2, BindingContext, ElementEvents, ProjectAsset } from "../types";
import { evaluateBindings } from "../utils/bindingEvaluator";
import { resolveProperties } from "../utils/propertyResolver";
import { computeLayouts } from "../utils/layoutEngine";
import { resolveStyle } from "../utils/styleResolver";
import { ElementRenderer } from "./elementRenderer";
import { runtimeWidgetRegistry } from "../factories/runtimeWidgetRegistry";

/**
 * Full rendering pipeline v2:
 *
 * UIElementV2[] + BindingContext + ElementEvents + assets
 *   → Binding Evaluator  → ResolvedBindings
 *   → Property Resolver  → RenderProperties
 *   → Layout Engine      → ComputedLayout
 *   → Style Resolver     → ComputedStyle
 *   → Element Renderer   → React element
 *
 * Container with `repeat` binding expands children per array item.
 */
export function renderV2(
  elements: UIElementV2[],
  context?: BindingContext,
  events?: ElementEvents,
  assets?: ProjectAsset[],
  canvasWidth?: number,
  canvasHeight?: number
) {
  const layouts = computeLayouts(elements, canvasWidth, canvasHeight);
  const elMap = new Map(elements.map(e => [e.id, e]));

  const results = new Map<string, React.ReactNode>();
  const skipIds = new Set<string>();

  // Pass 1: inject registry auto-bindings so all evaluation sees them
  if (context) {
    for (const el of elements) {
      const def = runtimeWidgetRegistry[el.type];
      if (def) {
        for (const ab of def.autoBindings) {
          if (!(el.bindings as any)[ab.target]) {
            (el.bindings as any)[ab.target] = ab.source;
          }
        }
      }
    }
  }

  // Helper: check if an element is a choice/action template (has runtime bindings)
  const isTemplate = (el: UIElementV2) => {
    const b = el.bindings;
    return (b.textTemplate && b.textTemplate.includes("[choice.")) ||
           (b.actionTemplate && b.actionTemplate.includes("[choice.")) ||
           (el as any).properties?._role === "choice-button";
  };

  // Pass 2: pre-evaluate repeat containers — skip templates, keep regular children
  if (context) {
    for (const el of elements) {
      if (el.type === "container" && el.bindings.repeat) {
        const b = evaluateBindings(el, context, elMap);
        if (b.repeat) {
          if (b.repeat.length === 0) {
            skipIds.add(el.id); // empty: hide container completely
          }
          // Always skip template children (they're only used for repeat expansion)
          for (const other of elements) {
            if (other.parentId === el.id && isTemplate(other)) skipIds.add(other.id);
          }
        }
      }
    }
  }

  for (const el of elements) {
    if (skipIds.has(el.id)) continue;

    const computed = layouts.get(el.id);
    if (!computed) continue;

    const bindings = evaluateBindings(el, context, elMap);
    if (!bindings.visible) continue;

    if (el.type === "container" && bindings.repeat && bindings.repeat.length > 0) {
      const renderProps = resolveProperties(el, bindings, context, assets);
      const computedStyle = resolveStyle(el.style, assets);
      results.set(el.id,
        <ElementRenderer key={el.id} computed={computed} computedStyle={computedStyle} renderProps={renderProps} events={events} />
      );

      const children = elements.filter(e => e.parentId === el.id && isTemplate(e));
      if (children.length === 0) continue;

      const pMode = (el.properties?.direction as string) || "column";
      const gap = (el.properties?.gap as number) ?? 0;
      const pad = (el.properties?.padding as number) ?? 0;
      const layoutMode = (el.properties as any)?.layoutMode || "automaticStack";
      const pl = layouts.get(el.id);

      bindings.repeat.forEach((item: any, idx: number) => {
        const itemCtx: BindingContext = {
          ...context,
          vars: { ...context?.vars, choice: item, _choices: context?.vars?._choices, _dialogueText: context?.dialogueText, _dialogueSpeaker: context?.dialogueSpeaker },
          dialogueText: context?.dialogueText,
          dialogueSpeaker: context?.dialogueSpeaker,
          dialogueFormattedText: context?.dialogueFormattedText,
        };

        children.forEach((child) => {
          const childBindings = evaluateBindings(child, itemCtx);
          if (!childBindings.visible) return;

          const ch = layouts.get(child.id);
          if (!ch) return;

          let instanceLayout;
          if (layoutMode === "manualPlacement" || !pl) {
            // Manual: preserve template position, just update bindings
            instanceLayout = { ...ch };
          } else {
            // Automatic stack: position within parent's content area
            const baseX = pl.x + pad;
            const baseY = pl.y + pad;
            const contentW = pl.width - pad * 2;
            if (pMode === "row") {
              instanceLayout = { ...ch, x: baseX + (ch.width + gap) * idx, y: baseY, width: ch.width, height: pl.height - pad * 2 };
            } else {
              instanceLayout = { ...ch, x: baseX, y: baseY + (ch.height + gap) * idx, width: contentW, height: ch.height };
            }
          }

          const childProps = resolveProperties(child, childBindings, itemCtx, assets);
          const childStyle = resolveStyle(child.style, assets);
          results.set(`${child.id}_r${idx}`,
            <ElementRenderer key={`${child.id}_r${idx}`} computed={instanceLayout} computedStyle={childStyle} renderProps={childProps} events={events} />
          );
        });
      });
      continue;
    }

    const renderProps = resolveProperties(el, bindings, context, assets);
    const computedStyle = resolveStyle(el.style, assets);
    results.set(el.id,
      <ElementRenderer key={el.id} computed={computed} computedStyle={computedStyle} renderProps={renderProps} events={events} />
    );
  }

  return results;
}
