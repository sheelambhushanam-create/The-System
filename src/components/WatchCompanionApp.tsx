import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bell,
  Check,
  Droplets,
  Dumbbell,
  Footprints,
  Heart,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Timer,
  Vibrate,
  Watch,
  Wifi,
} from 'lucide-react';
import type { WatchCommandType } from '../types/system';
import {
  getHapticEventForWatchCommand,
  watchHapticService,
  type HapticEvent,
  type HapticTriggerResult,
} from '../utils/haptics';
import { playChime, playTwoToneChime } from '../utils/storage';
import {
  WATCH_BRIDGE_CHANNEL,
  isValidBridgeWatchSnapshot,
  normalizeWatchPairingCode,
  type WatchSnapshot,
} from '../utils/watchBridge';

export type WatchFaceTab = 'now' | 'set' | 'water' | 'alerts';

interface WatchCompanionCoreProps {
  snapshot: WatchSnapshot;
  connectedLabel?: string;
  busyCommand?: string | null;
  onSendCommand: (
    type: WatchCommandType,
    payload?: Record<string, unknown>
  ) => Promise<void> | void;
  embedded?: boolean;
  hapticsEnabled?: boolean;
  onToggleHaptics?: (enabled: boolean) => void;
}

export const WatchCompanionFace: React.FC<WatchCompanionCoreProps> = ({
  snapshot,
  connectedLabel = 'Live Sync',
  busyCommand = null,
  onSendCommand,
  embedded = false,
  hapticsEnabled,
  onToggleHaptics,
}) => {
  const [face, setFace] = useState<WatchFaceTab>('now');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localHapticsEnabled, setLocalHapticsEnabled] = useState<boolean>(
    () => hapticsEnabled ?? snapshot.watchPrefs?.restAlertVibrate ?? true
  );
  const [lastHaptic, setLastHaptic] = useState<HapticTriggerResult | null>(null);
  const [showPulseBanner, setShowPulseBanner] = useState(false);

  const effectiveHapticsEnabled =
    typeof hapticsEnabled === 'boolean' ? hapticsEnabled : localHapticsEnabled;

  const prevRestRef = useRef<number>(snapshot.restRemainingSec);
  const skippedRestRef = useRef<boolean>(false);
  const prevAllDoneRef = useRef<boolean>(snapshot.activeWorkout.allDone);
  const prevHydrationMetRef = useRef<boolean>(
    snapshot.waterLitres >= snapshot.waterTargetLitres
  );
  const prevReminderIdsRef = useRef<Set<string>>(
    new Set(snapshot.dueReminders.map((r) => r.id))
  );
  const pulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    watchHapticService.setEnabled(effectiveHapticsEnabled);
  }, [effectiveHapticsEnabled]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  const emitHaptic = useCallback((event: HapticEvent, force = false) => {
    const res = watchHapticService.trigger(event, { force });
    setLastHaptic(res);
    setShowPulseBanner(true);
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
    pulseTimerRef.current = window.setTimeout(() => {
      setShowPulseBanner(false);
    }, 2200);
    return res;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const liveRestSec =
    snapshot.restEndTime > nowMs
      ? Math.max(0, Math.ceil((snapshot.restEndTime - nowMs) / 1000))
      : 0;

  // Short double-pulse when rest timer naturally completes
  useEffect(() => {
    if (liveRestSec > 0) {
      skippedRestRef.current = false;
    }
    if (prevRestRef.current > 0 && liveRestSec === 0) {
      if (!skippedRestRef.current) {
        emitHaptic('restComplete');
        playTwoToneChime(false);
      }
      skippedRestRef.current = false;
    }
    prevRestRef.current = liveRestSec;
  }, [liveRestSec, emitHaptic]);

  // Long celebratory vibration when all sets for the workout are completed
  useEffect(() => {
    const isNowDone = snapshot.activeWorkout.allDone;
    if (!prevAllDoneRef.current && isNowDone) {
      emitHaptic('workoutComplete');
      playTwoToneChime(false);
    }
    prevAllDoneRef.current = isNowDone;
  }, [snapshot.activeWorkout.allDone, emitHaptic]);

  // Rising triple-pulse when daily hydration target is reached
  useEffect(() => {
    const isHydrationMet =
      snapshot.waterTargetLitres > 0 &&
      snapshot.waterLitres >= snapshot.waterTargetLitres;
    if (!prevHydrationMetRef.current && isHydrationMet) {
      emitHaptic('hydrationGoal');
    }
    prevHydrationMetRef.current = isHydrationMet;
  }, [snapshot.waterLitres, snapshot.waterTargetLitres, emitHaptic]);

  // Distinct attention nudge when a new due wrist reminder arrives
  useEffect(() => {
    const currentIds = new Set(snapshot.dueReminders.map((r) => r.id));
    let hasNewReminder = false;
    currentIds.forEach((id) => {
      if (!prevReminderIdsRef.current.has(id)) {
        hasNewReminder = true;
      }
    });
    if (hasNewReminder) {
      emitHaptic('reminderAlert');
    }
    prevReminderIdsRef.current = currentIds;
  }, [snapshot.dueReminders, emitHaptic]);

  const timeStr = new Date(nowMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const waterPct = Math.min(
    100,
    Math.round((snapshot.waterLitres / Math.max(0.5, snapshot.waterTargetLitres)) * 100)
  );
  const stepsPct = Math.min(
    100,
    Math.round((snapshot.steps / Math.max(500, snapshot.stepsTarget)) * 100)
  );
  const restTotal = Math.max(1, snapshot.activeWorkout.restSec || 45);
  const restPct = liveRestSec > 0 ? Math.min(100, Math.round((liveRestSec / restTotal) * 100)) : 0;

  const fireCommand = (type: WatchCommandType, payload?: Record<string, unknown>) => {
    if (type === 'SKIP_REST') {
      skippedRestRef.current = true;
    }
    emitHaptic(getHapticEventForWatchCommand(type));
    playChime(type === 'COMPLETE_NEXT_SET' ? 720 : 600, 0.08, false);
    void onSendCommand(type, payload);
  };

  const handleToggleHaptics = () => {
    const next = !effectiveHapticsEnabled;
    setLocalHapticsEnabled(next);
    watchHapticService.setEnabled(next);
    onToggleHaptics?.(next);
    if (next) {
      emitHaptic('tap', true);
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-[310px] select-none rounded-[42px] border-4 p-3 shadow-xl"
      style={{
        backgroundColor: '#070c14',
        borderColor: '#1e293b',
        color: '#f8fafc',
      }}
      data-testid="watch-companion-face"
      data-haptic-enabled={String(effectiveHapticsEnabled)}
      data-haptic-last-event={lastHaptic?.event ?? ''}
      data-haptic-last-pattern={lastHaptic ? lastHaptic.pattern.join(',') : ''}
    >
      {/* Watch Bezel Top Status */}
      <div className="flex items-center justify-between px-2 pt-1 text-[11px]">
        <span className="font-mono-num font-bold tracking-tight text-slate-100">{timeStr}</span>
        <span className="font-mono-num flex items-center gap-1 text-[10px] text-cyan-300">
          <Wifi className="h-3 w-3" aria-hidden="true" />
          <span>{connectedLabel}</span>
        </span>
        <span className="font-mono-num flex items-center gap-1 text-[10px] text-rose-300">
          <Heart className="h-3 w-3" aria-hidden="true" />
          <span>{snapshot.liveBpm}</span>
        </span>
      </div>

      {/* Watch Inner OLED Screen */}
      <div
        className="mt-2 flex min-h-[296px] flex-col justify-between rounded-[30px] border border-slate-800 bg-slate-950/95 p-3.5"
      >
        {showPulseBanner && lastHaptic && (
          <div
            role="status"
            aria-live="polite"
            className="font-mono-num mb-2 flex items-center justify-between gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-950/45 px-2.5 py-1 text-[10px] text-cyan-200"
          >
            <span className="flex items-center gap-1 truncate font-semibold">
              <Vibrate className="h-3 w-3 shrink-0 text-cyan-300" aria-hidden="true" />
              <span className="truncate">
                {effectiveHapticsEnabled ? lastHaptic.label : 'Haptics Muted'}
              </span>
            </span>
            <span className="shrink-0 text-[9px] text-cyan-300/90">
              {effectiveHapticsEnabled ? `${lastHaptic.pattern.join('-')}ms` : 'off'}
            </span>
          </div>
        )}
        {face === 'now' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate font-semibold text-slate-200">{snapshot.userName}</span>
              <span className="font-mono-num">
                Day {snapshot.dayNum} · {snapshot.streak}d
              </span>
            </div>

            {/* Dual Wrist Progress Rings */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
                <div className="font-mono-num text-base font-bold text-cyan-300">
                  {snapshot.waterLitres.toFixed(2)}L
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  Water · {waterPct}%
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${waterPct}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
                <div className="font-mono-num text-base font-bold text-emerald-300">
                  {snapshot.steps.toLocaleString()}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  Steps · {stepsPct}%
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${stepsPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Primary 1-Tap Context Card */}
            {liveRestSec > 0 ? (
              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/30 p-3 text-center">
                <div className="text-[11px] font-medium text-cyan-200">Rest Countdown</div>
                <div className="font-mono-num mt-0.5 text-2xl font-bold text-cyan-300">
                  {liveRestSec}s
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => fireCommand('ADD_REST_15')}
                    className="min-h-[38px] rounded-xl bg-slate-800 px-2 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    +15s
                  </button>
                  <button
                    type="button"
                    onClick={() => fireCommand('SKIP_REST')}
                    className="min-h-[38px] rounded-xl bg-rose-500/20 px-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : !snapshot.activeWorkout.allDone ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Next Up</span>
                  <span className="font-mono-num">
                    Set {snapshot.activeWorkout.setIdx + 1}/{snapshot.activeWorkout.totalSets}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-white">
                  {snapshot.activeWorkout.exerciseName}
                </div>
                <div className="font-mono-num text-[11px] text-cyan-300">
                  {snapshot.activeWorkout.targetLabel}
                </div>
                <button
                  type="button"
                  disabled={busyCommand === 'COMPLETE_NEXT_SET'}
                  onClick={() => fireCommand('COMPLETE_NEXT_SET')}
                  className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-xs font-bold text-slate-950 active:scale-[0.98]"
                >
                  <Check className="h-4 w-4" />
                  <span>1-Tap Complete Set</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fireCommand('LOG_WATER_250')}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-3 text-xs font-bold text-slate-950 active:scale-[0.98]"
              >
                <Droplets className="h-4 w-4" />
                <span>Drink +250 ml Water</span>
              </button>
            )}

            {/* Quick 1-Tap Bottom Pair */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => fireCommand('LOG_WATER_250')}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-cyan-200 hover:bg-slate-800"
              >
                <Droplets className="h-3.5 w-3.5" />
                <span>+250 ml</span>
              </button>
              <button
                type="button"
                onClick={() => fireCommand('SYNC_TELEMETRY')}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-emerald-200 hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync Watch</span>
              </button>
            </div>
          </div>
        )}

        {face === 'set' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Active Workout</span>
              <span className="font-mono-num text-emerald-300">
                {snapshot.activeWorkout.completedSetsToday}/{snapshot.activeWorkout.totalSetsToday} sets
              </span>
            </div>

            {liveRestSec > 0 ? (
              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/30 p-3 text-center">
                <div className="text-[11px] text-cyan-200">Rest Timer</div>
                <div className="font-mono-num mt-1 text-3xl font-bold text-cyan-300">
                  {liveRestSec}s
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${restPct}%` }}
                  />
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fireCommand('ADD_REST_15')}
                    className="min-h-[42px] rounded-xl bg-slate-800 text-xs font-semibold text-white"
                  >
                    +15 sec
                  </button>
                  <button
                    type="button"
                    onClick={() => fireCommand('SKIP_REST')}
                    className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-rose-500/25 text-xs font-semibold text-rose-200"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    <span>Skip</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3">
                <div className="truncate text-sm font-bold text-white">
                  {snapshot.activeWorkout.exerciseName}
                </div>
                <div className="font-mono-num mt-1 flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span className="whitespace-nowrap">
                    {snapshot.activeWorkout.allDone
                      ? `${snapshot.activeWorkout.completedSetsToday}/${snapshot.activeWorkout.totalSetsToday} sets logged`
                      : `Set ${snapshot.activeWorkout.setIdx + 1} of ${snapshot.activeWorkout.totalSets}`}
                  </span>
                  <span className="whitespace-nowrap font-bold text-cyan-300">
                    {snapshot.activeWorkout.allDone ? 'Complete' : snapshot.activeWorkout.targetLabel}
                  </span>
                </div>

                {!snapshot.activeWorkout.allDone ? (
                  <button
                    type="button"
                    onClick={() => fireCommand('COMPLETE_NEXT_SET')}
                    className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-400 px-3 text-xs font-bold text-slate-950 active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" />
                    <span>Done Set &amp; Start {snapshot.activeWorkout.restSec}s Rest</span>
                  </button>
                ) : (
                  <div className="mt-3 rounded-xl bg-emerald-950/60 p-2.5 text-center text-xs font-semibold text-emerald-300">
                    Day {snapshot.dayNum} Workout Complete
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => fireCommand('START_REST_45')}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-200"
              >
                <Timer className="h-3.5 w-3.5 text-cyan-300" />
                <span>45s Rest</span>
              </button>
              <button
                type="button"
                onClick={() => fireCommand('TOGGLE_MIN_DUE')}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-amber-200"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{snapshot.isMinimumDueMode ? 'Full Plan' : 'Min Due'}</span>
              </button>
            </div>
          </div>
        )}

        {face === 'water' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>1-Tap Hydration &amp; Habits</span>
              <span className="font-mono-num text-cyan-300">
                {snapshot.waterLitres.toFixed(2)}/{snapshot.waterTargetLitres.toFixed(1)}L
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fireCommand('LOG_WATER_250')}
                className="flex min-h-[54px] flex-col items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 active:scale-[0.98]"
              >
                <span className="font-mono-num text-sm font-bold">+250 ml</span>
                <span className="text-[10px] font-semibold">1 Glass</span>
              </button>
              <button
                type="button"
                onClick={() => fireCommand('LOG_WATER_500')}
                className="flex min-h-[54px] flex-col items-center justify-center rounded-2xl border border-cyan-400/50 bg-cyan-950/40 text-cyan-200 active:scale-[0.98]"
              >
                <span className="font-mono-num text-sm font-bold">+500 ml</span>
                <span className="text-[10px] font-semibold">1 Bottle</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => fireCommand('LOG_WALK_1500')}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-emerald-200"
            >
              <span className="flex items-center gap-1.5">
                <Footprints className="h-3.5 w-3.5" />
                <span>5-Min Post-Meal Walk</span>
              </span>
              <span className="font-mono-num text-[11px]">+1,500</span>
            </button>

            <button
              type="button"
              onClick={() => fireCommand('TOGGLE_STRETCH')}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-slate-200"
            >
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-amber-300" />
                <span>2-Min Stretch Reset</span>
              </span>
              <span className="font-mono-num text-[11px] text-amber-300">1-Tap</span>
            </button>
          </div>
        )}

        {face === 'alerts' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Wrist Reminders</span>
              <span className="font-mono-num text-amber-300">
                {snapshot.dueReminders.length} due
              </span>
            </div>

            <div className="max-h-[168px] space-y-2 overflow-y-auto pr-0.5">
              {snapshot.dueReminders.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-center text-xs text-slate-300">
                  All watch reminders caught up!
                </div>
              ) : (
                snapshot.dueReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-2.5"
                  >
                    <div className="text-xs font-bold text-white">{rem.title}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{rem.subtitle}</div>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => fireCommand(rem.primaryAction)}
                        className="min-h-[34px] flex-1 rounded-lg bg-cyan-400 px-2 text-[11px] font-bold text-slate-950"
                      >
                        {rem.primaryLabel}
                      </button>
                      {rem.secondaryAction && (
                        <button
                          type="button"
                          onClick={() => fireCommand(rem.secondaryAction!)}
                          className="min-h-[34px] rounded-lg bg-slate-800 px-2 text-[11px] font-semibold text-slate-300"
                        >
                          {rem.secondaryLabel}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => fireCommand('SYNC_TELEMETRY')}
              className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-xs font-semibold text-emerald-200"
            >
              <Vibrate className="h-3.5 w-3.5" />
              <span>Push Watch Steps &amp; HR Now</span>
            </button>
          </div>
        )}

        {/* Watch Bottom Tile Switcher */}
        <nav
          aria-label="Watch screens"
          className="mt-2.5 grid grid-cols-4 gap-1 border-t border-slate-800 pt-2"
        >
          {(
            [
              ['now', 'Now', <Watch key="w" className="h-3.5 w-3.5" />],
              ['set', 'Set', <Dumbbell key="d" className="h-3.5 w-3.5" />],
              ['water', 'Water', <Droplets key="dr" className="h-3.5 w-3.5" />],
              ['alerts', 'Alerts', <Bell key="b" className="h-3.5 w-3.5" />],
            ] as const
          ).map(([id, label, icon]) => {
            const active = face === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (face !== id) {
                    emitHaptic('tap');
                    setFace(id);
                  }
                }}
                className="flex min-h-[38px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors"
                style={{
                  backgroundColor: active ? 'rgba(34, 211, 238, 0.16)' : 'transparent',
                  color: active ? '#67e8f9' : '#94a3b8',
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Physical Watch Crown / Code & Haptic Footer */}
      <div className="mt-2 flex items-center justify-between gap-2 px-3 text-[10px] text-slate-400">
        <span className="font-mono-num whitespace-nowrap">
          Pair: {snapshot.code}
        </span>
        <button
          type="button"
          onClick={handleToggleHaptics}
          aria-label={effectiveHapticsEnabled ? 'Mute watch haptics' : 'Enable watch haptics'}
          aria-pressed={effectiveHapticsEnabled}
          className="inline-flex min-h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors"
          style={{
            borderColor: effectiveHapticsEnabled
              ? 'rgba(34, 211, 238, 0.4)'
              : 'rgba(148, 163, 184, 0.3)',
            color: effectiveHapticsEnabled ? '#67e8f9' : '#94a3b8',
            backgroundColor: effectiveHapticsEnabled
              ? 'rgba(34, 211, 238, 0.1)'
              : 'transparent',
          }}
        >
          <Vibrate className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{effectiveHapticsEnabled ? 'Haptics On' : 'Haptics Off'}</span>
        </button>
      </div>
    </div>
  );
};

interface StandaloneWatchAppProps {
  initialCode?: string;
  localFallbackSnapshot: WatchSnapshot;
  onExitWatchMode?: () => void;
  onLocalCommand?: (type: WatchCommandType, payload?: Record<string, unknown>) => void;
}

export const StandaloneWatchApp: React.FC<StandaloneWatchAppProps> = ({
  initialCode = '',
  localFallbackSnapshot,
  onExitWatchMode,
  onLocalCommand,
}) => {
  const [codeInput, setCodeInput] = useState(() =>
    normalizeWatchPairingCode(initialCode || localFallbackSnapshot.code)
  );
  const [activeCode, setActiveCode] = useState(() =>
    normalizeWatchPairingCode(initialCode || localFallbackSnapshot.code)
  );
  const [snapshot, setSnapshot] = useState<WatchSnapshot>(localFallbackSnapshot);
  const [connectionMode, setConnectionMode] = useState<'local' | 'cloud' | 'live'>('local');
  const [statusNote, setStatusNote] = useState('Paired and ready for 1-tap actions.');
  const [busyCmd, setBusyCmd] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot((prev) =>
      prev.code === localFallbackSnapshot.code && localFallbackSnapshot.updatedAt >= prev.updatedAt
        ? localFallbackSnapshot
        : prev
    );
  }, [localFallbackSnapshot]);

  // Channel 1: Same-device instant BroadcastChannel sync
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(WATCH_BRIDGE_CHANNEL);
    bc.onmessage = (ev: MessageEvent<{ kind?: string; snapshot?: WatchSnapshot }>) => {
      if (ev.data?.kind === 'snapshot' && isValidBridgeWatchSnapshot(ev.data.snapshot)) {
        if (
          !activeCode ||
          normalizeWatchPairingCode(ev.data.snapshot.code) === activeCode
        ) {
          setSnapshot(ev.data.snapshot);
          setConnectionMode('live');
        }
      }
    };
    bc.postMessage({ kind: 'hello', code: activeCode });
    return () => bc.close();
  }, [activeCode]);

  // Channel 2: Cross-device Server-Sent Events + polling fallback
  useEffect(() => {
    if (!activeCode) return;
    let closed = false;
    let es: EventSource | null = null;

    const fetchLatest = async () => {
      try {
        const res = await fetch(`/api/watch/state?code=${encodeURIComponent(activeCode)}`);
        if (res.ok && !closed) {
          const data = (await res.json()) as { snapshot?: unknown };
          if (isValidBridgeWatchSnapshot(data.snapshot)) {
            const nextSnap = data.snapshot;
            setSnapshot((prev) =>
              nextSnap.updatedAt >= prev.updatedAt ? nextSnap : prev
            );
            setConnectionMode('cloud');
          }
        }
      } catch {
        // Offline / local BroadcastChannel handles same-device
      }
    };

    void fetchLatest();

    if (typeof EventSource !== 'undefined') {
      es = new EventSource(`/api/watch/stream?code=${encodeURIComponent(activeCode)}`);
      es.addEventListener('snapshot', (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data) as unknown;
          if (!closed && isValidBridgeWatchSnapshot(parsed)) {
            setSnapshot((prev) =>
              parsed.updatedAt >= prev.updatedAt ? parsed : prev
            );
            setConnectionMode('live');
          }
        } catch {
          // Ignore malformed event
        }
      });
    }

    const pollId = window.setInterval(fetchLatest, 4000);
    return () => {
      closed = true;
      window.clearInterval(pollId);
      es?.close();
    };
  }, [activeCode]);

  const sendWatchCommand = useCallback(
    async (type: WatchCommandType, payload?: Record<string, unknown>) => {
      setBusyCmd(type);
      onLocalCommand?.(type, payload);
      const code = activeCode || snapshot.code;
      const envelope = {
        id: `wcmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code,
        type,
        payload,
        createdAt: Date.now(),
        source: 'standalone_watch_app',
      };

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(WATCH_BRIDGE_CHANNEL);
        bc.postMessage({ kind: 'command', command: envelope });
        bc.close();
      }

      try {
        await fetch('/api/watch/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(envelope),
        });
        setStatusNote(`Sent ${type.replace(/_/g, ' ').toLowerCase()} to ${code}`);
      } catch {
        setStatusNote('Synced locally on this device.');
      } finally {
        setBusyCmd(null);
      }
    },
    [activeCode, snapshot.code, onLocalCommand]
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-3">
        {onExitWatchMode ? (
          <button
            type="button"
            onClick={onExitWatchMode}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Phone App</span>
          </button>
        ) : (
          <div className="font-display text-sm font-bold text-slate-100">
            The System · Watch
          </div>
        )}
        <span className="font-mono-num text-xs text-cyan-300">
          {connectionMode === 'live'
            ? 'Live Sync'
            : connectionMode === 'cloud'
              ? 'Cloud Paired'
              : 'Device Ready'}
        </span>
      </div>

      <WatchCompanionFace
        snapshot={snapshot}
        connectedLabel={
          connectionMode === 'live' ? 'Live' : connectionMode === 'cloud' ? 'Synced' : 'Paired'
        }
        busyCommand={busyCmd}
        onSendCommand={sendWatchCommand}
      />

      <div className="mt-5 w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs">
        <div className="font-semibold text-slate-200">Pair With Another Device</div>
        <p className="mt-1 text-slate-400">{statusNote}</p>
        <div className="mt-2.5 flex gap-2">
          <label htmlFor="watch-pair-code-input" className="sr-only">
            Watch pairing code
          </label>
          <input
            id="watch-pair-code-input"
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(normalizeWatchPairingCode(e.target.value))}
            placeholder="6-char code"
            className="font-mono-num min-h-[40px] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs font-bold uppercase text-white"
          />
          <button
            type="button"
            onClick={() => {
              const norm = normalizeWatchPairingCode(codeInput);
              if (norm) {
                setActiveCode(norm);
                setStatusNote(`Listening for pairing code ${norm}…`);
              }
            }}
            className="min-h-[40px] rounded-xl bg-cyan-400 px-4 text-xs font-bold text-slate-950"
          >
            Pair
          </button>
        </div>
      </div>
    </div>
  );
};
