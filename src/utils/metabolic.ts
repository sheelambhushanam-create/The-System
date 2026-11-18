import {
  ALT_POOLS,
  EX_POOLS,
  MIN_DUE_POOLS,
  TUTORIALS,
  WORKOUT_CONFIG,
  mapFemaleStageToClinical,
  type ExerciseEntry,
} from '../data/exercises';
import type {
  AppState,
  FemaleStage,
  LoggedFood,
  MacroSummary,
  PersonalRecord,
  ScheduleTrackId,
  StatKey,
  UserProfile,
  WorkoutDayExercise,
} from '../types/system';

export const FEMALE_STAGES: Array<[FemaleStage, string]> = [
  ['std', 'Standard Wellness'],
  ['pcos', 'Cycle & PCOS Support'],
  ['preg1', 'Pregnancy — Trimester 1'],
  ['preg2', 'Pregnancy — Trimester 2'],
  ['preg3', 'Pregnancy — Trimester 3'],
  ['post', 'Postpartum / Lactating'],
];

export function isFemaleProfile(p: UserProfile): boolean {
  return p.sex === 'f';
}

export function activeFemaleStage(p: UserProfile): FemaleStage {
  return isFemaleProfile(p) ? p.fstage || 'std' : 'std';
}

export function isMaternalProfile(p: UserProfile): boolean {
  const st = activeFemaleStage(p);
  return isFemaleProfile(p) && ['preg1', 'preg2', 'preg3', 'post'].includes(st);
}

export function getFemaleStageLabel(p: UserProfile): string {
  const st = activeFemaleStage(p);
  return (FEMALE_STAGES.find((x) => x[0] === st) || FEMALE_STAGES[0])[1];
}

export function calculateMacros(p: UserProfile): MacroSummary {
  const w = Number(p.w) || 70;
  const isMale = p.sex === 'm';
  const fst = activeFemaleStage(p);
  const bmr = 10 * w + 6.25 * p.h - 5 * p.age + (isMale ? 5 : -161);
  const tdee = bmr * p.act;

  let targetKcal: number;
  let proteinMult = 1.8;
  let modeNote = '';

  if (fst === 'preg1') {
    targetKcal = Math.max(1650, tdee);
    proteinMult = 1.5;
    modeNote = 'Trimester 1 pregnancy care (no calorie cutting · extra folate & iron)';
  } else if (fst === 'preg2') {
    targetKcal = Math.max(1850, tdee + 340);
    proteinMult = 1.6;
    modeNote = "Trimester 2 pregnancy energy (+340 cal/day for baby's growth)";
  } else if (fst === 'preg3') {
    targetKcal = Math.max(1950, tdee + 450);
    proteinMult = 1.65;
    modeNote = 'Trimester 3 pregnancy energy (+450 cal/day · extra calcium & iron)';
  } else if (fst === 'post') {
    targetKcal = Math.max(1800, tdee + 300);
    proteinMult = 1.75;
    modeNote = 'Postpartum & breastfeeding care (+300 cal/day · gentle core recovery)';
  } else if (fst === 'pcos') {
    targetKcal = Math.max(tdee * 0.85, 1350);
    proteinMult = 1.9;
    modeNote = 'PCOS support plan (gentle 15% calorie trim · high protein & fiber)';
  } else {
    targetKcal = Math.max(tdee * 0.8, isMale ? 1500 : 1200);
    proteinMult = 1.8;
    modeNote = 'Steady fat-loss goal (20% below your daily burn)';
  }

  const pr = Math.round(
    w * proteinMult * (p.age >= WORKOUT_CONFIG.engine.proteinLeucineAgeThreshold ? 1.1 : 1)
  );
  const f = Math.round(w * 0.85);
  const c = Math.max(50, Math.round((targetKcal - pr * 4 - f * 9) / 4));
  const defKcal = Math.max(150, Math.abs(tdee - targetKcal));
  const hMeters = Math.max(0.5, p.h / 100);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    t: Math.round(targetKcal),
    pr,
    f,
    c,
    bmi: w / (hMeters * hMeters),
    def: defKcal,
    modeNote,
  };
}

export function getLevelInfo(xp: number): { l: number; x: number; n: number } {
  let rem = Math.max(0, xp);
  let level = 1;
  while (rem >= level * 100) {
    rem -= level * 100;
    level++;
  }
  return { l: level, x: rem, n: level * 100 };
}

