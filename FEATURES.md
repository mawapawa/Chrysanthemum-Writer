# Chrysanthemum — Feature Reference

## Core Layout

| Area | What it does |
|---|---|
| **Left Sidebar** | Scene Directory — folder tree of all scene nodes, drag-and-drop reorder, search |
| **Center Canvas** | Visual flowchart — node cards with bezier connection lines, pan/zoom |
| **Right Sidebar** | Node Editor — collapsible sections for scene data, script, and choices |

---

## Top Bar — Tabs

| Tab | What it manages |
|---|---|
| **Storyboard** | The visual canvas + node editor |
| **Trackers** | Numeric values (gold, courage, affection) — create, delete |
| **Flags** | True/false statuses for story branching triggers |
| **Items** | Inventory items players can collect and use |
| **Entities** | Characters, monsters, NPCs with name + color badge |

---

## Scene Directory (Left Sidebar)

| Action | How |
|---|---|
| **Create folder** | Click `[Folder+]` at top |
| **Rename folder** | Hover folder → click pencil icon |
| **Delete folder** | Hover → click trash icon twice (confirm) |
| **Add node to folder** | Hover folder → click `[+]` |
| **Reorder scenes** | Drag folder headers up/down |
| **Reorder nodes** | Drag node items within a folder |
| **Move node to folder** | Drag node onto a different folder header |
| **Search** | Type in the search box above the tree |
| **Hide folder on canvas** | Click eye icon on folder — toggles visibility of that folder's cards |
| **Collapse sidebar** | Click "Collapse" at top → thin 12px strip |

---

## Canvas (Center)

| Action | How |
|---|---|
| **Pan** | Click and drag empty canvas space |
| **Zoom** | Use toolbar buttons `[-]` `[+`] or dropdown (100%/75%/50%/25%) |
| **Reset zoom** | Click compass icon in toolbar |
| **Add node** | Click `[+]` button in bottom-left toolbar, or double-click empty canvas |
| **Select node** | Click any node card |
| **Move node** | Drag node card by its title area |
| **Delete node** | Select node → click trash icon (two-click confirm) |
| **Set start node** | Click star icon on a node card |
| **Auto-arrange** | Click auto-layout button in toolbar |
| **Branch out** | Click "Branch Out" on a node card — creates new child node |
| **Test walkthrough** | Click play button → enters playtest mode |
| **Collapse right sidebar** | Click background → sidebar collapses to thin strip; click strip to re-open |
| **Resize right sidebar** | Drag the thin vertical handle on sidebar's left edge |

---

## Node Editor (Right Sidebar)

### 📄 Scene Overview
| Field | Description |
|---|---|
| **Title** | Scene point name |
| **Organizer Folder** | Assign to a scene folder (dropdown) |
| **Plot Summary** | Brief outline of what happens |
| **Is Game Ending?** | Toggle + ending style/label for ending nodes |

### 📝 Script & Dialogue Editor
- Full rich text editor (TipTap)
- Type normally to write prose
- **Right-click** selected text to open the context menu

> **Note:** TipTap is used for text aesthetics only (text style and color marks).

#### Context Menu Actions
| Menu | What it does |
|---|---|
| **🎨 Text Style** | Apply visual effects to selected text: Shake, Glitch, Glow, Whisper, Redacted |
| **🎨 Text Color** | Apply color to selected text — presets (Red, Blue, Green, Purple) or custom hex |
| **✕ Remove Effects** | Strip all text styles and colors from selection |

### 🔒 Choice Trees & Requirements
| Control | Description |
|---|---|
| **Choice text** | The player-facing option text |
| **Destination Node** | Which scene node this choice leads to |
| **🔒 Require Milestone** | Only show this choice if a flag is checked/unchecked |
| **🔒 Require Tracker** | Only show if a tracker value passes a comparison (≥, ≤, >, <, =, ≠) |
| **🎒 + Give Item** | Give player an item when this choice is selected |
| **🎒 + Take Item** | Take an item from the player when selected |
| **Delete choice** | Trash icon — two-click confirm |

---

## Tracks Managers

### Trackers (numeric)
- **Name**: lowercase identifier (e.g. "courage", "gold")
- **Starting Value**: default number
- **Description**: what it tracks
- Delete via trash icon (two-click confirm)

### Flags (boolean)
- **Name**: identifier (e.g. "has_old_key")
- **Default State**: checked (true) or unchecked (false)
- **Description**: what the flag represents
- Delete via trash icon

### Items
- **Name**: display name (e.g. "Cellar Key")
- **Description**: what the item is
- **Tags**: freeform labels — type + Enter to add (autocomplete from existing tags)
- Delete via trash icon

### Entities
- **Name**: display name (e.g. "Astrid", "Goblin")
- **Color**: pick from 8 presets or enter a custom hex code
- **Description**: who or what this is
- **Tags**: freeform labels (e.g. "monster", "friendly")
- Delete via trash icon

---

## Quick Search (Ctrl+F)

Press **Ctrl+F** anywhere to open the search palette. Searches:
- Node titles and descriptions
- Entity names
- Item names
- Flag names
- Tracker names

Results grouped by category. Use ↑↓ to navigate, Enter to open. Esc to close.

---

## Playtest Mode

| Feature | How |
|---|---|
| **Enter playtest** | Click play button on canvas toolbar |
| **Advance dialogue** | Click "Next" button or dialogue line |
| **Make a choice** | Click a choice button |
| **Locked choices** | Choices with unmet requirements are hidden (toggle "Show Locked" to debug) |
| **Live Memory Registry** | Left sidebar shows current tracker/flag values in real-time |
| **Inventory** | Collected items shown below the registry with counts |
| **Undo Branch** | Roll back to previous node with prior variable/inventory state |
| **Reset** | Restart from beginning with default values |
| **Exit** | Return to storyboard |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+F` | Open search palette |
| `Esc` | Close search palette, close context menus |
| `↑` / `↓` | Navigate search results / suggestion popups |
| `Enter` | Confirm selection in popups |

---

## Project Management

| Action | How |
|---|---|
| **New Blank Project** | Click Chrysanthemum logo → "New Blank Project" |
| **New From Template** | Click logo → "Mystery Template" |
| **Switch projects** | Click logo → select from list |
| **Delete project** | Click logo → hover non-active project → click X |
| **Auto-save** | Every 2 seconds of inactivity — saved to `{documents}/Chrysanthemum/Data/*.chrysanthemum` |
| **Export** | "Export Story" button → downloads raw JSON file |

---

## Local File Storage

Projects are saved as `.chrysanthemum` files in:
- **Windows:** `C:\Users\{name}\Documents\Chrysanthemum\Data\`
- **macOS:** `~/Documents/Chrysanthemum/Data/`
- **Linux:** `~/Documents/Chrysanthemum/Data/`

To back up: copy the entire `Data\` folder. To restore: paste it back.
