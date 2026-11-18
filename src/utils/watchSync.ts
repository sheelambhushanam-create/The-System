import { FOODS } from '../data/foods';
import type {
  AppState,
  ExerciseSet,
  LoggedFood,
  WatchActionEvent,
  WatchNextSetInfo,
  WatchReminder,
  WatchSnapshot,
} from '../types/system';
import { getAutonomicReadiness } from './clinical';
import {
  calculateMacros,
  getProgramDayExercises,
  getProgramDayNumber,
  getRecommendedTarget,
  sumDailyMacros,
} from './metabolic';
import { getHabitStatementStatus, verifyQuestsState } from './quests';

export const WATCH_CHANNEL_NAME = 'thesystem_watch_bridge_v1';
export const WATCH_SNAPSHOT_STORAGE_KEY = 'thesystem_watch_snapshot_v1';
export const WATCH_REMINDERS_STORAGE_KEY = 'thesystem_watch_reminders_v1';

export type WatchBridgeEnvelope =
  | { kind: 'snapshot'; snapshot: WatchSnapshot }
  | { kind: 'action'; pairingCode: string; action: WatchActionEvent }
  | { kind: 'reminder'; pairingCode: string; reminder: WatchReminder };

export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getSetLogKey(day: number, exIdx: number, isMinMode: boolean): string {
  return isMinMode ? `min_${day}_${exIdx}` : `${day}_${exIdx}`;
}

export function getExerciseSetsForState(
  state: AppState,
  day: number,
  exIdx: number,
  isMinMode: boolean
): ExerciseSet[] {
  const key = getSetLogKey(day, exIdx, isMinMode);
  if (state.setLogs[key] && state.setLogs[key].length > 0) {
    return state.setLogs[key];
  }
  const ex = getProgramDayExercises(
    day,
    state.p,
    state.shuf,
    isMinMode,
    state.scheduleTrack,
    state.exOverrides
  )[exIdx];
  if (!ex) return [];
  const rec = getRecommendedTarget(
    ex.name,
    ex.sets,
    ex.reps,
    ex.baseKg,
    ex.bwRatio,
    state.p,
    state.prs
  );
  return Array.from({ length: ex.sets }, () => ({ reps: rec.reps, kg: rec.kg, done: false }));
}

export function getNextActiveSetTarget(state: AppState, dateStr: string): WatchNextSetInfo {
  const day = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const isMinMode = Boolean(state.minimumDueDays?.[dateStr]);
  const exercises = getProgramDayExercises(
    day,
    state.p,
    state.shuf,
    isMinMode,
    state.scheduleTrack,
    state.exOverrides
  );

  let totalSetsToday = 0;
  let doneSetsToday = 0;
  let firstOpen: WatchNextSetInfo | null = null;

  exercises.forEach((ex, exIdx) => {
    const sets = getExerciseSetsForState(state, day, exIdx, isMinMode);
    totalSetsToday += sets.length;
    sets.forEach((s, setIdx) => {
      if (s.done) {
        doneSetsToday += 1;
      } else if (!firstOpen) {
        firstOpen = {
          day,
          isMinMode,
          exIdx,
          setIdx,
          exName: ex.name,
          setNumber: setIdx + 1,
          totalSets: sets.length,
          kg: s.kg,
          reps: s.reps,
          restSec: ex.restSec || (isMinMode ? 30 : 60),
          doneSetsToday: 0,
          totalSetsToday: 0,
          workoutComplete: false,
        };
      }
    });
  });

  if (firstOpen) {
    return {
      ...(firstOpen as WatchNextSetInfo),
      doneSetsToday,
      totalSetsToday,
      workoutComplete: false,
    };
  }

  const fallbackEx = exercises[0];
  return {
    day,
    isMinMode,
    exIdx: 0,
    setIdx: 0,
    exName: fallbackEx?.name || 'All Sets Complete',
    setNumber: totalSetsToday,
    totalSets: totalSetsToday,
    kg: fallbackEx?.baseKg || 0,
    reps: fallbackEx?.reps || 0,
    restSec: fallbackEx?.restSec || 45,
    doneSetsToday,
    totalSetsToday,
    workoutComplete: true,
  };
}

