# Chrysanthemum

> A visual novel storyboard editor with Google Drive collaboration.
> Built with Tauri v2 + React 19.

---

## Features

### Storyboard Canvas
- Infinite pan/zoom canvas with grid background
- Draggable node cards (story, location, encounter types)
- Bezier connection wires between choices and target nodes
- Merged multi-choice wires with stacked option labels
- Double-click to create new nodes
- Auto-arrange / tidy layout (by folder order)
- Type-based column separation (story/location/encounter lanes)

### Scene Directory (Left Sidebar)
- Foldable scene folders for organizing nodes
- Drag-and-drop reorder for folders and nodes
- Move nodes between folders via drag
- Search/filter by title, description, speaker
- Hide folders from canvas (eye toggle)
- Bulk move and delete nodes
- Collapsible to thin icon strip

### Node Editor (Right Sidebar)
- Resizable sidebar with drag handle
- Edit scene title, description, folder assignment
- Mark scenes as game endings (Good/Bad/Normal/Neutral)
- TipTap rich text dialogue editor with style/color marks
- Context menu: Shake, Glitch, Glow, Whisper, Redacted styles
- Context menu: text color presets + custom hex
- Choice trees with rewards (give/take items, adjust trackers, set flags)
- Choice requirements (flag checks, tracker comparisons)
- Location editor: open periods, status flags, shop inventory
- Encounter editor: enemy stats, item drops, win/lose/flee branches
- Collapsible section panels

### Managers (Tab Bar)
- **Items** — inventory items with tags and autocomplete
- **Entities** — characters/NPCs with color badges, tags, stat overrides (includes owned trackers & flags)
- **Calendar** — user-defined time periods with tracker conditions

### Playtest Simulator
- Full-screen dialogue walkthrough
- Live variable registry (tracker/flag values)
- Player inventory panel
- Choice buttons with requirement evaluation
- Locked choice debug toggle (show/hide unmet conditions)
- Undo branch (history rollback)
- Reset simulation
- Location shop with gold/affordability checks
- Encounter combat with damage calculation and drops
- Day/night time advancement
- Auto-triggered story beats

### Quick Search (Ctrl+F)
- Unified search across nodes, entities, items, flags, trackers
- Keyboard navigation (↑↓ enter, Esc to close)

### Google Drive Sync
- OAuth 2.0 sign-in with PKCE
- Per-project Drive folder linking (browse or paste link)
- Auto-sync (5-second debounce) and manual sync button
- UUID-based filenames (no duplicates)
- Cross-machine loading: sign-in scans Drive for project files
- Sync status indicator (Saved / Syncing / Synced to Drive ✓ / error details)

### Project Management
- New blank project
- New from template (Mystery of Ravenwood Manor)
- Switch between multiple projects
- Delete projects
- Import project from .json file
- Export project as .json
- Auto-save every 2 seconds to local filesystem
- localStorage fallback for web mode

### Tutorial & Help
- Built-in TutorialDialog with feature reference (all sections expandable)
- Keyboard shortcuts: Ctrl+F search, Esc close, ↑↓ navigate

### Calendar System
- Create named time periods (e.g. "Morning", "Night Shift")
- Combine multiple tracker conditions (hour >= 6, hour < 12)
- Assign periods to location cards for open/closed logic
- Real-time evaluation in playtest (✅ or 🔒 indicators)

### File Storage
- Local: `Documents/Chrysanthemum/Data/*.chrysanthemum`
- Drive: `chrysanthemum-{project-uuid}.json` (single file per project)

---

## Data Flow
- Edit → Auto-save (2s debounce) → Local .chrysanthemum file ↓ 5s debounce → Drive sync ↓ chrysanthemum-{uuid}.json in linked folder

- New machine: Sign in → Scan Drive for chrysanthemum-*.json → Load project → Auto-save locally → Sync back to same Drive file

---

## Built With
- Tauri v2 (Rust backend)
- React 19 + TypeScript
- Tailwind CSS v4
- TipTap (rich text editor)
- @dnd-kit (drag-and-drop)
- Lucide React (icons)
- Google Drive API v3
- Vite (bundler)
