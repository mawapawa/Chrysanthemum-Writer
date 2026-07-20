import { UIElementV2, ComputedLayout, LayoutV2 } from "../types";

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
    opacity: el.style.opacity ?? 1,
    borderRadius: el.style.borderRadius ?? "",
    borderWidth: el.style.borderWidth ?? "",
    borderColor: el.style.borderColor ?? "",
    borderStyle: el.style.borderStyle ?? "none",
    clip: false,
  };
}

function resolveRow(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  _elements: Map<string, UIElementV2>
): ComputedLayout {
  // Placeholder — row layout uses sequential positioning
  return {
    x: parentLayout.x,
    y: parentLayout.y,
    width: (el.layout as any).basis ?? 100,
    height: parentLayout.height,
    rotation: 0,
    zIndex: el.transform.zIndex,
    opacity: el.style.opacity ?? 1,
    borderRadius: el.style.borderRadius ?? "",
    borderWidth: el.style.borderWidth ?? "",
    borderColor: el.style.borderColor ?? "",
    borderStyle: el.style.borderStyle ?? "none",
    clip: false,
  };
}

function resolveColumn(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  _elements: Map<string, UIElementV2>
): ComputedLayout {
  return {
    x: parentLayout.x,
    y: parentLayout.y,
    width: parentLayout.width,
    height: (el.layout as any).basis ?? 100,
    rotation: 0,
    zIndex: el.transform.zIndex,
    opacity: el.style.opacity ?? 1,
    borderRadius: el.style.borderRadius ?? "",
    borderWidth: el.style.borderWidth ?? "",
    borderColor: el.style.borderColor ?? "",
    borderStyle: el.style.borderStyle ?? "none",
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
    width: (el.layout as any).columnSpan ?? 1 * 100,
    height: (el.layout as any).rowSpan ?? 1 * 100,
    rotation: 0,
    zIndex: el.transform.zIndex,
    opacity: el.style.opacity ?? 1,
    borderRadius: el.style.borderRadius ?? "",
    borderWidth: el.style.borderWidth ?? "",
    borderColor: el.style.borderColor ?? "",
    borderStyle: el.style.borderStyle ?? "none",
    clip: false,
  };
}

const RESOLVERS: Record<string, (el: UIElementV2, parent: ComputedLayout, tree: Map<string, UIElementV2[]>, elements: Map<string, UIElementV2>) => ComputedLayout> = {
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

  // Root canvas layout
  const rootLayout: ComputedLayout = {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    rotation: 0,
    zIndex: 0,
    opacity: 1,
    borderRadius: "",
    borderWidth: "",
    borderColor: "",
    borderStyle: "none",
    clip: false,
  };

  // Walk tree in parent-first order using a queue
  const queue: Array<{ parentId: string; parentLayout: ComputedLayout }> = [
    { parentId: "__root__", parentLayout: rootLayout },
  ];

  // Track running positions for row/column layout
  const runningX = new Map<string, number>();
  const runningY = new Map<string, number>();

  while (queue.length > 0) {
    const { parentId, parentLayout } = queue.shift()!;
    const children = tree.get(parentId) ?? [];

    for (const child of children) {
      const resolver = RESOLVERS[child.layout.mode] ?? resolveFreeform;

      // For row/column, compute running offset
      if (child.layout.mode === "row") {
        const offset = runningX.get(parentId) ?? 0;
        (child as any)._rowOffset = offset;
        runningX.set(parentId, offset + ((child.layout as any).basis ?? 100));
      }
      if (child.layout.mode === "column") {
        const offset = runningY.get(parentId) ?? 0;
        (child as any)._colOffset = offset;
        runningY.set(parentId, offset + ((child.layout as any).basis ?? 100));
      }

      const computed = resolver(child, parentLayout, tree, elMap);
      result.set(child.id, computed);

      // Queue children of this element
      if (tree.has(child.id)) {
        queue.push({ parentId: child.id, parentLayout: computed });
      }
    }
  }

  return result;
}
