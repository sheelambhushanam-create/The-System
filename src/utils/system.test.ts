import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMacros,
  calculateBodyFat,
  getCyclePhaseInsight,
  getExerciseExecutionCues,
  getLevelInfo,
  getRank,
  getRawExercisesForDay,
  getRecommendedTarget,
} from './metabolic';
import {
  buildDailyQuests,
  getHabitStatementStatus,
  parseMealText,
  verifyQuestsState,
} from './quests';
import { createDefaultState } from './storage';
import { buildMeasurementSeries } from './biometrics';
import {
  buildInitialPlanFromQuestionnaire,
  buildInitialUserStreaks,
  buildMemberCode,
  formatShareableSummary,
  recommendThemeFromProfile,
  resolveAuthorStreak,
} from './onboarding';

test('calculateMacros computes male deficit and floor accurately', () => {
  const base = createDefaultState().p;
  const res = calculateMacros({ ...base, sex: 'm', age: 28, h: 175, w: 80, act: 1.375 });
  assert.equal(res.bmr, 1759);
  assert.equal(res.tdee, 2418);
  assert.equal(res.t, 1935);
  assert.equal(res.pr, 144);

  const floorMale = calculateMacros({ ...base, sex: 'm', age: 30, h: 160, w: 50, act: 1.2 });
  assert.equal(floorMale.t, 1500);
});

test('calculateMacros disables deficit in maternal stages and boosts protein over 40', () => {
  const base = createDefaultState().p;
  const preg2 = calculateMacros({ ...base, sex: 'f', fstage: 'preg2', age: 30, h: 162, w: 62, act: 1.375 });
  assert.ok(preg2.t >= preg2.tdee + 339);
  assert.match(preg2.modeNote, /Trimester 2/);

  const over40 = calculateMacros({ ...base, sex: 'f', fstage: 'std', age: 44, h: 162, w: 70, act: 1.375 });
  assert.equal(over40.pr, Math.round(70 * 1.8 * 1.1));
});

test('getLevelInfo and getRank map XP thresholds monotonically', () => {
  assert.deepEqual(getLevelInfo(0), { l: 1, x: 0, n: 100 });
  assert.deepEqual(getLevelInfo(100), { l: 2, x: 0, n: 200 });
  assert.deepEqual(getLevelInfo(350), { l: 3, x: 50, n: 300 });
  assert.equal(getRank(1), 'E');
  assert.equal(getRank(5), 'D');
  assert.equal(getRank(10), 'C');
  assert.equal(getRank(15), 'B');
  assert.equal(getRank(25), 'A');
  assert.equal(getRank(40), 'S');
});

test('parseMealText parses quantities and multi-item Indian meals', () => {
  const items = parseMealText('2 roti + 1 moong dal + 1.5 curd');
  assert.equal(items.length, 3);
  assert.equal(items[0].k, 208);
  assert.equal(items[1].p, 14);
  assert.equal(items[2].k, 147);
});

test('verifyQuestsState auto-completes and revokes quests strictly from logged numbers', () => {
  const dateStr = '2026-11-17';
  let state = createDefaultState();
  state.xp = 0;
  state.start = dateStr;
  state.water = { [dateStr]: 3.0 };
  state.watch = { steps: 8500, sleep: 7.5 };

  const res1 = verifyQuestsState(state, dateStr);
  assert.equal(res1.nextState.done[dateStr].h, true);
  assert.equal(res1.nextState.done[dateStr].s, true);
  assert.equal(res1.nextState.done[dateStr].z, true);
  assert.equal(res1.nextState.xp, 50); // 15 water + 20 steps + 15 sleep

  // Revoke water if lowered below 3.0L
  const lowered = { ...res1.nextState, water: { [dateStr]: 2.0 } };
  const res2 = verifyQuestsState(lowered, dateStr);
  assert.equal(res2.nextState.done[dateStr].h, undefined);
  assert.equal(res2.nextState.xp, 35);
});

test('getRecommendedTarget scales by bodyweight and auto-progresses +2.5kg after PR', () => {
  const base = createDefaultState().p;
  const rec1 = getRecommendedTarget('Goblet squat', 3, 12, 10, 0.18, { ...base, w: 80, sex: 'm', tier: 'bal' }, {});
  assert.equal(rec1.kg, 15);

  const rec2 = getRecommendedTarget(
    'Goblet squat',
    3,
    12,
    10,
    0.18,
    { ...base, w: 80, sex: 'm', tier: 'bal' },
    { 'Goblet squat': { maxKg: 15, repsAtMax: 12, maxVol: 180, maxReps: 12, bestStr: '15 kg × 12' } }
  );
  assert.equal(rec2.kg, 17.5);
});

