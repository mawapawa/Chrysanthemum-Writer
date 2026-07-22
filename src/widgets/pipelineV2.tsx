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

  // In runtime, skip template containers with empty repeat arrays
  const templateParents = new Set<string>();
  if (context) {
    for (const el of elements) {
      if (el.type === "container" && el.bindings.repeat) {
        const b = evaluateBindings(el, context, elMap);
        if (b.repeat && b.repeat.length === 0) {
          templateParents.add(el.id);
        }
      }
    }
  }

  for (const el of elements) {
    if (templateParents.has(el.parentId ?? "")) continue;
    if (templateParents.has(el.id)) continue;

    const computed = layouts.get(el.id);
    if (!computed) continue;

    // Apply auto-bindings from runtime widget registry
    const widgetDef = runtimeWidgetRegistry[el.type];
    if (widgetDef && context) {
      for (const ab of widgetDef.autoBindings) {
        if (!(el.bindings as any)[ab.target]) {
          (el.bindings as any)[ab.target] = ab.source;
        }
      }
    }

    const bindings = evaluateBindings(el, context, elMap);
    if (!bindings.visible) continue;

    if (el.type === "container" && bindings.repeat && bindings.repeat.length > 0) {
      const renderProps = resolveProperties(el, bindings, context, assets);
      const computedStyle = resolveStyle(el.style, assets);
      results.set(el.id,
        <ElementRenderer key={el.id} computed={computed} computedStyle={computedStyle} renderProps={renderProps} events={events} />
      );

      const children = elements.filter(e => e.parentId === el.id);
      const pMode = (el.properties?.direction as string) || "column";
      const gap = (el.properties?.gap as number) ?? 0;

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

          const offset = pMode === "row"
            ? (ch.width + gap) * idx
            : (ch.height + gap) * idx;

          const instanceLayout = pMode === "row"
            ? { ...ch, x: ch.x + offset }
            : { ...ch, y: ch.y + offset };

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
