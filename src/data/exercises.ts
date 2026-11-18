import type {
  EquipmentType,
  FemaleStage,
  MobilityTier,
  Sex,
  WorkoutExerciseConfig,
} from '../types/system';

export type ExerciseEntry = [name: string, sets: number, reps: number, baseKg: number, bwRatio: number];

export type ClinicalStage =
  | 'standard'
  | 'pcos'
  | 'pregnancy_t1'
  | 'pregnancy_t2'
  | 'pregnancy_t3'
  | 'postpartum';

export function mapFemaleStageToClinical(sex: Sex, fstage?: FemaleStage): ClinicalStage {
  if (sex !== 'f') return 'standard';
  if (fstage === 'pcos') return 'pcos';
  if (fstage === 'preg1') return 'pregnancy_t1';
  if (fstage === 'preg2') return 'pregnancy_t2';
  if (fstage === 'preg3') return 'pregnancy_t3';
  if (fstage === 'post') return 'postpartum';
  return 'standard';
}

export const WORKOUT_CONFIG: {
  engine: {
    femaleStrengthRatio: number;
    microProgressionKg: number;
    defaultRestSec: number;
    metabolicRestSec: number;
    rpeTargetDefault: number;
    proteinLeucineAgeThreshold: number;
  };
  exercises: Record<string, WorkoutExerciseConfig>;
  schedules: {
    high_roi_3day: Record<string, string[]>;
    joint_safe_beginner: Record<string, string[]>;
    maternal_shield_track: Record<string, string[]>;
    desk_worker_express: Record<string, string[]>;
  };
  getSafeExercises: (
    stage?: ClinicalStage,
    equipmentTier?: EquipmentType,
    isJointPain?: boolean
  ) => WorkoutExerciseConfig[];
  getRecommendedWeight: (
    exerciseId: string,
    user: {
      sex: Sex;
      currentWeightKg?: number;
      prHistory?: Record<string, { weightKg: number; reps: number }>;
    }
  ) => number;
  shuffleExercise: (
    currentExerciseId: string,
    equipmentTier?: EquipmentType,
    stage?: ClinicalStage,
    isJointPain?: boolean,
    excludeIds?: string[]
  ) => string;
  getRotatedWorkout: (
    dayExerciseIds: string[],
    equipmentTier?: EquipmentType,
    stage?: ClinicalStage,
    isJointPain?: boolean,
    rotationSeed?: number
  ) => string[];
} = {
  engine: {
    femaleStrengthRatio: 0.72,
    microProgressionKg: 2.5,
    defaultRestSec: 60,
    metabolicRestSec: 45,
    rpeTargetDefault: 8,
    proteinLeucineAgeThreshold: 40,
  },
  exercises: {
    squat_goblet: {
      id: 'squat_goblet',
      name: 'Goblet Squat / Leg Press',
      category: 'lower_push',
      equipment: ['gym', 'dumb', 'desi'],
      baseWeightKg: 12.5,
      targetReps: 12,
      targetSets: 3,
      rpe: 8,
      xpType: 'STR',
      contraindications: ['pregnancy_t3', 'acute_knee_pain'],
      jointSafeAlternative: 'chair_squat',
      tags: ['compound', 'high_roi', 'foundation_a'],
    },
    chair_squat: {
      id: 'chair_squat',
      name: 'Box / Chair Squat',
      category: 'lower_push',
      equipment: ['body', 'dumb', 'desi', 'gym'],
      baseWeightKg: 0,
      targetReps: 15,
      targetSets: 3,
      rpe: 7,
      xpType: 'STR',
      contraindications: [],
      tags: ['joint_safe', 'beginner', 'postpartum_ready'],
    },
    reverse_lunge: {
      id: 'reverse_lunge',
      name: 'Controlled Reverse Lunge',
      category: 'lower_push',
      equipment: ['body', 'dumb', 'desi', 'gym'],
      baseWeightKg: 8.0,
      targetReps: 10,
      targetSets: 3,
      rpe: 8,
      xpType: 'STR',
      contraindications: ['acute_knee_pain'],
      jointSafeAlternative: 'chair_squat',
      tags: ['unilateral', 'compound'],
    },
    wall_sit: {
      id: 'wall_sit',
      name: 'Supported Wall Sit (sec)',
      category: 'isometric_lower',
      equipment: ['body', 'dumb', 'desi', 'gym'],
      baseWeightKg: 0,
      targetReps: 45,
      targetSets: 3,
      rpe: 7,
      xpType: 'VIT',
      contraindications: [],
      tags: ['joint_safe', 'maternal_safe', 'pcos_friendly'],
      isTimedSec: true,
    },
    glute_bridge: {
      id: 'glute_bridge',
      name: 'Floor Glute Bridge',
      category: 'lower_hinge',
      equipment: ['body', 'dumb', 'desi', 'gym'],
      baseWeightKg: 0,
      targetReps: 15,
      targetSets: 3,
      rpe: 7,
      xpType: 'STR',
      contraindications: ['pregnancy_t2', 'pregnancy_t3'],
      jointSafeAlternative: 'supported_hip_thrust',
      tags: ['joint_safe', 'foundation_b', 'pelvic_stability'],
    },
    supported_hip_thrust: {
      id: 'supported_hip_thrust',
      name: 'Elevated Supported Hip Thrust',
      category: 'lower_hinge',
      equipment: ['body', 'dumb', 'desi', 'gym'],
      baseWeightKg: 0,
      targetReps: 12,
      targetSets: 3,
      rpe: 6,
      xpType: 'STR',
      contraindications: [],
      tags: ['joint_safe', 'maternal_safe', 'pelvic_stability'],
    },
    rdl: {
      id: 'rdl',
      name: 'Romanian Deadlift (Dumbbell/Barbell)',
      category: 'lower_hinge',
      equipment: ['gym', 'dumb'],
      baseWeightKg: 15.0,
      targetReps: 10,
      targetSets: 3,
      rpe: 8,
      xpType: 'STR',
      contraindications: ['acute_lower_back'],
      jointSafeAlternative: 'glute_bridge',
      tags: ['compound', 'foundation_b', 'high_roi'],
    },
    clamshells: {
      id: 'clamshells',
      name: 'Side-Lying Clamshells',
      category: 'pelvic_restorative',
      equipment: ['body', 'dumb', 'desi', 'gym'],
      baseWeightKg: 0,
      targetReps: 15,
      targetSets: 3,
      rpe: 6,
      xpType: 'VIT',
      contraindications: [],
      tags: ['maternal_safe', 'joint_safe', 'pcos_friendly', 'postpartum_ready'],
    },
    pushup_standard: {
      id: 'pushup_standard',
      name: 'Standard Push-Up / Chest Press',
      category: 'upper_push',
      equipment: ['body', 'gym', 'desi', 'dumb'],
      baseWeightKg: 0,
      targetReps: 12,
      targetSets: 3,
      rpe: 8,
      xpType: 'STR',
      contraindications: ['pregnancy_t3'],
      jointSafeAlternative: 'pushup_incline_wall',
      tags: ['compound', 'foundation_a', 'high_roi'],
    },
    pushup_incline_wall: {
      id: 'pushup_incline_wall',
      name: 'Incline / Wall Push-Up',
      category: 'upper_push',
      equipment: ['body', 'desi', 'gym', 'dumb'],
      baseWeightKg: 0,
      targetReps: 12,
      targetSets: 3,
      rpe: 7,
      xpType: 'STR',
      contraindications: [],
      tags: ['joint_safe', 'maternal_safe', 'desk_worker', 'beginner'],
    },
    dumbbell_floor_press: {
      id: 'dumbbell_floor_press',
      name: 'Dumbbell Floor Press',
      category: 'upper_push',
      equipment: ['dumb', 'gym'],
      baseWeightKg: 10.0,
      targetReps: 12,
      targetSets: 3,
      rpe: 8,
      xpType: 'STR',
      contraindications: ['pregnancy_t2', 'pregnancy_t3'],
      jointSafeAlternative: 'pushup_incline_wall',
      tags: ['joint_safe', 'compound'],
    },
    overhead_press: {
      id: 'overhead_press',
      name: 'Overhead Dumbbell Press',
      category: 'upper_push_vertical',
      equipment: ['dumb', 'gym'],
      baseWeightKg: 7.5,
      targetReps: 10,
      targetSets: 3,
      rpe: 8,
      xpType: 'STR',
      contraindications: [],
      tags: ['foundation_b', 'posture'],
    },
    cable_dumbbell_row: {
      id: 'cable_dumbbell_row',
      name: 'Dumbbell / Seated Cable Row',
      category: 'upper_pull',
      equipment: ['gym', 'dumb'],
      baseWeightKg: 10.0,
      targetReps: 12,
      targetSets: 3,
      rpe: 8,
      xpType: 'STR',
      contraindications: [],
      tags: ['compound', 'foundation_a', 'desk_worker', 'maternal_safe'],
    },
    band_pullapart: {
      id: 'band_pullapart',
      name: 'Band Pull-Aparts & Thoracic Reset',
      category: 'upper_pull',
      equipment: ['dumb', 'gym', 'body', 'desi'],
      baseWeightKg: 0,
      targetReps: 20,
      targetSets: 2,
      rpe: 6,
      xpType: 'VIT',
      contraindications: [],
      tags: ['desk_worker', 'express_micro', 'joint_safe'],
    },
    front_plank: {
      id: 'front_plank',
      name: 'Front Core Plank (sec)',
      category: 'core_stability',
      equipment: ['body', 'desi', 'gym', 'dumb'],
      baseWeightKg: 0,
      targetReps: 45,
      targetSets: 3,
      rpe: 8,
      xpType: 'VIT',
      contraindications: ['pregnancy_t2', 'pregnancy_t3', 'diastasis_recti'],
      jointSafeAlternative: 'bird_dog',
      tags: ['foundation_a'],
      isTimedSec: true,
    },
    bird_dog: {
      id: 'bird_dog',
      name: 'Quadruped Bird-Dog',
      category: 'core_stability',
      equipment: ['body', 'desi', 'gym', 'dumb'],
      baseWeightKg: 0,
      targetReps: 12,
      targetSets: 3,
      rpe: 6,
      xpType: 'VIT',
      contraindications: [],
      tags: ['joint_safe', 'maternal_safe', 'foundation_b', 'desk_worker'],
    },
    cat_cow: {
      id: 'cat_cow',
      name: 'Cat-Cow Spine Mobilisation',
      category: 'mobility_pelvic',
      equipment: ['body', 'desi', 'gym', 'dumb'],
      baseWeightKg: 0,
      targetReps: 10,
      targetSets: 2,
      rpe: 5,
      xpType: 'SEN',
      contraindications: [],
      tags: ['maternal_safe', 'desk_worker', 'active_recovery'],
    },
    surya_namaskar: {
      id: 'surya_namaskar',
      name: 'Surya Namaskar (12-Pose Flow)',
      category: 'metabolic_flow',
      equipment: ['desi', 'body', 'gym'],
      baseWeightKg: 0,
      targetReps: 3,
      targetSets: 1,
      rpe: 7,
      xpType: 'AGI',
      contraindications: ['pregnancy_t2', 'pregnancy_t3'],
      jointSafeAlternative: 'cat_cow',
      tags: ['active_metabolic', 'desi_core'],
      isRounds: true,
    },
  },
  schedules: {
    high_roi_3day: {
      day1_foundation_a: ['squat_goblet', 'pushup_standard', 'cable_dumbbell_row', 'front_plank'],
      day2_active_metabolic: ['surya_namaskar'],
      day3_foundation_b: ['rdl', 'pushup_incline_wall', 'overhead_press', 'bird_dog'],
      day4_active_recovery: ['cat_cow', 'band_pullapart'],
      day5_metabolic_density: ['squat_goblet', 'cable_dumbbell_row', 'pushup_standard'],
    },
    joint_safe_beginner: {
      day1: ['chair_squat', 'pushup_incline_wall', 'band_pullapart', 'bird_dog'],
      day2: ['wall_sit', 'clamshells', 'cat_cow'],
    },
    maternal_shield_track: {
      routine: ['cat_cow', 'clamshells', 'wall_sit', 'pushup_incline_wall', 'cable_dumbbell_row'],
    },
    desk_worker_express: {
      circuit: ['band_pullapart', 'pushup_incline_wall', 'chair_squat', 'bird_dog'],
    },
  },
  getSafeExercises(stage = 'standard', equipmentTier = 'gym', isJointPain = false) {
    return Object.values(this.exercises).filter((ex) => {
      if (!ex.equipment.includes(equipmentTier)) return false;
      if (stage.startsWith('pregnancy_') || stage === 'postpartum') {
        if (
          ex.contraindications.includes(stage) ||
          (stage === 'postpartum' && ex.contraindications.includes('diastasis_recti'))
        ) {
          return false;
        }
      }
      if (isJointPain && ex.contraindications.includes('acute_knee_pain')) {
        return false;
      }
      return true;
    });
  },
  getRecommendedWeight(exerciseId, user) {
    const ex = this.exercises[exerciseId];
    if (!ex || ex.baseWeightKg === 0) return 0;

    let base = ex.baseWeightKg;
    if (user.sex === 'f') {
      base *= this.engine.femaleStrengthRatio;
    }
    const weightFactor = (user.currentWeightKg || 70) / 70;
    let recWeight = base * weightFactor;

    if (user.prHistory && user.prHistory[exerciseId]) {
      const lastPr = user.prHistory[exerciseId].weightKg;
      const lastReps = user.prHistory[exerciseId].reps;
      if (lastReps >= ex.targetReps) {
        recWeight = lastPr + this.engine.microProgressionKg;
      } else {
        recWeight = lastPr;
      }
    }

    return Math.round(recWeight * 2) / 2;
  },
  shuffleExercise(
    currentExerciseId,
    equipmentTier = 'gym',
    stage = 'standard',
    isJointPain = false,
    excludeIds = []
  ) {
    const current = this.exercises[currentExerciseId];
    if (!current) return currentExerciseId;
    const safeList = this.getSafeExercises(stage, equipmentTier, isJointPain);
    const sameCategory = safeList.filter(
      (ex) =>
        ex.id !== currentExerciseId &&
        ex.category === current.category &&
        !excludeIds.includes(ex.id)
    );
    const fallbackSameCategory = safeList.filter(
      (ex) => ex.id !== currentExerciseId && ex.category === current.category
    );
    const crossPool = safeList.filter(
      (ex) => ex.id !== currentExerciseId && !excludeIds.includes(ex.id)
    );
    const candidates = sameCategory.length
      ? sameCategory
      : fallbackSameCategory.length
        ? fallbackSameCategory
        : crossPool;
    if (candidates.length === 0) return currentExerciseId;
    return candidates[0].id;
  },
  getRotatedWorkout(
    dayExerciseIds,
    equipmentTier = 'gym',
    stage = 'standard',
    isJointPain = false,
    rotationSeed = 0
  ) {
    if (!dayExerciseIds.length) return [];
    // Pillar 3 (80/20 Invariant Core): Lock primary compound slots [0, 1] across a 4-6 week block
    const lockedCore = dayExerciseIds.slice(0, 2);
    if (rotationSeed <= 0 || dayExerciseIds.length <= 2) {
      return [...dayExerciseIds];
    }

    const safePool = this.getSafeExercises(stage, equipmentTier, isJointPain);
    const usedIds = new Set<string>(lockedCore);
    const rotatedAccessories = dayExerciseIds.slice(2).map((origId, idx) => {
      const origCfg = this.exercises[origId];
      const samePattern = safePool.filter(
        (ex) =>
          ex.id !== origId &&
          !usedIds.has(ex.id) &&
          (origCfg ? ex.category === origCfg.category : true)
      );
      const anySafeAccessory = safePool.filter(
        (ex) => ex.id !== origId && !usedIds.has(ex.id)
      );
      const pool = samePattern.length > 0 ? samePattern : anySafeAccessory;
      if (pool.length === 0) {
        usedIds.add(origId);
        return origId;
      }
      const picked = pool[(rotationSeed + idx - 1) % pool.length];
      usedIds.add(picked.id);
      return picked.id;
    });

    return [...lockedCore, ...rotatedAccessories];
  },
};

