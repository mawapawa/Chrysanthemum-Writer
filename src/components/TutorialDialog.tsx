import { useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";

interface Section {
  title: string;
  content: () => React.ReactNode;
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 text-left cursor-pointer transition-colors">
        {open ? <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />}
        <span className="text-xs font-bold text-slate-200">{title}</span>
      </button>
      {open && <div className="px-4 py-3 text-xs text-slate-400 space-y-2 leading-relaxed">{children}</div>}
    </div>
  );
}

export default function TutorialDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xl">
      <div className="glass-card p-6 w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-sm font-bold text-slate-200">Chrysanthemum — Feature Reference</h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <Section title="Core Layout" defaultOpen>
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Area</th><th className="text-left pb-1">What it does</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold text-indigo-400">Left Sidebar</td><td>Scene Directory — folder tree of all scene nodes, drag-and-drop reorder, search</td></tr>
                <tr><td className="pr-4 py-1 font-semibold text-indigo-400">Center Canvas</td><td>Visual flowchart — node cards with bezier connection lines, pan/zoom</td></tr>
                <tr><td className="pr-4 py-1 font-semibold text-indigo-400">Right Sidebar</td><td>Node Editor — collapsible sections for scene data, script, and choices</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Top Bar — Tabs">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Tab</th><th className="text-left pb-1">What it manages</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">Storyboard</td><td>The visual canvas + node editor</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Items</td><td>Inventory items players can collect and use</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Entities</td><td>Characters, monsters, NPCs with name + color badge</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Calendar</td><td>Time periods with tracker conditions for location open/closed logic</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Scene Directory (Left Sidebar)">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Action</th><th className="text-left pb-1">How</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">Create folder</td><td>Click [+] at top</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Rename folder</td><td>Hover folder → click pencil icon</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Delete folder</td><td>Hover → click trash icon twice (confirm)</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Add node to folder</td><td>Hover folder → click [+]</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Reorder scenes</td><td>Drag folder headers up/down</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Reorder nodes</td><td>Drag node items within a folder</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Move node to folder</td><td>Drag node onto a different folder header</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Search</td><td>Type in the search box above the tree</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Hide folder on canvas</td><td>Click eye icon — toggles visibility of cards in that folder</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Collapse sidebar</td><td>Click "Collapse" at top → thin strip</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Canvas (Center)">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Action</th><th className="text-left pb-1">How</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">Pan</td><td>Click and drag empty canvas space</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Zoom</td><td>Toolbar buttons [-] [+] or dropdown (100%/75%/50%/25%)</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Add node</td><td>Click [+] in toolbar, or double-click empty canvas</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Select node</td><td>Click any node card</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Move node</td><td>Drag node card by its title area</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Delete node</td><td>Click trash icon on card (two-click confirm)</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Set start node</td><td>Click star icon on a node card</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Auto-arrange</td><td>Click auto-layout button in toolbar</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Branch out</td><td>Click "Branch Out" to create a linked child node</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Test walkthrough</td><td>Click play button → enters playtest mode</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Collapse right sidebar</td><td>Click canvas background; click strip to re-open</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Resize right sidebar</td><td>Drag the vertical handle on the sidebar's left edge</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Node Editor — Scene Overview">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Field</th><th className="text-left pb-1">Description</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">Title</td><td>Scene point name</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Organizer Folder</td><td>Assign to a scene folder (dropdown)</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Plot Summary</td><td>Brief outline of what happens</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Is Game Ending?</td><td>Toggle + ending style/label for ending nodes</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Node Editor — Script & Dialogue">
            <p>Full rich text editor (TipTap) for text aesthetics only. Right-click selected text for styling options.</p>
            <table className="w-full text-[11px] mt-2">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Action</th><th className="text-left pb-1">How</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">Text Style</td><td>Shake, Glitch, Glow, Whisper, Redacted</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Text Color</td><td>Presets (Red, Blue, Green, Purple) or custom hex</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Remove Effects</td><td>Strip all text styles and colors from selection</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Node Editor — Choice Trees">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Control</th><th className="text-left pb-1">Description</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">Choice text</td><td>The player-facing option text</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Destination Node</td><td>Which scene node this choice leads to</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Require Flag</td><td>Only show this choice if a flag is checked/unchecked</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Require Tracker</td><td>Only show if a tracker value passes a comparison</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Give Item</td><td>Give player an item when this choice is selected</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Take Item</td><td>Take an item from the player when selected</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Adjust Tracker</td><td>Modify a numeric stat when this choice is selected</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Quick Search (Ctrl+F)">
            <p className="text-slate-300">Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-indigo-400">Ctrl+F</kbd> to search nodes, entities, items, flags, and trackers. Use ↑↓ to navigate, Enter to open.</p>
          </Section>

          <Section title="Playtest Mode">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Feature</th><th className="text-left pb-1">How</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">Enter playtest</td><td>Click play button on canvas toolbar</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Advance dialogue</td><td>Click "Next" button</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Make a choice</td><td>Click a choice button</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Locked choices</td><td>Toggle "Show Locked" to debug unmet requirements</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Live Memory</td><td>Left sidebar shows tracker/flag values in real time</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Inventory</td><td>Collected items shown below the registry</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Undo Branch</td><td>Roll back to previous node with prior state</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Reset</td><td>Restart from beginning with default values</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Keyboard Shortcuts">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Shortcut</th><th className="text-left pb-1">Action</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1"><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-indigo-400">Ctrl+F</kbd></td><td>Open search palette</td></tr>
                <tr><td className="pr-4 py-1"><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-indigo-400">Esc</kbd></td><td>Close search palette / context menus</td></tr>
                <tr><td className="pr-4 py-1"><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-indigo-400">↑</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-indigo-400">↓</kbd></td><td>Navigate search results / suggestion popups</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Project Management">
            <table className="w-full text-[11px]">
              <thead><tr className="text-slate-500 font-mono text-[10px]"><th className="text-left pr-4 pb-1">Action</th><th className="text-left pb-1">How</th></tr></thead>
              <tbody className="text-slate-300">
                <tr><td className="pr-4 py-1 font-semibold">New Project</td><td>Click Chrysanthemum logo → "New Blank Project" or "Mystery Template"</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Switch projects</td><td>Click logo → select from list</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Delete project</td><td>Click logo → hover non-active project → click X</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Import project</td><td>Click logo → "Import Project from File"</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Export</td><td>Settings → Download JSON</td></tr>
                <tr><td className="pr-4 py-1 font-semibold">Auto-save</td><td>Every 2 seconds of inactivity to <span className="font-mono text-[10px]">Documents/Chrysanthemum/Data/</span></td></tr>
              </tbody>
            </table>
          </Section>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-center shrink-0">
          <button onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