export function getRank(level: number): 'E' | 'D' | 'C' | 'B' | 'A' | 'S' {
  if (level < 5) return 'E';
  if (level < 10) return 'D';
  if (level < 15) return 'C';
  if (level < 25) return 'B';
  if (level < 40) return 'A';
  return 'S';
}

export function getProgramDayNumber(
  startDate: string,
  targetDate: string,
  cal: Record<string, string>,
  maxDays: number
): number {
  let count = 0;
  const d = new Date(startDate);
  const end = new Date(targetDate);
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return 1;
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    if (!cal[key]) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.min(maxDays, Math.max(1, count));
}

export function getGoalProgress(state: AppState, currentDate: string): number {
  if (isMaternalProfile(state.p)) {
    const day = getProgramDayNumber(state.start, currentDate, state.cal, state.p.days);
    return Math.min(100, Math.round((day / Math.max(1, state.p.days)) * 100));
  }
  const denom = Math.max(0.1, state.w0 - state.p.tw);
  return Math.round(Math.max(0, Math.min(100, ((state.w0 - state.p.w) / denom) * 100)));
}

export function isJointSafeProfile(p: UserProfile): boolean {
  return p.tier === 'joint' || Boolean(p.medicalHistory?.includes('joint_knee'));
}

function resolveSafeWorkoutConfigExercise(
  exId: string,
  p: UserProfile
): { config: (typeof WORKOUT_CONFIG.exercises)[string]; safetyNote?: string } | null {
  const raw = WORKOUT_CONFIG.exercises[exId];
  if (!raw) return null;

  const clinicalStage = mapFemaleStageToClinical(p.sex, p.fstage);
  const jointPain = isJointSafeProfile(p);
  const hasStageContraindication =
    (clinicalStage.startsWith('pregnancy_') && raw.contraindications.includes(clinicalStage)) ||
    (clinicalStage === 'postpartum' && raw.contraindications.includes('diastasis_recti'));
  const hasJointContraindication =
    jointPain && raw.contraindications.includes('acute_knee_pain');

  if (hasStageContraindication || hasJointContraindication) {
    const altId = raw.jointSafeAlternative;
    if (altId && WORKOUT_CONFIG.exercises[altId]) {
      return {
        config: WORKOUT_CONFIG.exercises[altId],
        safetyNote: hasStageContraindication ? 'Maternal Shield swap' : 'Joint-Safe swap',
      };
    }
    return null;
  }

  return { config: raw };
}

function getScheduleTrackIds(
  day: number,
  track: ScheduleTrackId,
  p: UserProfile
): string[] | null {
  if (track === 'adaptive') return null;

  if (track === 'high_roi_3day') {
    const cycle = [
      WORKOUT_CONFIG.schedules.high_roi_3day.day1_foundation_a,
      WORKOUT_CONFIG.schedules.high_roi_3day.day2_active_metabolic,
      WORKOUT_CONFIG.schedules.high_roi_3day.day3_foundation_b,
      WORKOUT_CONFIG.schedules.high_roi_3day.day4_active_recovery,
      WORKOUT_CONFIG.schedules.high_roi_3day.day5_metabolic_density,
    ];
    return cycle[(day - 1) % cycle.length];
  }

  if (track === 'joint_safe_beginner') {
    return day % 2 === 1
      ? WORKOUT_CONFIG.schedules.joint_safe_beginner.day1
      : WORKOUT_CONFIG.schedules.joint_safe_beginner.day2;
  }

  if (track === 'maternal_shield_track') {
    return WORKOUT_CONFIG.schedules.maternal_shield_track.routine;
  }

  if (track === 'desk_worker_express') {
    return WORKOUT_CONFIG.schedules.desk_worker_express.circuit;
  }

  // Fallback check if maternal profile uses adaptive
  void p;
  return null;
}

function findCatalogEntryByName(name: string): ExerciseEntry | null {
  const allPools = [...Object.values(EX_POOLS), ...Object.values(ALT_POOLS), ...Object.values(MIN_DUE_POOLS)];
  for (const list of allPools) {
    const hit = list.find((item) => item[0] === name);
    if (hit) return hit;
  }
  return null;
}

