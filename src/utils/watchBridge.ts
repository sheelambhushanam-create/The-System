import type {
  AppState,
  WatchCommandEnvelope,
  WatchCommandType,
  WatchReminderPrefs,
  WatchTelemetryPayload,
} from '../types/system';
import { getAutonomicReadiness } from './clinical';
import {
  getLevelInfo,
  getProgramDayExercises,
  getProgramDayNumber,
  getRank,
  getRecommendedTarget,
} from './metabolic';
import { getHabitStatementStatus, verifyQuestsState } from './quests';

export const WATCH_BRIDGE_CHANNEL = 'thesystem_watch_bridge_v2';

export const DEFAULT_WATCH_PREFS: WatchReminderPrefs = {
  enabled: true,
  waterIntervalMin: 60,
  restAlertVibrate: true,
  postMealWalkReminder: true,
  snoozedUntil: {},
  lastAcked: {},
};

export interface WatchDueReminder {
  id: 'water' | 'set' | 'walk' | 'streak';
  title: string;
  subtitle: string;
  primaryAction: WatchCommandType;
  primaryLabel: string;
  secondaryAction?: WatchCommandType;
  secondaryLabel?: string;
}

export interface WatchActiveWorkoutSummary {
  dayNum: number;
  exerciseName: string;
  exIdx: number;
  setIdx: number;
  totalSets: number;
  targetKg: number;
  targetReps: number;
  targetLabel: string;
  restSec: number;
  completedSetsInExercise: number;
  completedSetsToday: number;
  totalSetsToday: number;
  allDone: boolean;
}

export interface WatchSnapshot {
  code: string;
  userName: string;
  theme: AppState['theme'];
  darkMode: boolean;
  dayNum: number;
  totalDays: number;
  streak: number;
  xp: number;
  level: number;
  rank: string;
  waterLitres: number;
  waterTargetLitres: number;
  steps: number;
  stepsTarget: number;
  sleepHours: number;
  hrvMs: number;
  rhrBpm: number;
  liveBpm: number;
  readinessPct: number;
  deviceLabel: string;
  lastSyncedAt?: string;
  isMinimumDueMode: boolean;
  streakProtected: boolean;
  restEndTime: number;
  restRemainingSec: number;
  activeWorkout: WatchActiveWorkoutSummary;
  dueReminders: WatchDueReminder[];
  watchPrefs: WatchReminderPrefs;
  updatedAt: number;
}

export function isValidBridgeWatchSnapshot(raw: unknown): raw is WatchSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Partial<WatchSnapshot>;
  return (
    typeof s.code === 'string' &&
    Boolean(s.activeWorkout && typeof s.activeWorkout.allDone === 'boolean') &&
    Array.isArray(s.dueReminders)
  );
}

export function normalizeWatchPairingCode(raw = ''): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

export function generateWatchPairingCode(seed = ''): string {
  const clean = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  let n = (hash >>> 0) + 104729;
  for (let i = 0; i < 6; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + ((i + 3) * 7919);
  }
  return out;
}

function getSetLogKey(day: number, exIdx: number, isMinMode: boolean): string {
  return isMinMode ? `min_${day}_${exIdx}` : `${day}_${exIdx}`;
}

