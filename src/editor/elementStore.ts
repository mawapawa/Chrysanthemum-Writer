import type { UIElementV2, ComputedLayout, UILayoutCollection, UILayer } from "../types";
import { computeLayouts } from "../utils/layoutEngine";
import { evaluateBindings } from "../utils/bindingEvaluator";

export function createEmptyLayouts(): UILayoutCollection {
  return { screens: { main: [] }, activeScreen: "main", layers: defaultLayers() };
}

function defaultLayers(): UILayer[] {
  return [
    { id: "default", name: "Default", visible: true, locked: false, order: 0 },
  ];
}

export interface ElementStore {
  elements: UIElementV2[];
  selectedId: string | null;
  add: (el: UIElementV2) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<UIElementV2>) => void;
  duplicate: (id: string) => UIElementV2 | null;
  select: (id: string | null) => void;
  getById: (id: string) => UIElementV2 | undefined;
  getChildren: (parentId: string) => UIElementV2[];
  getAncestors: (id: string) => UIElementV2[];
  getLayouts: () => Map<string, ComputedLayout>;
  reparent: (id: string, newParentId: string | undefined) => void;
  moveBefore: (id: string, beforeId: string) => void;
}

export function createElementStore(initial: UIElementV2[] = [], onChange?: () => void): ElementStore {
  let elements = [...initial];
  let selectedId: string | null = null;
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach(fn => fn());
    onChange?.();
  }

  const store: ElementStore = {
    get elements() { return elements; },
    get selectedId() { return selectedId; },

    add(el) {
      elements = [...elements, el];
      selectedId = el.id;
      notify();
    },

    remove(id) {
      // Remove element and all descendants
      const idsToRemove = new Set<string>([id]);
      const queue = [id];
      while (queue.length > 0) {
        const pid = queue.shift()!;
        for (const child of elements.filter(e => e.parentId === pid)) {
          idsToRemove.add(child.id);
          queue.push(child.id);
        }
      }
      elements = elements.filter(e => !idsToRemove.has(e.id));
      if (selectedId === id || (selectedId && idsToRemove.has(selectedId))) {
        selectedId = null;
      }
      notify();
    },

    update(id, patch) {
      elements = elements.map(e => e.id === id ? { ...e, ...patch } : e);
      notify();
    },

    duplicate(id) {
      const src = elements.find(e => e.id === id);
      if (!src) return null;
      const copy = { ...src, id: src.id + "_copy" };
      elements = [...elements, copy];
      selectedId = copy.id;
      // Duplicate children recursively
      const toAdd: UIElementV2[] = [];
      function dupChildren(parentId: string, newParentId: string) {
        for (const child of elements.filter(e => e.parentId === parentId)) {
          const childCopy = { ...child, id: child.id + "_copy", parentId: newParentId };
          toAdd.push(childCopy);
          dupChildren(child.id, childCopy.id);
        }
      }
      dupChildren(id, copy.id);
      if (toAdd.length > 0) elements = [...elements, ...toAdd];
      notify();
      return copy;
    },

    select(id) {
      selectedId = id;
      notify();
    },

    getById(id) {
      return elements.find(e => e.id === id);
    },

    getChildren(parentId) {
      return elements.filter(e => e.parentId === parentId);
    },

    getAncestors(id) {
      const result: UIElementV2[] = [];
      let current = elements.find(e => e.id === id);
      while (current?.parentId) {
        const parent = elements.find(e => e.id === current.parentId);
        if (parent) { result.unshift(parent); current = parent; }
        else break;
      }
      return result;
    },

    getLayouts() {
      return computeLayouts(elements);
    },

    reparent(id, newParentId) {
      elements = elements.map(e => e.id === id ? { ...e, parentId: newParentId } : e);
      notify();
    },

    moveBefore(id, beforeId) {
      const idx = elements.findIndex(e => e.id === id);
      const beforeIdx = elements.findIndex(e => e.id === beforeId);
      if (idx === -1 || beforeIdx === -1) return;
      const item = elements[idx];
      const rest = elements.filter(e => e.id !== id);
      rest.splice(rest.findIndex(e => e.id === beforeId), 0, item);
      elements = rest;
      notify();
    },
  };

  return store;
}
