import type { AppState, LoggedFood, UserProfile } from '../types/system';
import { calculateMacros, isFemaleProfile, isMaternalProfile, sumDailyMacros } from './metabolic';

export interface CircadianWindowInfo {
  windowLabel: string;
  phase: string;
  guidance: string;
  optimalLoad: string;
}

export function getCircadianWindow(hourOverride?: number): CircadianWindowInfo {
  const hour = typeof hourOverride === 'number' ? hourOverride : new Date().getHours();
  if (hour >= 6 && hour < 11) {
    return {
      windowLabel: '8:14 AM Cortisol Peak Window',
      phase: 'Diurnal Peak · Neuromuscular Drive',
      guidance: 'Elevated morning cortisol and alertness support heavy compound lifts and skill acquisition.',
      optimalLoad: 'Compound Strength',
    };
  }
  if (hour >= 11 && hour < 15) {
    return {
      windowLabel: '12:30 PM Metabolic Window',
      phase: 'Midday Steady State',
      guidance: 'Optimal glucose clearance window for aerobic conditioning, walking intervals, and posture breaks.',
      optimalLoad: 'Aerobic & Mobility',
    };
  }
  if (hour >= 15 && hour < 19) {
    return {
      windowLabel: '4:45 PM Core Temp Peak',
      phase: 'Peak Power & Reaction Velocity',
      guidance: 'Core body temperature peaks late afternoon, maximizing joint elasticity and peak force output.',
      optimalLoad: 'Peak Force & Hypertrophy',
    };
  }
  return {
    windowLabel: '8:14 AM Cortisol Peak Window (Next)',
    phase: 'Evening Parasympathetic Shift',
    guidance: 'Melatonin onset begins; prioritize low-arousal mobility, breathing, and overnight tissue repair.',
    optimalLoad: 'Active Recovery',
  };
}

export interface AutonomicReadinessInfo {
  hrvMs: number;
  rhrBpm: number;
  readinessPct: number;
  statusLabel: string;
  protocolLabel: string;
  isReadyForLoad: boolean;
}

export function getAutonomicReadiness(
  state: AppState,
  dateStr: string,
  bleBpm = 0
): AutonomicReadinessInfo {
  const watch = state.watch || { steps: 0, sleep: 0 };
  const sleep = Math.max(0, Number(watch.sleep || 0));
  const water = Number(state.water[dateStr] || 0);
  const isMinDue = Boolean(state.minimumDueDays?.[dateStr]);

  // Sleep & hydration drive baseline RMSSD and resting heart rate unless explicitly synced
  const sleepDelta = sleep - 7.0;
  const hydrationBonus = Math.min(1, water / 2.5) * 6;
  const computedHrv = Math.round(Math.max(36, Math.min(98, 66 + sleepDelta * 7.5 + hydrationBonus - (isMinDue ? 4 : 0))));
  const computedRhr = Math.round(Math.max(46, Math.min(78, 57 - sleepDelta * 2.2 - (water >= 2 ? 1 : 0))));

  const hrvMs = typeof watch.hrvMs === 'number' && watch.hrvMs > 0 ? Math.round(watch.hrvMs) : computedHrv;
  const rhrBpm =
    bleBpm > 35 && bleBpm < 110
      ? Math.round(bleBpm)
      : typeof watch.rhrBpm === 'number' && watch.rhrBpm > 0
        ? Math.round(watch.rhrBpm)
        : computedRhr;

  const hrvScore = Math.max(0, Math.min(55, ((hrvMs - 35) / 50) * 55));
  const sleepScore = Math.max(0, Math.min(30, (sleep / 8.0) * 30));
  const rhrScore = Math.max(0, Math.min(15, ((75 - rhrBpm) / 25) * 15));
  const readinessPct = Math.round(Math.max(25, Math.min(100, hrvScore + sleepScore + rhrScore)));

  if (readinessPct >= 80) {
    return {
      hrvMs,
      rhrBpm,
      readinessPct,
      statusLabel: 'Vagal Dominant · Ready for Load',
      protocolLabel: 'Cleared for full compound progression',
      isReadyForLoad: true,
    };
  }
  if (readinessPct >= 62) {
    return {
      hrvMs,
      rhrBpm,
      readinessPct,
      statusLabel: 'Balanced Tone · Standard Load',
      protocolLabel: 'Maintain target RPE 7–8 volume',
      isReadyForLoad: true,
    };
  }
  return {
    hrvMs,
    rhrBpm,
    readinessPct,
    statusLabel: 'Sympathetic Strain · Recovery Advised',
    protocolLabel: 'Use Minimum Due or gentle mobility protocol',
    isReadyForLoad: false,
  };
}

export interface MicronutrientProfile {
  ironMg: number;
  ironTargetMg: number;
  ironPct: number;
  magnesiumMg: number;
  magnesiumTargetMg: number;
  magnesiumPct: number;
  folateMcg: number;
  folateTargetMcg: number;
  folatePct: number;
}

