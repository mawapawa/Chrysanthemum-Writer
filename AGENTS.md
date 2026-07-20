# Chrysanthemum — V2 UI Editor Architecture

## Project Overview
A Carrd-inspired visual novel UI editor. V2 pipeline runs alongside V1 — no legacy code removed.

**Design Principle**: The editor is a LEGO builder, not a tree editor. The canvas is the primary interface. Containers, parentIds, layout modes are implementation details the editor manages automatically. The user places pieces where they feel right and the editor infers the structure.

**Core Rule**: Every drag operation should resolve into a semantic edit to the document model, not a change in pixel coordinates.

## Key Files
- `src/editor/EditorV2.tsx` — main Carrd-like editor (hierarchy, canvas, inspector, layers, resolution)
- `src/editor/elementStore.ts` — element CRUD + layout computation
- `src/factories/vnComponents.ts` — 7 component presets + freeform container
- `src/utils/layoutEngine.ts` — tree builder + per-mode resolvers
- `src/utils/bindingEvaluator.ts` — showIf, state filters, var interpolation
- `src/utils/propertyResolver.ts` — UIElementV2 → TextStyleProps, etc.
- `src/utils/styleResolver.ts` — StyleV2 + appearance → ComputedStyle
- `src/widgets/pipelineV2.tsx` — orchestrates bindings → props → layout → style → render
- `src/widgets/renderGameUI.tsx` — GameUIRenderer for playtest integration
- `src/widgets/elementRenderer.tsx` — ElementRenderer + widgets
- `src/types.ts` — all type definitions (UIElementV2, ComputedLayout, LayoutV2, etc.)
- `src/App.tsx` — DEV flags off, tab bar, project management

## State
### Built
- V2 pipeline: BindingEvaluator, PropertyResolver, LayoutEngine (freeform/row/column/grid), StyleResolver (appearance + borders + shadow), ElementRenderer, pipelineV2 orchestrator
- GameUIRenderer — bridge from playtest to V2 layouts
- EditorV2: Carrd-style layout (hierarchy left, canvas center, inspector right, palette top), layer system, canvas resolution selector (6 presets), z-index control, custom HUD screen creation, button Open HUD action
- ElementStore with add/remove/update/duplicate/reparent/moveBefore, 600ms sync to project
- Asset upload (PNG/JPG → data URL → project.assets[])
- Appearance inspector (color/image backgrounds, fit modes, border radius, shadow, opacity)
- Element factories (7 presets + freeform container)
- Drag system: freeform elements can be dragged by x/y on canvas, throttled 50ms, snap-to-grid 10px
- Resize handles (8 directions) on selected freeform elements
- 16 vertical slice test cases

### ID Generator
- Fixed: uses `Date.now() + random suffix` (was: global counter that reset on HMR causing duplicate keys)

## Current Architecture Notes
- Flat hierarchy via `parentId`, no nested children array
- Layout modes for elements: `freeform`, `row`, `column`, `grid`
- Container direction (how children are laid out): via `properties.direction` ("row" | "column")
- Widgets are pure renderers — receive only resolved props
- Selection preserved across screen switches via store lifecycle
- Canvas hit areas: transparent div overlays for drag/resize interaction

## Pending Milestones
1. Remove freeform as default — Container-first workflow, root container on new screens, primitive registry palette, born-with-layout containers
2. Semantic drag — Replace pixel dragging with structural edits (reparent, reorder) via drop zones
3. Container layout modes — Row, Column, Grid, Overlay; inspector edits container mode; children inherit
4. Semantic resize — Resize modifies layout rules (basis, span, gap, padding), not pixel coords; Overlay stays pixel

## Milestone Progress

### Milestone 1 — ✅ Complete
**Container-first workflow with primitive registry**

Changes made:
- Created `src/factories/primitiveRegistry.ts` — registry of 7 primitives:
  - Container variants: Row, Column, Grid, Overlay (born-with layout)
  - Element primitives: Text, Image, Button
- `createRootContainer()` — auto-inserted on empty screens (freeform, fills canvas, column direction)
- `EditorV2.tsx` palette renders from `primitiveRegistry`, not `vnComponentList`
- **"Nothing can be added unless a container is selected"** — all palette buttons disable (grayed out, not-allowed cursor) when no container is targeted
- `findContainerForAdd()` helper: checks selected element (container→use it, non-container→use parent) or returns undefined
- New elements get `parentId` set to the target container at add time
- Clear button removes all and re-creates root container
- Old `vnComponents.ts` left intact (runtime widgets still reference preset types)

### Post-Milestone 1 Fixes
- Fixed element positioning — wrappers now use `position: relative` to anchor absolute children to the canvas
- Root container dimensions sync with canvas resolution (effect watches `canvasRes` changes)
- Semantic resize on flex containers — dragging handles changes `basis` instead of pixel width/height
- Dot grid now uses 10px-based pattern (matches snap grid, functions as pegboard reference)
- Root container resize blocked (infrastructure element)
- Debug overlay (ID + position + size) can be re-enabled via toggle

### Milestone 2 — ❌ Not Started
Semantic drag with drop zones

### Milestone 3 — ❌ Not Started
Full container layout modes (Grid implementation, Overlay mode)

### Milestone 4 — ❌ Not Started
Semantic resize (basis, span, gap, padding changes)