test('calculateBodyFat computes US Navy body fat % and lean mass', () => {
  const base = createDefaultState().p;
  const res = calculateBodyFat({ ...base, sex: 'm', h: 175, w: 80 }, [
    { d: '2026-11-17', waist: 86, neck: 38, hip: 0 },
  ]);
  assert.ok(res !== null);
  assert.ok(parseFloat(res.bf) > 10 && parseFloat(res.bf) < 25);
  assert.ok(parseFloat(res.lean) > 55);
});

test('buildMeasurementSeries sorts chronologically and computes linear trend lines for all metrics', () => {
  const wt = [
    { d: '2026-11-14', w: 80.0 },
    { d: '2026-11-01', w: 82.0 },
    { d: '2026-11-08', w: 81.0 },
  ];
  const meas = [
    { d: '2026-11-01', waist: 86.0, neck: 39.0, hip: 100.0 },
    { d: '2026-11-14', waist: 84.0, neck: 38.0, hip: 98.0 },
  ];

  const { points, summaries } = buildMeasurementSeries(wt, meas);
  assert.equal(points.length, 3);
  assert.equal(points[0].date, '2026-11-01');
  assert.equal(points[2].date, '2026-11-14');

  // Linear trend fits for weight, waist, neck, hip
  assert.equal(summaries.weight.latest, 80.0);
  assert.equal(summaries.weight.delta, -2.0);
  assert.ok(typeof points[1].weightTrend === 'number');
  assert.ok(typeof points[1].waistTrend === 'number');
  assert.ok(typeof points[1].neckTrend === 'number');
  assert.ok(typeof points[1].hipTrend === 'number');
  assert.ok((summaries.waist.slopePerWeek ?? 0) < 0);
  assert.ok((summaries.hip.slopePerWeek ?? 0) < 0);
});

test('recommendThemeFromProfile selects theme from user profile and medical history', () => {
  const womenRec = recommendThemeFromProfile({
    sex: 'f',
    medicalHistory: ['pcos_hormonal'],
    goalStyle: 'balanced',
  });
  assert.equal(womenRec.theme, 'women');
  assert.equal(womenRec.recommendedFstage, 'pcos');

  const maternalRec = recommendThemeFromProfile({
    sex: 'f',
    medicalHistory: ['pregnancy_postpartum'],
    goalStyle: 'competitive',
  });
  assert.equal(maternalRec.theme, 'women');
  assert.equal(maternalRec.recommendedTier, 'joint');

  const rpgRec = recommendThemeFromProfile({
    sex: 'm',
    medicalHistory: [],
    goalStyle: 'competitive',
  });
  assert.equal(rpgRec.theme, 'rpg');

  const cleanRec = recommendThemeFromProfile({
    sex: 'm',
    medicalHistory: ['joint_knee'],
    goalStyle: 'competitive',
  });
  assert.equal(cleanRec.theme, 'clean');
  assert.equal(cleanRec.recommendedTier, 'joint');
});

test('resolveAuthorStreak resolves current user and peer streaks accurately', () => {
  const state = createDefaultState();
  state.streak = 7;
  state.userStreaks = buildInitialUserStreaks('Aarav', 7);

  assert.equal(resolveAuthorStreak('PriyaFit', state), 15);
  assert.equal(resolveAuthorStreak('Vanguard_K', state), 21);
  assert.equal(resolveAuthorStreak('Aarav', state), 7);
  assert.equal(resolveAuthorStreak('Anonymous Member', state, { isCurrentUser: true }), 7);
  assert.equal(resolveAuthorStreak('GuestUser', state, { fallbackStreak: 4 }), 4);
});

test('getRawExercisesForDay returns tailored 3-move Minimum Due exercises by profile & equipment', () => {
  const base = createDefaultState().p;

  const bodyMin = getRawExercisesForDay(1, { ...base, eq: 'body', tier: 'bal' }, {}, true);
  assert.equal(bodyMin.length, 3);
  assert.equal(bodyMin[0][0], 'Incline push-ups');
  assert.equal(bodyMin[0][1], 2);

  const dumbMin = getRawExercisesForDay(1, { ...base, eq: 'dumb', tier: 'bal' }, {}, true);
  assert.equal(dumbMin.length, 3);
  assert.equal(dumbMin[0][0], 'Goblet squat (light)');

  const maternalMin = getRawExercisesForDay(
    1,
    { ...base, sex: 'f', fstage: 'preg2' },
    {},
    true
  );
  assert.equal(maternalMin.length, 3);
  assert.equal(maternalMin[0][0], 'Cat-Cow spine relief');

  const recoveryMin = getRawExercisesForDay(4, base, {}, true);
  assert.equal(recoveryMin.length, 2);
});

