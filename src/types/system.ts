export type ThemeMode = 'clean' | 'women' | 'rpg';
export type TabId = 'quests' | 'program' | 'nutrition' | 'community' | 'calendar' | 'profile';
export type Sex = 'm' | 'f';
export type FemaleStage = 'std' | 'pcos' | 'preg1' | 'preg2' | 'preg3' | 'post';
export type MobilityTier = 'joint' | 'bal' | 'hiit';
export type EquipmentType = 'body' | 'dumb' | 'gym' | 'desi';
export type CalendarTag = 'h' | 't' | 'b';
export type StatKey = 'STR' | 'AGI' | 'INT' | 'VIT' | 'SEN';
export type MedicalHistoryTag =
  | 'pcos_hormonal'
  | 'pregnancy_postpartum'
  | 'joint_knee'
  | 'cardiac_bp'
  | 'metabolic_diabetes';
export type OnboardingGoalStyle = 'balanced' | 'holistic' | 'competitive';
export type AllergyTag =
  | 'dairy_lactose'
  | 'soy'
  | 'gluten_wheat'
  | 'eggs'
  | 'peanuts_nuts'
  | 'lentils_beans';

export type PrimaryGoal = 'fat_loss' | 'strength' | 'energy_mobility' | 'maternal_care';

export interface UserProfile {
  name: string;
  title: string;
  sex: Sex;
  fstage: FemaleStage;
  age: number;
  h: number;
  w: number;
  tw: number;
  act: number;
  tier: MobilityTier;
  eq: EquipmentType;
  diet: string;
  days: number;
  primaryGoal?: PrimaryGoal;
  medicalHistory?: MedicalHistoryTag[];
  medicalNotes?: string;
  medicalDeferred?: boolean;
  goalStyle?: OnboardingGoalStyle;
  allergies?: AllergyTag[];
}

export interface ExerciseSet {
  reps: number;
  kg: number;
  done: boolean;
}

export interface PersonalRecord {
  maxKg: number;
  repsAtMax: number;
  maxVol: number;
  maxReps: number;
  bestStr: string;
}

export interface LoggedFood {
  n: string;
  k: number;
  p: number;
  c: number;
  f: number;
  q: number;
}

export interface MealCombo {
  n: string;
  items?: Array<[string, number]>;
  raw?: Array<[string, number, number, number, number, number]>;
}

export interface QuestItem {
  id: string;
  auto: boolean;
  t: string;
  xp: number;
  st: StatKey;
  r: string;
  l: string;
  d?: string;
}

export interface Duel {
  id: string;
  opp: string;
  myStartXp: number;
  oppGain: number;
  ends: string;
  active: boolean;
}

export interface FeedPost {
  id: string;
  u: string;
  t: string;
  tip: boolean;
  likes: string[];
  cm: Array<[string, string]>;
  ts: number;
  mediaUrl?: string;
  me?: boolean;
  authorStreak?: number;
}

export interface StoryItem {
  id: string;
  u: string;
  t: string;
  mediaUrl?: string;
  ts: number;
}

export interface Organization {
  id: string;
  name: string;
  type: 'Gym' | 'Company';
  email: string;
  status: 'approved' | 'pending' | 'rejected';
  code: string;
  members: number;
  challenge: string;
}

export interface AdminUser {
  email: string;
  name: string;
  lv: number;
  disabled: boolean;
}

export interface PrivacySettings {
  on: boolean;
  name: boolean;
  rank: boolean;
  stats: boolean;
  prog: boolean;
  bio: boolean;
}

export type ScheduleTrackId =
  | 'adaptive'
  | 'high_roi_3day'
  | 'joint_safe_beginner'
  | 'maternal_shield_track'
  | 'desk_worker_express';

export interface WorkoutExerciseConfig {
  id: string;
  name: string;
  category: string;
  equipment: EquipmentType[];
  baseWeightKg: number;
  bwRatio?: number;
  targetReps: number;
  targetSets: number;
  rpe: number;
  xpType: StatKey;
  contraindications: string[];
  jointSafeAlternative?: string;
  tags: string[];
  isTimedSec?: boolean;
  isRounds?: boolean;
}

export interface WorkoutDayExercise {
  id?: string;
  name: string;
  sets: number;
  reps: number;
  baseKg: number;
  bwRatio: number;
  rpe: number;
  xpType: StatKey;
  category?: string;
  restSec: number;
  safetyNote?: string;
  isInvariantCore?: boolean;
}

export interface CrossGymEvent {
  id: string;
  title: string;
  hostOrgCode: string;
  hostOrgName: string;
  partnerOrgCode: string;
  partnerOrgName: string;
  metric: 'steps' | 'xp';
  hostScore: number;
  partnerScore: number;
  endsLabel: string;
  active: boolean;
}

export type WatchActionType =
  | 'start_set'
  | 'complete_set'
  | 'log_water'
  | 'log_combo'
  | 'toggle_min_due'
  | 'complete_bonus'
  | 'skip_rest'
  | 'extend_rest'
  | 'sync_telemetry'
  | 'ack_reminder';

export type WatchCommandType =
  | 'LOG_WATER_250'
  | 'LOG_WATER_500'
  | 'SNOOZE_WATER_30'
  | 'ACK_REMINDER'
  | 'LOG_WALK_1500'
  | 'TOGGLE_STRETCH'
  | 'TOGGLE_MIN_DUE'
  | 'SYNC_TELEMETRY'
  | 'START_REST_45'
  | 'START_REST_60'
  | 'ADD_REST_15'
  | 'SKIP_REST'
  | 'COMPLETE_NEXT_SET';

