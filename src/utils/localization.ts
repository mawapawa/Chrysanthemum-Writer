import { VNProject, SceneBlock } from "../types";

export interface LocRow {
  nodeId: string;
  nodeTitle: string;
  blockIdx: number;
  speaker: string;
  sourceText: string;
  targetTranslation: string;
  toneNotes: string;
}

export function exportToCSV(project: VNProject): string {
  const rows: LocRow[] = [];

  for (const node of Object.values(project.nodes)) {
    const blocks = node.blocks || [];
    // Also include description as a text field
    if (node.description) {
      rows.push({
        nodeId: node.id,
        nodeTitle: node.title,
        blockIdx: -1,
        speaker: "Description",
        sourceText: node.description,
        targetTranslation: "",
        toneNotes: "",
      });
    }
    blocks.forEach((block, idx) => {
      const row = extractRow(node.id, node.title, idx, block);
      if (row) rows.push(row);
    });
    // Also extract from legacy dialogueLines
    if (!blocks.length && node.dialogueLines) {
      node.dialogueLines.forEach((line, idx) => {
        rows.push({
          nodeId: node.id,
          nodeTitle: node.title,
          blockIdx: idx,
          speaker: line.speaker || "Narrator",
          sourceText: line.text,
          targetTranslation: "",
          toneNotes: `expression: ${line.expression || "neutral"}`,
        });
      });
    }
  }

  const header = "Node ID,Node Title,Block Index,Speaker,Source Text,Target Translation,Tone Notes";
  const lines = rows.map(r => {
    const escape = (s: string | number) => {
      const str = String(s).replace(/"/g, '""');
      return /[,"\n]/.test(str) ? `"${str}"` : str;
    };
    return [r.nodeId, r.nodeTitle, r.blockIdx, r.speaker, r.sourceText, r.targetTranslation, r.toneNotes].map(escape).join(",");
  });
  return [header, ...lines].join("\n");
}

function extractRow(nodeId: string, nodeTitle: string, idx: number, block: SceneBlock): LocRow | null {
  let text = "";
  let speaker = "Narrator";
  let toneNotes = "";

  switch (block.type) {
    case "dialogue":
      text = block.text;
      speaker = block.speaker;
      toneNotes = `expression: ${block.expression || "neutral"}`;
      break;
    case "narrative":
      text = block.text;
      speaker = "Narrator";
      break;
    case "choice":
      text = block.text;
      speaker = "Choice";
      break;
    default:
      return null;
  }

  if (!text.trim()) return null;

  return { nodeId, nodeTitle, blockIdx: idx, speaker, sourceText: text, targetTranslation: "", toneNotes };
}

export interface ImportResult {
  success: boolean;
  message: string;
  updatedCount: number;
}

export function importFromCSV(project: VNProject, csvText: string): ImportResult {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { success: false, message: "CSV must have a header row and at least one data row.", updatedCount: 0 };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const nodeIdIdx = header.indexOf("node id");
  const blockIdxIdx = header.indexOf("block index");
  const transIdx = header.indexOf("target translation");
  const toneIdx = header.indexOf("tone notes");

  if (nodeIdIdx < 0 || blockIdxIdx < 0 || transIdx < 0) {
    return { success: false, message: "CSV must contain 'Node ID', 'Block Index', and 'Target Translation' columns.", updatedCount: 0 };
  }

  const parseCSV = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  // Group translations by nodeId -> blockIdx
  const translations: Record<string, Record<number, { text: string; toneNotes: string }>> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSV(lines[i]);
    const nodeId = cols[nodeIdIdx]?.trim();
    const blockIdx = parseInt(cols[blockIdxIdx]);
    const transText = cols[transIdx]?.trim();
    if (!nodeId || isNaN(blockIdx)) continue;

    if (!translations[nodeId]) translations[nodeId] = {};
    const toneText = toneIdx >= 0 ? (cols[toneIdx]?.trim() || "") : "";
    translations[nodeId][blockIdx] = { text: transText, toneNotes: toneText };
  }

  let updatedCount = 0;

  for (const node of Object.values(project.nodes)) {
    const nodeTrans = translations[node.id];
    if (!nodeTrans) continue;

    // Update description (blockIdx -1)
    if (nodeTrans[-1]?.text && node.description) {
      const trans = nodeTrans[-1].text;
      if (trans && isValidTranslation(node.description, trans)) {
        node.description = trans;
        updatedCount++;
      }
    }

    // Update blocks
    if (node.blocks) {
      for (let idx = 0; idx < node.blocks.length; idx++) {
        const trans = nodeTrans[idx];
        if (!trans?.text) continue;
        const block = node.blocks[idx];
        if (block.type === "dialogue" || block.type === "narrative") {
          if (isValidTranslation(block.text, trans.text)) {
            block.text = trans.text;
            updatedCount++;
          }
        } else if (block.type === "choice") {
          if (isValidTranslation(block.text, trans.text)) {
            block.text = trans.text;
            updatedCount++;
          }
        }
      }
    }

    // Update legacy dialogueLines (blockIdx as index into dialogueLines)
    if (!node.blocks?.length && node.dialogueLines) {
      for (let idx = 0; idx < node.dialogueLines.length; idx++) {
        const trans = nodeTrans[idx];
        if (!trans?.text) continue;
        if (isValidTranslation(node.dialogueLines[idx].text, trans.text)) {
          node.dialogueLines[idx].text = trans.text;
          updatedCount++;
        }
      }
    }
  }

  const count = updatedCount;
  return { success: true, message: `Applied ${count} translation${count !== 1 ? "s" : ""}.`, updatedCount: count };
}

function isValidTranslation(source: string, translation: string): boolean {
  if (!translation) return false;
  const inlinePattern = /\[[\w\-]+:[\w\-]+\]|\/[\w]+\b/g;
  const sourceCodes = source.match(inlinePattern) || [];
  const transCodes = translation.match(inlinePattern) || [];
  if (sourceCodes.length !== transCodes.length) return false;
  for (let i = 0; i < sourceCodes.length; i++) {
    if (sourceCodes[i] !== transCodes[i]) return false;
  }
  return true;
}