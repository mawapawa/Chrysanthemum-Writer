import type { UIElementV2, ResolvedBindings, BindingContext } from "../types";

// ─── Helpers ────────────────────────────────────────────────────

function varDefined(key: string, vars?: Record<string, any>): { defined: boolean; value: any } {
  if (vars && key in vars) return { defined: true, value: vars[key] };
  return { defined: false, value: undefined };
}

function valsMatch(a: any, b: any): boolean {
  if (String(a) === String(b)) return true;
  const na = Number(a); const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na === nb) return true;
  if (typeof a === "boolean" && (b === "true" || b === "1") && a) return true;
  if (typeof a === "boolean" && (b === "false" || b === "0") && !a) return true;
  return false;
}

function evalCondition(
  source: string | undefined,
  operator: string | undefined,
  value: string | undefined,
  vars?: Record<string, any>
): boolean {
  if (!source) return true;
  const op = operator ?? "exists";
  const [kind, ...rest] = source.split(".");
  const key = rest.join(".");
  const rv = varDefined(key, vars);
  if (!rv.defined) return false;
  const actual = rv.value;
  if (op === "exists") return kind === "flag" ? Boolean(actual) : actual !== undefined;
  if (value === undefined) return false;
  if (op === "==") return valsMatch(actual, value);
  if (op === "!=") return !valsMatch(actual, value);
  const nv = Number(value);
  const na = Number(actual);
  if (op === ">=") return na >= nv;
  if (op === "<=") return na <= nv;
  if (op === ">") return na > nv;
  if (op === "<") return na < nv;
  return false;
}

function resolvePath(obj: any, path: string): any {
  const parts = path.split(".");
  let val = obj;
  for (const part of parts) {
    if (val && typeof val === "object" && part in val) val = val[part];
    else return undefined;
  }
  return val;
}

function interpolate(template: string | undefined, vars?: Record<string, any>, isRuntime?: boolean): string {
  if (!template) return "";
  return template.replace(/\[([\w.]+)\]/g, (_, name) => {
    const val = resolvePath(vars, name);
    if (val !== undefined) return String(val);
    // In runtime mode, unresolved bindings become empty instead of showing the placeholder
    return isRuntime ? "" : `[${name}]`;
  });
}

function computeStateFilter(
  style: string | undefined,
  source: string | undefined,
  operator: string | undefined,
  value: string | undefined,
  vars?: Record<string, any>
): Record<string, any> {
  if (!style || style === "none" || !source) return {};
  if (!evalCondition(source, operator, value, vars)) return {};
  if (style === "grayscale") return { filter: "grayscale(1)", opacity: 0.7 };
  if (style === "low-opacity") return { opacity: 0.4 };
  if (style === "blur") return { filter: "blur(2px)", opacity: 0.6 };
  return {};
}

// ─── Main evaluator ─────────────────────────────────────────────

export function evaluateBindings(
  element: UIElementV2,
  context?: BindingContext,
  elementMap?: Map<string, UIElementV2>
): ResolvedBindings {
  const merged = { ...context?.vars, _dialogueText: context?.dialogueText, _dialogueSpeaker: context?.dialogueSpeaker };
  const b = element.bindings;

  // visibleDuring — applies to ALL elements in runtime via ancestor cascade
  let invisible = false;
  if (context?.interactionState) {
    if (b.visibleDuring) {
      invisible = !b.visibleDuring.includes(context.interactionState);
    }
    // Cascade: check ancestors regardless of own visibleDuring
    if (!invisible && elementMap && element.parentId) {
      let cur = elementMap.get(element.parentId);
      while (cur) {
        const cb = cur.bindings;
        if (cb.visibleDuring && !cb.visibleDuring.includes(context.interactionState!)) { invisible = true; break; }
        cur = cur.parentId ? elementMap.get(cur.parentId) : undefined;
      }
    }
  }

  const visible = !invisible && evalCondition(b.showIfSource, b.showIfOperator, b.showIfValue, merged);
  const stateFilter = computeStateFilter(
    b.stateFilterStyle, b.stateFilterSource, b.stateFilterOperator, b.stateFilterValue, merged
  );
  const isRuntime = !!context;
  const text = interpolate(b.textTemplate, merged, isRuntime);
  const repeat = b.repeat ? resolvePath(merged, b.repeat) : undefined;
  const action = interpolate(b.actionTemplate, merged, isRuntime);
  return { visible, stateFilter, text, repeat: Array.isArray(repeat) ? repeat : undefined, action: action || undefined, invisible };
}