export function buildWatchSnapshot(
  state: AppState,
  dateStr: string,
  opts: {
    bleBpm?: number;
    bleDeviceName?: string | null;
    restEndTime?: number;
    activeSetStartedAt?: number;
    reminders?: WatchReminder[];
  } = {}
): WatchSnapshot {
  const macros = calculateMacros(state.p);
  const logged = sumDailyMacros(state.log[dateStr] || []);
  const statement = getHabitStatementStatus(state, dateStr);
  const readiness = getAutonomicReadiness(state, dateStr, opts.bleBpm || 0);
  const nextSet = getNextActiveSetTarget(state, dateStr);

  return {
    userName: state.p.name,
    theme: state.theme,
    pairingCode: state.watchBridge?.pairingCode || 'SYS900',
    updatedAt: Date.now(),
    streak: state.streak,
    freeze: state.freeze,
    xp: state.xp,
    isMinDue: statement.isMinimumDueMode,
    waterLitres: Number(state.water[dateStr] || 0),
    waterTargetLitres: statement.hydrationTargetLitres,
    steps: Number(state.watch.steps || 0),
    stepsTarget: statement.stepsTarget,
    sleepHours: Number(state.watch.sleep || 0),
    hrvMs: readiness.hrvMs,
    rhrBpm: readiness.rhrBpm,
    liveBpm: opts.bleBpm && opts.bleBpm > 0 ? opts.bleBpm : readiness.rhrBpm,
    bleDeviceName: opts.bleDeviceName || state.watchBridge?.connectedWatchName || null,
    kcalLogged: Math.round(logged.k),
    kcalTarget: macros.t,
    protLogged: Math.round(logged.p),
    protTarget: macros.pr,
    restEndTime: opts.restEndTime || 0,
    activeSetStartedAt: opts.activeSetStartedAt,
    nextSet,
    quickCombos: (state.combos || []).slice(0, 3).map((c, idx) => ({ idx, name: c.n })),
    reminders: opts.reminders || [],
  };
}

export interface WatchMutationResult {
  nextState: AppState;
  toastText?: string;
  restSecondsToStart?: number;
  prAchieved?: { exName: string; bestStr: string; xp: number };
}