export function getDueWatchReminders(
  state: AppState,
  dateStr: string,
  nowMs = Date.now()
): WatchDueReminder[] {
  const prefs: WatchReminderPrefs = {
    ...DEFAULT_WATCH_PREFS,
    ...(state.watchPrefs || {}),
  };
  if (!prefs.enabled) return [];

  const statement = getHabitStatementStatus(state, dateStr);
  const waterLitres = Number(state.water[dateStr] || 0);
  const steps = Number(state.watch?.steps || 0);
  const loggedMeals = (state.log[dateStr] || []).length;
  const hour = new Date(nowMs).getHours();
  const snoozed = prefs.snoozedUntil || {};
  const reminders: WatchDueReminder[] = [];

  if (
    waterLitres < statement.hydrationTargetLitres &&
    (!snoozed.water || nowMs >= snoozed.water) &&
    (!prefs.waterNextDueAt || nowMs >= prefs.waterNextDueAt)
  ) {
    const remainingL = Math.max(0.25, +(statement.hydrationTargetLitres - waterLitres).toFixed(2));
    reminders.push({
      id: 'water',
      title: 'Drink Water',
      subtitle: `${waterLitres.toFixed(2)} / ${statement.hydrationTargetLitres.toFixed(1)} L · ${remainingL.toFixed(2)} L left`,
      primaryAction: 'LOG_WATER_250',
      primaryLabel: '+250 ml Now',
      secondaryAction: 'SNOOZE_WATER_30',
      secondaryLabel: 'Snooze 30m',
    });
  }

  if (!statement.minWorkoutDone && (!snoozed.set || nowMs >= snoozed.set)) {
    reminders.push({
      id: 'set',
      title: 'Ready for Next Set',
      subtitle: statement.isMinimumDueMode
        ? '5-min quick routine saves your streak'
        : '1-tap from your wrist logs Set & starts rest',
      primaryAction: 'COMPLETE_NEXT_SET',
      primaryLabel: 'Complete Set',
    });
  }

  if (
    prefs.postMealWalkReminder &&
    loggedMeals > 0 &&
    steps < statement.stepsTarget &&
    (!snoozed.walk || nowMs >= snoozed.walk)
  ) {
    reminders.push({
      id: 'walk',
      title: 'Post-Meal Walk',
      subtitle: '5-min walk smooths blood sugar after meals',
      primaryAction: 'LOG_WALK_1500',
      primaryLabel: '+1,500 Steps',
    });
  }

  if (hour >= 20 && !statement.streakProtected && (!snoozed.streak || nowMs >= snoozed.streak)) {
    reminders.push({
      id: 'streak',
      title: 'Protect Your Streak',
      subtitle: `${state.streak}d streak · Switch to Minimum Due in 1 tap`,
      primaryAction: 'TOGGLE_MIN_DUE',
      primaryLabel: 'Minimum Due',
    });
  }

  return reminders;
}

export function buildWatchSnapshot(
  state: AppState,
  dateStr: string,
  restEndTime = 0,
  bleDeviceName: string | null = null,
  bleBpm = 0,
  nowMs = Date.now()
): WatchSnapshot {
  const code = normalizeWatchPairingCode(
    state.watchPairingCode ||
      state.watchBridge?.pairingCode ||
      generateWatchPairingCode(state.p.name || 'member')
  );
  const levelInfo = getLevelInfo(state.xp);
  const rank = getRank(levelInfo.l);
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const statement = getHabitStatementStatus(state, dateStr);
  const readiness = getAutonomicReadiness(state, dateStr, bleBpm);
  const isMinMode = statement.isMinimumDueMode;
  const exercises = getProgramDayExercises(
    dayNum,
    state.p,
    state.shuf,
    isMinMode,
    state.scheduleTrack,
    state.exOverrides
  );

  let completedSetsToday = 0;
  let totalSetsToday = 0;
  let activeWorkout: WatchActiveWorkoutSummary | null = null;

  exercises.forEach((ex, exIdx) => {
    const key = getSetLogKey(dayNum, exIdx, isMinMode);
    const rec = getRecommendedTarget(
      ex.name,
      ex.sets,
      ex.reps,
      ex.baseKg,
      ex.bwRatio,
      state.p,
      state.prs
    );
    const sets =
      state.setLogs[key] && state.setLogs[key].length > 0
        ? state.setLogs[key]
        : Array.from({ length: ex.sets }, () => ({
            reps: rec.reps,
            kg: rec.kg,
            done: false,
          }));

    const doneInEx = sets.filter((s) => s.done).length;
    completedSetsToday += doneInEx;
    totalSetsToday += sets.length;

    const firstPendingSetIdx = sets.findIndex((s) => !s.done);
    if (!activeWorkout && firstPendingSetIdx >= 0) {
      const targetSet = sets[firstPendingSetIdx];
      activeWorkout = {
        dayNum,
        exerciseName: ex.name,
        exIdx,
        setIdx: firstPendingSetIdx,
        totalSets: sets.length,
        targetKg: targetSet.kg,
        targetReps: targetSet.reps,
        targetLabel: targetSet.kg > 0 ? `${targetSet.kg} kg × ${targetSet.reps}` : `${targetSet.reps} reps`,
        restSec: ex.restSec || (isMinMode ? 30 : 60),
        completedSetsInExercise: doneInEx,
        completedSetsToday,
        totalSetsToday,
        allDone: false,
      };
    }
  });

  if (!activeWorkout) {
    const firstEx = exercises[0];
    activeWorkout = {
      dayNum,
      exerciseName: firstEx ? firstEx.name : 'Workout Complete',
      exIdx: 0,
      setIdx: 0,
      totalSets: firstEx?.sets || 0,
      targetKg: 0,
      targetReps: firstEx?.reps || 0,
      targetLabel: 'All sets complete',
      restSec: firstEx?.restSec || 45,
      completedSetsInExercise: firstEx?.sets || 0,
      completedSetsToday,
      totalSetsToday,
      allDone: true,
    };
  } else {
    activeWorkout = {
      ...(activeWorkout as WatchActiveWorkoutSummary),
      completedSetsToday,
      totalSetsToday,
    };
  }

  const restRemainingSec = restEndTime > nowMs ? Math.max(0, Math.ceil((restEndTime - nowMs) / 1000)) : 0;

  return {
    code,
    userName: state.p.name,
    theme: state.theme,
    darkMode: state.darkMode,
    dayNum,
    totalDays: state.p.days,
    streak: state.streak,
    xp: state.xp,
    level: levelInfo.l,
    rank,
    waterLitres: Number(state.water[dateStr] || 0),
    waterTargetLitres: statement.hydrationTargetLitres,
    steps: Number(state.watch?.steps || 0),
    stepsTarget: statement.stepsTarget,
    sleepHours: Number(state.watch?.sleep || 0),
    hrvMs: readiness.hrvMs,
    rhrBpm: readiness.rhrBpm,
    liveBpm: bleBpm > 0 ? bleBpm : readiness.rhrBpm,
    readinessPct: readiness.readinessPct,
    deviceLabel: bleDeviceName || state.watch?.deviceLabel || 'Watch Companion',
    lastSyncedAt: state.watch?.lastSyncedAt,
    isMinimumDueMode: isMinMode,
    streakProtected: statement.streakProtected,
    restEndTime,
    restRemainingSec,
    activeWorkout,
    dueReminders: getDueWatchReminders(state, dateStr, nowMs),
    watchPrefs: {
      ...DEFAULT_WATCH_PREFS,
      ...(state.watchPrefs || {}),
    },
    updatedAt: nowMs,
  };
}