export const EX_POOLS: Record<EquipmentType | MobilityTier | 'maternal', ExerciseEntry[]> = {
  maternal: [
    ['Cat-Cow spine relief', 3, 10, 0, 0],
    ['Pelvic tilts (standing or quadruped)', 3, 12, 0, 0],
    ['Side-lying clamshells', 3, 12, 0, 0],
    ['Supported wall sit (sec)', 3, 30, 0, 0],
    ['Kegels & 360° breathing', 3, 8, 0, 0],
  ],
  joint: [
    ['Wall push-ups', 3, 12, 0, 0],
    ['Chair squats', 3, 12, 0, 0],
    ['Glute bridges', 3, 15, 0, 0],
    ['Standing knee marches', 3, 20, 0, 0],
    ['Dead bug', 3, 10, 0, 0],
  ],
  bal: [
    ['Push-ups', 3, 12, 0, 0],
    ['Bodyweight squats', 3, 15, 0, 0],
    ['Reverse lunges', 3, 10, 0, 0],
    ['Plank (sec)', 3, 35, 0, 0],
    ['Mountain climbers', 3, 20, 0, 0],
  ],
  hiit: [
    ['Burpees', 4, 12, 0, 0],
    ['Jump squats', 4, 15, 0, 0],
    ['Diamond push-ups', 4, 10, 0, 0],
    ['High knees (sec)', 4, 40, 0, 0],
    ['Plank to push-up', 4, 12, 0, 0],
  ],
  body: [
    ['Push-ups', 3, 12, 0, 0],
    ['Bodyweight squats', 3, 15, 0, 0],
    ['Reverse lunges', 3, 10, 0, 0],
    ['Plank (sec)', 3, 35, 0, 0],
    ['Mountain climbers', 3, 20, 0, 0],
  ],
  gym: [
    ['Leg press', 4, 12, 40, 0.55],
    ['Machine chest press', 3, 10, 25, 0.30],
    ['Lat pulldown', 3, 12, 30, 0.35],
    ['Dumbbell shoulder press', 3, 10, 10, 0.14],
    ['Plank (sec)', 3, 40, 0, 0],
  ],
  dumb: [
    ['Goblet squat', 3, 12, 10, 0.18],
    ['Dumbbell floor press', 3, 12, 10, 0.16],
    ['One-arm dumbbell row', 3, 10, 12, 0.18],
    ['Overhead dumbbell press', 3, 10, 8, 0.12],
    ['Dumbbell Romanian deadlift', 3, 12, 12, 0.20],
  ],
  desi: [
    ['Baithak (Hindu squats)', 3, 20, 0, 0],
    ['Dand (Hindu push-ups)', 3, 10, 0, 0],
    ['Surya Namaskar rounds', 3, 4, 0, 0],
    ['Naukasana (boat pose sec)', 3, 25, 0, 0],
    ['Chair dips', 3, 12, 0, 0],
  ],
};