export function applyWatchActionToState(
  prev: AppState,
  action: WatchActionEvent,
  dateStr: string
): WatchMutationResult {
  if (action.type === 'log_water') {
    const delta = Number(action.amount) || 0.25;
    const withWater: AppState = {
      ...prev,
      water: {
        ...prev.water,
        [dateStr]: Math.max(0, +(((prev.water[dateStr] || 0) + delta).toFixed(2))),
      },
      watchBridge: {
        pairingCode: prev.watchBridge?.pairingCode || 'SYS900',
        autoSync: prev.watchBridge?.autoSync ?? true,
        ...prev.watchBridge,
        lastWatchSyncAt: new Date().toISOString(),
      },
    };
    const verified = verifyQuestsState(withWater, dateStr);
    return {
      nextState: verified.nextState,
      toastText: `Watch 1-Tap: +${Math.round(delta * 1000)} ml water logged.`,
    };
  }

  if (action.type === 'toggle_min_due') {
    const current = Boolean(prev.minimumDueDays?.[dateStr]);
    const nextMap = { ...(prev.minimumDueDays || {}) };
    if (!current) nextMap[dateStr] = true;
    else delete nextMap[dateStr];
    const verified = verifyQuestsState(
      {
        ...prev,
        minimumDueDays: nextMap,
      },
      dateStr
    );
    return {
      nextState: verified.nextState,
      toastText: !current
        ? 'Watch 1-Tap: Minimum Due active (5-min streak saver).'
        : 'Watch 1-Tap: Full Plan restored.',
    };
  }

  if (action.type === 'complete_bonus') {
    const doneDay = { ...(prev.done[dateStr] || {}) };
    if (doneDay.b) {
      return {
        nextState: prev,
        toastText: 'Today’s quick stretch bonus is already marked done.',
      };
    }
    doneDay.b = true;
    const verified = verifyQuestsState(
      {
        ...prev,
        xp: prev.xp + 25,
        stats: { ...prev.stats, AGI: (prev.stats.AGI || 10) + 1 },
        done: { ...prev.done, [dateStr]: doneDay },
      },
      dateStr
    );
    return {
      nextState: verified.nextState,
      toastText: 'Watch 1-Tap: Bonus stretch/walk completed (+25 XP).',
    };
  }

  if (action.type === 'log_combo') {
    const idx = Number(action.comboIdx) || 0;
    const combo = prev.combos[idx];
    if (!combo) return { nextState: prev };
    const toAdd: LoggedFood[] = [];
    if (combo.items) {
      combo.items.forEach(([name, qty]) => {
        const hit = FOODS.find((f) => f.name === name);
        if (hit) {
          toAdd.push({
            n: qty !== 1 ? `${qty}× ${hit.name}` : hit.name,
            k: Math.round(hit.kcal * qty),
            p: +(hit.p * qty).toFixed(1),
            c: +(hit.c * qty).toFixed(1),
            f: +(hit.f * qty).toFixed(1),
            q: qty,
          });
        }
      });
    } else if (combo.raw) {
      combo.raw.forEach(([name, qty, kcal, p, c, f]) => {
        toAdd.push({
          n: qty !== 1 ? `${qty}× ${name}` : name,
          k: Math.round(kcal * qty),
          p: +(p * qty).toFixed(1),
          c: +(c * qty).toFixed(1),
          f: +(f * qty).toFixed(1),
          q: qty,
        });
      });
    }
    if (!toAdd.length) return { nextState: prev };
    const verified = verifyQuestsState(
      {
        ...prev,
        log: { ...prev.log, [dateStr]: [...(prev.log[dateStr] || []), ...toAdd] },
      },
      dateStr
    );
    return {
      nextState: verified.nextState,
      toastText: `Watch 1-Tap: Logged ${combo.n}.`,
    };
  }

  if (action.type === 'sync_telemetry') {
    const nextSteps = typeof action.steps === 'number' && action.steps >= 0 ? action.steps : prev.watch.steps;
    const nextSleep = typeof action.sleep === 'number' && action.sleep >= 0 ? action.sleep : prev.watch.sleep;
    const verified = verifyQuestsState(
      {
        ...prev,
        watch: {
          steps: nextSteps,
          sleep: nextSleep,
          hrvMs: typeof action.hrvMs === 'number' && action.hrvMs > 0 ? action.hrvMs : prev.watch.hrvMs,
          rhrBpm: typeof action.rhrBpm === 'number' && action.rhrBpm > 0 ? action.rhrBpm : prev.watch.rhrBpm,
        },
        watchBridge: {
          pairingCode: prev.watchBridge?.pairingCode || 'SYS900',
          autoSync: prev.watchBridge?.autoSync ?? true,
          ...prev.watchBridge,
          lastWatchSyncAt: new Date().toISOString(),
        },
      },
      dateStr
    );
    return {
      nextState: verified.nextState,
      toastText: `Watch Sync: ${nextSteps.toLocaleString()} steps · ${nextSleep}h sleep verified.`,
    };
  }

  if (action.type === 'complete_set') {
    const target = getNextActiveSetTarget(prev, dateStr);
    if (target.workoutComplete) {
      return { nextState: prev, toastText: `Day ${target.day} sets are already complete!` };
    }
    const sets = getExerciseSetsForState(prev, target.day, target.exIdx, target.isMinMode).map(
      (s, idx) => (idx === target.setIdx ? { ...s, done: true } : s)
    );
    const completedSet = sets[target.setIdx];
    const exList = getProgramDayExercises(
      target.day,
      prev.p,
      prev.shuf,
      target.isMinMode,
      prev.scheduleTrack,
      prev.exOverrides
    );
    const ex = exList[target.exIdx];
    let xp = prev.xp;
    const stats = { ...prev.stats };
    const prs = { ...prev.prs };
    let prAchieved: { exName: string; bestStr: string; xp: number } | undefined;

    if (ex && completedSet) {
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
      } else if (completedSet.kg > 0 && completedSet.kg === prevPr.maxKg && completedSet.reps > prevPr.repsAtMax) {
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
        prAchieved = { exName: ex.name, bestStr: updatedPr.bestStr, xp: 15 };
      }
    }

    const withSets: AppState = {
      ...prev,
      xp,
      stats,
      prs,
      setLogs: {
        ...prev.setLogs,
        [getSetLogKey(target.day, target.exIdx, target.isMinMode)]: sets,
      },
      watchBridge: {
        pairingCode: prev.watchBridge?.pairingCode || 'SYS900',
        autoSync: prev.watchBridge?.autoSync ?? true,
        ...prev.watchBridge,
        lastWatchSyncAt: new Date().toISOString(),
      },
    };

    const dayProg = { ...(withSets.prog[target.day] || {}) };
    const prefix = target.isMinMode ? 'min_' : '';
    exList.forEach((_, idx) => {
      const sList = getExerciseSetsForState(withSets, target.day, idx, target.isMinMode);
      const pk = `${prefix}${idx}`;
      if (sList.length > 0 && sList.every((s) => s.done)) dayProg[pk] = true;
    });
    const clearedCount = exList.filter((_, idx) => Boolean(dayProg[`${prefix}${idx}`])).length;
    const completionKey = target.isMinMode ? 'min' : 'x';
    if (clearedCount === exList.length && !dayProg[completionKey]) {
      dayProg[completionKey] = true;
      const bonusXp = target.isMinMode ? 15 : 25;
      withSets.xp += bonusXp;
      withSets.stats = { ...withSets.stats, STR: withSets.stats.STR + 1 };
    }
    withSets.prog = { ...withSets.prog, [target.day]: dayProg };

    const verified = verifyQuestsState(withSets, dateStr);
    return {
      nextState: verified.nextState,
      restSecondsToStart: target.restSec,
      prAchieved,
      toastText: `Watch 1-Tap: ${target.exName} Set ${target.setNumber}/${target.totalSets} done!`,
    };
  }

  return { nextState: prev };
}

