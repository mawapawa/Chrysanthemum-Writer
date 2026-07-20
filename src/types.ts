export interface VNVariable {
  id?: string;
  name: string;
  type: "number" | "boolean";
  defaultValue: number | boolean;
  description?: string;
  displayId?: string;
}

export interface VNCharacter {
  id: string;
  name: string;
  color: string;
  description?: string;
  displayId?: string;
}

export interface ChoiceCondition {
  variableName: string;
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
  value: number | boolean | string;
}

export interface StatChange {
  variableName: string;
  operation: "+" | "-" | "=";
  value: number | boolean | string;
}

export interface VNEntityStat {
  name: string;
  defaultValue: number;
  isCombat?: boolean;
}

export interface VNEntityFlag {
  name: string;
  defaultValue: boolean;
}

export interface VNEntity {
  id: string;
  name: string;
  color: string;
  description?: string;
  displayId?: string;
  tags: string[];
  hp?: number;
  attack?: number;
  defense?: number;
  stats?: Record<string, number>;
  ownedTrackers?: VNEntityStat[];
  ownedFlags?: VNEntityFlag[];
  expressions?: string[];
}

export interface VNTracker {
  id: string;
  name: string;
  defaultValue: number;
  description?: string;
  displayId?: string;
}

export interface VNFlag {
  id: string;
  name: string;
  defaultValue: boolean;
  description?: string;
  displayId?: string;
}

export interface VNItem {
  id: string;
  name: string;
  description?: string;
  displayId?: string;
  tags: string[];
  statModifiers?: Record<string, number>;
}

export interface InlineEffect {
  id: string;
  type: "give_item" | "take_item" | "adjust_tracker" | "set_flag" | "clear_flag";
  targetId: string;
  operation?: "add" | "subtract" | "set";
  value?: number;
  flagValue?: boolean;
}

export interface ChoiceRequirement {
  source: "tracker" | "flag";
  targetId: string;
  operator?: "==" | "!=" | ">=" | "<=" | ">" | "<";
  compareValue?: number;
  expect?: boolean;
}

export interface StoryChoice {
  id: string;
  text: string;
  targetNodeId: string;
  condition?: ChoiceCondition;
  statChanges?: StatChange[];
  requirement?: ChoiceRequirement;
  effects?: InlineEffect[];
}

export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  expression?: string;
  formattedText?: string;
}

export interface LocationItem {
  itemId: string;
  price: number;
  quantity?: number;
}

export interface EncounterDrop {
  itemId: string;
  chance: number;
  quantity: number;
}

export interface CalendarCondition {
  trackerId: string;
  operator: ">=" | "<=" | ">" | "<" | "==" | "!=";
  value: number;
}

export interface CalendarPeriod {
  id: string;
  name: string;
  conditions: CalendarCondition[];
}

export interface TimeSegment {
  name: string;
  ticks: number;
}

export interface CustomTimeConfig {
  segments: TimeSegment[];
  daysOfWeek: string[];
  months: { name: string; days: number }[];
}

export interface TimeContext {
  tick: number;
  segment: string;
  dayOfWeek: string;
  dayOfMonth: number;
  month: string;
  year: number;
}

export interface LocationData {
  openTime?: "day" | "night" | "any";
  openPeriodId?: string;
  statusFlagId?: string;
  inventory: LocationItem[];
  tags: string[];
}

export interface LocationVisuals {
  bgImage: string;
  ambientAudio?: string;
  uiLayoutId?: string;
}

export interface EncounterPoolEntry {
  encounterId: string;
  weight: number;
}

export interface BaseAction {
  label: string;
  actionCommand: string;
}

export interface LocationNodeData {
  visuals: LocationVisuals;
  connections: string[];
  mapPosition: { x: number; y: number };
  encounterPool: EncounterPoolEntry[];
  baseActions: BaseAction[];
  inventory: LocationItem[];
  tags: string[];
}

export interface EncounterData {
  entityId?: string;
  enemyName: string;
  hp: number;
  attack: number;
  defense: number;
  drops: EncounterDrop[];
  onWinNodeId?: string;
  onLoseNodeId?: string;
  onFleeNodeId?: string;
  tags: string[];
}

export interface StoryBeatTrigger {
  source: "flag" | "tracker";
  targetId: string;
  expect?: boolean;
  min?: number;
}