test('Minimum Due mode lowers daily targets and protects streak without double-counting', () => {
  const dateStr = '2026-11-17';
  let state = createDefaultState();
  state.start = dateStr;
  state.streak = 3;
  state.xp = 0;
  state.minimumDueDays = { [dateStr]: true };

  // Unpaid initially (0 active minimum pillars)
  const initialStatement = getHabitStatementStatus(state, dateStr);
  assert.equal(initialStatement.isMinimumDueMode, true);
  assert.equal(initialStatement.statementTier, 'unpaid');
  assert.equal(initialStatement.hydrationTargetLitres, 1.5);

  const minQuests = buildDailyQuests(state, dateStr);
  assert.match(minQuests[0].t, /Minimum Due: 5-min micro-workout/);

  // Complete Minimum Due micro-workout + 1.5L hydration -> streak increments once from 3 -> 4
  state = {
    ...state,
    water: { [dateStr]: 1.5 },
    prog: { 1: { min: true } },
  };
  const afterMin = verifyQuestsState(state, dateStr);
  assert.equal(afterMin.nextState.done[dateStr].w, true);
  assert.equal(afterMin.nextState.done[dateStr].h, true);
  assert.equal(afterMin.nextState.streak, 4);
  assert.equal(afterMin.nextState.streakAwardedDays[dateStr], 'minimum');

  // Upgrading later to Full Balance upgrades award tag without double-incrementing streak
  const upgraded = verifyQuestsState(
    {
      ...afterMin.nextState,
      minimumDueDays: {},
      water: { [dateStr]: 3.0 },
      watch: { steps: 8500, sleep: 7.5 },
      prog: { 1: { min: true, x: true } },
    },
    dateStr
  );
  assert.equal(upgraded.nextState.streak, 4);
  assert.equal(upgraded.nextState.streakAwardedDays[dateStr], 'full');
});

import { WORKOUT_CONFIG } from '../data/exercises';
import { getProgramDayExercises, pickPerExerciseSwap } from './metabolic';

test('WORKOUT_CONFIG filters maternal and joint contraindications and scales female/PR weights', () => {
  const safePreg3 = WORKOUT_CONFIG.getSafeExercises('pregnancy_t3', 'gym', false).map((e) => e.id);
  assert.equal(safePreg3.includes('glute_bridge'), false);
  assert.equal(safePreg3.includes('front_plank'), false);
  assert.equal(safePreg3.includes('supported_hip_thrust'), true);

  const safeJoint = WORKOUT_CONFIG.getSafeExercises('standard', 'dumb', true).map((e) => e.id);
  assert.equal(safeJoint.includes('squat_goblet'), false);
  assert.equal(safeJoint.includes('chair_squat'), true);

  const fWeight = WORKOUT_CONFIG.getRecommendedWeight('squat_goblet', {
    sex: 'f',
    currentWeightKg: 70,
  });
  assert.equal(fWeight, 9);

  const prWeight = WORKOUT_CONFIG.getRecommendedWeight('squat_goblet', {
    sex: 'm',
    currentWeightKg: 70,
    prHistory: { squat_goblet: { weightKg: 15, reps: 12 } },
  });
  assert.equal(prWeight, 17.5);
});

test('WORKOUT_CONFIG.shuffleExercise and getProgramDayExercises respect tracks and per-exercise overrides', () => {
  const base = createDefaultState().p;
  const swappedId = WORKOUT_CONFIG.shuffleExercise('squat_goblet', 'dumb', 'standard', false);
  assert.notEqual(swappedId, 'squat_goblet');
  assert.ok(WORKOUT_CONFIG.exercises[swappedId]);

  const express = getProgramDayExercises(1, { ...base, eq: 'body' }, {}, false, 'desk_worker_express', {});
  assert.equal(express.length, 4);
  assert.equal(express[0].restSec, WORKOUT_CONFIG.engine.metabolicRestSec);

  const pregSafe = getProgramDayExercises(
    1,
    { ...base, sex: 'f', fstage: 'preg3', eq: 'gym' },
    {},
    false,
    'high_roi_3day',
    {}
  );
  assert.ok(pregSafe.some((ex) => ex.id === 'chair_squat' && ex.safetyNote === 'Maternal Shield swap'));
  assert.ok(pregSafe.some((ex) => ex.id === 'bird_dog' && ex.safetyNote === 'Maternal Shield swap'));

  const swapCandidate = pickPerExerciseSwap(express[0], { ...base, eq: 'body' }, false, express.map((e) => e.name));
  assert.notEqual(swapCandidate, express[0].id);

  const withOverride = getProgramDayExercises(
    1,
    { ...base, eq: 'body' },
    {},
    false,
    'desk_worker_express',
    { '1_0': swapCandidate }
  );
  assert.notEqual(withOverride[0].name, express[0].name);
  assert.equal(withOverride[1].name, express[1].name);
});