export interface ParsedWearableMetrics {
  steps: number;
  sleepHours: number;
  hrvMs?: number;
  rhrBpm?: number;
  sourceLabel: string;
}

export function parseWearableHealthPayload(rawText: string): ParsedWearableMetrics | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const item = Array.isArray(parsed)
        ? (parsed[parsed.length - 1] as Record<string, unknown>)
        : (parsed as Record<string, unknown>);
      if (!item || typeof item !== 'object') return null;
      const steps = Number(
        item.steps ?? item.stepCount ?? item.totalSteps ?? item.dailySteps ?? 0
      );
      const sleepHours = Number(
        item.sleepHours ??
          item.sleep ??
          (typeof item.sleepMinutes === 'number' ? +(item.sleepMinutes / 60).toFixed(1) : 0)
      );
      const hrvMs = Number(item.hrvMs ?? item.hrv ?? item.rmssd ?? 0);
      const rhrBpm = Number(item.rhrBpm ?? item.rhr ?? item.restingHeartRate ?? 0);
      if (steps <= 0 && sleepHours <= 0 && hrvMs <= 0 && rhrBpm <= 0) return null;
      return {
        steps: Math.max(0, Math.round(steps)),
        sleepHours: Math.max(0, +sleepHours.toFixed(1)),
        ...(hrvMs > 0 ? { hrvMs: Math.round(hrvMs) } : {}),
        ...(rhrBpm > 0 ? { rhrBpm: Math.round(rhrBpm) } : {}),
        sourceLabel: String(item.source || 'Watch Export JSON'),
      };
    } catch {
      return null;
    }
  }

  // CSV parsing: header + latest row OR "steps,sleep,hrv,rhr"
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const firstCells = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const hasHeader = firstCells.some((c) => /step|sleep|hrv|rhr|bpm/.test(c));
  const dataLine = hasHeader && lines.length > 1 ? lines[lines.length - 1] : lines[0];
  const vals = dataLine.split(',').map((c) => Number(c.trim()));

  if (hasHeader && lines.length > 1) {
    const idxSteps = firstCells.findIndex((c) => c.includes('step'));
    const idxSleep = firstCells.findIndex((c) => c.includes('sleep'));
    const idxHrv = firstCells.findIndex((c) => c.includes('hrv') || c.includes('rmssd'));
    const idxRhr = firstCells.findIndex((c) => c.includes('rhr') || c.includes('resting') || c.includes('bpm'));
    const steps = idxSteps >= 0 ? vals[idxSteps] || 0 : 0;
    const sleepHours = idxSleep >= 0 ? vals[idxSleep] || 0 : 0;
    const hrvMs = idxHrv >= 0 ? vals[idxHrv] || 0 : 0;
    const rhrBpm = idxRhr >= 0 ? vals[idxRhr] || 0 : 0;
    if (steps <= 0 && sleepHours <= 0 && hrvMs <= 0 && rhrBpm <= 0) return null;
    return {
      steps: Math.max(0, Math.round(steps)),
      sleepHours: Math.max(0, +sleepHours.toFixed(1)),
      ...(hrvMs > 0 ? { hrvMs: Math.round(hrvMs) } : {}),
      ...(rhrBpm > 0 ? { rhrBpm: Math.round(rhrBpm) } : {}),
      sourceLabel: 'Watch CSV Export',
    };
  }

  if (vals.some((v) => Number.isFinite(v) && v > 0)) {
    const [steps = 0, sleepHours = 0, hrvMs = 0, rhrBpm = 0] = vals.map((v) =>
      Number.isFinite(v) ? v : 0
    );
    return {
      steps: Math.max(0, Math.round(steps)),
      sleepHours: Math.max(0, +sleepHours.toFixed(1)),
      ...(hrvMs > 0 ? { hrvMs: Math.round(hrvMs) } : {}),
      ...(rhrBpm > 0 ? { rhrBpm: Math.round(rhrBpm) } : {}),
      sourceLabel: 'Watch CSV Export',
    };
  }

  return null;
}

