import {
  FOODS,
  RECIPES,
  getSafeFoods,
  getSafeRecipes,
  type FoodCatalogItem,
} from '../data/foods';
import type { AllergyTag, AppState, LoggedFood, QuestItem } from '../types/system';
import { DEFAULT_CLINICAL_CODEX, type ClinicalCodex } from './codex';
import {
  calculateMacros,
  getProgramDayNumber,
  isFemaleProfile,
  isJointSafeProfile,
  isMaternalProfile,
  sumDailyMacros,
} from './metabolic';

const BONUS_POOL: Array<[string, string]> = [
  [
    'Bonus: 2-minute full-body stretch',
    'Reach overhead 30s · Gentle forward bend 30s · Shoulder rolls 30s · Easy spine twist 30s',
  ],
  [
    'Bonus: 20 bodyweight squats anytime today',
    'Feet shoulder-width apart · Sit back slowly · Complete 20 controlled reps',
  ],
  [
    'Bonus: 5-minute post-meal walk',
    'Finish eating · Walk slowly for 5 minutes to blunt blood sugar spikes',
  ],
  [
    'Bonus: 1-minute core & breath reset',
    'Tall posture · 6 slow nasal breaths · Gentle core brace',
  ],
];

const SPECIAL_DAY_LABEL: Record<string, string> = {
  h: 'holiday',
  t: 'travel day',
  b: 'busy day',
};

export interface HabitStatementStatus {
  isMinimumDueMode: boolean;
  statementTier: 'unpaid' | 'minimum_paid' | 'full_paid';
  minWorkoutDone: boolean;
  fullWorkoutDone: boolean;
  minHydrationMet: boolean;
  minNourishMet: boolean;
  minMovementCheckInMet: boolean;
  minPillarsMet: number;
  minRequired: number;
  fullTargetsMet: number;
  fullRequired: number;
  hydrationTargetLitres: number;
  stepsTarget: number;
  sleepTargetHours: number;
  streakProtected: boolean;
}

export function getHabitStatementStatus(state: AppState, dateStr: string): HabitStatementStatus {
  const isMinimumDueMode = Boolean(state.minimumDueDays?.[dateStr]);
  const c = calculateMacros(state.p);
  const T = sumDailyMacros(state.log[dateStr] || []);
  const wLitres = Number(state.water[dateStr] || 0);
  const watch = state.watch || { steps: 0, sleep: 0 };
  const mat = isMaternalProfile(state.p);
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const dayProg = state.prog[dayNum] || {};
  const doneDay = state.done[dateStr] || {};

  const fullWorkoutDone = Boolean(dayProg.x);
  const minWorkoutDone = Boolean(dayProg.min || dayProg.x);

  const hydrationTargetLitres = isMinimumDueMode ? 1.5 : 3.0;
  const stepsTarget = isMinimumDueMode ? (mat ? 2500 : 3000) : mat ? 6000 : 8000;
  const sleepTargetHours = isMinimumDueMode ? 6 : 7;

  const minHydrationMet = wLitres >= 1.5;
  const minNourishMet = T.k >= 250;
  const minMovementCheckInMet = Boolean(doneDay.b || doneDay.sn);

  const minPillarsMet = [
    minWorkoutDone,
    minHydrationMet,
    minNourishMet,
    minMovementCheckInMet,
  ].filter(Boolean).length;
  const minRequired = 2;

  const fullChecks = [
    fullWorkoutDone,
    T.p >= c.pr * 0.95,
    mat ? T.k >= c.t * 0.85 && T.k <= c.t * 1.2 : T.k >= 800 && T.k <= c.t * 1.05,
    wLitres >= 3.0,
    (watch.steps || 0) >= (mat ? 6000 : 8000),
    (watch.sleep || 0) >= 7,
  ];
  const fullTargetsMet = fullChecks.filter(Boolean).length;
  const fullRequired = 3;

  const fullPaid = fullTargetsMet >= fullRequired;
  const minimumPaid = fullPaid || minPillarsMet >= minRequired;
  const statementTier: HabitStatementStatus['statementTier'] = fullPaid
    ? 'full_paid'
    : minimumPaid
      ? 'minimum_paid'
      : 'unpaid';

  return {
    isMinimumDueMode,
    statementTier,
    minWorkoutDone,
    fullWorkoutDone,
    minHydrationMet,
    minNourishMet,
    minMovementCheckInMet,
    minPillarsMet,
    minRequired,
    fullTargetsMet,
    fullRequired,
    hydrationTargetLitres,
    stepsTarget,
    sleepTargetHours,
    streakProtected: statementTier !== 'unpaid',
  };
}

