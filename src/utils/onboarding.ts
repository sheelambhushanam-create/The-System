import { PEERS } from '../data/foods';
import type {
  AllergyTag,
  AppState,
  EquipmentType,
  FemaleStage,
  MedicalHistoryTag,
  MobilityTier,
  OnboardingGoalStyle,
  PrimaryGoal,
  ScheduleTrackId,
  Sex,
  ThemeMode,
  UserProfile,
} from '../types/system';
import {
  calculateMacros,
  getFemaleStageLabel,
  getLevelInfo,
  getProgramDayNumber,
  getRank,
  isMaternalProfile,
} from './metabolic';

export const MEDICAL_HISTORY_OPTIONS: Array<{
  id: MedicalHistoryTag;
  label: string;
  detail: string;
}> = [
  {
    id: 'pcos_hormonal',
    label: 'PCOS / Hormone Support',
    detail: 'Focuses on steady blood sugar meals and gentle workouts.',
  },
  {
    id: 'pregnancy_postpartum',
    label: 'Pregnancy / New Mom',
    detail: 'Turns on safety checks and swaps unsafe moves automatically.',
  },
  {
    id: 'joint_knee',
    label: 'Knee / Joint Pain',
    detail: 'Swaps heavy jumps and deep squats for joint-friendly moves.',
  },
  {
    id: 'cardiac_bp',
    label: 'Blood Pressure / Heart Care',
    detail: 'Focuses on steady walking, breathing, and comfortable pacing.',
  },
  {
    id: 'metabolic_diabetes',
    label: 'Blood Sugar / Diabetes Care',
    detail: 'Highlights post-meal walks, fiber, and balanced protein.',
  },
];

export interface ThemeRecommendationInput {
  sex: Sex;
  fstage?: FemaleStage;
  medicalHistory?: MedicalHistoryTag[];
  goalStyle?: OnboardingGoalStyle;
  tier?: MobilityTier;
  primaryGoal?: PrimaryGoal;
  preferredThemeMode?: 'auto' | ThemeMode;
}

export interface ThemeRecommendation {
  theme: ThemeMode;
  reason: string;
  recommendedTier?: MobilityTier;
  recommendedFstage?: FemaleStage;
}

export function recommendThemeFromProfile(input: ThemeRecommendationInput): ThemeRecommendation {
  const history = input.medicalHistory || [];
  const isPregOrPost =
    history.includes('pregnancy_postpartum') ||
    Boolean(input.sex === 'f' && input.fstage && ['preg1', 'preg2', 'preg3', 'post'].includes(input.fstage));
  const isPcosOrHormonal =
    history.includes('pcos_hormonal') || Boolean(input.sex === 'f' && input.fstage === 'pcos');

  if (input.preferredThemeMode && input.preferredThemeMode !== 'auto') {
    if (input.preferredThemeMode === 'women') {
      return {
        theme: 'women',
        reason: isPregOrPost
          ? 'Women’s Wellness mode active with pregnancy & postpartum movement safeguards.'
          : 'Women’s Wellness mode active with cycle-aligned pacing, iron/folate tracking, and calm recovery.',
        recommendedTier: isPregOrPost ? 'joint' : input.tier,
        recommendedFstage: isPregOrPost
          ? input.fstage && input.fstage !== 'std'
            ? input.fstage
            : 'preg1'
          : isPcosOrHormonal
            ? 'pcos'
            : input.fstage,
      };
    }
    if (input.preferredThemeMode === 'clean') {
      return {
        theme: 'clean',
        reason:
          'Universal Clean (Vitality) mode active with guided execution cues, readiness telemetry, and zero clutter.',
        recommendedTier:
          isPregOrPost || history.includes('joint_knee') ? 'joint' : input.tier,
        recommendedFstage: isPregOrPost
          ? input.fstage && input.fstage !== 'std'
            ? input.fstage
            : 'preg1'
          : isPcosOrHormonal
            ? 'pcos'
            : input.fstage,
      };
    }
    return {
      theme: 'rpg',
      reason: 'Game Mode (RPG) active for XP levels, ranks, and daily challenges.',
      recommendedTier: isPregOrPost ? 'joint' : input.tier,
    };
  }

  if (isPregOrPost) {
    return {
      theme: 'women',
      reason: 'Women’s Wellness mode chosen to keep pregnancy & postpartum workouts gentle and safe.',
      recommendedTier: 'joint',
      recommendedFstage:
        input.fstage && input.fstage !== 'std' ? input.fstage : 'preg1',
    };
  }

  if (isPcosOrHormonal) {
    return {
      theme: 'women',
      reason: 'Women’s Wellness mode chosen for cycle & hormone-friendly daily goals.',
      recommendedFstage: 'pcos',
    };
  }

  if (input.sex === 'f' && (input.goalStyle === 'holistic' || input.primaryGoal === 'maternal_care')) {
    return {
      theme: 'women',
      reason: 'Women’s Wellness mode chosen for cycle-aligned habits, iron & folate focus, and calm pacing.',
    };
  }

  if (
    history.includes('joint_knee') ||
    history.includes('cardiac_bp') ||
    history.includes('metabolic_diabetes')
  ) {
    return {
      theme: 'clean',
      reason:
        'Universal Clean (Vitality) mode chosen for clear health telemetry and joint-friendly pacing.',
      recommendedTier: history.includes('joint_knee') ? 'joint' : input.tier,
    };
  }

  if (input.goalStyle === 'competitive' || input.tier === 'hiit') {
    return {
      theme: 'rpg',
      reason: 'Game Mode (RPG) chosen for XP levels, ranks, and daily challenges.',
    };
  }

  return {
    theme: 'clean',
    reason: 'Universal Clean (Vitality) mode chosen for structured daily execution cues, macros, and biometrics.',
  };
}

