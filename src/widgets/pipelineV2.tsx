import React from "react";
import type { UIElementV2, BindingContext } from "../types";
import { evaluateBindings } from "../utils/bindingEvaluator";
import { resolveProperties } from "../utils/propertyResolver";
import { computeLayouts } from "../utils/layoutEngine";
import { ElementRenderer } from "./elementRenderer";

/**
 * Full rendering pipeline v2:
 *
 * UIElementV2[] + BindingContext
 *   → Binding Evaluator  → ResolvedBindings
 *   → Property Resolver  → RenderProperties
 *   → Layout Engine      → ComputedLayout
 *   → Element Renderer   → React element
 */
export function renderV2(
  elements: UIElementV2[],
  context?: BindingContext,
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

    const renderProps = resolveProperties(el, bindings, context);
    results.push(
      <ElementRenderer key={el.id} computed={computed} renderProps={renderProps} />
    );
  }

  return results;
}