export const ALT_POOLS: Record<EquipmentType | MobilityTier | 'maternal', ExerciseEntry[]> = {
  maternal: [
    ['Prenatal brisk walk (min)', 1, 15, 0, 0],
    ['Supported chair squats', 3, 10, 0, 0],
    ['Wall push-ups', 3, 10, 0, 0],
    ['Seated resistance band row', 3, 12, 2, 0.04],
    ['Bird-dog (gentle core)', 3, 8, 0, 0],
  ],
  joint: [
    ['Step-ups (low step)', 3, 12, 0, 0],
    ['Incline push-ups', 3, 12, 0, 0],
    ['Seated band row', 3, 15, 2, 0.04],
    ['Bird-dog', 3, 10, 0, 0],
    ['Standing calf raises', 3, 15, 0, 0],
  ],
  bal: [
    ['Incline push-ups', 3, 15, 0, 0],
    ['Glute bridges', 3, 15, 0, 0],
    ['Split squats', 3, 10, 0, 0],
    ['Side plank (sec)', 3, 30, 0, 0],
    ['Shadowboxing (sec)', 3, 60, 0, 0],
  ],
  hiit: [
    ['Squat thrusts', 4, 15, 0, 0],
    ['Alternating jump lunges', 4, 16, 0, 0],
    ['Decline push-ups', 4, 12, 0, 0],
    ['Mountain climbers (sec)', 4, 45, 0, 0],
    ['V-ups', 4, 15, 0, 0],
  ],
  body: [
    ['Incline push-ups', 3, 15, 0, 0],
    ['Glute bridges', 3, 15, 0, 0],
    ['Split squats', 3, 10, 0, 0],
    ['Side plank (sec)', 3, 30, 0, 0],
    ['Shadowboxing (sec)', 3, 60, 0, 0],
  ],
  gym: [
    ['Goblet squat', 4, 12, 15, 0.22],
    ['Seated cable row', 3, 12, 30, 0.35],
    ['Incline dumbbell press', 3, 10, 12, 0.16],
    ['Dumbbell Romanian deadlift', 3, 12, 15, 0.24],
    ['Hanging knee raises', 3, 12, 0, 0],
  ],
  dumb: [
    ['Dumbbell lunges', 3, 10, 8, 0.12],
    ['Push-ups', 3, 15, 0, 0],
    ['Bent-over dumbbell row', 3, 12, 10, 0.16],
    ['Arnold press', 3, 10, 8, 0.12],
    ['Glute bridges (weighted)', 3, 15, 10, 0.18],
  ],
  desi: [
    ['Baithak (jump variation)', 3, 15, 0, 0],
    ['Pehlwani dand', 3, 10, 0, 0],
    ['Gada / dumbbell swings', 3, 15, 8, 0.12],
    ['Bhujangasana (cobra sec)', 3, 30, 0, 0],
    ['Plank (sec)', 3, 40, 0, 0],
  ],
};

