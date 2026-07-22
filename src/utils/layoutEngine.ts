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

type Resolver = (el: UIElementV2, parent: ComputedLayout, tree: Map<string, UIElementV2[]>, elements: Map<string, UIElementV2>, seqOffset?: number) => ComputedLayout;

function resolveRow(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  elements: Map<string, UIElementV2>,
  seqOffset?: number
): ComputedLayout {
  const gap = parentGap(el, elements);
  const pad = parentPadding(el, elements);
  const basis = (el.layout as any).basis ?? 100;
  const offset = seqOffset ?? 0;
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
  elements: Map<string, UIElementV2>,
  seqOffset?: number
): ComputedLayout {
  const gap = parentGap(el, elements);
  const pad = parentPadding(el, elements);
  const basis = (el.layout as any).basis ?? 100;
  const offset = seqOffset ?? 0;
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

function resolvePegboard(
  el: UIElementV2,
  parentLayout: ComputedLayout,
  _tree: Map<string, UIElementV2[]>,
  elements: Map<string, UIElementV2>
): ComputedLayout {
  const l = el.layout as any;
  const row = l.row ?? 1;
  const col = l.col ?? 1;
  const rowSpan = l.rowSpan ?? 1;
  const colSpan = l.colSpan ?? 1;

  const parentEl = elements.get(el.parentId ?? "");
  const pProps = (parentEl?.properties ?? {}) as any;
  const pegCols = pProps.pegboardColumns ?? 12;
  const pegRows = pProps.pegboardRows ?? 12;
  const gap = (pProps.gap as number) ?? 0;
  const pad = (pProps.padding as number) ?? 0;

  const gridW = parentLayout.width - pad * 2;
  const gridH = parentLayout.height - pad * 2;
  const cellW = (gridW - gap * (pegCols - 1)) / pegCols;
  const cellH = (gridH - gap * (pegRows - 1)) / pegRows;

  return {
    x: parentLayout.x + pad + (col - 1) * (cellW + gap),
    y: parentLayout.y + pad + (row - 1) * (cellH + gap),
    width: colSpan * cellW + (colSpan - 1) * gap,
    height: rowSpan * cellH + (rowSpan - 1) * gap,
    rotation: 0,
    zIndex: el.transform.zIndex,
    clip: false,
  };
}

const RESOLVERS: Record<string, Resolver> = {
  freeform: resolveFreeform,
  row: resolveRow,
  column: resolveColumn,
  grid: resolveGrid,
  pegboard: resolvePegboard,
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
  // Track pegboard dimensions for sequential offset computation
  const childSize = new Map<string, { w: number; h: number }>();

  while (queue.length > 0) {
    const { parentId, parentLayout } = queue.shift()!;
    const parentEl = elMap.get(parentId);
    const children = tree.get(parentId) ?? [];

    // Pre-compute pegboard child sizes so offsets can use them
    for (const child of children) {
      if (child.layout.mode === "pegboard" && parentEl) {
        const tmp = resolvePegboard(child, parentLayout, tree, elMap);
        childSize.set(child.id, { w: tmp.width, h: tmp.height });
      }
    }

    for (const child of children) {
      const pMode = (parentEl?.properties?.direction as string) || "";

      // Compute sequential offset for row/column parents (stored locally, not on element)
      let seqOff: number | undefined;
      if (parentEl && (pMode === "row" || pMode === "column")) {
        const gap = (parentEl.properties?.gap as number) ?? 0;
        const sz = childSize.get(child.id);
        seqOff = pMode === "row" ? (runningX.get(parentId) ?? 0) : (runningY.get(parentId) ?? 0);
        const dim = (child.layout as any).basis ?? (pMode === "row" ? sz?.w : sz?.h) ?? 100;
        if (pMode === "row") runningX.set(parentId, seqOff + dim + gap);
        else runningY.set(parentId, seqOff + dim + gap);
      }

      let resolver: Resolver;
      if (child.layout.mode === "freeform") {
        resolver = resolveFreeform;
      } else if (child.layout.mode === "pegboard") {
        resolver = resolvePegboard;
      } else if (pMode === "row") {
        resolver = resolveRow;
      } else {
        resolver = resolveColumn;
      }

      const computed = resolver(child, parentLayout, tree, elMap, seqOff);
      result.set(child.id, computed);

      if (tree.has(child.id)) {
        queue.push({ parentId: child.id, parentLayout: computed });
      }
    }
  }

  return result;
}