import {
  computeMicronutrients,
  getAutonomicReadiness,
  getCircadianWindow,
  getKineticAndSleepMetrics,
} from './clinical';

test('getCircadianWindow returns accurate diurnal training windows', () => {
  const morning = getCircadianWindow(8);
  assert.equal(morning.windowLabel, '8:14 AM Cortisol Peak Window');
  assert.equal(morning.optimalLoad, 'Compound Strength');

  const afternoon = getCircadianWindow(16);
  assert.equal(afternoon.windowLabel, '4:45 PM Core Temp Peak');
  assert.equal(afternoon.optimalLoad, 'Peak Force & Hypertrophy');

  const evening = getCircadianWindow(22);
  assert.equal(evening.optimalLoad, 'Active Recovery');
});

test('getAutonomicReadiness responds to synced HRV, RHR, sleep, hydration, and live BLE BPM', () => {
  const dateStr = '2026-11-17';
  const base = createDefaultState();

  const optimal = getAutonomicReadiness({
    ...base,
    water: { [dateStr]: 3.0 },
    watch: { steps: 8420, sleep: 8.2, hrvMs: 74, rhrBpm: 54 },
  }, dateStr);
  assert.equal(optimal.hrvMs, 74);
  assert.equal(optimal.rhrBpm, 54);
  assert.equal(optimal.isReadyForLoad, true);
  assert.match(optimal.statusLabel, /Vagal Dominant/);

  const strained = getAutonomicReadiness(
    {
      ...base,
      water: { [dateStr]: 0.5 },
      watch: { steps: 2000, sleep: 4.5, hrvMs: 38, rhrBpm: 74 },
    },
    dateStr
  );
  assert.equal(strained.isReadyForLoad, false);
  assert.match(strained.statusLabel, /Sympathetic Strain/);

  const bleOverride = getAutonomicReadiness(
    { ...base, watch: { steps: 5000, sleep: 7.5, hrvMs: 68, rhrBpm: 60 } },
    dateStr,
    52
  );
  assert.equal(bleOverride.rhrBpm, 52);
});

test('computeMicronutrients calculates bioavailable iron, magnesium, and folate accurately', () => {
  const base = createDefaultState().p;
  const foods = [
    { n: 'Palak / Spinach sabzi (1 cup)', k: 120, p: 4, c: 8, f: 7, q: 1 },
    { n: 'Moong dal (1 cup)', k: 150, p: 10, c: 24, f: 1.5, q: 1 },
    { n: 'Ragi roti', k: 110, p: 3, c: 22, f: 1, q: 1 },
  ];
  const maleMicros = computeMicronutrients(foods, { ...base, sex: 'm', fstage: 'std' });
  assert.equal(maleMicros.ironTargetMg, 10);
  assert.ok(maleMicros.ironMg >= 8);
  assert.ok(maleMicros.magnesiumMg >= 190);
  assert.ok(maleMicros.folateMcg >= 260);

  const maternalMicros = computeMicronutrients(foods, { ...base, sex: 'f', fstage: 'preg2' });
  assert.equal(maternalMicros.ironTargetMg, 27);
  assert.equal(maternalMicros.folateTargetMcg, 600);
});

test('getKineticAndSleepMetrics computes dual-layer steps, cadence, and sleep architecture', () => {
  const res = getKineticAndSleepMetrics({ steps: 8420, sleep: 8.2 }, 'Garmin HR');
  assert.equal(res.totalSteps, 8420);
  assert.equal(res.wearableSteps + res.coprocessorSteps, 8420);
  assert.equal(res.cadenceSpm, 114);
  assert.equal(res.formattedSleep, '8h 12m');
  assert.equal(res.deepPct, 22);
  assert.equal(res.remPct, 24);
  assert.equal(res.lightPct, 54);
  assert.equal(res.repairStatus, 'Optimal Tissue Repair');
  assert.equal(res.sensorSource, 'Garmin HR + Coprocessor');
});

import {
  DEFAULT_CLINICAL_CODEX,
  syncClinicalCodex,
  validateCodexPayload,
} from './codex';
import {
  FOODS,
  RECIPES,
  buildGroceryList,
  getDailyChefRecommendation,
  getMacroSubstitutions,
  getSafeFoods,
  getSafeRecipes,
  isComboSafe,
} from '../data/foods';
import { getCoachReply } from './quests';
import { getNextBestMove } from './notifications';

