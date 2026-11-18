import { SEED_CHAT, SEED_POSTS, SEED_STORIES } from '../data/foods';
import type { AppState, ThemeMode, UserProfile } from '../types/system';
import { buildInitialUserStreaks } from './onboarding';

const STORAGE_KEY = 'thesystem_universal_v1';

export const todayISO = () => new Date().toISOString().slice(0, 10);

function shiftDateISO(baseISO: string, deltaDays: number): string {
  const d = new Date(`${baseISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function createDefaultState(): AppState {
  const now = new Date();
  const today = todayISO();
  const weekKey = `${now.getFullYear()}-W${Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  )}`;

  return {
    theme: 'clean',
    darkMode: false,
    p: {
      name: 'Aarav',
      title: 'The Focused',
      sex: 'm',
      fstage: 'std',
      age: 28,
      h: 174,
      w: 80,
      tw: 72,
      act: 1.375,
      tier: 'bal',
      eq: 'body',
      diet: 'Indian High-Protein Veg',
      days: 30,
      primaryGoal: 'fat_loss',
      medicalHistory: [],
      medicalNotes: '',
      medicalDeferred: false,
      goalStyle: 'balanced',
      allergies: [],
    },
    w0: 80,
    xp: 120,
    ob: true,
    done: {},
    prog: {},
    shuf: {},
    exOverrides: {},
    scheduleTrack: 'adaptive',
    setLogs: {},
    prs: {},
    log: {},
    water: {},
    combos: [
      {
        n: 'Desi Protein Breakfast',
        items: [
          ['Boiled egg', 2],
          ['Whole wheat roti', 2],
          ['Curd / dahi (1 cup)', 1],
        ],
      },
      {
        n: 'Soya & Dal Power Lunch',
        items: [
          ['Soya chunks (30 g)', 1.5],
          ['Moong dal (1 cup)', 1],
          ['Whole wheat roti', 2],
        ],
      },
    ],
    grocDone: {},
    sanct: {},
    customSanctuary: [],
    stats: { STR: 12, AGI: 11, INT: 10, VIT: 12, SEN: 10 },
    streak: 3,
    minimumDueDays: {},
    streakAwardedDays: {},
    userStreaks: buildInitialUserStreaks('Aarav', 3),
    freeze: 1,
    last: today,
    start: today,
    wt: [
      { d: shiftDateISO(today, -21), w: 81.8 },
      { d: shiftDateISO(today, -14), w: 81.1 },
      { d: shiftDateISO(today, -7), w: 80.5 },
      { d: today, w: 80.0 },
    ],
    meas: [
      { d: shiftDateISO(today, -21), waist: 86.2, neck: 38.6, hip: 99.8 },
      { d: shiftDateISO(today, -14), waist: 85.4, neck: 38.4, hip: 99.1 },
      { d: shiftDateISO(today, -7), waist: 84.6, neck: 38.2, hip: 98.5 },
      { d: today, waist: 84.0, neck: 38.0, hip: 98.0 },
    ],
    mute: false,
    cal: {},
    gt: '07:00',
    watch: { steps: 4200, sleep: 6.5 },
    watchBridge: {
      pairingCode: 'SYS742',
      autoSync: true,
    },
    boss: { wk: weekKey, dmg: 12400, max: 20000, claimed: false },
    extraQuests: [],
    duels: [
      {
        id: 'd1',
        opp: 'IronBhai@guild.in',
        myStartXp: 0,
        oppGain: 210,
        ends: 'In 5 days',
        active: true,
      },
    ],
    feed: SEED_POSTS,
    stories: SEED_STORIES,
    chat: SEED_CHAT,
    ph: {},
    acct: { email: '', signedIn: false, isAdmin: false, orgCode: '' },
    demoOnboarded: false,
    cloudSync: { enabled: false, lastSyncedAt: undefined, cloudId: undefined },
    b2b: {
      orgs: [
        {
          id: 'org1',
          name: 'Iron Temple Studio',
          type: 'Gym',
          email: 'owner@irontemple.in',
          status: 'approved',
          code: 'GYM-IRON88',
          members: 142,
          challenge: '30-Day Monsoon Shred',
        },
        {
          id: 'org2',
          name: 'Apex Tech Wellness',
          type: 'Company',
          email: 'hr@apextech.io',
          status: 'pending',
          code: 'CORP-APEX26',
          members: 85,
          challenge: '10k Steps Desk Battle',
        },
      ],
      globalEvent: {
        title: 'Winter Arc — 21-Day Consistency Challenge',
        desc: 'Complete 3+ daily targets for 21 consecutive days to unlock the Frost Vanguard badge.',
        active: true,
      },
      users: [
        { email: 'Vanguard_K@guild.in', name: 'Vanguard_K', lv: 34, disabled: false },
        { email: 'IronBhai@guild.in', name: 'IronBhai', lv: 22, disabled: false },
        { email: 'PriyaFit@guild.in', name: 'PriyaFit', lv: 13, disabled: false },
      ],
      crossGymEvents: [
        {
          id: 'cg1',
          title: 'Metro Monsoon Step & Strength War',
          hostOrgCode: 'GYM-IRON88',
          hostOrgName: 'Iron Temple Studio',
          partnerOrgCode: 'CORP-APEX26',
          partnerOrgName: 'Apex Tech Wellness',
          metric: 'xp',
          hostScore: 18420,
          partnerScore: 17190,
          endsLabel: 'Ends in 4 days',
          active: true,
        },
      ],
    },
    priv: { on: true, name: true, rank: true, stats: true, prog: true, bio: false },
  };
}

export function loadState(): AppState {
  const def = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const mergedP = {
      ...def.p,
      ...(parsed.p || {}),
      allergies: Array.isArray(parsed.p?.allergies) ? parsed.p.allergies : def.p.allergies || [],
    };
    const mergedStreak = typeof parsed.streak === 'number' ? parsed.streak : def.streak;
    return {
      ...def,
      ...parsed,
      darkMode: typeof parsed.darkMode === 'boolean' ? parsed.darkMode : def.darkMode,
      p: mergedP,
      exOverrides: { ...def.exOverrides, ...(parsed.exOverrides || {}) },
      scheduleTrack: parsed.scheduleTrack || def.scheduleTrack,
      minimumDueDays: { ...def.minimumDueDays, ...(parsed.minimumDueDays || {}) },
      streakAwardedDays: { ...def.streakAwardedDays, ...(parsed.streakAwardedDays || {}) },
      acct: { ...def.acct, ...(parsed.acct || {}) },
      demoOnboarded:
        typeof parsed.demoOnboarded === 'boolean'
          ? parsed.demoOnboarded
          : Boolean(parsed.acct?.signedIn),
      cloudSync: { ...(def.cloudSync || { enabled: false }), ...(parsed.cloudSync || {}) },
      b2b: {
        ...def.b2b,
        ...(parsed.b2b || {}),
        crossGymEvents:
          Array.isArray(parsed.b2b?.crossGymEvents) && parsed.b2b.crossGymEvents.length > 0
            ? parsed.b2b.crossGymEvents
            : def.b2b.crossGymEvents,
      },
      priv: { ...def.priv, ...(parsed.priv || {}) },
      stats: { ...def.stats, ...(parsed.stats || {}) },
      watch: { ...def.watch, ...(parsed.watch || {}) },
      watchBridge: {
        ...(def.watchBridge || { pairingCode: 'SYS742', autoSync: true }),
        ...(parsed.watchBridge || {}),
      },
      userStreaks: {
        ...buildInitialUserStreaks(mergedP.name, mergedStreak),
        ...(parsed.userStreaks || {}),
      },
    };
  } catch {
    return def;
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function parsePlanHash(): Partial<UserProfile> | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.location.hash.startsWith('#plan=')) return null;
    const raw = decodeURIComponent(window.location.hash.slice(6));
    const cfg = JSON.parse(atob(raw));
    if (cfg && cfg.w && cfg.h) return cfg;
    return null;
  } catch {
    return null;
  }
}

let audioCtx: AudioContext | null = null;
export function playChime(freq: number, duration = 0.11, muted = false) {
  if (muted) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Ignore audio errors on headless/restricted browsers
  }
}

export function playTwoToneChime(muted = false) {
  if (muted) return;
  playChime(587.33, 0.12, muted);
  if (typeof window !== 'undefined') {
    window.setTimeout(() => playChime(880, 0.18, muted), 130);
  }
}

export const THEME_COPY: Record<
  ThemeMode,
  {
    label: string;
    subtitle: string;
    nav: { quests: string; program: string; nutrition: string; community: string; calendar: string; profile: string };
    dailyTitle: string;
    programTitle: string;
    nutritionTitle: string;
    sanctuaryTitle: string;
    communityTitle: string;
    calendarTitle: string;
    duelTitle: string;
    bossTitle: string;
    coachName: string;
  }
> = {
  clean: {
    label: 'Universal Clean',
    subtitle: 'Clinical sports-science telemetry with clear daily targets',
    nav: {
      quests: 'Today',
      program: 'Workouts',
      nutrition: 'Food',
      community: 'Community',
      calendar: 'Schedule',
      profile: 'Profile',
    },
    dailyTitle: 'Daily Protocol Checklist',
    programTitle: 'Clinical Workout Tracker',
    nutritionTitle: 'Macro & Micronutrient Log',
    sanctuaryTitle: 'Autonomic Recovery',
    communityTitle: 'Community & Accountability',
    calendarTitle: 'Schedule & Sensor Sync',
    duelTitle: '7-Day Accountability Partner',
    bossTitle: 'Weekly Group Milestone',
    coachName: 'Daily Coach',
  },
  women: {
    label: 'Women’s Wellness',
    subtitle: 'Cycle-friendly workouts, pregnancy safety, and calm recovery',
    nav: {
      quests: 'Today',
      program: 'Movement',
      nutrition: 'Nourish',
      community: 'Circle',
      calendar: 'Calendar',
      profile: 'Profile',
    },
    dailyTitle: 'Today’s Care & Habits',
    programTitle: 'Safe Movement Plan',
    nutritionTitle: 'Healthy Eating & Care',
    sanctuaryTitle: 'Calm & Recovery',
    communityTitle: 'Wellness Circle',
    calendarTitle: 'Cycle Calendar & Sync',
    duelTitle: '7-Day Buddy Check-In',
    bossTitle: 'Weekly Community Goal',
    coachName: 'Wellness Guide',
  },
  rpg: {
    label: 'Game Mode (RPG)',
    subtitle: 'Level up your health with daily quests, XP, and ranks',
    nav: {
      quests: 'Quests',
      program: 'Training',
      nutrition: 'Fuel',
      community: 'Guild',
      calendar: 'Schedule',
      profile: 'Status',
    },
    dailyTitle: 'Daily Quests',
    programTitle: 'Training Arena',
    nutritionTitle: 'Daily Fuel & Meals',
    sanctuaryTitle: 'Recovery & Rest Habits',
    communityTitle: 'Guild & Friends Feed',
    calendarTitle: 'Schedule & Watch Sync',
    duelTitle: '7-Day 1-on-1 Challenge',
    bossTitle: 'Weekly Team Boss Goal',
    coachName: 'Quest Coach',
  },
};