export function getProgramDayExercises(
  day: number,
  p: UserProfile,
  shuf: Record<number, number>,
  minimumDue = false,
  scheduleTrack: ScheduleTrackId = 'adaptive',
  exOverrides: Record<string, string> = {}
): WorkoutDayExercise[] {
  const prefix = minimumDue ? 'min_' : '';
  const defaultRestSec = minimumDue
    ? 30
    : scheduleTrack === 'desk_worker_express' || p.tier === 'hiit'
      ? WORKOUT_CONFIG.engine.metabolicRestSec
      : WORKOUT_CONFIG.engine.defaultRestSec;
  const progReps = Math.floor(day / 7) * 2;

  let baseItems: WorkoutDayExercise[] = [];

  const trackIds = !minimumDue ? getScheduleTrackIds(day, scheduleTrack, p) : null;
  if (trackIds && trackIds.length > 0) {
    const clinicalStage = mapFemaleStageToClinical(p.sex, p.fstage);
    const jointPain = isJointSafeProfile(p);
    const sh = shuf[day] || 0;
    const rotatedIds = WORKOUT_CONFIG.getRotatedWorkout(
      trackIds,
      p.eq || 'body',
      clinicalStage,
      jointPain,
      sh
    );
    const resolved: WorkoutDayExercise[] = [];
    for (let idx = 0; idx < rotatedIds.length; idx++) {
      const id = rotatedIds[idx];
      const safe = resolveSafeWorkoutConfigExercise(id, p);
      if (!safe) continue;
      const cfg = safe.config;
      const isMetabolicDensity =
        scheduleTrack === 'high_roi_3day' && (day - 1) % 5 === 4;
      const repBoost = cfg.isTimedSec || cfg.isRounds ? 0 : isMetabolicDensity ? 2 : progReps;
      const isRotatedSlot = sh > 0 && idx >= 2 && id !== trackIds[idx];
      resolved.push({
        id: cfg.id,
        name: cfg.name,
        sets: cfg.targetSets,
        reps: cfg.targetReps + repBoost,
        baseKg: cfg.baseWeightKg,
        bwRatio: cfg.baseWeightKg > 0 ? +(cfg.baseWeightKg / 70).toFixed(2) : 0,
        rpe: cfg.rpe,
        xpType: cfg.xpType,
        category: cfg.category,
        restSec: defaultRestSec,
        safetyNote: safe.safetyNote || (isRotatedSlot ? 'Rotated accessory' : undefined),
        isInvariantCore: idx < 2,
      });
    }
    baseItems = resolved;
  } else {
    const rawList = getRawExercisesForDay(day, p, shuf, minimumDue);
    const isActiveSession = !minimumDue && day % 4 !== 0;
    baseItems = rawList.map(([name, sets, reps, baseKg, bwRatio], idx) => {
      const lower = name.toLowerCase();
      const matchedCfg = Object.values(WORKOUT_CONFIG.exercises).find(
        (ex) =>
          ex.name.toLowerCase() === lower ||
          lower.includes(ex.id.replace(/_/g, ' ')) ||
          (lower.includes('goblet') && ex.id === 'squat_goblet') ||
          (lower.includes('chair squat') && ex.id === 'chair_squat') ||
          (lower.includes('wall sit') && ex.id === 'wall_sit') ||
          (lower.includes('glute bridge') && ex.id === 'glute_bridge') ||
          (lower.includes('romanian deadlift') && ex.id === 'rdl') ||
          (lower.includes('clamshell') && ex.id === 'clamshells') ||
          (lower.includes('wall push') && ex.id === 'pushup_incline_wall') ||
          (lower.includes('incline push') && ex.id === 'pushup_incline_wall') ||
          (lower.includes('shoulder press') && ex.id === 'overhead_press') ||
          (lower.includes('row') && ex.id === 'cable_dumbbell_row') ||
          (lower.includes('bird-dog') && ex.id === 'bird_dog') ||
          (lower.includes('cat-cow') && ex.id === 'cat_cow') ||
          (lower.includes('surya') && ex.id === 'surya_namaskar')
      );
      return {
        id: matchedCfg?.id,
        name,
        sets,
        reps,
        baseKg,
        bwRatio,
        rpe: matchedCfg?.rpe ?? (minimumDue ? 6 : WORKOUT_CONFIG.engine.rpeTargetDefault),
        xpType: (matchedCfg?.xpType ?? 'STR') as StatKey,
        category: matchedCfg?.category,
        restSec: defaultRestSec,
        isInvariantCore: isActiveSession && idx < 2,
      };
    });
  }

  return baseItems.map((item, idx) => {
    const overrideKey = `${prefix}${day}_${idx}`;
    const overrideVal = exOverrides[overrideKey];
    if (!overrideVal) return item;

    const cfg = WORKOUT_CONFIG.exercises[overrideVal];
    if (cfg) {
      return {
        id: cfg.id,
        name: cfg.name,
        sets: minimumDue ? Math.min(2, cfg.targetSets) : cfg.targetSets,
        reps:
          minimumDue && !cfg.isTimedSec && !cfg.isRounds
            ? Math.max(6, Math.round(cfg.targetReps * 0.7))
            : cfg.targetReps + (cfg.isTimedSec || cfg.isRounds ? 0 : progReps),
        baseKg: minimumDue && cfg.baseWeightKg > 0 ? +(cfg.baseWeightKg * 0.75).toFixed(1) : cfg.baseWeightKg,
        bwRatio: cfg.baseWeightKg > 0 ? +(cfg.baseWeightKg / 70).toFixed(2) : 0,
        rpe: cfg.rpe,
        xpType: cfg.xpType,
        category: cfg.category,
        restSec: defaultRestSec,
        safetyNote: 'Swapped',
      };
    }

    const poolHit = findCatalogEntryByName(overrideVal);
    if (poolHit) {
      const [name, sets, reps, baseKg, bwRatio] = poolHit;
      return {
        ...item,
        id: undefined,
        name,
        sets,
        reps: reps + (name.includes('(min)') ? 0 : progReps),
        baseKg,
        bwRatio,
        safetyNote: 'Swapped',
      };
    }

    return item;
  });
}

