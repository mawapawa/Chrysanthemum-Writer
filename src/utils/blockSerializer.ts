import { StoryNode, SceneBlock, StoryChoice, DialogueLine, StatChange } from "../types";

export function blocksToNode(blocks: SceneBlock[], existing: StoryNode): Partial<StoryNode> {
  const dialogueLines: DialogueLine[] = [];
  const choices: StoryChoice[] = [];
  const statChanges: StatChange[] = [];
  let isEnding = false;
  let endingType: "GOOD" | "BAD" | "NEUTRAL" | "NORMAL" | undefined;
  let endingName: string | undefined;
  let continueToNodeId: string | undefined;

  for (const block of blocks) {
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
        statChanges.push({
          variableName: block.variableName,
          operation: block.operation,
          value: block.value,
        });
        break;
      case "choice":
        choices.push({
          id: crypto.randomUUID(),
          text: block.text,
          targetNodeId: block.targetNodeId,
          effects: block.effects,
          requirement: block.requirement,
        });
        break;
      case "continue":
        continueToNodeId = block.targetNodeId;
        break;
      case "ending":
        isEnding = true;
        endingType = block.endingType;
        endingName = block.endingName;
        break;
      // New block types — preserved in the blocks array, not mapped to legacy fields
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
  let hasDialogue = false;
  for (const line of node.dialogueLines || []) {
    if (line.speaker === "Narrator" || !line.speaker) {
      blocks.push({ type: "narrative", text: line.text });
    } else {
      blocks.push({ type: "dialogue", speaker: line.speaker, expression: line.expression, text: line.text });
    }
    hasDialogue = true;
  }

  // Interleave statChanges after the last dialogue block if any
  for (const sc of node.statChanges || []) {
    blocks.push({ type: "effect", variableName: sc.variableName, operation: sc.operation, value: Number(sc.value) || 0 });
  }

  // Add choices
  for (const choice of node.choices || []) {
    blocks.push({
      type: "choice",
      text: choice.text,
      targetNodeId: choice.targetNodeId,
      effects: choice.effects,
      requirement: choice.requirement,
    });
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
