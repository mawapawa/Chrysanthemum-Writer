import React from "react";
import type { UIElementV2, BindingContext, ElementEvents, ProjectAsset } from "../types";
import { evaluateBindings } from "../utils/bindingEvaluator";
import { resolveProperties } from "../utils/propertyResolver";
import { computeLayouts } from "../utils/layoutEngine";
import { resolveStyle } from "../utils/styleResolver";
import { ElementRenderer } from "./elementRenderer";

/**
 * Full rendering pipeline v2:
 *
 * UIElementV2[] + BindingContext + ElementEvents + assets
 *   → Binding Evaluator  → ResolvedBindings
 *   → Property Resolver  → RenderProperties
 *   → Layout Engine      → ComputedLayout
 *   → Style Resolver     → ComputedStyle
 *   → Element Renderer   → React element
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

  const results: React.ReactNode[] = [];
  for (const el of elements) {
    const computed = layouts.get(el.id);
    if (!computed) continue;

    const bindings = evaluateBindings(el, context);
    if (!bindings.visible) continue;

    const renderProps = resolveProperties(el, bindings, context, assets);
    const computedStyle = resolveStyle(el.style, assets);
    results.push(
      <ElementRenderer key={el.id} computed={computed} computedStyle={computedStyle} renderProps={renderProps} events={events} />
    );
  }

  return results;
}
