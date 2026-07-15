import { VNProject } from "../types";
import { ManagerLayout } from "./ManagerLayout";
import { BarChart3, FileText, GitFork, AlertTriangle } from "lucide-react";

interface DashboardProps {
  project: VNProject;
  onGoToNode: (nodeId: string) => void;
}

interface TodoItem {
  nodeId: string;
  nodeTitle: string;
  text: string;
  type: "TODO" | "FIXME";
}

export default function Dashboard({ project, onGoToNode }: DashboardProps) {
  const nodes = Object.values(project.nodes);
  let totalWords = 0;
  let dialogueWords = 0;
  let narrativeWords = 0;
  let choiceWords = 0;
  const todos: TodoItem[] = [];
  let branchCounts = { zero: 0, one: 0, many: 0 };

  for (const node of nodes) {
    const blocks = node.blocks || [];
    for (const block of blocks) {
      let text = "";
      if (block.type === "dialogue" || block.type === "narrative") {
        text = block.text;
      } else if (block.type === "choice") {
        text = block.text;
      }
      if (text) {
        const words = text.split(/\s+/).filter(Boolean).length;
        totalWords += words;
        if (block.type === "dialogue") dialogueWords += words;
        else if (block.type === "narrative") narrativeWords += words;
        else if (block.type === "choice") choiceWords += words;

        const todoMatch = text.match(/\/\/TODO\s*(.*)/g);
        if (todoMatch) {
          for (const m of todoMatch) {
            todos.push({ nodeId: node.id, nodeTitle: node.title, text: m.replace(/\/\/TODO\s*/, ""), type: "TODO" });
          }
        }
        const fixmeMatch = text.match(/#FIXME\s*(.*)/g);
        if (fixmeMatch) {
          for (const m of fixmeMatch) {
            todos.push({ nodeId: node.id, nodeTitle: node.title, text: m.replace(/#FIXME\s*/, ""), type: "FIXME" });
          }
        }
      }
    }

    const choiceCount = node.choices.length;
    if (choiceCount === 0) branchCounts.zero++;
    else if (choiceCount === 1) branchCounts.one++;
    else branchCounts.many++;
  }

  const totalNodes = nodes.length;
  const branchRatio = totalNodes > 0
    ? { zero: (branchCounts.zero / totalNodes * 100).toFixed(0), one: (branchCounts.one / totalNodes * 100).toFixed(0), many: (branchCounts.many / totalNodes * 100).toFixed(0) }
    : { zero: "0", one: "0", many: "0" };

  return (
    <ManagerLayout icon={BarChart3} title="Dashboard" listTitle="TODO / FIXME"
      description="Project analytics, word counts, and inline task scanner."
      form={
        <div className="space-y-5">
          <div className="glass-card p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-indigo-400" /> Word Counts
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-2xl font-mono font-bold text-indigo-300">{totalWords.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">Total Words</p>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-2xl font-mono font-bold text-cyan-300">{totalNodes}</p>
                <p className="text-[10px] text-slate-500">Total Nodes</p>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-lg font-mono font-bold text-amber-300">{dialogueWords.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">Dialogue</p>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-lg font-mono font-bold text-purple-300">{narrativeWords.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">Narrative</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <GitFork className="w-3.5 h-3.5 text-emerald-400" /> Branch Distribution
            </h4>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-900/60 rounded-xl p-3 text-center">
                <p className="text-lg font-mono font-bold text-slate-300">{branchRatio.zero}%</p>
                <p className="text-[10px] text-slate-500">No Choices</p>
                <p className="text-[9px] text-slate-600">{branchCounts.zero} nodes</p>
              </div>
              <div className="flex-1 bg-slate-900/60 rounded-xl p-3 text-center">
                <p className="text-lg font-mono font-bold text-slate-300">{branchRatio.one}%</p>
                <p className="text-[10px] text-slate-500">Linear</p>
                <p className="text-[9px] text-slate-600">{branchCounts.one} nodes</p>
              </div>
              <div className="flex-1 bg-slate-900/60 rounded-xl p-3 text-center">
                <p className="text-lg font-mono font-bold text-indigo-300">{branchRatio.many}%</p>
                <p className="text-[10px] text-slate-500">Branching</p>
                <p className="text-[9px] text-slate-600">{branchCounts.many} nodes</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-slate-400">{todos.length} item{todos.length !== 1 ? "s" : ""} found</span>
        </div>
        {todos.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-4 text-center">No TODO or FIXME markers found. Add <code className="text-indigo-400 bg-slate-800 px-1 rounded">//TODO</code> or <code className="text-amber-400 bg-slate-800 px-1 rounded">#FIXME</code> in any text block.</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {todos.map((item, i) => (
              <button key={i} onClick={() => onGoToNode(item.nodeId)}
                className="w-full text-left flex items-start gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group">
                <span className={`text-xs font-bold mt-0.5 shrink-0 ${item.type === "FIXME" ? "text-rose-400" : "text-amber-400"}`}>
                  {item.type === "FIXME" ? "⚠" : "☐"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-300 truncate">{item.text || item.type}</p>
                  <p className="text-[10px] text-slate-500 truncate group-hover:text-indigo-400 transition-colors">
                    {item.nodeTitle} ({item.nodeId.slice(0, 8)})
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}