test('validateCodexPayload validates valid payloads and rejects malformed schemas', () => {
  assert.equal(validateCodexPayload(null), null);
  assert.equal(validateCodexPayload({ version: '1.2.0' }), null);
  assert.equal(
    validateCodexPayload({
      version: '1.2.0',
      guidelines: { proteinPerKgStandard: 9.0, rpeTargetDefault: 8, defaultRestSec: 60 },
    }),
    null
  );

  const valid = validateCodexPayload({
    version: '1.1.0',
    updatedAt: '2026-11-18',
    guidelines: {
      proteinPerKgStandard: 1.8,
      proteinPerKgPcos: 1.9,
      mastersLeucineAge: 40,
      mastersProteinMultiplier: 1.1,
      rpeTargetDefault: 8,
      defaultRestSec: 60,
      metabolicRestSec: 45,
      sources: ['ISSN'],
    },
    recipes: [
      {
        name: 'Roasted Chana Sattu Cooler',
        costInr: 18,
        macros: [195, 13, 30, 3],
        ingredients: 'Sattu, lemon',
        steps: 'Mix with chilled water',
        tag: 'Veg',
        allergenTags: ['lentils_beans'],
      },
    ],
  });
  assert.ok(valid);
  assert.equal(valid.version, '1.1.0');
  assert.equal(valid.recipes.length, 1);
});

test('syncClinicalCodex uses remote payload when valid and falls back offline cleanly', async () => {
  const remoteRes = await syncClinicalCodex(async () => ({
    ok: true,
    json: async () => ({
      ...DEFAULT_CLINICAL_CODEX,
      version: '1.2.5',
    }),
  }) as unknown as Response);
  assert.equal(remoteRes.source, 'remote');
  assert.equal(remoteRes.codex.version, '1.2.5');

  const offlineRes = await syncClinicalCodex(async () => {
    throw new Error('Network offline');
  });
  assert.equal(offlineRes.source, 'fallback');
  assert.equal(offlineRes.codex.version, DEFAULT_CLINICAL_CODEX.version);
});

test('Allergy Shield enforces zero-surface exclusion across foods, recipes, combos, text parser, grocery, swaps, and coach', () => {
  const dairyGluten: Array<'dairy_lactose' | 'gluten_wheat'> = ['dairy_lactose', 'gluten_wheat'];
  const safeFoods = getSafeFoods(dairyGluten, FOODS).map((f) => f.name);
  assert.equal(safeFoods.includes('Low-fat paneer (100 g)'), false);
  assert.equal(safeFoods.includes('Curd / dahi (1 cup)'), false);
  assert.equal(safeFoods.includes('Whey scoop'), false);
  assert.equal(safeFoods.includes('Whole wheat roti'), false);
  assert.equal(safeFoods.includes('Oats (40 g)'), false);
  assert.equal(safeFoods.includes('Ragi roti'), true);

  const safeRecipes = getSafeRecipes(RECIPES, dairyGluten, {
    isFemaleOrWomen: false,
    diet: 'Indian High-Protein Veg',
  }).map((r) => r.name);
  assert.equal(safeRecipes.includes('Paneer bhurji'), false);
  assert.equal(safeRecipes.includes('Curd sprout chaat'), false);
  assert.equal(safeRecipes.includes('Palak Ragi & Pumpkin Seed Bowl'), true);

  assert.equal(
    isComboSafe({ n: 'Paneer Combo', items: [['Low-fat paneer (100 g)', 1]] }, dairyGluten, FOODS),
    false
  );
  assert.equal(
    isComboSafe({ n: 'Safe Bowl', items: [['Palak / Spinach sabzi (1 cup)', 1], ['Ragi roti', 2]] }, dairyGluten, FOODS),
    true
  );

  const parsedBlocked = parseMealText('1 paneer + 2 oats + 1 curd', FOODS, dairyGluten);
  assert.equal(parsedBlocked.length, 0);

  const parsedRotiFallback = parseMealText('2 roti', FOODS, dairyGluten);
  assert.equal(parsedRotiFallback.length, 1);
  assert.equal(parsedRotiFallback[0].n, '2× Ragi roti');

  const parsedSafe = parseMealText('2 ragi roti + 1 palak', FOODS, dairyGluten);
  assert.equal(parsedSafe.length, 2);

  const grocery = buildGroceryList('Indian High-Protein Veg', dairyGluten);
  const allGroceryLabels = grocery.categories.flatMap((c) => c.list.map((i) => i[0])).join(' | ');
  assert.doesNotMatch(allGroceryLabels, /Paneer|Curd|Whole Wheat|Rolled Oats/i);
  assert.match(allGroceryLabels, /Millet Flour/i);

  const swaps = getMacroSubstitutions(['dairy_lactose', 'soy'], 40);
  assert.ok(swaps.length >= 2);
  assert.equal(swaps.some((s) => s.food.allergenTags.includes('dairy_lactose') || s.food.allergenTags.includes('soy')), false);

  const state = createDefaultState();
  state.p.allergies = ['dairy_lactose', 'lentils_beans', 'soy', 'eggs'];
  const reply = getCoachReply('What should I eat tonight?', state, '2026-11-18');
  assert.doesNotMatch(reply.text, /Paneer|Curd|Sprouts|Soya|Egg/i);
  assert.ok(reply.suggestedFood);
});