export type SceneBlock =
  | { type: "dialogue"; speaker: string; expression?: string; text: string }
  | { type: "narrative"; text: string }
  | { type: "effect"; variableName: string; operation: "+" | "-" | "="; value: number }
  | { type: "statDisplay"; variableName: string }
  | { type: "choice"; text: string; targetNodeId: string; random?: number; effects?: InlineEffect[]; requirement?: ChoiceRequirement }
  | { type: "entity"; entityId: string }
  | { type: "condition"; source: "tracker" | "flag"; targetId: string; operator?: string; compareValue?: number }
  | { type: "continue"; targetNodeId: string }
  | { type: "ending"; endingType: "GOOD" | "BAD" | "NEUTRAL" | "NORMAL"; endingName?: string }
  | { type: "flag"; flagName: string; flagValue: boolean }
  | { type: "conditional"; condition: ChoiceRequirement }
  | { type: "bgm"; trackName: string; fadeIn?: number }
  | { type: "sfx"; soundName: string }
  | { type: "background"; asset: string }
  | { type: "delay"; seconds: number }
  | { type: "itemEffect"; action: "give" | "take" | "use"; itemName: string }
  | { type: "time"; action: "add" | "set" | "set_date"; value: number; segment?: string; dateString?: string; unit?: "tick" | "day" | "month" }
  | { type: "intercept"; targetLocationId: string; condition: ChoiceRequirement }
  | { type: "trigger"; source: "flag" | "tracker"; targetId: string; expect?: boolean; min?: number }
  | { type: "showOverlay"; overlayId: string }
  | { type: "hideOverlay" }
  | { type: "inputDialog"; variableName: string; prompt: string; defaultValue?: string };

export interface StoryNode {
  id: string;
  title: string;
  description: string;
  speaker: string;
  dialogueLines: DialogueLine[];
  choices: StoryChoice[];
  statChanges: StatChange[];
  position: { x: number; y: number };
  isEnding: boolean;
  endingType?: "GOOD" | "BAD" | "NEUTRAL" | "NORMAL";
  endingName?: string;
  sceneId?: string;
  displayId?: string;
  order?: number;
  nodeType: "story" | "location" | "encounter";
  locationNodeData?: LocationNodeData;
  locationData?: LocationData;
  encounterData?: EncounterData;
  continueToNodeId?: string;
  trigger?: StoryBeatTrigger;
  interceptFlag?: { targetLocationId: string; condition: ChoiceRequirement };
  blocks?: SceneBlock[];
}

export interface NodeLock {
  nodeId: string;
  userId: string;
  userName: string;
  acquiredAt: number;
  heartbeatAt: number;
}

export interface VNScene {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order?: number;
  parentId?: string;
}

export interface VNProject {
  id: string;
  name: string;
  description: string;
  startNodeId: string;
  nodes: Record<string, StoryNode>;
  entities: VNEntity[];
  trackers: VNTracker[];
  flags: VNFlag[];
  inventory: VNItem[];
  lastModified: number;
  schemaVersion: number;
  driveFileId?: string;
  driveFolderId?: string;
  driveSyncVersion?: number;
  lastModifiedBy?: { id: string; name: string };
  locks?: NodeLock[];
  calendar?: CalendarPeriod[];
  customTimeConfig?: CustomTimeConfig;
  globalTimeTicks?: number;
  scenes?: VNScene[];
  flowDirection?: "horizontal" | "vertical";
  variables?: VNVariable[];
  characters?: VNCharacter[];
  dashboardLayout?: WidgetConfig[];
  overlays?: OverlayDef[];
  keyMappings?: KeyMapping[];
}

export type WidgetType = "container" | "text" | "image" | "statText" | "statBar" | "button" | "choiceList" | "portrait" | "inventory" | "divider" | "borderBox" | "repeater" | "inspector";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  settings?: WidgetSettings;
  children?: WidgetConfig[];
}

export interface WidgetSettings {
  // container
  direction?: "row" | "column";
  containerBorder?: boolean;
  padding?: string;
  bgColor?: string;
  borderColor?: string;
  gap?: string;

  // text
  textType?: "label" | "title" | "characterName" | "dialogue" | "narrator" | "custom";
  content?: string;
  fontSize?: string;
  color?: string;
  align?: "left" | "center" | "right";

  // image
  src?: string;
  aspectRatio?: string;
  fit?: "cover" | "contain" | "fill";

  // statText / statBar
  statSource?: string;    // "tracker.NAME" | "flag.NAME" | "entity.NAME.field"
  statLabel?: string;
  statMin?: number;
  statMax?: number;
  barColor?: string;

  // button
  buttonLabel?: string;
  buttonAction?: string;  // "menu" | "save" | "load" | "settings" | "custom" | "next" | "continue"

  // choiceList
  choiceListLabel?: string;
  choiceListMode?: "auto" | "always";

  // portrait
  portraitSpeaker?: string;
  portraitSrc?: string;
  portraitShape?: "circle" | "rounded" | "square";

  // inventory
  inventoryLabel?: string;
  inventoryShowEmpty?: boolean;

  // divider
  dividerColor?: string;
  dividerStyle?: "solid" | "dashed" | "dotted";

  // repeater
  repeaterSource?: string;

  // inspector
  trackedItemId?: string;

  // borderBox (9-slice)
  borderImage?: string;
  borderSliceTop?: number;
  borderSliceRight?: number;
  borderSliceBottom?: number;
  borderSliceLeft?: number;
  borderWidth?: string;
  borderPadding?: string;

  // styling (all widget types)
  widgetOpacity?: number;
  widgetBorderRadius?: string;
  widgetBorderWidth?: string;
  widgetBorderColor?: string;
  widgetBorderStyle?: "solid" | "dashed" | "dotted" | "none";