export const MIN_DUE_POOLS: Record<EquipmentType | MobilityTier | 'maternal', ExerciseEntry[]> = {
  maternal: [
    ['Cat-Cow spine relief', 1, 8, 0, 0],
    ['Pelvic tilts (standing or quadruped)', 1, 10, 0, 0],
    ['Gentle recovery walk (min)', 1, 5, 0, 0],
  ],
  joint: [
    ['Wall push-ups', 1, 10, 0, 0],
    ['Chair squats', 1, 10, 0, 0],
    ['Standing knee marches', 1, 16, 0, 0],
  ],
  bal: [
    ['Incline push-ups', 2, 8, 0, 0],
    ['Bodyweight squats', 2, 10, 0, 0],
    ['Plank (sec)', 1, 20, 0, 0],
  ],
  hiit: [
    ['Push-ups', 2, 10, 0, 0],
    ['Bodyweight squats', 2, 12, 0, 0],
    ['High knees (sec)', 2, 20, 0, 0],
  ],
  body: [
    ['Incline push-ups', 2, 8, 0, 0],
    ['Bodyweight squats', 2, 10, 0, 0],
    ['Plank (sec)', 1, 20, 0, 0],
  ],
  gym: [
    ['Goblet squat (light)', 2, 8, 10, 0.15],
    ['Machine chest press (light)', 2, 8, 15, 0.20],
    ['Lat pulldown (light)', 2, 10, 20, 0.25],
  ],
  dumb: [
    ['Goblet squat (light)', 2, 8, 6, 0.12],
    ['Dumbbell floor press', 2, 8, 6, 0.12],
    ['One-arm dumbbell row', 2, 8, 8, 0.12],
  ],
  desi: [
    ['Baithak (easy Hindu squats)', 2, 10, 0, 0],
    ['Incline Dand (Hindu push-ups)', 2, 6, 0, 0],
    ['Surya Namaskar rounds', 1, 2, 0, 0],
  ],
};