export interface WatchCommandResult {
  nextState: AppState;
  toastText: string;
  startRestSec?: number;
  adjustRestDeltaSec?: number;
  clearRest?: boolean;
  prHit?: { exName: string; bestStr: string; xp: number };
}

export function applyWatchCommand(
  state: AppState,
  command: Pick<WatchCommandEnvelope, 'type' | 'payload'>,
  dateStr: string,
  nowMs = Date.now()
): WatchCommandResult {
  const prefs: WatchReminderPrefs = {
    ...DEFAULT_WATCH_PREFS,
    ...(state.watchPrefs || {}),
  };

  if (command.type === 'LOG_WATER_250' || command.type === 'LOG_WATER_500') {
    const delta = command.type === 'LOG_WATER_500' ? 0.5 : 0.25;
    const nextWaterVal = Math.max(0, +(((state.water[dateStr] || 0) + delta).toFixed(2)));
    const nextDue = nowMs + Math.max(15, prefs.waterIntervalMin) * 60_000;
    const updated: AppState = {
      ...state,
      water: { ...state.water, [dateStr]: nextWaterVal },
      watchPrefs: {
        ...prefs,
        waterNextDueAt: nextDue,
        lastAcked: { ...(prefs.lastAcked || {}), water: nowMs },
      },
    };
    const { nextState } = verifyQuestsState(updated, dateStr);
    return {
      nextState,
      toastText: `Watch logged +${Math.round(delta * 1000)} ml water (${nextWaterVal.toFixed(2)} L today)`,
    };
  }

  if (command.type === 'SNOOZE_WATER_30') {
    const mins = command.payload?.minutes || 30;
    return {
      nextState: {
        ...state,
        watchPrefs: {
          ...prefs,
          snoozedUntil: { ...(prefs.snoozedUntil || {}), water: nowMs + mins * 60_000 },
        },
      },
      toastText: `Water reminder snoozed ${mins} min on watch.`,
    };
  }

  if (command.type === 'ACK_REMINDER') {
    const rid = command.payload?.reminderId || 'water';
    return {
      nextState: {
        ...state,
        watchPrefs: {
          ...prefs,
          snoozedUntil: { ...(prefs.snoozedUntil || {}), [rid]: nowMs + 45 * 60_000 },
          lastAcked: { ...(prefs.lastAcked || {}), [rid]: nowMs },
        },
      },
      toastText: 'Watch reminder acknowledged.',
    };
  }

  if (command.type === 'LOG_WALK_1500') {
    const nextSteps = Math.max(0, Math.round((state.watch?.steps || 0) + 1500));
    const updated: AppState = {
      ...state,
      watch: {
        ...state.watch,
        steps: nextSteps,
        lastSyncedAt: new Date(nowMs).toISOString(),
        deviceLabel: command.payload?.deviceName || state.watch?.deviceLabel || 'Watch Companion',
      },
      watchPrefs: {
        ...prefs,
        lastAcked: { ...(prefs.lastAcked || {}), walk: nowMs },
      },
    };
    const { nextState } = verifyQuestsState(updated, dateStr);
    return {
      nextState,
      toastText: `Watch synced +1,500 steps (${nextSteps.toLocaleString()} total)`,
    };
  }

  if (command.type === 'TOGGLE_STRETCH') {
    const doneDay = { ...(state.done[dateStr] || {}) };
    if (doneDay.b) {
      return { nextState: state, toastText: 'Daily quick stretch already logged today.' };
    }
    doneDay.b = true;
    const updated: AppState = {
      ...state,
      xp: state.xp + 25,
      stats: { ...state.stats, AGI: state.stats.AGI + 1 },
      done: { ...state.done, [dateStr]: doneDay },
    };
    const { nextState } = verifyQuestsState(updated, dateStr);
    return {
      nextState,
      toastText: 'Watch logged 2-min stretch (+25 XP)!',
    };
  }

  if (command.type === 'TOGGLE_MIN_DUE') {
    const current = Boolean(state.minimumDueDays?.[dateStr]);
    const nextMap = { ...(state.minimumDueDays || {}) };
    if (!current) nextMap[dateStr] = true;
    else delete nextMap[dateStr];
    const { nextState } = verifyQuestsState({ ...state, minimumDueDays: nextMap }, dateStr);
    return {
      nextState,
      toastText: !current
        ? 'Watch enabled Minimum Due mode (5-min streak saver).'
        : 'Watch switched back to Full Plan.',
    };
  }

  if (command.type === 'SYNC_TELEMETRY') {
    const p: WatchTelemetryPayload = command.payload || {};
    const nextSteps =
      typeof p.steps === 'number' && p.steps >= 0
        ? Math.round(p.steps)
        : Math.round((state.watch?.steps || 4200) + 1250);
    const nextSleep =
      typeof p.sleep === 'number' && p.sleep > 0
        ? +p.sleep.toFixed(1)
        : Math.max(7.2, Number(state.watch?.sleep || 7.2));
    const nextHrv =
      typeof p.hrvMs === 'number' && p.hrvMs > 0
        ? Math.round(p.hrvMs)
        : state.watch?.hrvMs || 68;
    const nextRhr =
      typeof p.rhrBpm === 'number' && p.rhrBpm > 0
        ? Math.round(p.rhrBpm)
        : typeof p.liveBpm === 'number' && p.liveBpm > 35 && p.liveBpm < 110
          ? Math.round(p.liveBpm)
          : state.watch?.rhrBpm || 57;

    const updated: AppState = {
      ...state,
      watch: {
        ...state.watch,
        steps: nextSteps,
        sleep: nextSleep,
        hrvMs: nextHrv,
        rhrBpm: nextRhr,
        lastSyncedAt: new Date(nowMs).toISOString(),
        deviceLabel: p.deviceName || state.watch?.deviceLabel || 'Watch Companion',
      },
    };
    const { nextState } = verifyQuestsState(updated, dateStr);
    return {
      nextState,
      toastText: `Watch telemetry synced: ${nextSteps.toLocaleString()} steps · ${nextSleep}h sleep`,
    };
  }

  if (command.type === 'START_REST_45') {
    return { nextState: state, toastText: 'Watch started 45s rest timer.', startRestSec: 45 };
  }
  if (command.type === 'START_REST_60') {
    return { nextState: state, toastText: 'Watch started 60s rest timer.', startRestSec: 60 };
  }
  if (command.type === 'ADD_REST_15') {
    return { nextState: state, toastText: 'Added +15s rest from watch.', adjustRestDeltaSec: 15 };
  }
  if (command.type === 'SKIP_REST') {
    return { nextState: state, toastText: 'Rest skipped from watch.', clearRest: true };
  }

  if (command.type === 'COMPLETE_NEXT_SET') {
    const isMinMode = Boolean(state.minimumDueDays?.[dateStr]);
    const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
    const exList = getProgramDayExercises(
      dayNum,
      state.p,
      state.shuf,
      isMinMode,
      state.scheduleTrack,
      state.exOverrides
    );

    let targetExIdx = -1;
    let targetSetIdx = -1;
    let targetSets: AppState['setLogs'][string] = [];

    for (let i = 0; i < exList.length; i++) {
      const ex = exList[i];
      const key = getSetLogKey(dayNum, i, isMinMode);
      const rec = getRecommendedTarget(
        ex.name,
        ex.sets,
        ex.reps,
        ex.baseKg,
        ex.bwRatio,
        state.p,
        state.prs
      );
      const currentSets =
        state.setLogs[key] && state.setLogs[key].length > 0
          ? state.setLogs[key]
          : Array.from({ length: ex.sets }, () => ({
              reps: rec.reps,
              kg: rec.kg,
              done: false,
            }));
      const pending = currentSets.findIndex((s) => !s.done);
      if (pending >= 0) {
        targetExIdx = i;
        targetSetIdx = pending;
        targetSets = currentSets;
        break;
      }
    }

    if (targetExIdx < 0 || targetSetIdx < 0) {
      return {
        nextState: state,
        toastText: `Day ${dayNum} workout already complete!`,
      };
    }

    const ex = exList[targetExIdx];
    const key = getSetLogKey(dayNum, targetExIdx, isMinMode);
    const updatedSets = targetSets.map((s, idx) =>
      idx === targetSetIdx ? { ...s, done: true } : s
    );
    const completedSet = updatedSets[targetSetIdx];

    let xp = state.xp;
    const stats = { ...state.stats };
    const prs = { ...state.prs };
    let prHit: WatchCommandResult['prHit'];

    const prevPr = prs[ex.name] || {
      maxKg: 0,
      repsAtMax: 0,
      maxVol: 0,
      maxReps: 0,
      bestStr: '',
    };
    const vol = (completedSet.kg || 0) * (completedSet.reps || 0);
    let isPr = false;
    const updatedPr = { ...prevPr };

    if (completedSet.kg > 0 && completedSet.kg > prevPr.maxKg) {
      updatedPr.maxKg = completedSet.kg;
      updatedPr.repsAtMax = completedSet.reps;
      updatedPr.bestStr = `${completedSet.kg} kg × ${completedSet.reps}`;
      isPr = true;
    } else if (
      completedSet.kg > 0 &&
      completedSet.kg === prevPr.maxKg &&
      completedSet.reps > prevPr.repsAtMax
    ) {
      updatedPr.repsAtMax = completedSet.reps;
      updatedPr.bestStr = `${completedSet.kg} kg × ${completedSet.reps}`;
      isPr = true;
    } else if (vol > 0 && vol > prevPr.maxVol) {
      updatedPr.maxVol = vol;
      updatedPr.bestStr = `${completedSet.kg} kg × ${completedSet.reps}`;
      isPr = true;
    } else if (completedSet.kg === 0 && completedSet.reps > prevPr.maxReps) {
      updatedPr.maxReps = completedSet.reps;
      updatedPr.bestStr = `${completedSet.reps} reps`;
      if (updatedPr.maxReps > ex.reps) isPr = true;
    }
    prs[ex.name] = updatedPr;
    if (isPr) {
      xp += 15;
      stats.STR += 1;
      prHit = { exName: ex.name, bestStr: updatedPr.bestStr, xp: 15 };
    }

    const dayProg = { ...(state.prog[dayNum] || {}) };
    const prefix = isMinMode ? 'min_' : '';
    if (updatedSets.every((s) => s.done)) {
      dayProg[`${prefix}${targetExIdx}`] = true;
    }

    const allExDone = exList.every((_, idx) => Boolean(dayProg[`${prefix}${idx}`]));
    const completionKey = isMinMode ? 'min' : 'x';
    if (allExDone && !dayProg[completionKey]) {
      dayProg[completionKey] = true;
      xp += isMinMode ? 15 : 25;
      stats.STR += 1;
    }

    const preVerify: AppState = {
      ...state,
      xp,
      stats,
      prs,
      setLogs: { ...state.setLogs, [key]: updatedSets },
      prog: { ...state.prog, [dayNum]: dayProg },
    };
    const { nextState } = verifyQuestsState(preVerify, dateStr);
    const restSec = ex.restSec || (isMinMode ? 30 : 60);

    return {
      nextState,
      toastText: allExDone
        ? `Watch finished ${ex.name} & completed Day ${dayNum}!`
        : `Watch logged ${ex.name} Set ${targetSetIdx + 1}/${updatedSets.length} · ${restSec}s rest`,
      startRestSec: allExDone ? undefined : restSec,
      prHit,
    };
  }

  return { nextState: state, toastText: 'Watch synced.' };
}
