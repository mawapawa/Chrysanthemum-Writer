import { UIElementV2, ComputedLayout } from "../types";

// ─── Tree builder ───────────────────────────────────────────────
function buildTree(elements: UIElementV2[]): Map<string, UIElementV2[]> {
  const tree = new Map<string, UIElementV2[]>();
  for (const el of elements) {
    const pid = el.parentId ?? "__root__";
    if (!tree.has(pid)) tree.set(pid, []);
    tree.get(pid)!.push(el);
  }
  return tree;
}

function parentGap(el: UIElementV2, elements: Map<string, UIElementV2>): number {
  if (!el.parentId) return 0;
  const parent = elements.get(el.parentId);
  return (parent?.properties?.gap as number) ?? 0;
}

function parentPadding(el: UIElementV2, elements: Map<string, UIElementV2>): number {
  if (!el.parentId) return 0;
  const parent = elements.get(el.parentId);
  return (parent?.properties?.padding as number) ?? 0;
}

// ─── Layout mode resolvers ──────────────────────────────────────

function resolveFreeform(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  _elements: Map<string, UIElementV2>
): ComputedLayout {
  const l = el.layout as { mode: "freeform"; x: number; y: number; width: number; height: number; rotation?: number };
  return {
    x: parentLayout.x + (l.x ?? 0),
    y: parentLayout.y + (l.y ?? 0),
    width: l.width ?? 100,
    height: l.height ?? 100,
    rotation: l.rotation ?? 0,
    zIndex: el.transform.zIndex,
    clip: false,
  };
}

function resolveRow(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  elements: Map<string, UIElementV2>
): ComputedLayout {
  const gap = parentGap(el, elements);
  const pad = parentPadding(el, elements);
  const basis = (el.layout as any).basis ?? 100;
  const offset = (el as any)._rowOffset ?? 0;
  return {
    x: parentLayout.x + pad + offset,
    y: parentLayout.y + pad,
    width: basis,
    height: parentLayout.height - pad * 2,
    rotation: 0,
    zIndex: el.transform.zIndex,
    clip: false,
  };
}

function resolveColumn(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  elements: Map<string, UIElementV2>
): ComputedLayout {
  const gap = parentGap(el, elements);
  const pad = parentPadding(el, elements);
  const basis = (el.layout as any).basis ?? 100;
  const offset = (el as any)._colOffset ?? 0;
  return {
    x: parentLayout.x + pad,
    y: parentLayout.y + pad + offset,
    width: parentLayout.width - pad * 2,
    height: basis,
    rotation: 0,
    zIndex: el.transform.zIndex,
    clip: false,
  };
}

function resolveGrid(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  _elements: Map<string, UIElementV2>
): ComputedLayout {
  return {
    x: parentLayout.x,
    y: parentLayout.y,
    width: (el.layout as any).columnSpan ?? 100,
    height: (el.layout as any).rowSpan ?? 100,
    rotation: 0,
    zIndex: el.transform.zIndex,
    clip: false,
  };
}

type Resolver = (el: UIElementV2, parent: ComputedLayout, tree: Map<string, UIElementV2[]>, elements: Map<string, UIElementV2>) => ComputedLayout;

const RESOLVERS: Record<string, Resolver> = {
  freeform: resolveFreeform,
  row: resolveRow,
  column: resolveColumn,
  grid: resolveGrid,
};

// ─── Main layout engine ─────────────────────────────────────────

export function computeLayouts(
  elements: UIElementV2[],
  canvasWidth: number = 800,
  canvasHeight: number = 600
): Map<string, ComputedLayout> {
  const tree = buildTree(elements);
  const elMap = new Map(elements.map(e => [e.id, e]));
  const result = new Map<string, ComputedLayout>();

  const rootLayout: ComputedLayout = {
    x: 0, y: 0,
    width: canvasWidth, height: canvasHeight,
    rotation: 0, zIndex: 0, clip: false,
  };

  const queue: Array<{ parentId: string; parentLayout: ComputedLayout; parentMode?: string }> = [
    { parentId: "__root__", parentLayout: rootLayout },
  ];

  // Track running positions for row/column layout
  const runningX = new Map<string, number>();
  const runningY = new Map<string, number>();

  while (queue.length > 0) {
    const { parentId, parentLayout } = queue.shift()!;
    const parentEl = elMap.get(parentId);
    const children = tree.get(parentId) ?? [];

    for (const child of children) {
      const resolver = RESOLVERS[child.layout.mode] ?? resolveFreeform;

      // For row/column, compute sequential offset from parent container
      if (parentEl) {
        const pMode = (parentEl.properties?.direction as string) || "";
        const gap = (parentEl.properties?.gap as number) ?? 0;
        if (pMode === "row") {
          const offset = runningX.get(parentId) ?? 0;
          (child as any)._rowOffset = offset;
          const cw = (child.layout as any).basis ?? 100;
          runningX.set(parentId, offset + cw + gap);
        } else if (pMode === "column") {
          const offset = runningY.get(parentId) ?? 0;
          (child as any)._colOffset = offset;
          const ch = (child.layout as any).basis ?? 100;
          runningY.set(parentId, offset + ch + gap);
        }
      }

      const computed = resolver(child, parentLayout, tree, elMap);
      result.set(child.id, computed);

      if (tree.has(child.id)) {
        queue.push({ parentId: child.id, parentLayout: computed });
      }
    }
  }

  return result;
}
