# Runtime Widgets v1 — Milestone

## Validation Checklist

### Palette
- [ ] Drag Dialogue Box — child templates created correctly, defaults match registry
- [ ] Drag Choice List — same
- [ ] Drag Name Box — same
- [ ] Drag Portrait — same

### Layout
- [ ] Move widgets on pegboard
- [ ] Resize widgets
- [ ] Containers behave correctly (direction, gap, padding)
- [ ] Layers work (hide, lock, reorder)
- [ ] Pegboard grid resolution handles correctly

### Inspector
- [ ] Registry-defined fields shown for runtime widgets
- [ ] Generic bindings (textTemplate, repeat, etc.) hidden
- [ ] Styling updates immediately
- [ ] Fields persisted on save/reload

### Serialization
- [ ] Save project
- [ ] Close editor
- [ ] Reopen
- [ ] Registry widgets restored
- [ ] Child templates restored
- [ ] No duplicated runtime data

### Storyboard Integration
- [ ] Dialogue node → Dialogue Box updates (zero manual bindings)
- [ ] Speaker changes → Name Box updates
- [ ] Choice node → Choice List appears, buttons populate
- [ ] Choice selected → dialogue resumes
- [ ] Portrait changes → Portrait widget updates

### Playtest
- [ ] Typing effect works
- [ ] Choices appear at correct story point
- [ ] Choices disappear after selection
- [ ] Dialogue box hides during choices (visibleDuring)
- [ ] Choice list hides during dialogue
- [ ] Story progression via scene navigator bar
- [ ] No placeholder leaks ([choice.text] at runtime)

### Regression Checks
- [ ] Existing layouts (pre-registry) still load correctly
- [ ] Legacy Choice List and Dialogue Box projects migrate without data loss
- [ ] Copy/paste still works
- [ ] Duplicate still works
- [ ] Layers still function
- [ ] Export/import unchanged
- [ ] Playtest behaves identically after reopening a project

---

## Completion Criteria

1. All checklist items accepted
2. One complete VN scene built and playtested (10–15 nodes, branching choices, portrait changes)
3. No manual bindings required for the common path
4. Advanced mode available for users who need raw bindings

---

## Runtime Widget Contract (Locked)

Once Runtime Widgets v1 passes, the following architecture is frozen:

1. **Runtime widgets are defined exclusively in `runtimeWidgetRegistry`.** The registry is the single source of truth for defaults, inspector fields, auto-bindings, visibility defaults, and child templates.
2. **Runtime widgets consume the existing `BindingContext`.** They do not query the storyboard directly.
3. **Runtime widgets use the existing layout engine** (pegboard, row, column, freeform) without special positioning logic.
4. **Runtime widgets compose existing primitives and containers.** They do not introduce new rendering systems.
5. **The renderer, palette, and inspector discover runtime widgets from the registry.** No hardcoded switch statements per widget type.

If a future feature requires violating one of these rules, it triggers an architectural review rather than a routine implementation.

---

## After v1: The Tiny VN

Build one scene:

```
Start
  ↓
Narration
  ↓
Character enters
  ↓
Dialogue (x3-4 lines)
  ↓
Portrait changes
  ↓
Dialogue (x2)
  ↓
Choice ──┬── Branch A → Ending A
          └── Branch B → Ending B
```

This exercises: storyboard, runtime widgets, layout, playtest, serialization, bindings, branching, portrait changes, dialogue progression. If you can build this without fighting the tool, the architecture is validated.