export function publishWatchSnapshot(snapshot: WatchSnapshot): void {
  try {
    localStorage.setItem(WATCH_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage errors
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(WATCH_CHANNEL_NAME);
      ch.postMessage({ kind: 'snapshot', snapshot } satisfies WatchBridgeEnvelope);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel unavailability
  }
}

export function readStoredWatchSnapshot(): WatchSnapshot | null {
  try {
    const raw = localStorage.getItem(WATCH_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WatchSnapshot;
  } catch {
    return null;
  }
}

export function subscribeWatchChannel(
  onMessage: (env: WatchBridgeEnvelope) => void
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(WATCH_CHANNEL_NAME);
  ch.onmessage = (ev) => {
    if (ev.data && typeof ev.data === 'object') {
      onMessage(ev.data as WatchBridgeEnvelope);
    }
  };
  return () => ch.close();
}

export function dispatchWatchActionViaBridge(
  pairingCode: string,
  action: WatchActionEvent,
  syncServer = true
): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(WATCH_CHANNEL_NAME);
      ch.postMessage({ kind: 'action', pairingCode, action } satisfies WatchBridgeEnvelope);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
  if (syncServer && typeof fetch === 'function') {
    fetch('/api/watch/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pairingCode, action }),
    }).catch(() => {
      // Offline / same-device BroadcastChannel already handled
    });
  }
}

export function pushWatchReminderViaBridge(
  pairingCode: string,
  reminder: WatchReminder
): void {
  try {
    const existing = JSON.parse(localStorage.getItem(WATCH_REMINDERS_STORAGE_KEY) || '[]') as WatchReminder[];
    const updated = [reminder, ...existing.filter((r) => r.id !== reminder.id)].slice(0, 6);
    localStorage.setItem(WATCH_REMINDERS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(WATCH_CHANNEL_NAME);
      ch.postMessage({ kind: 'reminder', pairingCode, reminder } satisfies WatchBridgeEnvelope);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
}