export function buildDailyQuests(state: AppState, dateStr: string): QuestItem[] {
  const c = calculateMacros(state.p);
  const dl = (n: number) => (n / c.def).toFixed(1);
  const sp = state.cal[dateStr];
  const mat = isMaternalProfile(state.p);
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const bonus = BONUS_POOL[new Date(dateStr).getUTCDate() % 4] || BONUS_POOL[0];
  const minMode = Boolean(state.minimumDueDays?.[dateStr]);
  const stepGoal = minMode ? (mat ? 2500 : 3000) : mat ? 6000 : 8000;
  const waterGoal = minMode ? '1.5' : '3.0';
  const sleepGoal = minMode ? 6 : 7;

  const base: QuestItem[] = [
    {
      id: 'w',
      auto: !sp,
      t: sp
        ? `Light 10-min walk (${SPECIAL_DAY_LABEL[sp] || 'rest day'})`
        : minMode
          ? `Minimum Due: 5-min micro-workout (3 moves)`
          : `Finish Day ${dayNum} Workout`,
      xp: sp ? 20 : minMode ? 25 : 40,
      st: 'STR',
      r: minMode
        ? 'Keeps your workout habit alive in just 5 minutes with zero pressure.'
        : mat
          ? 'Eases lower-back stiffness, keeps circulation steady, and protects your joints.'
          : 'Builds firm, toned muscle that burns fat at rest and protects your back.',
      l: minMode
        ? 'Skipping the quick 5-minute check breaks your daily streak.'
        : mat
          ? 'More stiffness and lower energy today.'
          : `Slower strength progress — pushes your goal back by ~${dl(300)} day.`,
    },
    {
      id: 'p',
      auto: true,
      t: minMode
        ? `Hit protein goal (${c.pr} g · Full Day bonus)`
        : `Hit protein goal (${c.pr} g)`,
      xp: 30,
      st: 'VIT',
      r: mat
        ? 'Gives you and your baby steady building blocks for daily recovery.'
        : 'Keeps you full longer and protects your muscles while losing fat.',
      l: minMode
        ? 'Optional on Minimum Due days — logging any healthy meal still helps.'
        : mat
          ? 'Less fullness and slower recovery.'
          : `Can leave you hungrier and slow down toning (~${dl(150)} day delay).`,
    },
    {
      id: 'c',
      auto: true,
      t: mat
        ? `Eat around ${c.t} cal`
        : minMode
          ? `Stay within ${c.t} cal (Full Day bonus)`
          : `Stay within ${c.t} cal (log ≥ 800 cal)`,
      xp: 30,
      st: 'INT',
      r: mat
        ? 'Gives steady daily energy plus iron, folate, and calcium.'
        : 'Keeps your calories in the sweet spot for steady fat loss.',
      l: minMode
        ? 'Optional on Minimum Due days — focus on one healthy meal.'
        : mat
          ? 'Energy dips and missing key nutrients.'
          : `Eating way over goal slows today's progress (~${dl(400)} day).`,
    },
    {
      id: 'h',
      auto: true,
      t: minMode
        ? `Minimum Due: Drink ${waterGoal} L of water`
        : `Drink ${waterGoal} L of water`,
      xp: minMode ? 10 : 15,
      st: 'VIT',
      r: 'Helps digestion, keeps energy up, and stops false hunger cravings.',
      l: 'Can cause tiredness, headaches, and feeling hungry when you are just thirsty.',
    },
    {
      id: 's',
      auto: true,
      t: minMode
        ? `Minimum Due: Walk ${stepGoal.toLocaleString()} steps`
        : `Walk ${stepGoal.toLocaleString()} steps`,
      xp: minMode ? 15 : 20,
      st: 'AGI',
      r: 'Easy everyday movement that keeps joints loose and burns extra calories.',
      l: mat
        ? 'Less gentle movement for joints and circulation.'
        : `Missed easy daily calorie burn (~${dl(250)} day).`,
    },
    {
      id: 'z',
      auto: true,
      t: minMode
        ? `Minimum Due: Sleep ${sleepGoal}+ hours`
        : `Sleep / rest ${sleepGoal}+ hours`,
      xp: minMode ? 10 : 15,
      st: 'SEN',
      r: 'Lowers stress, balances hunger, and helps your body recover overnight.',
      l: 'More stress and stronger sugar cravings tomorrow.',
    },
    {
      id: 'b',
      auto: false,
      t: bonus[0],
      xp: 25,
      st: 'AGI',
      r: 'Quick bonus stretch for extra XP (also counts for Minimum Due).',
      l: 'Optional — no penalty if skipped.',
    },
  ];

  if (!mat) {
    base.push({
      id: 'sn',
      auto: false,
      t: 'Bonus: 3 rounds of Surya Namaskar',
      xp: 40,
      st: 'AGI',
      r: 'Warms up all your joints, stretches your back, and boosts energy.',
      l: 'Optional — no penalty if skipped.',
    });
  }

  const extras = (state.extraQuests || []).filter((q) => q.d === dateStr);
  return [...base, ...extras];
}