export function pickPerExerciseSwap(
  currentEx: WorkoutDayExercise,
  p: UserProfile,
  minimumDue: boolean,
  existingNames: string[]
): string {
  const clinicalStage = mapFemaleStageToClinical(p.sex, p.fstage);
  const jointPain = isJointSafeProfile(p);

  if (currentEx.id && WORKOUT_CONFIG.exercises[currentEx.id]) {
    const excludeIds = Object.values(WORKOUT_CONFIG.exercises)
      .filter((ex) => existingNames.includes(ex.name) && ex.id !== currentEx.id)
      .map((ex) => ex.id);
    const pickedId = WORKOUT_CONFIG.shuffleExercise(
      currentEx.id,
      p.eq || 'body',
      clinicalStage,
      jointPain,
      excludeIds
    );
    if (pickedId && pickedId !== currentEx.id) {
      return pickedId;
    }
  }

  // Fallback across ALT_POOLS / EX_POOLS / MIN_DUE_POOLS for the user's tier/equipment
  const key = isMaternalProfile(p)
    ? 'maternal'
    : p.eq && p.eq !== 'body'
      ? p.eq
      : p.tier || 'bal';

  const poolCandidates = minimumDue
    ? [...(MIN_DUE_POOLS[key] || []), ...(ALT_POOLS[key] || [])]
    : [...(ALT_POOLS[key] || []), ...(EX_POOLS[key] || [])];

  const filtered = poolCandidates.filter(
    ([name]) => name !== currentEx.name && !existingNames.includes(name)
  );
  if (filtered.length > 0) return filtered[0][0];

  const anySafe = WORKOUT_CONFIG.getSafeExercises(clinicalStage, p.eq || 'body', jointPain).filter(
    (ex) => ex.name !== currentEx.name
  );
  if (anySafe.length > 0) return anySafe[0].id;

  return currentEx.id || currentEx.name;
}