export interface PoseGeometry {
  hd: [number, number];
  s: [number, number];
  h: [number, number];
  a: [number, number];
  l: Array<[number, number, number, number]>;
}

export const POSES: Record<string, PoseGeometry> = {
  stand: { hd: [50, 8], s: [50, 16], h: [50, 38], a: [53, 26], l: [[50, 50, 50, 62]] },
  arms: { hd: [46, 8], s: [50, 16], h: [52, 38], a: [40, 2], l: [[52, 50, 52, 62]] },
  fold: { hd: [40, 50], s: [42, 44], h: [52, 36], a: [44, 60], l: [[52, 50, 52, 62]] },
  lunge: { hd: [38, 26], s: [40, 32], h: [48, 44], a: [32, 58], l: [[34, 50, 32, 62], [62, 56, 74, 62]] },
  plank: { hd: [18, 38], s: [22, 40], h: [58, 46], a: [22, 60], l: [[78, 54, 92, 62]] },
  pdown: { hd: [18, 50], s: [22, 52], h: [58, 56], a: [22, 62], l: [[78, 59, 92, 62]] },
  ash: { hd: [30, 52], s: [34, 54], h: [60, 56], a: [34, 62], l: [[48, 60, 50, 62]] },
  cobra: { hd: [26, 34], s: [32, 46], h: [56, 58], a: [36, 62], l: [[76, 60, 92, 62]] },
  dog: { hd: [32, 40], s: [36, 36], h: [52, 14], a: [24, 62], l: [[67, 38, 82, 62]] },
  squat: { hd: [46, 12], s: [46, 22], h: [36, 44], a: [60, 30], l: [[56, 46, 50, 62]] },
  catcow: { hd: [24, 34], s: [32, 36], h: [64, 34], a: [32, 60], l: [[64, 48, 64, 60]] },
  wallsit: { hd: [26, 16], s: [26, 26], h: [26, 44], a: [36, 36], l: [[46, 44, 46, 62]] },
};