test('getDailyChefRecommendation rotates among safe recipes deterministically by date', () => {
  const safe = getSafeRecipes(RECIPES, ['dairy_lactose'], {
    isFemaleOrWomen: true,
    diet: 'Indian High-Protein Veg',
  });
  const day1 = getDailyChefRecommendation(safe, 500, 25, '2026-11-18');
  const day2 = getDailyChefRecommendation(safe, 500, 25, '2026-11-19');
  assert.ok(day1);
  assert.ok(day2);
  assert.equal(day1.allergenTags.includes('dairy_lactose'), false);
  if (safe.length > 1) {
    assert.notEqual(day1.name, day2.name);
  }
});

test('80/20 Anti-Monotony locks Core Lifts (positions 0 and 1) while rotating accessories (>= 2)', () => {
  const base = createDefaultState().p;
  const prof = { ...base, eq: 'gym' as const, sex: 'm' as const, fstage: 'std' as const };

  const weekBlock = getProgramDayExercises(1, prof, { 1: 0 }, false, 'high_roi_3day', {});
  const refreshed = getProgramDayExercises(1, prof, { 1: 1 }, false, 'high_roi_3day', {});

  assert.equal(weekBlock[0].isInvariantCore, true);
  assert.equal(weekBlock[1].isInvariantCore, true);
  assert.equal(refreshed[0].name, weekBlock[0].name);
  assert.equal(refreshed[1].name, weekBlock[1].name);
  assert.equal(refreshed[2].isInvariantCore, false);
  // At least one accessory/finisher rotates cleanly when alternatives exist
  const accessoriesBefore = weekBlock.slice(2).map((e) => e.id).join(',');
  const accessoriesAfter = refreshed.slice(2).map((e) => e.id).join(',');
  assert.notEqual(accessoriesAfter, accessoriesBefore);

  // Maternal Safety Shield still protects during rotation
  const pregRefreshed = getProgramDayExercises(
    1,
    { ...prof, sex: 'f', fstage: 'preg3' },
    { 1: 1 },
    false,
    'high_roi_3day',
    {}
  );
  assert.equal(pregRefreshed.some((e) => e.id === 'glute_bridge' || e.id === 'front_plank'), false);
});

test('getNextBestMove returns plain-English context-aware action anchors', () => {
  const state = createDefaultState();
  const morning = getNextBestMove(state, '2026-11-18', 8);
  assert.equal(morning.actionType, 'water');

  const eveningUnpaid = getNextBestMove(state, '2026-11-18', 21);
  assert.equal(eveningUnpaid.actionType, 'min_due');
  assert.match(eveningUnpaid.ctaLabel, /Minimum Due/);

  const lunchProteinNeeded = getNextBestMove(
    { ...state, water: { '2026-11-18': 1.5 } },
    '2026-11-18',
    13
  );
  assert.equal(lunchProteinNeeded.actionType, 'nutrition');
});

test('parseMealText handles spoken voice phrases like 2 chapati and dal and spoken numbers', () => {
  const spoken1 = parseMealText('2 chapati and dal');
  assert.equal(spoken1.length, 2);
  assert.equal(spoken1[0].n, '2× Whole wheat roti');
  assert.equal(spoken1[0].k, 208);
  assert.equal(spoken1[1].n, 'Moong dal (1 cup)');
  assert.equal(spoken1[1].p, 14);

  const spoken2 = parseMealText('two chapatis and a bowl of dal');
  assert.equal(spoken2.length, 2);
  assert.equal(spoken2[0].n, '2× Whole wheat roti');
  assert.equal(spoken2[1].n, 'Moong dal (1 cup)');

  const spoken3 = parseMealText('2 eggs and half cup curd');
  assert.equal(spoken3.length, 2);
  assert.equal(spoken3[0].n, '2× Boiled egg');
  assert.equal(spoken3[1].n, '0.5× Curd / dahi (1 cup)');

  const glutenFree = parseMealText('2 chapati and dal', FOODS, ['gluten_wheat']);
  assert.equal(glutenFree.length, 2);
  assert.equal(glutenFree[0].n, '2× Ragi roti');
  assert.equal(glutenFree[1].n, 'Moong dal (1 cup)');
});

