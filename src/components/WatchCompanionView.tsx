import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  Bluetooth,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  HeartPulse,
  Play,
  ShieldCheck,
  Sparkles,
  Timer,
  Utensils,
  Watch,
} from 'lucide-react';
import type {
  WatchActionEvent,
  WatchActionType,
  WatchReminder,
  WatchSnapshot,
} from '../types/system';
import { watchHapticService } from '../utils/haptics';
import {
  WATCH_REMINDERS_STORAGE_KEY,
  dispatchWatchActionViaBridge,
  readStoredWatchSnapshot,
  subscribeWatchChannel,
} from '../utils/watchSync';

interface WatchCompanionViewProps {
  variant?: 'embedded' | 'standalone';
  snapshot?: WatchSnapshot | null;
  pairingCode?: string;
  onDispatchAction?: (action: WatchActionEvent) => void;
  onConnectBle?: () => void;
  onExitStandalone?: () => void;
}

type WatchFaceTab = 'workout' | 'quick' | 'vitals';

export const WatchCompanionView: React.FC<WatchCompanionViewProps> = ({
  variant = 'embedded',
  snapshot: propSnapshot,
  pairingCode: propCode,
  onDispatchAction,
  onConnectBle,
  onExitStandalone,
}) => {
  const [faceTab, setFaceTab] = useState<WatchFaceTab>('workout');
  const [dialShape, setDialShape] = useState<'square' | 'round'>('square');
  const [nowClock, setNowClock] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [remoteSnapshot, setRemoteSnapshot] = useState<WatchSnapshot | null>(
    () => propSnapshot || readStoredWatchSnapshot()
  );
  const [reminders, setReminders] = useState<WatchReminder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(WATCH_REMINDERS_STORAGE_KEY) || '[]') as WatchReminder[];
    } catch {
      return [];
    }
  });
  const [localCode, setLocalCode] = useState(() => {
    if (propCode) return propCode;
    const params = new URLSearchParams(window.location.search);
    return (params.get('code') || readStoredWatchSnapshot()?.pairingCode || 'SYS742').toUpperCase();
  });
  const [localSetStartedAt, setLocalSetStartedAt] = useState<number>(0);
  const [setElapsedSec, setSetElapsedSec] = useState<number>(0);
  const [restLeftSec, setRestLeftSec] = useState<number>(0);
  const [lastTapLabel, setLastTapLabel] = useState<string>('');

  const activeSnapshot = propSnapshot || remoteSnapshot;
  const effectiveCode = (propCode || activeSnapshot?.pairingCode || localCode || 'SYS742').toUpperCase();

  // Clock ticker
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  // Live subscription to BroadcastChannel + server polling in standalone mode
  useEffect(() => {
    const unsub = subscribeWatchChannel((env) => {
      if (env.kind === 'snapshot') {
        if (env.snapshot.pairingCode === effectiveCode || !propCode) {
          setRemoteSnapshot(env.snapshot);
        }
      } else if (env.kind === 'reminder') {
        if (env.pairingCode === effectiveCode) {
          watchHapticService.trigger('reminderAlert');
          setReminders((prev) => [env.reminder, ...prev.filter((r) => r.id !== env.reminder.id)].slice(0, 4));
        }
      }
    });

    const onStorage = (ev: StorageEvent) => {
      if (ev.key && ev.key.includes('thesystem_watch')) {
        const stored = readStoredWatchSnapshot();
        if (stored) setRemoteSnapshot(stored);
      }
    };
    window.addEventListener('storage', onStorage);

    let pollId: number | undefined;
    if (variant === 'standalone') {
      const pull = async () => {
        try {
          const res = await fetch(`/api/watch/state?code=${encodeURIComponent(effectiveCode)}`);
          if (res.ok) {
            const data = (await res.json()) as { snapshot?: WatchSnapshot };
            if (data.snapshot) setRemoteSnapshot(data.snapshot);
          }
        } catch {
          // Offline / local BroadcastChannel active
        }
      };
      void pull();
      pollId = window.setInterval(pull, 2500);
    }

    return () => {
      unsub();
      window.removeEventListener('storage', onStorage);
      if (pollId) window.clearInterval(pollId);
    };
  }, [effectiveCode, propCode, variant]);

  const effectiveSetStartedAt = activeSnapshot?.activeSetStartedAt || localSetStartedAt;

  // Elapsed active set & rest timer ticker on watch dial
  useEffect(() => {
    const tick = () => {
      if (effectiveSetStartedAt > 0) {
        setSetElapsedSec(Math.max(0, Math.floor((Date.now() - effectiveSetStartedAt) / 1000)));
      } else {
        setSetElapsedSec(0);
      }
      const restEnd = activeSnapshot?.restEndTime || 0;
      if (restEnd > Date.now()) {
        setRestLeftSec(Math.ceil((restEnd - Date.now()) / 1000));
      } else {
        setRestLeftSec(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [effectiveSetStartedAt, activeSnapshot?.restEndTime]);

  const mergedReminders = useMemo(() => {
    const fromSnap = activeSnapshot?.reminders || [];
    const seen = new Set<string>();
    const combined: WatchReminder[] = [];
    [...fromSnap, ...reminders].forEach((r) => {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push(r);
      }
    });
    return combined;
  }, [activeSnapshot?.reminders, reminders]);

  const sendAction = (
    type: WatchActionType,
    extra: Partial<Omit<WatchActionEvent, 'id' | 'type' | 'ts'>> = {},
    feedback?: string
  ) => {
    watchHapticService.trigger(
      type === 'complete_set'
        ? 'setComplete'
        : type === 'log_water'
          ? 'waterLog'
          : type === 'sync_telemetry'
            ? 'syncComplete'
            : 'tap'
    );
    const ev: WatchActionEvent = {
      id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      source: variant === 'standalone' ? 'watch_standalone' : 'watch_dial',
      ts: Date.now(),
      ...extra,
    };

    if (type === 'start_set') {
      setLocalSetStartedAt(Date.now());
    } else if (type === 'complete_set') {
      setLocalSetStartedAt(0);
    }

    if (onDispatchAction) {
      onDispatchAction(ev);
    } else {
      dispatchWatchActionViaBridge(effectiveCode, ev, true);
    }
    if (feedback) {
      setLastTapLabel(feedback);
      window.setTimeout(() => setLastTapLabel((curr) => (curr === feedback ? '' : curr)), 2600);
    }
  };

  const dismissReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    sendAction('ack_reminder', { reminderId: id });
  };

  const nextSet = activeSnapshot?.nextSet;
  const waterPct = activeSnapshot
    ? Math.min(100, Math.round((activeSnapshot.waterLitres / Math.max(0.5, activeSnapshot.waterTargetLitres)) * 100))
    : 0;
  const stepsPct = activeSnapshot
    ? Math.min(100, Math.round((activeSnapshot.steps / Math.max(1000, activeSnapshot.stepsTarget)) * 100))
    : 0;

  const isRound = dialShape === 'round' && variant === 'embedded';

  const watchScreen = (
    <div
      className={`relative flex flex-col justify-between overflow-hidden border-2 bg-[#070b14] text-slate-100 shadow-2xl ${
        isRound
          ? 'mx-auto h-[388px] w-[388px] max-w-full rounded-full px-10 py-6'
          : variant === 'standalone'
            ? 'mx-auto min-h-[430px] w-full max-w-[390px] rounded-[42px] p-5'
            : 'mx-auto min-h-[385px] w-full max-w-[330px] rounded-[40px] p-4'
      }`}
      style={{
        borderColor: 'rgba(0, 229, 255, 0.38)',
      }}
      data-testid="watch-companion-dial"
    >
      {/* Top Watch Status Line */}
      <div
        className={`flex items-center text-[11px] ${
          isRound ? 'mx-auto justify-center gap-3.5' : 'justify-between gap-2'
        }`}
      >
        <span className="font-mono-num font-bold text-cyan-400">{nowClock}</span>
        <span className="font-mono-num inline-flex items-center gap-1 text-rose-400">
          <HeartPulse className="h-3 w-3" />
          {activeSnapshot ? `${activeSnapshot.liveBpm} bpm` : '-- bpm'}
        </span>
        <span className="font-mono-num inline-flex items-center gap-0.5 text-amber-400">
          <Flame className="h-3 w-3" />
          {activeSnapshot?.streak ?? 0}d
        </span>
      </div>

      {/* Main Scroll-Safe Center Chord Area */}
      <div className={`my-2 flex-1 overflow-y-auto ${isRound ? 'mx-auto w-full max-w-[292px] pr-0.5' : ''}`}>
        {/* Incoming Push Reminder Banner on Watch */}
        {mergedReminders.length > 0 && (
          <div
            className="mb-2 rounded-2xl border border-cyan-400/50 bg-cyan-950/60 p-2.5 text-left"
            role="status"
          >
            <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-cyan-300">
              <span className="inline-flex items-center gap-1">
                <BellRing className="h-3 w-3" />
                {mergedReminders[0].title}
              </span>
              <button
                type="button"
                onClick={() => dismissReminder(mergedReminders[0].id)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-200">{mergedReminders[0].body}</p>
            <button
              type="button"
              onClick={() => {
                const r = mergedReminders[0];
                sendAction(
                  r.actionType,
                  r.actionAmount ? { amount: r.actionAmount } : {},
                  `${r.ctaLabel} synced`
                );
                dismissReminder(r.id);
              }}
              className="mt-2 min-h-[34px] w-full rounded-xl bg-cyan-400 px-3 text-xs font-bold text-slate-950"
            >
              {mergedReminders[0].ctaLabel}
            </button>
          </div>
        )}
        {!activeSnapshot ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <Watch className="h-8 w-8 text-cyan-400" />
            <div className="mt-2 text-sm font-bold">Connecting Watch Bridge…</div>
            <p className="mt-1 text-xs text-slate-400">
              Code <span className="font-mono-num font-bold text-cyan-300">{effectiveCode}</span> · Open
              The System dashboard to stream live workouts &amp; reminders.
            </p>
          </div>
        ) : faceTab === 'workout' ? (
          <div className="flex h-full flex-col justify-between space-y-2.5">
            {restLeftSec > 0 ? (
              <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/40 p-3 text-center">
                <div className="text-[11px] font-semibold text-emerald-300">REST INTERVAL</div>
                <div className="font-mono-num mt-0.5 text-3xl font-bold text-white">
                  {restLeftSec}s
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => sendAction('extend_rest', { amount: 15 }, '+15s rest')}
                    className="min-h-[36px] rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-white"
                  >
                    +15s
                  </button>
                  <button
                    type="button"
                    onClick={() => sendAction('skip_rest', {}, 'Rest skipped')}
                    className="min-h-[36px] rounded-xl bg-rose-500/20 text-xs font-semibold text-rose-300"
                  >
                    Skip Rest
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Day {nextSet?.day} {nextSet?.isMinMode ? '· Min Due' : ''}
                </span>
                <span className="font-mono-num text-cyan-300">
                  {nextSet?.doneSetsToday}/{nextSet?.totalSetsToday} sets
                </span>
              </div>
              <div className="mt-1 truncate text-sm font-bold text-white">
                {nextSet?.workoutComplete ? 'Session Complete!' : nextSet?.exName}
              </div>
              <div className="font-mono-num mt-0.5 text-xs text-slate-300">
                {nextSet?.workoutComplete
                  ? 'All planned sets logged today'
                  : `Set ${nextSet?.setNumber}/${nextSet?.totalSets} · ${
                      (nextSet?.kg || 0) > 0 ? `${nextSet?.kg} kg × ` : ''
                    }${nextSet?.reps} reps`}
              </div>
            </div>

            {nextSet && !nextSet.workoutComplete ? (
              effectiveSetStartedAt > 0 ? (
                <div className="space-y-2">
                  <div className="font-mono-num flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-300">
                    <Timer className="h-3.5 w-3.5" />
                    <span>Set Active · {setElapsedSec}s elapsed</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendAction('complete_set', {}, 'Set completed + rest started')}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-3 text-sm font-extrabold text-slate-950 transition-transform active:scale-95"
                  >
                    <Check className="h-4 w-4" />
                    <span>1-Tap Complete Set</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => sendAction('start_set', {}, 'Set timer started')}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-cyan-400 px-2 text-xs font-extrabold text-slate-950 transition-transform active:scale-95"
                  >
                    <Play className="h-4 w-4" />
                    <span>Start Set</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sendAction('complete_set', {}, 'Set logged!')}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/60 bg-emerald-500/20 px-2 text-xs font-bold text-emerald-300 transition-transform active:scale-95"
                  >
                    <Check className="h-4 w-4" />
                    <span>Quick Done</span>
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={() => sendAction('log_water', { amount: 0.25 }, '+250 ml post-workout')}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-3 text-xs font-extrabold text-slate-950"
              >
                <Droplets className="h-4 w-4" />
                <span>1-Tap Post-Workout +250 ml</span>
              </button>
            )}
          </div>
        ) : faceTab === 'quick' ? (
          <div className="space-y-2.5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-300">
                  <Droplets className="h-3.5 w-3.5" />
                  Water
                </span>
                <span className="font-mono-num font-bold">
                  {activeSnapshot.waterLitres.toFixed(2)} / {activeSnapshot.waterTargetLitres.toFixed(1)} L ({waterPct}%)
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => sendAction('log_water', { amount: 0.25 }, '+250 ml water')}
                  className="min-h-[42px] rounded-xl bg-cyan-400 text-xs font-extrabold text-slate-950"
                >
                  +250 ml
                </button>
                <button
                  type="button"
                  onClick={() => sendAction('log_water', { amount: 0.5 }, '+500 ml water')}
                  className="min-h-[42px] rounded-xl border border-cyan-400/50 bg-cyan-950/60 text-xs font-bold text-cyan-200"
                >
                  +500 ml
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => sendAction('complete_bonus', {}, '2-min stretch done!')}
                className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-2 text-[11px] font-bold text-emerald-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>2m Stretch</span>
              </button>
              <button
                type="button"
                onClick={() => sendAction('toggle_min_due', {}, 'Minimum Due toggled')}
                className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-amber-400/40 bg-amber-950/40 px-2 text-[11px] font-bold text-amber-300"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{activeSnapshot.isMinDue ? 'Min Due: ON' : 'Min Due'}</span>
              </button>
            </div>

            {activeSnapshot.quickCombos.length > 0 && (
              <div className="space-y-1.5">
                {activeSnapshot.quickCombos.slice(0, 2).map((combo) => (
                  <button
                    key={combo.idx}
                    type="button"
                    onClick={() => sendAction('log_combo', { comboIdx: combo.idx }, `Logged ${combo.name}`)}
                    className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 text-[11px] font-semibold text-slate-200"
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Utensils className="h-3 w-3 shrink-0 text-amber-400" />
                      <span className="truncate">{combo.name}</span>
                    </span>
                    <span className="shrink-0 text-cyan-400">+1 Tap</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] text-slate-400">Steps ({stepsPct}%)</div>
                <div className="font-mono-num mt-0.5 text-sm font-bold text-cyan-300">
                  {activeSnapshot.steps.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] text-slate-400">Sleep · HRV</div>
                <div className="font-mono-num mt-0.5 text-sm font-bold text-emerald-300">
                  {activeSnapshot.sleepHours}h · {activeSnapshot.hrvMs}ms
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] text-slate-400">Nutrition</div>
                <div className="font-mono-num mt-0.5 text-xs font-bold text-white">
                  {activeSnapshot.kcalLogged}/{activeSnapshot.kcalTarget} cal
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] text-slate-400">Protein</div>
                <div className="font-mono-num mt-0.5 text-xs font-bold text-amber-300">
                  {activeSnapshot.protLogged}/{activeSnapshot.protTarget} g
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  sendAction(
                    'sync_telemetry',
                    {
                      steps: activeSnapshot.steps + 1000,
                      sleep: activeSnapshot.sleepHours || 7.5,
                      hrvMs: activeSnapshot.hrvMs,
                      rhrBpm: activeSnapshot.liveBpm,
                    },
                    '+1,000 watch steps synced'
                  )
                }
                className="min-h-[40px] rounded-xl bg-cyan-400 px-2 text-xs font-extrabold text-slate-950"
              >
                +1k Watch Steps
              </button>
              {onConnectBle && (
                <button
                  type="button"
                  onClick={onConnectBle}
                  className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-cyan-400/50 bg-cyan-950/60 px-2 text-xs font-bold text-cyan-200"
                >
                  <Bluetooth className="h-3.5 w-3.5" />
                  <span>{activeSnapshot.bleDeviceName ? 'BLE Live' : 'Pair BLE'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sync Confirmation Line */}
      {lastTapLabel && (
        <div className="font-mono-num mb-1.5 text-center text-[10px] font-semibold text-emerald-400">
          {lastTapLabel}
        </div>
      )}

      {/* Bottom Watch Tab Switcher */}
      <div
        className={`grid grid-cols-3 gap-1 bg-slate-900 p-1 text-[10px] font-semibold ${
          isRound ? 'mx-auto w-[226px] rounded-full' : 'rounded-2xl'
        }`}
      >
        <button
          type="button"
          onClick={() => setFaceTab('workout')}
          className={`flex min-h-[34px] items-center justify-center gap-1 ${
            isRound ? 'rounded-full' : 'rounded-xl'
          } ${faceTab === 'workout' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}
        >
          <Dumbbell className="h-3 w-3" />
          <span>Train</span>
        </button>
        <button
          type="button"
          onClick={() => setFaceTab('quick')}
          className={`flex min-h-[34px] items-center justify-center gap-1 ${
            isRound ? 'rounded-full' : 'rounded-xl'
          } ${faceTab === 'quick' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}
        >
          <Droplets className="h-3 w-3" />
          <span>Water+</span>
        </button>
        <button
          type="button"
          onClick={() => setFaceTab('vitals')}
          className={`flex min-h-[34px] items-center justify-center gap-1 ${
            isRound ? 'rounded-full' : 'rounded-xl'
          } ${faceTab === 'vitals' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}
        >
          <Activity className="h-3 w-3" />
          <span>Vitals</span>
        </button>
      </div>
    </div>
  );

  if (variant === 'standalone') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#04070d] p-4 text-slate-100">
        <div className="mb-4 flex w-full max-w-[390px] items-center justify-between gap-2 text-xs">
          <div className="font-mono-num text-slate-400">
            Watch Companion · Code <strong className="text-cyan-400">{effectiveCode}</strong>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Pairing code"
              value={localCode}
              onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
              className="font-mono-num w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-xs text-cyan-300"
            />
            {onExitStandalone && (
              <button
                type="button"
                onClick={onExitStandalone}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200"
              >
                Full App
              </button>
            )}
          </div>
        </div>
        {watchScreen}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono-num" style={{ color: 'var(--sys-muted)' }}>
          Interactive Wrist Remote · Code {effectiveCode}
        </span>
        <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: 'var(--sys-border)' }}>
          <button
            type="button"
            onClick={() => setDialShape('square')}
            className="rounded-md px-2 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: dialShape === 'square' ? 'var(--sys-primary)' : 'transparent',
              color: dialShape === 'square' ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
            }}
          >
            Ultra Dial
          </button>
          <button
            type="button"
            onClick={() => setDialShape('round')}
            className="rounded-md px-2 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: dialShape === 'round' ? 'var(--sys-primary)' : 'transparent',
              color: dialShape === 'round' ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
            }}
          >
            Round Dial
          </button>
        </div>
      </div>
      {watchScreen}
    </div>
  );
};
