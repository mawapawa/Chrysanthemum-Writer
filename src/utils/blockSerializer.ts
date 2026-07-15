import { StoryNode, SceneBlock, StoryChoice, DialogueLine, StatChange, InlineEffect } from "../types";

// blocksToNode extracts legacy fields from the blocks array for backward compatibility.
// The canonical source of truth is always node.blocks (set by handleEditorBlocksChange).
// Types without legacy equivalents (bgm, sfx, delay, etc.) are automatically preserved
// via the blocks field and do not need legacy extraction.
export function blocksToNode(blocks: SceneBlock[], _existing: StoryNode): Partial<StoryNode> {
  const dialogueLines: DialogueLine[] = [];
  const choices: StoryChoice[] = [];
  const statChanges: StatChange[] = [];
  let isEnding = false;
  let endingType: "GOOD" | "BAD" | "NEUTRAL" | "NORMAL" | undefined;
  let endingName: string | undefined;
  let continueToNodeId: string | undefined;
  const skipIdx = new Set<number>();

  for (let i = 0; i < blocks.length; i++) {
    if (skipIdx.has(i)) continue;
    const block = blocks[i];

    switch (block.type) {
      case "dialogue":
        dialogueLines.push({
          id: crypto.randomUUID(),
          speaker: block.speaker,
          text: block.text,
          expression: block.expression || "Neutral",
          formattedText: block.text ? `<p>${block.text}</p>` : undefined,
        });
        break;
      case "narrative":
        dialogueLines.push({
          id: crypto.randomUUID(),
          speaker: "Narrator",
          text: block.text,
          formattedText: block.text ? `<p>${block.text}</p>` : undefined,
        });
        break;
      case "effect":
        // If preceded by a choice, it's already attached as choice effect — skip
        if (i > 0 && blocks[i - 1].type === "choice") break;
        statChanges.push({
          variableName: block.variableName,
          operation: block.operation,
          value: block.value,
        });
        break;
      case "choice": {
        const choiceEffects: InlineEffect[] = [...(block.effects || [])];
        const next = blocks[i + 1];
        if (next?.type === "effect") {
          choiceEffects.push({
            id: crypto.randomUUID(),
            type: "adjust_tracker",
            targetId: next.variableName,
            operation: next.operation === "+" ? "add" : next.operation === "-" ? "subtract" : "set",
            value: next.value,
          });
          skipIdx.add(i + 1);
        } else if (next?.type === "flag") {
          choiceEffects.push({
            id: crypto.randomUUID(),
            type: next.flagValue ? "set_flag" : "clear_flag",
            targetId: next.flagName,
          });
          skipIdx.add(i + 1);
        }
        choices.push({
          id: crypto.randomUUID(),
          text: block.text,
          targetNodeId: block.targetNodeId,
          effects: choiceEffects,
          requirement: block.requirement,
        });
        break;
      }
      case "continue":
        continueToNodeId = block.targetNodeId;
        break;
      case "ending":
        isEnding = true;
        endingType = block.endingType;
        endingName = block.endingName;
        break;
      case "flag":
      case "conditional":
      case "bgm":
      case "sfx":
      case "background":
      case "delay":
      case "itemEffect":
      case "statDisplay":
      case "entity":
      case "condition":
        break;
    }
  }

  return {
    dialogueLines: dialogueLines.length > 0 ? dialogueLines : [],
    choices,
    statChanges: statChanges.length > 0 ? statChanges : [],
    isEnding,
    endingType,
    endingName,
    continueToNodeId,
  };
}

export function nodeToBlocks(node: StoryNode): SceneBlock[] {
  const blocks: SceneBlock[] = [];

  // Build from dialogueLines and narrative text
  for (const line of node.dialogueLines || []) {
    if (line.speaker === "Narrator" || !line.speaker) {
      blocks.push({ type: "narrative", text: line.text });
    } else {
      blocks.push({ type: "dialogue", speaker: line.speaker, expression: line.expression, text: line.text });
    }

  }

  // Interleave statChanges after the last dialogue block if any
  for (const sc of node.statChanges || []) {
    blocks.push({ type: "effect", variableName: sc.variableName, operation: sc.operation, value: Number(sc.value) || 0 });
  }

  // Add choices with their effects expanded into following blocks
  for (const choice of node.choices || []) {
    blocks.push({
      type: "choice",
      text: choice.text,
      targetNodeId: choice.targetNodeId,
      effects: choice.effects,
      requirement: choice.requirement,
    });
    for (const ef of choice.effects || []) {
      if (ef.type === "adjust_tracker") {
        blocks.push({
          type: "effect" as const,
          variableName: ef.targetId,
          operation: ef.operation === "add" ? "+" : ef.operation === "subtract" ? "-" : "=",
          value: ef.value || 0,
        });
      } else if (ef.type === "set_flag" || ef.type === "clear_flag") {
        blocks.push({
          type: "flag" as const,
          flagName: ef.targetId,
          flagValue: ef.type === "set_flag",
        });
      }
    }
  }

  // Add continue-to if applicable
  if (node.continueToNodeId) {
    blocks.push({ type: "continue", targetNodeId: node.continueToNodeId });
  }

  // Add ending if applicable
  if (node.isEnding) {
    blocks.push({ type: "ending", endingType: node.endingType || "NORMAL", endingName: node.endingName });
  }

  return blocks;
}