export interface WatchReminderPrefs {
  enabled: boolean;
  waterIntervalMin: number;
  restAlertVibrate: boolean;
  postMealWalkReminder: boolean;
  waterNextDueAt?: number;
  snoozedUntil?: Record<string, number>;
  lastAcked?: Record<string, number>;
}

export interface WatchTelemetryPayload {
  steps?: number;
  sleep?: number;
  hrvMs?: number;
  rhrBpm?: number;
  liveBpm?: number;
  deviceName?: string;
}

export interface WatchCommandEnvelope {
  id: string;
  code: string;
  type: WatchCommandType;
  payload?: WatchTelemetryPayload & {
    minutes?: number;
    reminderId?: string;
    [key: string]: unknown;
  };
  createdAt: number;
  source?: string;
}

export interface WatchActionEvent {
  id: string;
  type: WatchActionType;
  amount?: number;
  comboIdx?: number;
  steps?: number;
  sleep?: number;
  hrvMs?: number;
  rhrBpm?: number;
  reminderId?: string;
  source?: string;
  ts: number;
}

export interface WatchReminder {
  id: string;
  category: 'water' | 'set' | 'walk' | 'streak';
  title: string;
  body: string;
  ctaLabel: string;
  actionType: WatchActionType;
  actionAmount?: number;
  ts: number;
}

export interface WatchNextSetInfo {
  day: number;
  isMinMode: boolean;
  exIdx: number;
  setIdx: number;
  exName: string;
  setNumber: number;
  totalSets: number;
  kg: number;
  reps: number;
  restSec: number;
  doneSetsToday: number;
  totalSetsToday: number;
  workoutComplete: boolean;
}

export interface WatchSnapshot {
  userName: string;
  theme: ThemeMode;
  pairingCode: string;
  updatedAt: number;
  streak: number;
  freeze: number;
  xp: number;
  isMinDue: boolean;
  waterLitres: number;
  waterTargetLitres: number;
  steps: number;
  stepsTarget: number;
  sleepHours: number;
  hrvMs: number;
  rhrBpm: number;
  liveBpm: number;
  bleDeviceName: string | null;
  kcalLogged: number;
  kcalTarget: number;
  protLogged: number;
  protTarget: number;
  restEndTime: number;
  activeSetStartedAt?: number;
  nextSet: WatchNextSetInfo;
  quickCombos: Array<{ idx: number; name: string }>;
  reminders: WatchReminder[];
}

export interface AppState {
  theme: ThemeMode;
  darkMode: boolean;
  p: UserProfile;
  w0: number;
  xp: number;
  ob: boolean;
  done: Record<string, Record<string, boolean>>;
  prog: Record<number, Record<string, boolean>>;
  shuf: Record<number, number>;
  exOverrides: Record<string, string>;
  scheduleTrack: ScheduleTrackId;
  setLogs: Record<string, ExerciseSet[]>;
  prs: Record<string, PersonalRecord>;
  log: Record<string, LoggedFood[]>;
  water: Record<string, number>;
  combos: MealCombo[];
  grocDone: Record<string, boolean>;
  sanct: Record<string, boolean>;
  customSanctuary: Array<[string, string, StatKey]>;
  stats: Record<StatKey, number>;
  streak: number;
  minimumDueDays: Record<string, boolean>;
  streakAwardedDays: Record<string, 'minimum' | 'full'>;
  userStreaks: Record<string, number>;
  freeze: number;
  last: string;
  start: string;
  wt: Array<{ d: string; w: number }>;
  meas: Array<{ d: string; waist: number; neck: number; hip: number }>;
  mute: boolean;
  cal: Record<string, CalendarTag>;
  gym?: { la: number; lo: number };
  gci?: string;
  gt: string;
  watch: {
    steps: number;
    sleep: number;
    hrvMs?: number;
    rhrBpm?: number;
    lastSyncedAt?: string;
    deviceLabel?: string;
  };
  watchPairingCode?: string;
  watchPrefs?: WatchReminderPrefs;
  watchBridge?: {
    pairingCode: string;
    autoSync: boolean;
    lastWatchSyncAt?: string;
    connectedWatchName?: string;
  };
  boss: { wk: string; dmg: number; max: number; claimed: boolean };
  extraQuests: QuestItem[];
  duels: Duel[];
  feed: FeedPost[];
  stories: StoryItem[];
  chat: { g: Array<[string, string]>; v: Array<[string, string]> };
  ph: Record<number, string>;
  acct: { email: string; signedIn: boolean; isAdmin: boolean; orgCode: string };
  demoOnboarded?: boolean;
  cloudSync?: { enabled: boolean; lastSyncedAt?: string; cloudId?: string };
  b2b: {
    orgs: Organization[];
    globalEvent: { title: string; desc: string; active: boolean };
    users: AdminUser[];
    crossGymEvents?: CrossGymEvent[];
  };
  priv: PrivacySettings;
}

export interface MacroSummary {
  bmr: number;
  tdee: number;
  t: number;
  pr: number;
  f: number;
  c: number;
  bmi: number;
  def: number;
  modeNote: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  isError?: boolean;
  onUndo?: () => void;
}