export function verifyQuestsState(
  state: AppState,
  dateStr: string
): { nextState: AppState; newlyCompleted: QuestItem[] } {
  const c = calculateMacros(state.p);
  const T = sumDailyMacros(state.log[dateStr] || []);
  const wLitres = Number(state.water[dateStr] || 0);
  const watch = state.watch || { steps: 0, sleep: 0 };
  const mat = isMaternalProfile(state.p);
  const minMode = Boolean(state.minimumDueDays?.[dateStr]);
  const stepGoal = minMode ? (mat ? 2500 : 3000) : mat ? 6000 : 8000;
  const waterGoal = minMode ? 1.5 : 3.0;
  const sleepGoal = minMode ? 6 : 7;
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const dayProg = state.prog[dayNum] || {};
  const workoutDone = minMode ? Boolean(dayProg.min || dayProg.x) : Boolean(dayProg.x);

  const checks: Record<string, boolean> = {
    w: workoutDone,
    p: T.p >= c.pr * 0.95,
    c: mat ? T.k >= c.t * 0.85 && T.k <= c.t * 1.2 : T.k >= 800 && T.k <= c.t * 1.05,
    h: wLitres >= waterGoal,
    s: (watch.steps || 0) >= stepGoal,
    z: (watch.sleep || 0) >= sleepGoal,
  };

  const quests = buildDailyQuests(state, dateStr);
  const doneDay = { ...(state.done[dateStr] || {}) };
  const nextStats = { ...state.stats };
  let nextXp = state.xp;
  const newlyCompleted: QuestItem[] = [];

  for (const [qid, met] of Object.entries(checks)) {
    const q = quests.find((item) => item.id === qid);
    if (!q || !q.auto) continue;
    const wasDone = Boolean(doneDay[qid]);

    if (met && !wasDone) {
      doneDay[qid] = true;
      nextXp += q.xp;
      nextStats[q.st] = (nextStats[q.st] || 10) + 1;
      newlyCompleted.push(q);
    } else if (!met && wasDone) {
      delete doneDay[qid];
      nextXp = Math.max(0, nextXp - q.xp);
      nextStats[q.st] = Math.max(1, (nextStats[q.st] || 10) - 1);
    }
  }

  const intermediateState: AppState = {
    ...state,
    xp: nextXp,
    stats: nextStats,
    done: {
      ...state.done,
      [dateStr]: doneDay,
    },
  };

  const statement = getHabitStatementStatus(intermediateState, dateStr);
  const nextStreakAwarded = { ...(state.streakAwardedDays || {}) };
  const prevAward = nextStreakAwarded[dateStr];
  let nextStreak = state.streak;

  if (statement.streakProtected && !prevAward) {
    nextStreak += 1;
    nextStreakAwarded[dateStr] = statement.statementTier === 'full_paid' ? 'full' : 'minimum';
  } else if (statement.statementTier === 'full_paid' && prevAward === 'minimum') {
    nextStreakAwarded[dateStr] = 'full';
  } else if (!statement.streakProtected && prevAward) {
    nextStreak = Math.max(0, nextStreak - 1);
    delete nextStreakAwarded[dateStr];
  }

  const nextUserStreaks = { ...(state.userStreaks || {}) };
  if (state.p.name.trim()) {
    nextUserStreaks[state.p.name.trim()] = nextStreak;
  }
  nextUserStreaks['Anonymous Member'] = nextStreak;

  return {
    nextState: {
      ...intermediateState,
      streak: nextStreak,
      streakAwardedDays: nextStreakAwarded,
      userStreaks: nextUserStreaks,
    },
    newlyCompleted,
  };
}