export function getRawExercisesForDay(
  day: number,
  p: UserProfile,
  shuf: Record<number, number>,
  minimumDue = false
): ExerciseEntry[] {
  const key = isMaternalProfile(p)
    ? 'maternal'
    : p.eq && p.eq !== 'body'
      ? p.eq
      : p.tier || 'bal';

  if (minimumDue) {
    if (day % 4 === 0) {
      return isMaternalProfile(p)
        ? [
            ['Gentle evening walk (min)', 1, 5, 0, 0],
            ['Cat-Cow spine relief', 1, 6, 0, 0],
          ]
        : [
            ['Active recovery: easy walk (min)', 1, 5, 0, 0],
            ['Box breathing (min)', 1, 3, 0, 0],
          ];
    }
    return (MIN_DUE_POOLS[key] || MIN_DUE_POOLS.bal).map(([name, sets, reps, kg, ratio]) => [
      name,
      sets,
      reps,
      kg,
      ratio || 0,
    ]);
  }

  if (day % 4 === 0) {
    return isMaternalProfile(p)
      ? [
          ['Gentle evening walk (min)', 1, 15, 0, 0],
          ['Cat-Cow & hip mobility (min)', 1, 8, 0, 0],
          ['Pelvic floor & deep breathing (min)', 1, 5, 0, 0],
        ]
      : [
          ['Active recovery: easy walk (min)', 1, 20, 0, 0],
          ['Full-body mobility stretch (min)', 1, 10, 0, 0],
          ['Box breathing (min)', 1, 5, 0, 0],
        ];
  }

  // Pillar 3 (80/20 Invariant Core):
  // Positions 0 & 1 (Primary Compounds) stay locked across shuf[day] for a 4-6 week block
  // so progressive overload (+2.5 kg) and PR tracking stay consistent.
  // Positions >= 2 (Accessories & Finishers) rotate on day cadence + shuf[day].
  const sh = shuf[day] || 0;
  const blockAlt = Math.floor((day - 1) / 28) % 2 === 1;
  const corePool = (blockAlt ? ALT_POOLS[key] : EX_POOLS[key]) || EX_POOLS.bal;
  const altPool = (blockAlt ? EX_POOLS[key] : ALT_POOLS[key]) || ALT_POOLS.bal;
  const useAltAccessories = (day + sh) % 2 === 0;
  const accSource = (useAltAccessories ? altPool : corePool).slice(2);
  const rotOffset = sh > 1 && accSource.length > 0 ? (sh - 1) % accSource.length : 0;
  const rotatedAccessories =
    rotOffset > 0
      ? [...accSource.slice(rotOffset), ...accSource.slice(0, rotOffset)]
      : accSource;

  const combined = [...corePool.slice(0, 2), ...rotatedAccessories];
  const progReps = Math.floor(day / 7) * 2;

  return combined.map(([name, sets, reps, kg, ratio]) => [
    name,
    sets,
    reps + (name.includes('(min)') ? 0 : progReps),
    kg,
    ratio || 0,
  ]);
}

export function getRecommendedTarget(
  exName: string,
  baseSets: number,
  baseReps: number,
  baseKg: number,
  bwRatio: number,
  p: UserProfile,
  prs: Record<string, PersonalRecord>
) {
  const bw = Number(p.w) || 70;
  const sexMult = p.sex === 'f' ? WORKOUT_CONFIG.engine.femaleStrengthRatio : 1.0;
  const tierMult = p.tier === 'joint' ? 0.75 : p.tier === 'hiit' ? 1.15 : 1.0;
  const pr = prs[exName];
  const isWeighted = baseKg > 0 || bwRatio > 0 || Boolean(pr && pr.maxKg > 0);

  let recKg = 0;
  let recReps = baseReps;

  if (isWeighted) {
    const rawCalc =
      bwRatio > 0 ? bw * bwRatio * sexMult * tierMult : baseKg * sexMult * tierMult;
    const roundedCalc = Math.max(2.5, Math.round(rawCalc / 2.5) * 2.5);
    if (pr && pr.maxKg > 0) {
      recKg =
        (pr.repsAtMax || 0) >= baseReps
          ? +(pr.maxKg + WORKOUT_CONFIG.engine.microProgressionKg).toFixed(1)
          : pr.maxKg;
    } else {
      recKg = roundedCalc;
    }
  } else if (pr && (pr.maxReps || 0) >= baseReps) {
    recReps = pr.maxReps + 2;
  }

  return {
    sets: baseSets,
    reps: recReps,
    kg: recKg,
    isWeighted,
    label: isWeighted ? `${recKg} kg × ${recReps} reps` : `Bodyweight × ${recReps}`,
  };
}

export function calculateBodyFat(
  p: UserProfile,
  meas: Array<{ d: string; waist: number; neck: number; hip: number }>
): { bf: string; lean: string; waist: number } | null {
  const m = meas[meas.length - 1];
  if (!m || !m.waist || !m.neck) return null;
  const h = Number(p.h);
  const w = Number(p.w);
  const isMale = p.sex === 'm';

  let bf: number;
  if (isMale) {
    if (m.waist <= m.neck) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(m.waist - m.neck) + 0.15456 * Math.log10(h)) - 450;
  } else {
    const hip = m.hip || m.waist + 14;
    if (m.waist + hip <= m.neck) return null;
    bf =
      495 /
        (1.29579 - 0.35004 * Math.log10(m.waist + hip - m.neck) + 0.221 * Math.log10(h)) -
      450;
  }

  bf = Math.max(4, Math.min(60, bf));
  const leanKg = w * (1 - bf / 100);
  return { bf: bf.toFixed(1), lean: leanKg.toFixed(1), waist: m.waist };
}