export interface QuestionnaireInput {
  name: string;
  sex: Sex;
  fstage?: FemaleStage;
  age: number;
  h: number;
  w: number;
  tw: number;
  act: number;
  eq: EquipmentType;
  diet: string;
  days: number;
  primaryGoal: PrimaryGoal;
  goalStyle: OnboardingGoalStyle;
  preferredThemeMode?: 'auto' | ThemeMode;
  medicalHistory: MedicalHistoryTag[];
  medicalNotes?: string;
  medicalDeferred?: boolean;
  allergies: AllergyTag[];
}

export interface CalibratedPlanOutput {
  theme: ThemeMode;
  reason: string;
  profilePatch: Partial<UserProfile>;
  scheduleTrack: ScheduleTrackId;
  dailyWaterLitres: number;
  dailyStepsTarget: number;
  trackLabel: string;
}

export function buildInitialPlanFromQuestionnaire(input: QuestionnaireInput): CalibratedPlanOutput {
  const baseRec = recommendThemeFromProfile({
    sex: input.sex,
    fstage: input.fstage,
    medicalHistory: input.medicalHistory,
    goalStyle: input.goalStyle,
    primaryGoal: input.primaryGoal,
    preferredThemeMode: input.preferredThemeMode,
    tier: input.primaryGoal === 'strength' ? 'bal' : input.primaryGoal === 'energy_mobility' ? 'joint' : 'bal',
  });

  const isMaternal =
    input.medicalHistory.includes('pregnancy_postpartum') ||
    (input.sex === 'f' && Boolean(input.fstage && ['preg1', 'preg2', 'preg3', 'post'].includes(input.fstage)));

  const hasJointOrCardiac =
    input.medicalHistory.includes('joint_knee') || input.medicalHistory.includes('cardiac_bp');

  let tier: MobilityTier = baseRec.recommendedTier || 'bal';
  if (!baseRec.recommendedTier) {
    if (hasJointOrCardiac || input.primaryGoal === 'energy_mobility') {
      tier = 'joint';
    } else if (input.goalStyle === 'competitive' && input.primaryGoal === 'strength') {
      tier = 'hiit';
    } else {
      tier = 'bal';
    }
  }

  let scheduleTrack: ScheduleTrackId = 'adaptive';
  let trackLabel = 'Smart Daily Plan';
  if (isMaternal) {
    scheduleTrack = 'maternal_shield_track';
    trackLabel = 'Pregnancy & Postpartum Safe Track';
  } else if (hasJointOrCardiac) {
    scheduleTrack = 'joint_safe_beginner';
    trackLabel = 'Gentle & Joint-Friendly Track';
  } else if (input.primaryGoal === 'strength') {
    scheduleTrack = 'high_roi_3day';
    trackLabel = '3-Day Progressive Strength (35 min)';
  } else if (input.primaryGoal === 'energy_mobility' && input.act <= 1.25) {
    scheduleTrack = 'desk_worker_express';
    trackLabel = '10-Min Desk Mobility & Recovery';
  }

  const fstage: FemaleStage =
    input.sex === 'm'
      ? 'std'
      : baseRec.recommendedFstage || input.fstage || (input.primaryGoal === 'maternal_care' ? 'pcos' : 'std');

  const theme: ThemeMode =
    input.preferredThemeMode && input.preferredThemeMode !== 'auto'
      ? baseRec.theme
      : input.sex === 'f' && input.primaryGoal === 'maternal_care' && baseRec.theme === 'clean'
        ? 'women'
        : baseRec.theme;

  const dailyWaterLitres = isMaternal ? 3.25 : input.w >= 85 ? 3.5 : 3.0;
  const dailyStepsTarget = isMaternal ? 6000 : input.medicalHistory.includes('joint_knee') ? 6500 : 8000;

  return {
    theme,
    reason: baseRec.reason,
    scheduleTrack,
    trackLabel,
    dailyWaterLitres,
    dailyStepsTarget,
    profilePatch: {
      name: input.name.trim() || 'Member',
      sex: input.sex,
      fstage,
      age: Math.max(14, Math.min(95, Number(input.age) || 28)),
      h: Math.max(120, Math.min(220, Number(input.h) || 170)),
      w: Math.max(35, Math.min(220, Number(input.w) || 70)),
      tw: Math.max(35, Math.min(220, Number(input.tw) || 65)),
      act: Number(input.act) || 1.375,
      eq: input.eq,
      diet: input.diet,
      days: Math.max(7, Number(input.days) || 30),
      tier,
      primaryGoal: input.primaryGoal,
      goalStyle: input.goalStyle,
      medicalHistory: input.medicalHistory,
      medicalNotes: (input.medicalNotes || '').trim(),
      medicalDeferred: Boolean(input.medicalDeferred),
      allergies: input.allergies,
    },
  };
}

