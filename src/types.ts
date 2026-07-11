interface VNVariable {
  id?: string;
  name: string;
  type: "number" | "boolean";
  defaultValue: number | boolean;
  description?: string;
  displayId?: string;
}

interface VNCharacter {
  id: string;
  name: string;
  color: string;
  description?: string;
  displayId?: string;
}

interface ChoiceCondition {
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
}

export interface InlineEffect {
  id: string;
  type: "give_item" | "take_item" | "adjust_tracker" | "set_flag" | "clear_flag";
  targetId: string;
  operation?: "add" | "subtract" | "set";
  value?: number;
  flagValue?: boolean;
}

export interface DialogueBlock {
  id: string;
  speaker: string;
  text: string;
  expression?: string;
  effects: InlineEffect[];
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

export interface LocationData {
  openTime?: "day" | "night" | "any";
  openPeriodId?: string;
  statusFlagId?: string;
  inventory: LocationItem[];
  tags: string[];
}

export interface EncounterData {
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
  dialogueTimeline?: DialogueBlock[];
  nodeType: "story" | "location" | "encounter";
  locationData?: LocationData;
  encounterData?: EncounterData;
  continueToNodeId?: string;
  trigger?: StoryBeatTrigger;
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
  scenes?: VNScene[];
  flowDirection?: "horizontal" | "vertical";
  variables?: VNVariable[];
  characters?: VNCharacter[];
}