export function sumDailyMacros(foods: LoggedFood[]) {
  return foods.reduce(
    (acc, item) => ({
      k: acc.k + item.k,
      p: acc.p + item.p,
      c: acc.c + item.c,
      f: acc.f + item.f,
    }),
    { k: 0, p: 0, c: 0, f: 0 }
  );
}

export interface CyclePhaseInsight {
  cycleDay: number;
  phaseLabel: string;
  energyPace: string;
  nutrientFocus: string;
  dailyTip: string;
}

export function getCyclePhaseInsight(dayNum: number, p: UserProfile): CyclePhaseInsight {
  const safeDay = Math.max(1, Math.round(dayNum) || 1);
  const cycleDay = ((safeDay - 1) % 28) + 1;
  const stage = activeFemaleStage(p);

  if (stage === 'preg1') {
    return {
      cycleDay,
      phaseLabel: 'First Trimester · Gentle Foundation',
      energyPace: 'Easy Talk-Test Pace',
      nutrientFocus: 'Folate & Hydration',
      dailyTip:
        'Keep workouts conversational, sip fluids steadily, and honor nausea or fatigue cues.',
    };
  }
  if (stage === 'preg2') {
    return {
      cycleDay,
      phaseLabel: 'Second Trimester · Steady Support',
      energyPace: 'Supported Posture & Strength',
      nutrientFocus: 'Bioavailable Iron & Calcium',
      dailyTip:
        'Use upright or incline support instead of flat-back moves and nourish steady energy.',
    };
  }
  if (stage === 'preg3') {
    return {
      cycleDay,
      phaseLabel: 'Third Trimester · Pelvic & Calm Flow',
      energyPace: 'Low-Impact Mobility',
      nutrientFocus: 'Iron, Choline & Fiber',
      dailyTip:
        'Prioritize wall/chair-assisted moves, diaphragmatic breathing, and restful sleep.',
    };
  }
  if (stage === 'post') {
    return {
      cycleDay,
      phaseLabel: 'Postpartum · Gradual Restore',
      energyPace: 'Pelvic Floor & Walking',
      nutrientFocus: 'Protein, Iron & Omega-3',
      dailyTip:
        'Rebuild deep core and pelvic stability gently before adding higher-impact sets.',
    };
  }
  if (stage === 'pcos') {
    return {
      cycleDay,
      phaseLabel: 'PCOS Support · Insulin Balance',
      energyPace: 'Strength + Post-Meal Walks',
      nutrientFocus: 'Magnesium, Fiber & Zinc',
      dailyTip:
        'Pair protein-first meals with a 10-minute post-meal walk to smooth afternoon energy.',
    };
  }

  if (cycleDay <= 5) {
    return {
      cycleDay,
      phaseLabel: 'Menstrual · Restorative',
      energyPace: 'Gentle Mobility & Walks',
      nutrientFocus: 'Iron + Vitamin C',
      dailyTip:
        'Honor lower energy with warm iron-rich meals, light stretching, and an earlier bedtime.',
    };
  }
  if (cycleDay <= 13) {
    return {
      cycleDay,
      phaseLabel: 'Follicular · Rising Energy',
      energyPace: 'Progressive Strength Focus',
      nutrientFocus: 'Lean Protein & B-Vitamins',
      dailyTip:
        'Rising readiness supports crisp strength sets—aim for clean control on every rep.',
    };
  }
  if (cycleDay <= 16) {
    return {
      cycleDay,
      phaseLabel: 'Ovulatory · Peak Power',
      energyPace: 'Confident Compound Effort',
      nutrientFocus: 'Antioxidants & Electrolytes',
      dailyTip:
        'Great window for steady compound lifts and extra water intake through the day.',
    };
  }
  return {
    cycleDay,
    phaseLabel: 'Luteal · Steady Endurance',
    energyPace: 'Moderate Load & Pacing',
    nutrientFocus: 'Magnesium, B6 & Complex Carbs',
    dailyTip:
      'Support resting recovery with magnesium-rich meals, steady sets, and calm evening wind-down.',
  };
}