test('buildInitialPlanFromQuestionnaire tailors theme, track, safety tier, water, and steps', () => {
  const maternalPlan = buildInitialPlanFromQuestionnaire({
    name: 'Ananya',
    sex: 'f',
    fstage: 'preg2',
    age: 29,
    h: 162,
    w: 66,
    tw: 66,
    act: 1.375,
    eq: 'body',
    diet: 'Indian High-Protein Veg',
    days: 60,
    primaryGoal: 'maternal_care',
    goalStyle: 'holistic',
    medicalHistory: ['pregnancy_postpartum'],
    allergies: ['dairy_lactose'],
  });
  assert.equal(maternalPlan.theme, 'women');
  assert.equal(maternalPlan.scheduleTrack, 'maternal_shield_track');
  assert.equal(maternalPlan.profilePatch.tier, 'joint');
  assert.equal(maternalPlan.dailyWaterLitres, 3.25);
  assert.equal(maternalPlan.dailyStepsTarget, 6000);

  const jointPlan = buildInitialPlanFromQuestionnaire({
    name: 'Rohan',
    sex: 'm',
    fstage: 'std',
    age: 41,
    h: 175,
    w: 88,
    tw: 78,
    act: 1.2,
    eq: 'body',
    diet: 'Eggetarian',
    days: 30,
    primaryGoal: 'energy_mobility',
    goalStyle: 'competitive',
    medicalHistory: ['joint_knee', 'metabolic_diabetes'],
    allergies: [],
  });
  assert.equal(jointPlan.theme, 'clean');
  assert.equal(jointPlan.scheduleTrack, 'joint_safe_beginner');
  assert.equal(jointPlan.profilePatch.tier, 'joint');
  assert.equal(jointPlan.dailyWaterLitres, 3.5);
  assert.equal(jointPlan.dailyStepsTarget, 6500);

  const strengthPlan = buildInitialPlanFromQuestionnaire({
    name: 'Vikram',
    sex: 'm',
    fstage: 'std',
    age: 26,
    h: 178,
    w: 76,
    tw: 75,
    act: 1.55,
    eq: 'gym',
    diet: 'Omnivore',
    days: 90,
    primaryGoal: 'strength',
    goalStyle: 'competitive',
    medicalHistory: [],
    allergies: [],
  });
  assert.equal(strengthPlan.theme, 'rpg');
  assert.equal(strengthPlan.scheduleTrack, 'high_roi_3day');
  assert.equal(strengthPlan.profilePatch.tier, 'hiit');
  assert.equal(strengthPlan.dailyStepsTarget, 8000);
});

test('buildMemberCode and formatShareableSummary include member code, nutrition, and goal', () => {
  const state = createDefaultState();
  state.p.name = 'Aarav';
  state.streak = 5;
  state.water['2026-11-18'] = 2.5;
  const code = buildMemberCode('Aarav');
  assert.match(code, /^SYS-[A-Z0-9]+$/);
  const summary = formatShareableSummary(state, '2026-11-18');
  assert.match(summary, /Aarav/);
  assert.match(summary, new RegExp(code));
  assert.match(summary, /kcal/);
  assert.match(summary, /2\.50L water/);
});

test('First 3 Questions preferredThemeMode chooses Universal Clean vs Women Wellness reliably while keeping maternal safety', () => {
  const autoCleanWoman = buildInitialPlanFromQuestionnaire({
    name: 'Meera',
    sex: 'f',
    fstage: 'std',
    age: 27,
    h: 165,
    w: 60,
    tw: 58,
    act: 1.55,
    eq: 'dumb',
    diet: 'Eggetarian',
    days: 30,
    primaryGoal: 'strength',
    goalStyle: 'balanced',
    preferredThemeMode: 'auto',
    medicalHistory: [],
    allergies: [],
  });
  assert.equal(autoCleanWoman.theme, 'clean');

  const explicitWomen = buildInitialPlanFromQuestionnaire({
    name: 'Meera',
    sex: 'f',
    fstage: 'std',
    age: 27,
    h: 165,
    w: 60,
    tw: 58,
    act: 1.55,
    eq: 'dumb',
    diet: 'Eggetarian',
    days: 30,
    primaryGoal: 'strength',
    goalStyle: 'balanced',
    preferredThemeMode: 'women',
    medicalHistory: [],
    allergies: [],
  });
  assert.equal(explicitWomen.theme, 'women');

  const maternalCleanOverride = recommendThemeFromProfile({
    sex: 'f',
    fstage: 'preg2',
    medicalHistory: ['pregnancy_postpartum'],
    preferredThemeMode: 'clean',
  });
  assert.equal(maternalCleanOverride.theme, 'clean');
  assert.equal(maternalCleanOverride.recommendedTier, 'joint');
});