export const SURYA_STEPS: Array<[string, string, string]> = [
  ['Pranamasana (Prayer Pose)', 'Stand tall with palms together at your chest. Breathe normally.', 'stand'],
  ['Hasta Uttanasana (Raised Arms)', 'Breathe in. Raise your arms overhead and arch back gently.', 'arms'],
  ['Hastapadasana (Forward Fold)', 'Breathe out. Bend forward from the hips and bring hands toward the floor.', 'fold'],
  ['Ashwa Sanchalanasana (Lunge)', 'Breathe in. Step your right leg back, lower the knee and look up.', 'lunge'],
  ['Plank Pose', 'Hold steady. Step the other leg back so your body forms a straight line.', 'plank'],
  ['Ashtanga Namaskara (Eight Points)', 'Breathe out. Lower your knees, chest and chin to the floor.', 'ash'],
  ['Bhujangasana (Cobra)', 'Breathe in. Slide forward and lift your chest, elbows slightly bent.', 'cobra'],
  ['Adho Mukha Svanasana (Downward Dog)', 'Breathe out. Lift your hips high into an inverted V.', 'dog'],
  ['Ashwa Sanchalanasana (Lunge)', 'Breathe in. Step your right foot forward between your hands.', 'lunge'],
  ['Hastapadasana (Forward Fold)', 'Breathe out. Bring the left foot forward and fold down.', 'fold'],
  ['Hasta Uttanasana (Raised Arms)', 'Breathe in. Rise up with arms overhead.', 'arms'],
  ['Pranamasana (Prayer Pose)', 'Breathe out. Return to prayer pose. Repeat on the opposite leg.', 'stand'],
];