export interface DemoPersona {
  id: string;
  label: string;
  subtitle: string;
  email: string;
  input: QuestionnaireInput;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'aarav',
    label: 'Aarav · Lean Strength',
    subtitle: 'Clean telemetry · 30-day fat loss & strength',
    email: 'aarav.demo@thesystem.app',
    input: {
      name: 'Aarav',
      sex: 'm',
      fstage: 'std',
      age: 28,
      h: 174,
      w: 80,
      tw: 72,
      act: 1.375,
      eq: 'dumb',
      diet: 'Indian High-Protein Veg',
      days: 30,
      primaryGoal: 'fat_loss',
      goalStyle: 'balanced',
      medicalHistory: [],
      allergies: [],
    },
  },
  {
    id: 'ananya',
    label: 'Ananya · Women’s Wellness',
    subtitle: 'PCOS & cycle-aligned nutrition & gentle strength',
    email: 'ananya.demo@thesystem.app',
    input: {
      name: 'Ananya',
      sex: 'f',
      fstage: 'pcos',
      age: 29,
      h: 162,
      w: 66,
      tw: 60,
      act: 1.375,
      eq: 'body',
      diet: 'Indian High-Protein Veg',
      days: 60,
      primaryGoal: 'maternal_care',
      goalStyle: 'holistic',
      medicalHistory: ['pcos_hormonal'],
      allergies: [],
    },
  },
  {
    id: 'rohan',
    label: 'Rohan · Desk & Joint Care',
    subtitle: 'Knee-safe mobility & blood sugar stability',
    email: 'rohan.demo@thesystem.app',
    input: {
      name: 'Rohan',
      sex: 'm',
      fstage: 'std',
      age: 39,
      h: 176,
      w: 86,
      tw: 78,
      act: 1.2,
      eq: 'body',
      diet: 'Eggetarian',
      days: 30,
      primaryGoal: 'energy_mobility',
      goalStyle: 'balanced',
      medicalHistory: ['joint_knee', 'metabolic_diabetes'],
      allergies: ['dairy_lactose'],
    },
  },
  {
    id: 'vanguard',
    label: 'Vikram · Game Mode (RPG)',
    subtitle: 'XP levels, ranks & progressive gym training',
    email: 'vikram.demo@thesystem.app',
    input: {
      name: 'Vikram',
      sex: 'm',
      fstage: 'std',
      age: 25,
      h: 178,
      w: 76,
      tw: 74,
      act: 1.55,
      eq: 'gym',
      diet: 'Omnivore',
      days: 90,
      primaryGoal: 'strength',
      goalStyle: 'competitive',
      medicalHistory: [],
      allergies: [],
    },
  },
];