export interface DailyRolloverResult {
  nextState: AppState;
  freezesUsed: number;
  streakReset: boolean;
  daysAdvanced: number;
}

export function evaluateDailyRollover(
  state: AppState,
  todayDateStr: string
): DailyRolloverResult {
  const lastStr = state.last || todayDateStr;
  if (lastStr >= todayDateStr) {
    return {
      nextState: state.last === todayDateStr ? state : { ...state, last: todayDateStr },
      freezesUsed: 0,
      streakReset: false,
      daysAdvanced: 0,
    };
  }

  const startMs = new Date(`${lastStr}T00:00:00Z`).getTime();
  const endMs = new Date(`${todayDateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { nextState: { ...state, last: todayDateStr }, freezesUsed: 0, streakReset: false, daysAdvanced: 0 };
  }

  const daysAdvanced = Math.max(0, Math.round((endMs - startMs) / 86400000));
  if (daysAdvanced === 0) {
    return { nextState: state, freezesUsed: 0, streakReset: false, daysAdvanced: 0 };
  }

  let freeze = state.freeze || 0;
  let streak = state.streak || 0;
  let freezesUsed = 0;
  let streakReset = false;

  for (let i = 0; i < daysAdvanced; i++) {
    const d = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
    const wasAwarded = Boolean(state.streakAwardedDays?.[d]);
    const isProtectedCalendarTag = Boolean(state.cal?.[d]);
    if (wasAwarded || isProtectedCalendarTag) {
      continue;
    }
    if (streak > 0) {
      if (freeze > 0) {
        freeze -= 1;
        freezesUsed += 1;
      } else {
        streak = 0;
        streakReset = true;
      }
    }
  }

  const nextUserStreaks = { ...(state.userStreaks || {}) };
  if (state.p.name.trim()) {
    nextUserStreaks[state.p.name.trim()] = streak;
  }

  return {
    nextState: {
      ...state,
      freeze,
      streak,
      last: todayDateStr,
      userStreaks: nextUserStreaks,
    },
    freezesUsed,
    streakReset,
    daysAdvanced,
  };
}

const SPOKEN_NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  half: 0.5,
};

const SPOKEN_FOOD_ALIASES: Array<[RegExp, string]> = [
  [/\bchapat+i(?:s)?\b|\bphulka(?:s)?\b|\brotis?\b/gi, 'roti'],
  [/\bda+l\b/gi, 'moong dal'],
  [/\bdahi\b|\byogurt\b|\byoghurt\b/gi, 'curd'],
  [/\bchawal\b|\bbhat\b/gi, 'cooked rice'],
  [/\banda\b|\beggs?\b/gi, 'egg'],
  [/\bkela\b|\bbananas?\b/gi, 'banana'],
  [/\bdoodh\b/gi, 'milk'],
  [/\bsabzi\b|\bspinach\b/gi, 'palak'],
  [/\bsoyabean\b|\bsoybean\b/gi, 'soya'],
  [/\bidlis\b/gi, 'idli'],
  [/\bdosas\b/gi, 'dosa'],
  [/\balmonds\b/gi, 'almonds'],
  [/\bpeanuts\b/gi, 'peanuts'],
];

function normalizeMealSegment(segment: string): { qty: number; term: string } {
  let cleaned = segment
    .toLowerCase()
    .replace(/\b(?:bowls?|cups?|plates?|pieces?|pcs?|servings?|glasses?|of)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let qty = 1;
  const numMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)?\s*(.+)$/i);
  if (numMatch) {
    qty = parseFloat(numMatch[1]);
    cleaned = numMatch[2].trim();
  } else {
    const wordMatch = cleaned.match(/^(a|an|one|two|three|four|five|six|half)\s+(.+)$/i);
    if (wordMatch) {
      qty = SPOKEN_NUMBER_WORDS[wordMatch[1].toLowerCase()] ?? 1;
      cleaned = wordMatch[2].trim();
    }
  }

  for (const [pattern, replacement] of SPOKEN_FOOD_ALIASES) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return { qty, term: cleaned.replace(/\s+/g, ' ').trim() };
}

export function parseMealText(
  raw: string,
  catalog: FoodCatalogItem[] = FOODS,
  allergies: AllergyTag[] = []
): LoggedFood[] {
  const safeCatalog = getSafeFoods(allergies, catalog);
  const parts = raw
    .split(/\+|,|&|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const logged: LoggedFood[] = [];

  for (const part of parts) {
    const { qty, term } = normalizeMealSegment(part);
    if (!term) continue;

    const words = term
      .split(/\s+/)
      .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w))
      .filter((w) => w.length > 2);

    const hit =
      safeCatalog.find((f) => f.name.toLowerCase().includes(term)) ||
      safeCatalog.find((f) => words.some((w) => f.name.toLowerCase().includes(w)));

    if (hit) {
      const label = qty !== 1 ? `${qty}× ${hit.name}` : hit.name;
      logged.push({
        n: label,
        k: Math.round(hit.kcal * qty),
        p: +(hit.p * qty).toFixed(1),
        c: +(hit.c * qty).toFixed(1),
        f: +(hit.f * qty).toFixed(1),
        q: qty,
      });
    }
  }

  return logged;
}

export interface CoachReply {
  text: string;
  actionLabel: string;
  actionType: 'log_food' | 'add_circuit' | 'add_walk' | 'open_calendar' | 'enable_min_due';
  suggestedFood?: LoggedFood;
  calendarUrl?: string;
  sources?: Array<{ title: string; uri: string }>;
  modeUsed?: 'offline_codex' | 'gemini_live';
  note?: string;
}

export function getCoachReply(
  question: string,
  state: AppState,
  dateStr: string,
  codex: ClinicalCodex = DEFAULT_CLINICAL_CODEX
): CoachReply {
  const s = question.toLowerCase();
  const c = calculateMacros(state.p);
  const T = sumDailyMacros(state.log[dateStr] || []);
  const allergies = state.p.allergies || [];
  const maternal = isMaternalProfile(state.p);
  const jointSafe = isJointSafeProfile(state.p);

  if (/eat|food|dinner|lunch|hungry|snack|sweet|protein|meal|dal|sprout/.test(s)) {
    const remKcal = Math.max(0, c.t - Math.round(T.k));
    const remProt = Math.max(0, c.pr - Math.round(T.p));

    const safeRecipes = getSafeRecipes([...RECIPES, ...(codex.recipes || [])], allergies, {
      isFemaleOrWomen: isFemaleProfile(state.p) || state.theme === 'women',
      diet: state.p.diet,
    }).sort((a, b) => b.macros[1] - a.macros[1]);

    const bestRecipe = safeRecipes[0];
    if (bestRecipe) {
      const allergyNote =
        allergies.length > 0 ? ` (100% free of your flagged allergens)` : '';
      return {
        text: `You have ~${remKcal} kcal and ${remProt} g protein left today${allergyNote}. Per ISSN pacing, try ${bestRecipe.name} (${bestRecipe.macros[0]} kcal, ${bestRecipe.macros[1]} g protein, ₹${bestRecipe.costInr}) — it keeps you full and builds firm muscle while you rest.`,
        actionLabel: `+ Log ${bestRecipe.name} (${bestRecipe.macros[0]} kcal)`,
        actionType: 'log_food',
        suggestedFood: {
          n: bestRecipe.name,
          k: bestRecipe.macros[0],
          p: bestRecipe.macros[1],
          c: bestRecipe.macros[2],
          f: bestRecipe.macros[3],
          q: 1,
        },
        modeUsed: 'offline_codex',
      };
    }

    const safeFoods = getSafeFoods(allergies, FOODS).sort((a, b) => b.p - a.p);
    const bestFood = safeFoods[0];
    if (bestFood) {
      return {
        text: `You have ~${remKcal} kcal and ${remProt} g protein left today. Safe protein option: ${bestFood.name} (${bestFood.kcal} kcal, ${bestFood.p} g protein).`,
        actionLabel: `+ Log ${bestFood.name} (${bestFood.kcal} kcal)`,
        actionType: 'log_food',
        suggestedFood: {
          n: bestFood.name,
          k: bestFood.kcal,
          p: bestFood.p,
          c: bestFood.c,
          f: bestFood.f,
          q: 1,
        },
        modeUsed: 'offline_codex',
      };
    }
  }

  if (/10|minute|busy|tired|desk|quick|meeting|schedule|calendar/.test(s)) {
    const equipNote =
      state.p.eq === 'gym'
        ? 'at the gym'
        : state.p.eq === 'dumb'
          ? 'with dumbbells'
          : state.p.eq === 'desi'
            ? 'using bodyweight flow'
            : 'at home with zero gear';
    return {
      text: maternal
        ? `Maternal Safety Shield active: try a gentle 10-minute circuit (${equipNote}) — 5 min easy walk + Cat-Cow + Pelvic Tilts at comfortable effort (RPE 6/10).`
        : jointSafe
          ? `Joint-Safe mode: do a 10-minute circuit (${equipNote}) — 2 sets × 12 chair squats, 2 sets × 12 wall push-ups, and bird-dog to protect your knees and lower back.`
          : `Do a 10-minute express circuit (${equipNote}, ACSM target RPE ${codex.guidelines.rpeTargetDefault}/10): 2 sets × 15 squats, 2 sets × 10 push-ups, and a 30s plank.`,
      actionLabel: '+ Add 10-Min Circuit to Today',
      actionType: 'add_circuit',
      modeUsed: 'offline_codex',
    };
  }

  if (/exhaust|sleep|fatigue|low energy|minimum/.test(s)) {
    return {
      text: `You logged ${state.watch.sleep || 0} hrs sleep and ${(state.watch.steps || 0).toLocaleString()} steps today. Switch on Minimum Due mode so a quick 5-minute routine protects your ${state.streak}-day streak while your body recovers.`,
      actionLabel: 'Switch Today to Minimum Due',
      actionType: 'enable_min_due',
      modeUsed: 'offline_codex',
    };
  }

  return {
    text: `Codex v${codex.version} · Aim for ${c.pr} g protein, train your locked Core lifts in Workouts, and take a 10-minute walk after eating to blunt sugar dips while protecting your ${state.streak}-day streak.`,
    actionLabel: '+ Add 5-Min Post-Meal Walk',
    actionType: 'add_walk',
    modeUsed: 'offline_codex',
  };
}