export interface TutorialStep {
  title?: string;
  text: string;
  pose: string;
}

export interface ExerciseTutorial {
  name: string;
  steps: TutorialStep[];
}

export const TUTORIALS: Record<string, ExerciseTutorial> = {
  surya: {
    name: 'Surya Namaskar (12-Pose Flow)',
    steps: SURYA_STEPS.map(([title, text, pose]) => ({ title, text, pose })),
  },
  'cat-cow': {
    name: 'Cat-Cow Spine Relief',
    steps: [
      { text: 'Start on hands and knees with wrists under shoulders and knees under hips.', pose: 'catcow' },
      { text: 'Inhale, drop belly gently and lift chest; exhale, round upper back slowly.', pose: 'catcow' },
    ],
  },
  'wall sit': {
    name: 'Supported Wall Sit',
    steps: [
      { text: 'Slide your back down a wall until thighs are comfortable (45°–90°).', pose: 'wallsit' },
      { text: 'Keep knees aligned over ankles and breathe steadily.', pose: 'wallsit' },
    ],
  },
  pelvic: {
    name: 'Pelvic Tilts & Kegels',
    steps: [
      { text: 'Stand with back softly against a wall or kneel on all fours.', pose: 'catcow' },
      { text: 'Exhale and gently draw lower belly & pelvic floor upward for 5s; release on inhale.', pose: 'stand' },
    ],
  },
  dand: {
    name: 'Dand (Hindu Push-Up)',
    steps: [
      { text: 'Start in downward dog: hips high, hands and feet planted.', pose: 'dog' },
      { text: 'Swoop forward and down, chest skimming just above the floor.', pose: 'ash' },
      { text: 'Press up into cobra with chest open and shoulders back.', pose: 'cobra' },
    ],
  },
  baithak: {
    name: 'Baithak (Hindu Squat)',
    steps: [
      { text: 'Stand with feet shoulder-width apart and arms relaxed in front.', pose: 'stand' },
      { text: 'Sit back and down keeping your torso tall and heels grounded.', pose: 'squat' },
      { text: 'Drive through your feet to stand back up smoothly.', pose: 'stand' },
    ],
  },
  'push-up': {
    name: 'Push-Up',
    steps: [
      { text: 'Hands under shoulders, body in one straight line from head to heels.', pose: 'plank' },
      { text: 'Lower chest toward floor or wall with elbows angled around 45°.', pose: 'pdown' },
      { text: 'Press back up cleanly without sagging hips.', pose: 'plank' },
    ],
  },
  squat: {
    name: 'Squat',
    steps: [
      { text: 'Feet shoulder-width apart, chest upright, core braced.', pose: 'stand' },
      { text: 'Push hips back and bend knees as if sitting onto a chair.', pose: 'squat' },
      { text: 'Drive through mid-foot and heels to stand tall.', pose: 'stand' },
    ],
  },
  lunge: {
    name: 'Lunge',
    steps: [
      { text: 'Step one leg back and lower until both knees bend ~90°.', pose: 'lunge' },
      { text: 'Push firmly through your front foot to return to standing.', pose: 'stand' },
    ],
  },
  plank: {
    name: 'Plank',
    steps: [
      { text: 'Forearms or hands stacked under shoulders, body straight.', pose: 'plank' },
      { text: 'Brace core gently and breathe evenly through your nose.', pose: 'plank' },
    ],
  },
  glute: {
    name: 'Floor Glute Bridge / Hip Thrust',
    steps: [
      { text: 'Lie on knees bent, feet hip-width apart and heels grounded.', pose: 'ash' },
      { text: 'Drive through heels to lift hips cleanly, squeezing glutes at top.', pose: 'cobra' },
    ],
  },
  deadlift: {
    name: 'Romanian Deadlift',
    steps: [
      { text: 'Soften knees slightly, brace spine neutral, and hinge hips straight back.', pose: 'stand' },
      { text: 'Lower weights along thighs to mid-shin, then drive hips forward cleanly.', pose: 'fold' },
    ],
  },
  row: {
    name: 'Dumbbell / Seated Cable Row',
    steps: [
      { text: 'Keep torso tall with chest lifted and shoulders packed away from ears.', pose: 'stand' },
      { text: 'Pull elbows smoothly toward hips, pause for 1s, and control the return.', pose: 'stand' },
    ],
  },
  'bird-dog': {
    name: 'Quadruped Bird-Dog',
    steps: [
      { text: 'Start on hands and knees with neutral spine and gentle core brace.', pose: 'catcow' },
      { text: 'Extend opposite arm and leg cleanly without arching lower back; alternate sides.', pose: 'plank' },
    ],
  },
  clamshell: {
    name: 'Side-Lying Clamshells',
    steps: [
      { text: 'Lie on side with knees bent ~45° and heels stacked together.', pose: 'catcow' },
      { text: 'Lift top knee smoothly without rolling pelvis backward; lower with control.', pose: 'catcow' },
    ],
  },
};