  // conditional visibility (all widget types)
  showIfSource?: string;    // "tracker.NAME" | "flag.NAME"
  showIfOperator?: "==" | "!=" | ">=" | "<=" | ">" | "<" | "exists";
  showIfValue?: string;

  // visual state filter
  stateFilterStyle?: "none" | "grayscale" | "low-opacity" | "blur";
  stateFilterSource?: string;
  stateFilterOperator?: "==" | "!=" | ">=" | "<=" | ">" | "<" | "exists";
  stateFilterValue?: string;
}

// ─── Binding Evaluator Types ────────────────────────────────────

export interface ResolvedBindings {
  visible: boolean;
  stateFilter: Record<string, any>; // CSS filter properties
  text: string;            // interpolated textTemplate
}

// ─── Binding Context ────────────────────────────────────────────

export interface BindingContext {
  vars?: Record<string, any>;       // tracker/flag values
  dialogueText?: string;             // current line text
  dialogueSpeaker?: string;
  dialogueFormattedText?: string;
}

// ─── Render Properties ──────────────────────────────────────────

export interface TextStyleProps {
  type: 'text';
  content: string;
  fontSize: string;
  color: string;
  align: 'left' | 'center' | 'right';
  fontStyle?: string;
  fontWeight?: number;
  lineHeight?: number;
  isDialogueBox: boolean;
  formattedText?: string;
}

export interface ButtonStyleProps {
  type: 'button';
  label: string;
  action: string;
  disabled: boolean;
}

export type RenderProperties = TextStyleProps | ButtonStyleProps;

// ─── Element Events ─────────────────────────────────────────────

export interface ElementEvents {
  onButtonAction?: (action: string) => void;
}

// ─── New Layout Engine Types (v2, alongside existing types) ─────

export type LayoutModeV2 = 'freeform' | 'row' | 'column' | 'grid';

export interface FreeformLayoutV2 {
  mode: 'freeform';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface RowLayoutV2 {
  mode: 'row';
  grow: number;
  shrink: number;
  basis: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface ColumnLayoutV2 {
  mode: 'column';
  grow: number;
  shrink: number;
  basis: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface GridLayoutV2 {
  mode: 'grid';
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
}

export type LayoutV2 = FreeformLayoutV2 | RowLayoutV2 | ColumnLayoutV2 | GridLayoutV2;

export interface TransformV2 {
  zIndex: number;
}

export interface ConstraintsV2 {
  horizontal?: 'stretch' | 'center';
  vertical?: 'stretch' | 'center';
}

export interface BindingsV2 {
  showIfSource?: string;
  showIfOperator?: string;
  showIfValue?: string;
  stateFilterStyle?: 'none' | 'grayscale' | 'low-opacity' | 'blur';
  stateFilterSource?: string;
  stateFilterOperator?: string;
  stateFilterValue?: string;
  textTemplate?: string;
}

export interface StyleV2 {
  opacity?: number;
  padding?: string;       // CSS shorthand e.g. "8px" or "8px 12px"
  margin?: string;        // CSS shorthand
  background?: string;    // CSS background value e.g. "#1e293b" or "linear-gradient(...)"
  boxShadow?: string;     // CSS box-shadow
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  bgColor?: string;       // legacy shortcut for background color
}

export interface UIElementV2 {
  id: string;
  parentId?: string;
  type: WidgetType;
  layout: LayoutV2;
  transform: TransformV2;
  style: StyleV2;
  constraints?: ConstraintsV2;
  bindings: BindingsV2;
  properties: Record<string, any>;  // widget-type-specific (renamed from "settings")
}

// ComputedLayout — the pure output of the layout engine (geometry only)
export interface ComputedLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  clip: boolean;
}

// ComputedStyle — the pure output of the style resolver (visuals only)
export interface ComputedStyle {
  opacity: number;
  padding: string;
  margin: string;
  background: string;
  boxShadow: string;
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
  borderStyle: string;
}

export interface OverlayDefV2 {
  id: string;
  name: string;
  elements: UIElementV2[];
  settings: {
    closeOnClickOutside: boolean;
    transition: 'fade' | 'slideUp' | 'none';
    backgroundColor: string;
  };
}

// ─── Existing types below ───────────────────────────────────────

export interface KeyMapping {
  key: string;
  action: string;
  label: string;
}

export interface OverlayDef {
  id: string;
  name: string;
  layout: WidgetConfig[];
  settings: {
    closeOnClickOutside: boolean;
    transition: "fade" | "slideUp" | "none";
    backgroundColor: string;
  };
}

export interface SaveData {
  slot: number;
  name: string;
  timestamp: number;
  currentNodeId: string;
  lineIdx: number;
  vars: Record<string, number>;
  playerInventory: string[];
  combatState: Record<string, { currentHp: number; maxHp: number; attack: number; defense: number; name: string }>;
  history: Array<{ nodeId: string; variables: Record<string, number> }>;
  logs: Array<{ text: string; type: "set" | "plus" | "minus" }>;
  nodeTitle?: string;
  inspectedItemId?: string;
  globalTimeTicks?: number;
  activeOverlayId?: string | null;
}