export function buildMemberCode(name: string): string {
  return `SYS-${Array.from(name || 'Member')
    .reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
    .toString(36)
    .toUpperCase()}`;
}

export function formatShareableSummary(state: AppState, dateStr: string): string {
  const c = calculateMacros(state.p);
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const endDt = new Date(`${dateStr}T00:00:00Z`);
  endDt.setUTCDate(endDt.getUTCDate() + Math.max(1, state.p.days - dayNum + 1));
  const endLabel = endDt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const level = getLevelInfo(state.xp).l;
  const rank = getRank(level);
  const waterToday = Number(state.water[dateStr] || 0).toFixed(2);
  const eqLabel =
    state.p.eq === 'body'
      ? 'Bodyweight'
      : state.p.eq === 'dumb'
        ? 'Dumbbells / Bands'
        : state.p.eq === 'gym'
          ? 'Full Gym'
          : 'Traditional / Flow';

  const trackLabels: Record<ScheduleTrackId, string> = {
    adaptive: 'Smart Daily Plan',
    high_roi_3day: '3-Day Strength Plan',
    joint_safe_beginner: 'Gentle & Joint-Friendly',
    maternal_shield_track: 'Pregnancy & Postpartum Safe',
    desk_worker_express: '10-Min Quick Desk Break',
  };
  const trackLabel = trackLabels[state.scheduleTrack] || 'Smart Daily Plan';

  return [
    `The System — Wellness & Plan Summary for ${state.p.name}`,
    `• Day ${dayNum} of ${state.p.days} · ${state.streak}-Day Streak · Member ${buildMemberCode(state.p.name)}`,
    `• Daily Nutrition Target: ${c.t} kcal | ${c.pr}g Protein | ${c.c}g Carbs | ${c.f}g Fat (${state.p.diet})`,
    `• Training Setup: ${eqLabel} · Track: ${trackLabel}`,
    `• Today's Activity: ${state.watch.steps.toLocaleString()} steps · ${state.watch.sleep}h sleep · ${waterToday}L water`,
    `• Target Goal: ${isMaternalProfile(state.p) ? getFemaleStageLabel(state.p) : `${state.p.tw} kg`} by ${endLabel}`,
    `• Progress: Level ${level} (Rank ${rank})`,
  ].join('\n');
}

export function resolveAuthorStreak(
  authorName: string,
  state: AppState,
  options?: { isCurrentUser?: boolean; fallbackStreak?: number }
): number {
  const normalized = authorName.trim();
  const isMe =
    Boolean(options?.isCurrentUser) ||
    normalized === state.p.name ||
    normalized === `${state.p.name} (You)`;

  if (isMe) {
    return Math.max(0, state.streak || 0);
  }

  if (state.userStreaks && typeof state.userStreaks[normalized] === 'number') {
    return Math.max(0, state.userStreaks[normalized]);
  }

  const peer = PEERS.find((p) => p.name === normalized);
  if (peer) return peer.streak;

  if (typeof options?.fallbackStreak === 'number') {
    return Math.max(0, options.fallbackStreak);
  }

  return 1;
}

export function buildInitialUserStreaks(userName: string, userStreak: number): Record<string, number> {
  const map: Record<string, number> = {};
  PEERS.forEach((peer) => {
    map[peer.name] = peer.streak;
  });
  if (userName.trim()) {
    map[userName.trim()] = userStreak;
  }
  map['Anonymous Member'] = userStreak;
  return map;
}