test('getCyclePhaseInsight and getExerciseExecutionCues provide stage and posture guidance', () => {
  const base = createDefaultState().p;
  const luteal = getCyclePhaseInsight(20, { ...base, sex: 'f', fstage: 'std' });
  assert.equal(luteal.cycleDay, 20);
  assert.match(luteal.phaseLabel, /Luteal/);
  assert.match(luteal.nutrientFocus, /Magnesium/);

  const pcos = getCyclePhaseInsight(4, { ...base, sex: 'f', fstage: 'pcos' });
  assert.match(pcos.phaseLabel, /PCOS Support/);

  const squatGuide = getExerciseExecutionCues('Goblet Squat', { ...base, tier: 'joint' });
  assert.equal(squatGuide.steps.length, 3);
  assert.match(squatGuide.postureCue, /pain-free/);

  const holdGuide = getExerciseExecutionCues('Forearm Plank (sec)', { ...base, fstage: 'preg2', sex: 'f' });
  assert.equal(holdGuide.steps.length, 3);
  assert.match(holdGuide.cadence, /nasal breath/);
  assert.match(holdGuide.postureCue, /never hold your breath/);
});

import { evaluateDailyRollover } from './quests';
import {
  applyWatchActionToState,
  getNextActiveSetTarget,
  parseWearableHealthPayload,
} from './watchSync';

test('evaluateDailyRollover auto-consumes Streak Freeze tokens for unexcused missed days while respecting calendar tags', () => {
  const base = createDefaultState();
  const state = {
    ...base,
    streak: 5,
    freeze: 1,
    last: '2026-11-15',
    streakAwardedDays: { '2026-11-15': 'full' as const },
    cal: { '2026-11-16': 't' as const }, // Travel day excused
  };

  // Missing Nov 17 should consume 1 freeze token and keep streak = 5
  const r1 = evaluateDailyRollover(state, '2026-11-18');
  assert.equal(r1.freezesUsed, 1);
  assert.equal(r1.nextState.freeze, 0);
  assert.equal(r1.nextState.streak, 5);
  assert.equal(r1.nextState.last, '2026-11-18');

  // Missing another day with 0 freeze resets streak to 0
  const r2 = evaluateDailyRollover(r1.nextState, '2026-11-20');
  assert.equal(r2.streakReset, true);
  assert.equal(r2.nextState.streak, 0);
});

test('Watch Sync 1-tap actions complete sets, log water/combos, toggle Min Due, and parse health exports', () => {
  const dateStr = '2026-11-18';
  let state = createDefaultState();
  state.start = dateStr;
  state.xp = 0;

  const targetBefore = getNextActiveSetTarget(state, dateStr);
  assert.equal(targetBefore.setNumber, 1);
  assert.equal(targetBefore.doneSetsToday, 0);

  // 1-tap complete set from watch
  const setRes = applyWatchActionToState(
    state,
    { id: 'w1', type: 'complete_set', ts: Date.now() },
    dateStr
  );
  state = setRes.nextState;
  assert.ok((setRes.restSecondsToStart || 0) > 0);
  const targetAfter = getNextActiveSetTarget(state, dateStr);
  assert.equal(targetAfter.doneSetsToday, 1);

  // 1-tap +0.5L water from watch
  const waterRes = applyWatchActionToState(
    state,
    { id: 'w2', type: 'log_water', amount: 0.5, ts: Date.now() },
    dateStr
  );
  state = waterRes.nextState;
  assert.equal(state.water[dateStr], 0.5);

  // 1-tap toggle Minimum Due + complete bonus
  const minRes = applyWatchActionToState(
    state,
    { id: 'w3', type: 'toggle_min_due', ts: Date.now() },
    dateStr
  );
  state = minRes.nextState;
  assert.equal(state.minimumDueDays[dateStr], true);

  // Parse JSON and CSV wearable exports
  const jsonParsed = parseWearableHealthPayload('{"steps":9540,"sleepHours":7.7,"hrvMs":72,"rhrBpm":54}');
  assert.ok(jsonParsed);
  assert.equal(jsonParsed.steps, 9540);
  assert.equal(jsonParsed.sleepHours, 7.7);
  assert.equal(jsonParsed.hrvMs, 72);

  const csvParsed = parseWearableHealthPayload('steps,sleep,hrv,rhr\n8820,8.1,68,56');
  assert.ok(csvParsed);
  assert.equal(csvParsed.steps, 8820);
  assert.equal(csvParsed.rhrBpm, 56);
});


