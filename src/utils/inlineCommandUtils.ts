export function handleSlashCommand(view: any, event: KeyboardEvent): boolean {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    const { state } = view;
    const { $from } = state.selection;
    const before = $from.parent.textContent.slice(0, $from.parentOffset);
    const nodeBefore = $from.nodeBefore;
    if (before === "" || before.endsWith(" ") || nodeBefore?.type.name === "hard_break") {
      event.preventDefault();
      const node = view.state.schema.nodes.inlineCommand?.create();
      if (node) {
        const tr = state.tr.replaceSelectionWith(node);
        view.dispatch(tr);
      }
      return true;
    }
  }
  return false;
}