export interface ExerciseExecutionGuide {
  cadence: string;
  postureCue: string;
  steps: Array<{ title: string; detail: string }>;
}

export function getExerciseExecutionCues(
  exName: string,
  p: UserProfile
): ExerciseExecutionGuide {
  const lower = exName.toLowerCase();
  const isHoldOrFlow =
    /\((sec|min)\)/.test(lower) ||
    lower.includes('plank') ||
    lower.includes('bridge') ||
    lower.includes('walk') ||
    lower.includes('stretch') ||
    lower.includes('surya') ||
    lower.includes('breath');

  const cadence = isHoldOrFlow
    ? 'Slow nasal breath · 4s inhale, 4s exhale'
    : 'Inhale 3s on lowering · Exhale smoothly on effort';

  const postureCue = isMaternalProfile(p)
    ? 'Keep ribs stacked over pelvis and exhale cleanly on effort—never hold your breath.'
    : p.tier === 'joint' || p.medicalHistory?.includes('joint_knee')
      ? 'Track knees softly over toes and work inside a pain-free, controlled range.'
      : 'Stack ribs over pelvis, shoulders packed away from ears, smooth control.';

  const tutorialKey = Object.keys(TUTORIALS).find((k) => lower.includes(k));
  if (tutorialKey && TUTORIALS[tutorialKey]?.steps.length) {
    const rawSteps = TUTORIALS[tutorialKey].steps;
    const labels = ['Setup & Alignment', 'Controlled Effort', 'Reset & Finish'];
    const mapped = rawSteps.slice(0, 3).map((s, idx) => ({
      title: labels[idx] || `Step ${idx + 1}`,
      detail: s.text,
    }));
    if (mapped.length < 3) {
      mapped.push({
        title: 'Reset & Finish',
        detail: 'Pause briefly under control before resetting breath for your next clean repetition.',
      });
    }
    return { cadence, postureCue, steps: mapped };
  }

  if (lower.includes('squat') || lower.includes('lunge') || lower.includes('leg') || lower.includes('step')) {
    return {
      cadence,
      postureCue,
      steps: [
        {
          title: 'Setup & Alignment',
          detail: 'Plant feet evenly shoulder-width apart with chest proud and core lightly braced.',
        },
        {
          title: 'Controlled Effort',
          detail: 'Lower hips back smoothly for 2–3 seconds while knees track cleanly over toes.',
        },
        {
          title: 'Reset & Finish',
          detail: 'Press evenly through mid-foot and heels to stand tall without locking knees.',
        },
      ],
    };
  }

  if (lower.includes('row') || lower.includes('pull') || lower.includes('curl') || lower.includes('band')) {
    return {
      cadence,
      postureCue,
      steps: [
        {
          title: 'Setup & Alignment',
          detail: 'Set a long spine, draw shoulders down from ears, and take light tension before moving.',
        },
        {
          title: 'Controlled Effort',
          detail: 'Pull elbows smoothly toward your ribs and pause for one calm beat at peak squeeze.',
        },
        {
          title: 'Reset & Finish',
          detail: 'Lower smoothly back to full reach on a 3-count without letting shoulders round forward.',
        },
      ],
    };
  }

  if (lower.includes('push') || lower.includes('press') || lower.includes('dip') || lower.includes('fly')) {
    return {
      cadence,
      postureCue,
      steps: [
        {
          title: 'Setup & Alignment',
          detail: 'Set wrists stacked cleanly, ribs tucked, and elbows angled roughly 45° from torso.',
        },
        {
          title: 'Controlled Effort',
          detail: 'Lower steadily until chest opens comfortably, keeping shoulder blades stable.',
        },
        {
          title: 'Reset & Finish',
          detail: 'Exhale as you press back to top alignment without flaring lower back.',
        },
      ],
    };
  }

  return {
    cadence,
    postureCue,
    steps: [
      {
        title: 'Setup & Alignment',
        detail: 'Establish balanced stance, neutral spine, and one calm breath before starting.',
      },
      {
        title: 'Controlled Effort',
        detail: 'Move deliberately through each repetition or hold with even muscular tension.',
      },
      {
        title: 'Reset & Finish',
        detail: 'Complete the set smoothly under control and take 30–45 seconds to let pulse settle.',
      },
    ],
  };
}