const FOOD_MICROS: Array<{ match: RegExp; iron: number; mag: number; folate: number }> = [
  { match: /palak|spinach/i, iron: 3.6, mag: 78, folate: 130 },
  { match: /moong|dal|rajma|chole/i, iron: 2.8, mag: 68, folate: 110 },
  { match: /soya/i, iron: 3.1, mag: 65, folate: 55 },
  { match: /sprout/i, iron: 1.9, mag: 42, folate: 75 },
  { match: /ragi/i, iron: 2.2, mag: 48, folate: 22 },
  { match: /roti|chilla|oats|poha|upma|rice|idli|dosa/i, iron: 1.1, mag: 32, folate: 20 },
  { match: /egg/i, iron: 0.9, mag: 6, folate: 24 },
  { match: /paneer|tofu|curd|dahi|milk|whey/i, iron: 0.6, mag: 28, folate: 16 },
  { match: /almond|peanut/i, iron: 1.2, mag: 72, folate: 28 },
  { match: /chicken/i, iron: 1.1, mag: 29, folate: 6 },
  { match: /banana/i, iron: 0.3, mag: 32, folate: 24 },
];

export function computeMicronutrients(
  loggedFoods: LoggedFood[],
  profile: UserProfile
): MicronutrientProfile {
  const female = isFemaleProfile(profile);
  const maternal = isMaternalProfile(profile);

  const ironTargetMg = maternal ? 27 : female ? 18 : 10;
  const magnesiumTargetMg = female ? 320 : 400;
  const folateTargetMcg = maternal ? 600 : 400;

  let ironMg = 0;
  let magnesiumMg = 0;
  let folateMcg = 0;

  loggedFoods.forEach((item) => {
    const q = Math.max(0.5, Number(item.q) || 1);
    const matches = FOOD_MICROS.filter((rule) => rule.match.test(item.n));
    if (matches.length > 0) {
      matches.forEach((m) => {
        ironMg += m.iron * q;
        magnesiumMg += m.mag * q;
        folateMcg += m.folate * q;
      });
    } else {
      // Conservative estimate scaled by calories for custom foods
      const scale = (item.k || 150) / 200;
      ironMg += 0.9 * scale;
      magnesiumMg += 24 * scale;
      folateMcg += 18 * scale;
    }
  });

  ironMg = +ironMg.toFixed(1);
  magnesiumMg = Math.round(magnesiumMg);
  folateMcg = Math.round(folateMcg);

  return {
    ironMg,
    ironTargetMg,
    ironPct: Math.min(100, Math.round((ironMg / ironTargetMg) * 100)),
    magnesiumMg,
    magnesiumTargetMg,
    magnesiumPct: Math.min(100, Math.round((magnesiumMg / magnesiumTargetMg) * 100)),
    folateMcg,
    folateTargetMcg,
    folatePct: Math.min(100, Math.round((folateMcg / folateTargetMcg) * 100)),
  };
}

export interface KineticAndSleepMetrics {
  totalSteps: number;
  wearableSteps: number;
  coprocessorSteps: number;
  cadenceSpm: number;
  sensorSource: string;
  sleepHours: number;
  formattedSleep: string;
  deepMins: number;
  remMins: number;
  lightMins: number;
  deepPct: number;
  remPct: number;
  lightPct: number;
  repairStatus: string;
}

export function getKineticAndSleepMetrics(
  watch: AppState['watch'],
  bleDeviceName?: string | null
): KineticAndSleepMetrics {
  const totalSteps = Math.max(0, Math.round(watch?.steps || 0));
  const wearableSteps = Math.round(totalSteps * 0.72);
  const coprocessorSteps = Math.max(0, totalSteps - wearableSteps);
  const cadenceSpm = totalSteps >= 8000 ? 114 : totalSteps >= 4000 ? 104 : totalSteps > 0 ? 92 : 0;

  const sleepHours = Math.max(0, Number(watch?.sleep || 0));
  const totalMins = Math.round(sleepHours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const formattedSleep = `${h}h ${String(m).padStart(2, '0')}m`;

  const deepPct = sleepHours >= 7 ? 22 : 18;
  const remPct = sleepHours >= 7 ? 24 : 20;
  const lightPct = 100 - deepPct - remPct;

  const deepMins = Math.round((totalMins * deepPct) / 100);
  const remMins = Math.round((totalMins * remPct) / 100);
  const lightMins = Math.max(0, totalMins - deepMins - remMins);

  const repairStatus =
    sleepHours >= 7.5
      ? 'Optimal Tissue Repair'
      : sleepHours >= 6.5
        ? 'Low Allostatic Strain'
        : 'Elevated Sleep Debt';

  return {
    totalSteps,
    wearableSteps,
    coprocessorSteps,
    cadenceSpm,
    sensorSource: bleDeviceName ? `${bleDeviceName} + Coprocessor` : 'Wearable + Coprocessor',
    sleepHours,
    formattedSleep,
    deepMins,
    remMins,
    lightMins,
    deepPct,
    remPct,
    lightPct,
    repairStatus,
  };
}

export function getMacroPercentages(state: AppState, dateStr: string) {
  const targets = calculateMacros(state.p);
  const totals = sumDailyMacros(state.log[dateStr] || []);
  return {
    targets,
    totals,
    kcalPct: Math.min(100, Math.round((totals.k / Math.max(1, targets.t)) * 100)),
    protPct: Math.min(100, Math.round((totals.p / Math.max(1, targets.pr)) * 100)),
    carbPct: Math.min(100, Math.round((totals.c / Math.max(1, targets.c)) * 100)),
    fatPct: Math.min(100, Math.round((totals.f / Math.max(1, targets.f)) * 100)),
  };
}
