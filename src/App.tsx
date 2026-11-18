import React, { useCallback, useEffect, useState } from 'react';
import { CalendarView } from './components/CalendarView';
import { CommunityView } from './components/CommunityView';
import { DemoOnboardingScreen } from './components/DemoOnboardingScreen';
import { Modals, type ActiveModal } from './components/Modals';
import { BottomNav, TopBar, WorkspaceToolbar } from './components/Navigation';
import { NutritionView } from './components/NutritionView';
import { ProfileView } from './components/ProfileView';
import { ProgramView } from './components/ProgramView';
import { QuestsView } from './components/QuestsView';
import { WatchCompanionView } from './components/WatchCompanionView';
import { StandaloneWatchApp } from './components/WatchCompanionApp';
import { OfflineIndicator } from './components/PWAInstallButton';
import { TUTORIALS } from './data/exercises';
import { FOODS } from './data/foods';
import type {
  AppState,
  CalendarTag,
  EquipmentType,
  FemaleStage,
  LoggedFood,
  MobilityTier,
  PrivacySettings,
  ScheduleTrackId,
  StatKey,
  TabId,
  ThemeMode,
  ToastMessage,
  WatchActionEvent,
  WatchCommandType,
  WatchReminder,
} from './types/system';
import {
  DEFAULT_CLINICAL_CODEX,
  syncClinicalCodex,
  type ClinicalCodex,
} from './utils/codex';
import {
  getLevelInfo,
  getProgramDayExercises,
  getProgramDayNumber,
  getRecommendedTarget,
  pickPerExerciseSwap,
} from './utils/metabolic';
import { triggerSystemReminder } from './utils/notifications';
import type { CalibratedPlanOutput } from './utils/onboarding';
import {
  evaluateDailyRollover,
  parseMealText,
  verifyQuestsState,
  type CoachReply,
} from './utils/quests';
import {
  createDefaultState,
  loadState,
  parsePlanHash,
  playChime,
  playTwoToneChime,
  saveState,
  todayISO,
} from './utils/storage';
import {
  applyWatchActionToState,
  buildWatchSnapshot,
  generatePairingCode,
  publishWatchSnapshot,
  pushWatchReminderViaBridge,
  subscribeWatchChannel,
} from './utils/watchSync';
import {
  applyWatchCommand,
  buildWatchSnapshot as buildBridgeWatchSnapshot,
} from './utils/watchBridge';

export default function App() {
  const [rolloverMeta, setRolloverMeta] = useState<{ freezesUsed: number; streakReset: boolean }>({
    freezesUsed: 0,
    streakReset: false,
  });

  const [state, setState] = useState<AppState>(() => {
    const initial = loadState();
    const hashPlan = parsePlanHash();
    if (hashPlan) {
      initial.p = { ...initial.p, ...hashPlan };
      initial.w0 = Number(hashPlan.w) || initial.w0;
      initial.start = todayISO();
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    const rollover = evaluateDailyRollover(initial, todayISO());
    if (rollover.freezesUsed > 0 || rollover.streakReset) {
      window.setTimeout(
        () =>
          setRolloverMeta({
            freezesUsed: rollover.freezesUsed,
            streakReset: rollover.streakReset,
          }),
        0
      );
    }
    return rollover.nextState;
  });

  const [isWatchStandaloneMode, setIsWatchStandaloneMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'watch';
  });
  const [isWatchCompanionFaceMode, setIsWatchCompanionFaceMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname === '/watch' || params.get('mode') === 'watchface';
  });
  const [activeTab, setActiveTab] = useState<TabId>('quests');
  const [modal, setModal] = useState<ActiveModal>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [restEndTime, setRestEndTime] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [activeSetStartedAt, setActiveSetStartedAt] = useState(0);
  const [watchReminders, setWatchReminders] = useState<WatchReminder[]>([]);
  const [prBanner, setPrBanner] = useState<{
    exName: string;
    bestStr: string;
    xp: number;
  } | null>(null);
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [bleBpm, setBleBpm] = useState(0);
  const [codex, setCodex] = useState<ClinicalCodex>(DEFAULT_CLINICAL_CODEX);
  const [codexSource, setCodexSource] = useState<'remote' | 'cache' | 'fallback'>('fallback');
  const [showOnboardingScreen, setShowOnboardingScreen] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === '/watch' || params.get('mode') === 'watchface') return false;
    if (params.get('mode') === 'watch') return false;
    if (params.get('autostart') === '1') return false;
    if (params.get('onboarding') === '1') return true;
    return !state.demoOnboarded;
  });
  const [onboardingStep, setOnboardingStep] = useState<'login' | 'questions'>('login');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [lastSentNote, setLastSentNote] = useState('');

  const pushToast = useCallback(
    (text: string, isError = false, onUndo?: () => void) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, text, isError, onUndo }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, onUndo ? 5000 : 3200);
    },
    []
  );

  // Notify user once if Streak Freeze saved streak on day rollover
  useEffect(() => {
    if (rolloverMeta.freezesUsed > 0) {
      pushToast(
        `Streak Freeze protected your ${state.streak}-day streak across ${rolloverMeta.freezesUsed} missed day${rolloverMeta.freezesUsed > 1 ? 's' : ''}!`
      );
      setRolloverMeta({ freezesUsed: 0, streakReset: false });
    } else if (rolloverMeta.streakReset) {
      pushToast('Missed unexcused day without Streak Freeze — ready to start fresh today!', true);
      setRolloverMeta({ freezesUsed: 0, streakReset: false });
    }
  }, [rolloverMeta, state.streak, pushToast]);

  // Sync HTML data-theme and .dark class whenever theme or darkMode changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.theme, state.darkMode]);

  // Persist state on changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Pillar 1: Background Clinical Codex sync (/api/codex/latest -> IndexedDB/localStorage cache -> offline fallback)
  useEffect(() => {
    let active = true;
    syncClinicalCodex(undefined, '/api/codex/latest').then((res) => {
      if (!active) return;
      setCodex(res.codex);
      setCodexSource(res.source);
    });
    return () => {
      active = false;
    };
  }, []);

  // Escape key closes active modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal) setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  // Global Rest Timer countdown + two-tone Web Audio chime on completion
  useEffect(() => {
    if (!restEndTime) {
      setRestRemaining(0);
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
      setRestRemaining(rem);
      if (rem <= 0) {
        setRestEndTime(0);
        playTwoToneChime(state.mute);
        pushToast('Rest complete — ready for next set.');
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [restEndTime, state.mute, pushToast]);

  // Helper to apply XP & boss damage + verify anti-cheat quests
  const commitState = useCallback(
    (updater: (prev: AppState) => AppState, verifyToday = false) => {
      setState((prev) => {
        const beforeLevel = getLevelInfo(prev.xp).l;
        let next = updater(prev);

        if (verifyToday) {
          const { nextState, newlyCompleted } = verifyQuestsState(next, todayISO());
          next = nextState;
          if (newlyCompleted.length > 0) {
            playChime(700, 0.12, next.mute);
            newlyCompleted.forEach((q) => {
              pushToast(
                next.theme === 'clean'
                  ? `Verified & Completed: ${q.t}`
                  : `Verified & Completed: ${q.t} (+${q.xp} XP)`
              );
            });
          }
        }

        const gainedXp = Math.max(0, next.xp - prev.xp);
        if (gainedXp > 0 && next.boss && !next.boss.claimed) {
          const newDmg = Math.min(next.boss.max, next.boss.dmg + gainedXp * 18);
          next = {
            ...next,
            boss: {
              ...next.boss,
              dmg: newDmg,
              claimed: newDmg >= next.boss.max,
            },
          };
          if (newDmg >= next.boss.max && !prev.boss.claimed) {
            next.xp += 150;
            next.p = { ...next.p, title: 'Titan Challenger' };
            pushToast(
              next.theme === 'clean'
                ? 'Weekly Training Milestone Cleared!'
                : 'Weekly Milestone Cleared! Title unlocked: Titan Challenger (+150 XP)'
            );
          }
        }

        const afterLevel = getLevelInfo(next.xp).l;
        if (afterLevel > beforeLevel && next.theme !== 'clean') {
          playChime(880, 0.16, next.mute);
          pushToast(`Level Up! Reached Level ${afterLevel}.`);
        }

        const todayKey = todayISO();
        if (
          next.streak > prev.streak &&
          next.streakAwardedDays?.[todayKey] &&
          !prev.streakAwardedDays?.[todayKey]
        ) {
          const tierLabel =
            next.streakAwardedDays[todayKey] === 'full' ? 'Full Balance' : 'Minimum Due';
          playChime(760, 0.14, next.mute);
          pushToast(`${tierLabel} met! ${next.streak}-day streak protected.`);
        }

        return next;
      });
    },
    [pushToast]
  );

  const handleToggleMinimumDue = useCallback(
    (dateStr: string, enabled?: boolean) => {
      commitState((prev) => {
        const current = Boolean(prev.minimumDueDays?.[dateStr]);
        const nextVal = typeof enabled === 'boolean' ? enabled : !current;
        const nextMap = { ...(prev.minimumDueDays || {}) };
        if (nextVal) nextMap[dateStr] = true;
        else delete nextMap[dateStr];
        return {
          ...prev,
          minimumDueDays: nextMap,
        };
      }, true);
    },
    [commitState]
  );

  // Theme & Dark Mode Switchers
  const handleSelectTheme = (theme: ThemeMode) => {
    setState((prev) => ({ ...prev, theme }));
    playChime(600, 0.08, state.mute);
  };

  const handleToggleDarkMode = () => {
    setState((prev) => ({ ...prev, darkMode: !prev.darkMode }));
    playChime(560, 0.06, state.mute);
  };

  // Water Logger
  const handleLogWater = (delta: number) => {
    const d = todayISO();
    playChime(540, 0.09, state.mute);
    commitState(
      (prev) => ({
        ...prev,
        water: {
          ...prev.water,
          [d]: Math.max(0, +(((prev.water[d] || 0) + delta).toFixed(2))),
        },
      }),
      true
    );
  };

  // Manual Quest Toggle
  const handleToggleManualQuest = (questId: string) => {
    const d = todayISO();
    commitState((prev) => {
      const doneDay = { ...(prev.done[d] || {}) };
      const xpMap: Record<string, { xp: number; st: StatKey }> = {
        b: { xp: 25, st: 'AGI' },
        sn: { xp: 40, st: 'AGI' },
      };
      const extra = prev.extraQuests.find((x) => x.id === questId);
      const reward = extra ? { xp: extra.xp, st: extra.st } : xpMap[questId] || { xp: 20, st: 'AGI' };

      if (doneDay[questId]) {
        delete doneDay[questId];
        return {
          ...prev,
          xp: Math.max(0, prev.xp - reward.xp),
          stats: { ...prev.stats, [reward.st]: Math.max(1, prev.stats[reward.st] - 1) },
          done: { ...prev.done, [d]: doneDay },
        };
      }
      doneDay[questId] = true;
      playChime(660, 0.11, prev.mute);
      pushToast(prev.theme === 'clean' ? 'Protocol target complete' : `Target complete +${reward.xp} XP`);
      return {
        ...prev,
        xp: prev.xp + reward.xp,
        stats: { ...prev.stats, [reward.st]: prev.stats[reward.st] + 1 },
        done: { ...prev.done, [d]: doneDay },
      };
    }, true);
  };

  // Program Set Helpers
  const setLogKey = (day: number, exIdx: number, isMinMode = false) =>
    isMinMode ? `min_${day}_${exIdx}` : `${day}_${exIdx}`;

  const ensureSetsInState = (prev: AppState, day: number, exIdx: number, isMinMode = false) => {
    const key = setLogKey(day, exIdx, isMinMode);
    if (prev.setLogs[key]) return prev.setLogs[key];
    const ex = getProgramDayExercises(
      day,
      prev.p,
      prev.shuf,
      isMinMode,
      prev.scheduleTrack,
      prev.exOverrides
    )[exIdx];
    if (!ex) return [];
    const rec = getRecommendedTarget(
      ex.name,
      ex.sets,
      ex.reps,
      ex.baseKg,
      ex.bwRatio,
      prev.p,
      prev.prs
    );
    return Array.from({ length: ex.sets }, () => ({ reps: rec.reps, kg: rec.kg, done: false }));
  };

  const syncExerciseAndDayCompletion = (
    next: AppState,
    day: number,
    isMinMode = false
  ): AppState => {
    const exList = getProgramDayExercises(
      day,
      next.p,
      next.shuf,
      isMinMode,
      next.scheduleTrack,
      next.exOverrides
    );
    const dayProg = { ...(next.prog[day] || {}) };
    const prefix = isMinMode ? 'min_' : '';

    exList.forEach((_, i) => {
      const sets = next.setLogs[setLogKey(day, i, isMinMode)] || ensureSetsInState(next, day, i, isMinMode);
      const progKey = `${prefix}${i}`;
      if (sets.length > 0 && sets.every((s) => s.done)) dayProg[progKey] = true;
      else delete dayProg[progKey];
    });

    const clearedCount = exList.filter((_, i) => Boolean(dayProg[`${prefix}${i}`])).length;
    let xp = next.xp;
    const stats = { ...next.stats };
    const completionKey = isMinMode ? 'min' : 'x';

    if (clearedCount === exList.length && !dayProg[completionKey]) {
      dayProg[completionKey] = true;
      const bonusXp = isMinMode ? 15 : 25;
      xp += bonusXp;
      stats.STR += 1;
      playChime(780, 0.14, next.mute);
      pushToast(
        next.theme === 'clean'
          ? isMinMode
            ? `Day ${day} Minimum Due Cleared!`
            : `Day ${day} Training Session Cleared!`
          : isMinMode
            ? `Day ${day} Minimum Due Cleared! +${bonusXp} XP`
            : `Day ${day} Training Cleared! +${bonusXp} XP`
      );
    } else if (clearedCount < exList.length && dayProg[completionKey]) {
      delete dayProg[completionKey];
    }

    return {
      ...next,
      xp,
      stats,
      prog: { ...next.prog, [day]: dayProg },
    };
  };

  const handleStepSetField = (
    day: number,
    exIdx: number,
    setIdx: number,
    field: 'kg' | 'reps',
    delta: number,
    isMinMode = false
  ) => {
    playChime(520, 0.05, state.mute);
    setState((prev) => {
      const sets = ensureSetsInState(prev, day, exIdx, isMinMode).map((s, idx) =>
        idx === setIdx ? { ...s, [field]: Math.max(0, +((s[field] || 0) + delta).toFixed(1)) } : s
      );
      return {
        ...prev,
        setLogs: { ...prev.setLogs, [setLogKey(day, exIdx, isMinMode)]: sets },
      };
    });
  };

  const handleUpdateSetField = (
    day: number,
    exIdx: number,
    setIdx: number,
    field: 'kg' | 'reps',
    val: number,
    isMinMode = false
  ) => {
    setState((prev) => {
      const sets = ensureSetsInState(prev, day, exIdx, isMinMode).map((s, idx) =>
        idx === setIdx ? { ...s, [field]: Math.max(0, val) } : s
      );
      return {
        ...prev,
        setLogs: { ...prev.setLogs, [setLogKey(day, exIdx, isMinMode)]: sets },
      };
    });
  };

  const handleToggleSetDone = (
    day: number,
    exIdx: number,
    setIdx: number,
    isMinMode = false
  ) => {
    const todayDay = getProgramDayNumber(state.start, todayISO(), state.cal, state.p.days);
    commitState(
      (prev) => {
        const sets = ensureSetsInState(prev, day, exIdx, isMinMode).map((s, idx) =>
          idx === setIdx ? { ...s, done: !s.done } : s
        );
        const toggled = sets[setIdx];
        let xp = prev.xp;
        const stats = { ...prev.stats };
        const prs = { ...prev.prs };

        if (toggled?.done) {
          playChime(680, 0.09, prev.mute);
          const ex = getProgramDayExercises(
            day,
            prev.p,
            prev.shuf,
            isMinMode,
            prev.scheduleTrack,
            prev.exOverrides
          )[exIdx];
          setRestEndTime(Date.now() + (ex?.restSec || (isMinMode ? 30 : 60)) * 1000);
          if (ex) {
            const exName = ex.name;
            const prevPr = prs[exName] || {
              maxKg: 0,
              repsAtMax: 0,
              maxVol: 0,
              maxReps: 0,
              bestStr: '',
            };
            const vol = (toggled.kg || 0) * (toggled.reps || 0);
            let isPr = false;
            const updatedPr = { ...prevPr };

            if (toggled.kg > 0 && toggled.kg > prevPr.maxKg) {
              updatedPr.maxKg = toggled.kg;
              updatedPr.repsAtMax = toggled.reps;
              updatedPr.bestStr = `${toggled.kg} kg × ${toggled.reps}`;
              isPr = true;
            } else if (
              toggled.kg > 0 &&
              toggled.kg === prevPr.maxKg &&
              toggled.reps > prevPr.repsAtMax
            ) {
              updatedPr.repsAtMax = toggled.reps;
              updatedPr.bestStr = `${toggled.kg} kg × ${toggled.reps}`;
              isPr = true;
            } else if (vol > 0 && vol > prevPr.maxVol) {
              updatedPr.maxVol = vol;
              updatedPr.bestStr = `${toggled.kg} kg × ${toggled.reps}`;
              isPr = true;
            } else if (toggled.kg === 0 && toggled.reps > prevPr.maxReps) {
              updatedPr.maxReps = toggled.reps;
              updatedPr.bestStr = `${toggled.reps} reps`;
              if (updatedPr.maxReps > ex.reps) isPr = true;
            }
            prs[exName] = updatedPr;
            if (isPr) {
              xp += 15;
              stats.STR += 1;
              setPrBanner({ exName, bestStr: updatedPr.bestStr, xp: 15 });
              window.setTimeout(() => {
                setPrBanner((curr) => (curr?.exName === exName ? null : curr));
              }, 4800);
            }
          }
        }

        const withSets: AppState = {
          ...prev,
          xp,
          stats,
          prs,
          setLogs: { ...prev.setLogs, [setLogKey(day, exIdx, isMinMode)]: sets },
        };
        return syncExerciseAndDayCompletion(withSets, day, isMinMode);
      },
      day === todayDay
    );
  };

  const handleAddSetRow = (day: number, exIdx: number, isMinMode = false) => {
    setState((prev) => {
      const sets = ensureSetsInState(prev, day, exIdx, isMinMode);
      const last = sets[sets.length - 1] || { reps: 10, kg: 0 };
      const nextSets = [...sets, { reps: last.reps, kg: last.kg, done: false }];
      return {
        ...prev,
        setLogs: { ...prev.setLogs, [setLogKey(day, exIdx, isMinMode)]: nextSets },
      };
    });
  };

  const handleRemoveSetRow = (day: number, exIdx: number, isMinMode = false) => {
    setState((prev) => {
      const sets = ensureSetsInState(prev, day, exIdx, isMinMode);
      if (sets.length <= 1) return prev;
      const nextSets = sets.slice(0, -1);
      return syncExerciseAndDayCompletion(
        {
          ...prev,
          setLogs: { ...prev.setLogs, [setLogKey(day, exIdx, isMinMode)]: nextSets },
        },
        day,
        isMinMode
      );
    });
  };

  const handleApplyRecommended = (day: number, exIdx: number, isMinMode = false) => {
    const ex = getProgramDayExercises(
      day,
      state.p,
      state.shuf,
      isMinMode,
      state.scheduleTrack,
      state.exOverrides
    )[exIdx];
    if (!ex) return;
    const rec = getRecommendedTarget(
      ex.name,
      ex.sets,
      ex.reps,
      ex.baseKg,
      ex.bwRatio,
      state.p,
      state.prs
    );
    setState((prev) => {
      const sets = ensureSetsInState(prev, day, exIdx, isMinMode).map((s) =>
        s.done ? s : { ...s, kg: rec.kg, reps: rec.reps }
      );
      return {
        ...prev,
        setLogs: { ...prev.setLogs, [setLogKey(day, exIdx, isMinMode)]: sets },
      };
    });
    playChime(600, 0.08, state.mute);
    pushToast(`Applied target: ${rec.label}`);
  };

  const handleShuffleExercise = (day: number, exIdx: number, isMinMode = false) => {
    setState((prev) => {
      const list = getProgramDayExercises(
        day,
        prev.p,
        prev.shuf,
        isMinMode,
        prev.scheduleTrack,
        prev.exOverrides
      );
      const current = list[exIdx];
      if (!current) return prev;
      const swappedIdOrName = pickPerExerciseSwap(
        current,
        prev.p,
        isMinMode,
        list.map((item) => item.name)
      );
      if (!swappedIdOrName || swappedIdOrName === current.id || swappedIdOrName === current.name) {
        return prev;
      }
      const key = setLogKey(day, exIdx, isMinMode);
      const nextOverrides = { ...(prev.exOverrides || {}), [key]: swappedIdOrName };
      const nextSetLogs = { ...prev.setLogs };
      delete nextSetLogs[key];
      const nextState: AppState = {
        ...prev,
        exOverrides: nextOverrides,
        setLogs: nextSetLogs,
      };
      const updatedList = getProgramDayExercises(
        day,
        nextState.p,
        nextState.shuf,
        isMinMode,
        nextState.scheduleTrack,
        nextOverrides
      );
      const swappedEx = updatedList[exIdx];
      pushToast(`Swapped to ${swappedEx?.name || swappedIdOrName} without losing progress.`);
      return syncExerciseAndDayCompletion(nextState, day, isMinMode);
    });
    playChime(600, 0.09, state.mute);
  };

  const handleShuffleDay = (day: number) => {
    setState((prev) => {
      const nextSetLogs = { ...prev.setLogs };
      const nextOverrides = { ...(prev.exOverrides || {}) };

      // 80/20 Anti-Monotony Invariant Core Rule:
      // Preserve primary compound lifts (positions 0 and 1) and their logged sets,
      // while safely rotating accessory & finisher positions (>= 2).
      const clearAccessoryKey = (k: string, prefix: string) => {
        if (!k.startsWith(prefix)) return false;
        const idx = Number(k.slice(prefix.length));
        return Number.isFinite(idx) && idx >= 2;
      };

      Object.keys(nextSetLogs).forEach((k) => {
        if (clearAccessoryKey(k, `${day}_`) || clearAccessoryKey(k, `min_${day}_`)) {
          delete nextSetLogs[k];
        }
      });
      Object.keys(nextOverrides).forEach((k) => {
        if (clearAccessoryKey(k, `${day}_`) || clearAccessoryKey(k, `min_${day}_`)) {
          delete nextOverrides[k];
        }
      });

      const nextProg = { ...prev.prog };
      if (nextProg[day]) {
        const cleanedDayProg = { ...nextProg[day] };
        Object.keys(cleanedDayProg).forEach((pk) => {
          if (pk === 'x' || pk === 'min') {
            delete cleanedDayProg[pk];
            return;
          }
          const idxStr = pk.startsWith('min_') ? pk.slice(4) : pk;
          const idx = Number(idxStr);
          if (Number.isFinite(idx) && idx >= 2) {
            delete cleanedDayProg[pk];
          }
        });
        nextProg[day] = cleanedDayProg;
      }

      return {
        ...prev,
        shuf: { ...prev.shuf, [day]: (prev.shuf[day] || 0) + 1 },
        exOverrides: nextOverrides,
        setLogs: nextSetLogs,
        prog: nextProg,
      };
    });
    playChime(580, 0.1, state.mute);
    pushToast(`Day ${day} accessories refreshed (core compound lifts locked)!`);
  };

  // Nutrition Handlers
  const handleLogFood = (item: LoggedFood) => {
    const d = todayISO();
    playChime(500, 0.08, state.mute);
    commitState(
      (prev) => ({
        ...prev,
        log: { ...prev.log, [d]: [...(prev.log[d] || []), item] },
      }),
      true
    );
    pushToast(`Logged ${item.n}`);
  };

  const handleQuickLogText = (raw: string) => {
    const allergies = state.p.allergies || [];
    const items = parseMealText(raw, FOODS, allergies);
    if (items.length === 0) {
      pushToast(
        allergies.length > 0
          ? 'No allergen-safe matching food found. Check your Allergy Shield in Profile.'
          : 'No matching food found. Try e.g. "2 ragi roti + 1 palak"',
        true
      );
      return;
    }
    const d = todayISO();
    playChime(520, 0.1, state.mute);
    commitState(
      (prev) => ({
        ...prev,
        log: { ...prev.log, [d]: [...(prev.log[d] || []), ...items] },
      }),
      true
    );
    pushToast(`Logged ${items.length} item${items.length > 1 ? 's' : ''}!`);
  };

  const handleDeleteLoggedFood = (idx: number) => {
    const d = todayISO();
    const removed = (state.log[d] || [])[idx];
    if (!removed) return;

    commitState(
      (prev) => ({
        ...prev,
        log: { ...prev.log, [d]: (prev.log[d] || []).filter((_, i) => i !== idx) },
      }),
      true
    );

    pushToast(`Removed ${removed.n}`, false, () => {
      commitState(
        (prev) => {
          const list = [...(prev.log[d] || [])];
          list.splice(idx, 0, removed);
          return { ...prev, log: { ...prev.log, [d]: list } };
        },
        true
      );
    });
  };

  const handleLogCombo = (comboIdx: number) => {
    const combo = state.combos[comboIdx];
    if (!combo) return;
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

    if (toAdd.length === 0) return;
    const d = todayISO();
    playChime(560, 0.1, state.mute);
    commitState(
      (prev) => ({
        ...prev,
        log: { ...prev.log, [d]: [...(prev.log[d] || []), ...toAdd] },
      }),
      true
    );
    pushToast(`Logged combo: ${combo.n}`);
  };

  // Gym Check-In Handlers
  const handleVerifyGymCode = (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      pushToast('Enter a valid Gym or Company code.', true);
      return;
    }
    const org = state.b2b.orgs.find((o) => o.code.toUpperCase() === code);
    if (org && org.status !== 'approved') {
      pushToast('That organization is still pending Super-Admin approval.', true);
      return;
    }
    const d = todayISO();
    commitState((prev) => {
      const nextAcct = org ? { ...prev.acct, orgCode: org.code } : prev.acct;
      if (prev.gci === d) {
        pushToast(org ? `Joined ${org.name}!` : 'Already checked in today.');
        return { ...prev, acct: nextAcct };
      }
      playChime(780, 0.14, prev.mute);
      pushToast(org ? `Verified at ${org.name}! +30 XP` : `Code ${code} verified! +30 XP`);
      return {
        ...prev,
        acct: nextAcct,
        gci: d,
        xp: prev.xp + 30,
      };
    });
  };

  const handleSaveGymGps = () => {
    if (!navigator.geolocation) {
      pushToast('Geolocation unavailable on this browser.', true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState((prev) => ({
          ...prev,
          gym: { la: pos.coords.latitude, lo: pos.coords.longitude },
        }));
        pushToast('Gym GPS coordinates saved.');
      },
      () => pushToast('Allow location permission to save Gym GPS.', true)
    );
  };

  const handleCheckInGymGps = () => {
    if (!state.gym || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const E = 6371e3;
        const rad = (x: number) => (x * Math.PI) / 180;
        const a =
          Math.sin(rad(pos.coords.latitude - state.gym!.la) / 2) ** 2 +
          Math.cos(rad(state.gym!.la)) *
            Math.cos(rad(pos.coords.latitude)) *
            Math.sin(rad(pos.coords.longitude - state.gym!.lo) / 2) ** 2;
        const meters = 2 * E * Math.asin(Math.sqrt(a));
        if (meters > 250) {
          pushToast(`You are ${Math.round(meters)} m away from your saved gym.`, true);
          return;
        }
        const d = todayISO();
        if (state.gci === d) {
          pushToast('Already checked in today.');
          return;
        }
        commitState((prev) => ({ ...prev, gci: d, xp: prev.xp + 30 }));
        pushToast('Gym GPS check-in complete! +30 XP');
      },
      () => pushToast('Location permission required.', true)
    );
  };

  const handleConnectBleWatch = async () => {
    const navBle = navigator as unknown as {
      bluetooth?: {
        requestDevice: (opts: unknown) => Promise<{
          name?: string;
          gatt?: {
            connect: () => Promise<{
              getPrimaryService: (s: string) => Promise<{
                getCharacteristic: (c: string) => Promise<{
                  startNotifications: () => Promise<void>;
                  addEventListener: (e: string, cb: (ev: { target: { value: DataView } }) => void) => void;
                }>;
              }>;
            }>;
          };
        }>;
      };
    };

    if (!navBle.bluetooth) {
      pushToast('Web Bluetooth requires Chrome/Android. Use the manual Steps & Sleep sync below.', true);
      return;
    }
    try {
      const device = await navBle.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService('heart_rate');
      const char = await service?.getCharacteristic('heart_rate_measurement');
      await char?.startNotifications();
      char?.addEventListener('characteristicvaluechanged', (ev) => {
        const val = ev.target.value;
        const bpm = val.getUint8(0) & 1 ? val.getUint16(1, true) : val.getUint8(1);
        setBleBpm(bpm);
      });
      setBleDeviceName(device.name || 'Smartwatch');
      pushToast(`Connected to ${device.name || 'Smartwatch'}`);
    } catch {
      pushToast('Bluetooth device pairing cancelled or unavailable.', true);
    }
  };

  const handleCopyText = (text: string, msg: string) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => pushToast(msg))
        .catch(() => pushToast(msg));
    } else {
      pushToast(msg);
    }
  };

  const CLOUD_VAULT_KEY = 'thesystem_cloud_vault_v1';

  const getCloudAccountEmail = useCallback((target: AppState) => {
    const email = target.acct.email.trim().toLowerCase();
    if (email) return email;
    return `${(target.p.name || 'guest').trim().toLowerCase().replace(/\s+/g, '.')}@demo.local`;
  }, []);

  const handleCloudSyncNow = useCallback(
    async (overrideState?: AppState) => {
      const target = overrideState || state;
      const emailKey = getCloudAccountEmail(target);
      setCloudBusy(true);
      try {
        const nowIso = new Date().toISOString();
        let syncedAt = nowIso;
        let cloudId =
          target.cloudSync?.cloudId || `CLD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        const snapshotToSave: AppState = {
          ...target,
          demoOnboarded: true,
          cloudSync: {
            enabled: Boolean(target.cloudSync?.enabled),
            lastSyncedAt: syncedAt,
            cloudId,
          },
        };

        try {
          const res = await fetch('/api/cloud/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailKey, snapshot: snapshotToSave }),
          });
          if (res.ok) {
            const data = (await res.json()) as { syncedAt?: string; cloudId?: string };
            if (data.syncedAt) syncedAt = data.syncedAt;
            if (data.cloudId) cloudId = data.cloudId;
          }
        } catch {
          // Offline fallback persists to localStorage cloud vault below
        }

        try {
          const vault = JSON.parse(localStorage.getItem(CLOUD_VAULT_KEY) || '{}') as Record<
            string,
            { snapshot: AppState; syncedAt: string; cloudId: string }
          >;
          vault[emailKey] = {
            snapshot: {
              ...snapshotToSave,
              cloudSync: {
                enabled: Boolean(snapshotToSave.cloudSync?.enabled),
                lastSyncedAt: syncedAt,
                cloudId,
              },
            },
            syncedAt,
            cloudId,
          };
          localStorage.setItem(CLOUD_VAULT_KEY, JSON.stringify(vault));
        } catch {
          // Ignore storage quota errors
        }

        setState((prev) => ({
          ...prev,
          cloudSync: {
            enabled: Boolean(prev.cloudSync?.enabled),
            lastSyncedAt: syncedAt,
            cloudId,
          },
        }));
        if (!overrideState) {
          pushToast(`Synced to Cloud (${cloudId})!`);
        }
      } finally {
        setCloudBusy(false);
      }
    },
    [state, getCloudAccountEmail, pushToast]
  );

  const handleCloudRestoreNow = useCallback(async () => {
    const emailKey = getCloudAccountEmail(state);
    setCloudBusy(true);
    try {
      let restored: { snapshot?: Partial<AppState>; syncedAt?: string; cloudId?: string } | null = null;
      try {
        const res = await fetch(`/api/cloud/restore?email=${encodeURIComponent(emailKey)}`);
        if (res.ok) {
          restored = (await res.json()) as {
            snapshot?: Partial<AppState>;
            syncedAt?: string;
            cloudId?: string;
          };
        }
      } catch {
        // Fallback to local vault
      }

      if (!restored?.snapshot) {
        try {
          const vault = JSON.parse(localStorage.getItem(CLOUD_VAULT_KEY) || '{}') as Record<
            string,
            { snapshot?: Partial<AppState>; syncedAt?: string; cloudId?: string }
          >;
          if (vault[emailKey]?.snapshot) {
            restored = vault[emailKey];
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (!restored?.snapshot) {
        pushToast('No cloud snapshot found for this account yet. Sync first.', true);
        return;
      }

      const freshBase = createDefaultState();
      setState({
        ...freshBase,
        ...restored.snapshot,
        p: { ...freshBase.p, ...(restored.snapshot.p || {}) },
        demoOnboarded: true,
        cloudSync: {
          enabled: restored.snapshot.cloudSync?.enabled ?? state.cloudSync?.enabled ?? false,
          lastSyncedAt: restored.syncedAt || restored.snapshot.cloudSync?.lastSyncedAt,
          cloudId: restored.cloudId || restored.snapshot.cloudSync?.cloudId,
        },
      });
      pushToast(`Restored latest snapshot from Cloud (${restored.cloudId || 'Vault'})!`);
    } finally {
      setCloudBusy(false);
    }
  }, [state, getCloudAccountEmail, pushToast]);

  const handleSendPlan = useCallback(
    async (recipient: string, summary: string, planUrl: string) => {
      const target = recipient.trim();
      const payloadText = `${summary}\n\nPlan Link:\n${planUrl}`;
      let confirmation = target
        ? `Sent wellness plan to ${target} and copied to clipboard.`
        : 'Wellness plan copied & prepared for sharing.';
      try {
        const res = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: target || 'Direct Share',
            senderName: state.p.name,
            summary,
            planUrl,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { shareId?: string; recipient?: string };
          if (data.shareId) {
            confirmation = target
              ? `Sent to ${target} (${data.shareId}) · Also copied to clipboard.`
              : `Prepared shareable plan (${data.shareId}) · Copied to clipboard.`;
          }
        }
      } catch {
        // Offline / clipboard fallback handled below
      }
      handleCopyText(payloadText, confirmation);
      setLastSentNote(confirmation);
    },
    [state.p.name]
  );

  const handleQuickSkipOnboarding = () => {
    setState((prev) => ({
      ...prev,
      demoOnboarded: true,
    }));
    setShowOnboardingScreen(false);
    setActiveTab('quests');
    pushToast('Welcome! Your wellness dashboard is ready.');
  };

  const handleCompleteDemoSetup = ({
    email,
    signedIn,
    calibrated,
  }: {
    email: string;
    signedIn: boolean;
    calibrated: CalibratedPlanOutput;
  }) => {
    const nextName = (calibrated.profilePatch.name || state.p.name).trim() || 'Member';
    const isFirstOnboarding = !state.demoOnboarded;
    commitState(
      (prev) => ({
        ...prev,
        demoOnboarded: true,
        theme: calibrated.theme,
        scheduleTrack: calibrated.scheduleTrack,
        p: { ...prev.p, ...calibrated.profilePatch, name: nextName },
        w0: Number(calibrated.profilePatch.w) || prev.w0,
        start: todayISO(),
        xp: isFirstOnboarding ? prev.xp + 50 : prev.xp,
        exOverrides: {},
        setLogs: {},
        userStreaks: { ...prev.userStreaks, [nextName]: prev.streak },
        acct: {
          ...prev.acct,
          email: email.trim(),
          signedIn,
          isAdmin: false,
        },
      }),
      true
    );
    setShowOnboardingScreen(false);
    setActiveTab('quests');
    pushToast(
      isFirstOnboarding
        ? `Welcome, ${nextName}! Personalized plan ready (+50 XP).`
        : `Plan updated for ${nextName}!`
    );
  };

  const handleAdminDemoSignIn = (email: string, password: string) => {
    if (password !== 'SystemOwner#2026') {
      pushToast('Invalid Super-Admin password.', true);
      return;
    }
    setState((prev) => ({
      ...prev,
      demoOnboarded: true,
      acct: { email, signedIn: true, isAdmin: true, orgCode: prev.acct.orgCode },
    }));
    setShowOnboardingScreen(false);
    setModal({ type: 'admin' });
    pushToast('Signed in as System Owner.');
  };

  const watchSnapshot = buildWatchSnapshot(state, todayISO(), {
    bleBpm,
    bleDeviceName,
    restEndTime,
    activeSetStartedAt,
    reminders: watchReminders,
  });

  const handleWatchAction = useCallback(
    (action: WatchActionEvent) => {
      if (action.type === 'start_set') {
        setActiveSetStartedAt(Date.now());
        playChime(600, 0.08, state.mute);
        pushToast('Watch 1-Tap: Set timer started!');
        return;
      }
      if (action.type === 'skip_rest') {
        setRestEndTime(0);
        setRestRemaining(0);
        return;
      }
      if (action.type === 'extend_rest') {
        const addMs = (Number(action.amount) || 15) * 1000;
        setRestEndTime((t) => Math.max(Date.now(), t) + addMs);
        return;
      }
      if (action.type === 'ack_reminder') {
        if (action.reminderId) {
          setWatchReminders((prev) => prev.filter((r) => r.id !== action.reminderId));
        }
        return;
      }

      if (action.type === 'complete_set') {
        setActiveSetStartedAt(0);
      }

      const d = todayISO();
      let computedToast: string | undefined;
      let computedRest = 0;
      let computedPr: { exName: string; bestStr: string; xp: number } | undefined;

      commitState((prev) => {
        const res = applyWatchActionToState(prev, action, d);
        computedToast = res.toastText;
        computedRest = res.restSecondsToStart || 0;
        computedPr = res.prAchieved;
        return res.nextState;
      }, false);

      playChime(680, 0.1, state.mute);
      if (computedRest > 0) {
        setRestEndTime(Date.now() + computedRest * 1000);
      }
      if (computedPr) {
        setPrBanner(computedPr);
        window.setTimeout(() => {
          setPrBanner((curr) => (curr?.exName === computedPr?.exName ? null : curr));
        }, 4800);
      }
      if (computedToast) {
        pushToast(computedToast);
      }
    },
    [commitState, pushToast, state.mute]
  );

  const handlePushWatchReminder = useCallback(
    (reminder: WatchReminder) => {
      const code = state.watchBridge?.pairingCode || 'SYS742';
      setWatchReminders((prev) => [reminder, ...prev.filter((r) => r.id !== reminder.id)].slice(0, 4));
      pushWatchReminderViaBridge(code, reminder);
      playTwoToneChime(state.mute);
      pushToast(`Pushed "${reminder.title}" to Watch.`);
    },
    [state.watchBridge?.pairingCode, state.mute, pushToast]
  );

  // Publish live Watch Snapshot across BroadcastChannel + localStorage + Express bridge
  useEffect(() => {
    if (isWatchStandaloneMode) return;
    publishWatchSnapshot(watchSnapshot);
    const code = state.watchBridge?.pairingCode || 'SYS742';
    const timer = window.setTimeout(() => {
      fetch('/api/watch/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, snapshot: watchSnapshot }),
      }).catch(() => {
        // Offline / local BroadcastChannel handles same-device sync
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isWatchStandaloneMode, watchSnapshot, state.watchBridge?.pairingCode]);

  // Listen for incoming 1-tap actions from Standalone Watch Window (?mode=watch) or Shortcuts/WearOS
  useEffect(() => {
    if (isWatchStandaloneMode) return;
    const code = state.watchBridge?.pairingCode || 'SYS742';
    const unsub = subscribeWatchChannel((env) => {
      if (env.kind === 'action' && env.pairingCode === code) {
        handleWatchAction(env.action);
      }
    });
    const pollId = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/watch/actions?code=${encodeURIComponent(code)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { actions?: WatchActionEvent[] };
        if (Array.isArray(data.actions) && data.actions.length > 0) {
          data.actions.forEach((act) => handleWatchAction(act));
        }
      } catch {
        // Ignore network polling errors when offline
      }
    }, 3000);
    return () => {
      unsub();
      window.clearInterval(pollId);
    };
  }, [isWatchStandaloneMode, state.watchBridge?.pairingCode, handleWatchAction]);

  const handleWatchBridgeCommand = useCallback(
    (type: WatchCommandType, payload?: Record<string, unknown>) => {
      const d = todayISO();
      let startRestSec: number | undefined;
      let adjustRestDeltaSec: number | undefined;
      let clearRest: boolean | undefined;

      commitState((prev) => {
        const res = applyWatchCommand(prev, { type, payload }, d);
        startRestSec = res.startRestSec;
        adjustRestDeltaSec = res.adjustRestDeltaSec;
        clearRest = res.clearRest;
        return res.nextState;
      }, false);

      if (clearRest) {
        setRestEndTime(0);
        setRestRemaining(0);
      } else if (typeof startRestSec === 'number' && startRestSec > 0) {
        setRestEndTime(Date.now() + startRestSec * 1000);
      } else if (typeof adjustRestDeltaSec === 'number' && adjustRestDeltaSec !== 0) {
        setRestEndTime((t) => Math.max(Date.now(), t) + adjustRestDeltaSec! * 1000);
      }
    },
    [commitState]
  );

  if (isWatchCompanionFaceMode) {
    const bridgeSnapshot = buildBridgeWatchSnapshot(
      state,
      todayISO(),
      restEndTime,
      bleDeviceName,
      bleBpm
    );
    return (
      <StandaloneWatchApp
        initialCode={
          new URLSearchParams(window.location.search).get('code') ||
          state.watchBridge?.pairingCode ||
          bridgeSnapshot.code
        }
        localFallbackSnapshot={bridgeSnapshot}
        onLocalCommand={handleWatchBridgeCommand}
        onExitWatchMode={() => {
          const url = new URL(window.location.href);
          if (url.pathname === '/watch') {
            url.pathname = '/';
          }
          url.searchParams.delete('mode');
          url.searchParams.delete('code');
          window.history.replaceState(null, '', url.toString());
          setIsWatchCompanionFaceMode(false);
        }}
      />
    );
  }

  if (isWatchStandaloneMode) {
    return (
      <WatchCompanionView
        variant="standalone"
        pairingCode={state.watchBridge?.pairingCode || 'SYS742'}
        onConnectBle={handleConnectBleWatch}
        onExitStandalone={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('mode');
          url.searchParams.delete('code');
          window.history.replaceState(null, '', url.toString());
          setIsWatchStandaloneMode(false);
        }}
      />
    );
  }

  if (showOnboardingScreen) {
    return (
      <>
        <DemoOnboardingScreen
          initialState={state}
          initialStep={onboardingStep}
          canCancel={Boolean(state.demoOnboarded)}
          onCancel={() => setShowOnboardingScreen(false)}
          onQuickSkip={handleQuickSkipOnboarding}
          onAdminSignIn={handleAdminDemoSignIn}
          onCompleteSetup={handleCompleteDemoSetup}
        />
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 md:bottom-auto md:left-auto md:right-6 md:top-6 md:translate-x-0"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="sys-card pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 text-xs font-medium"
              style={{
                borderColor: t.isError ? 'var(--sys-danger)' : 'var(--sys-primary)',
                color: t.isError ? 'var(--sys-danger)' : 'var(--sys-text)',
              }}
            >
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <TopBar
        state={state}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <WorkspaceToolbar
        state={state}
        onOpenCoach={() => setModal({ type: 'coach' })}
        onOpenWatch={() => setModal({ type: 'watch' })}
        onToggleMute={() => setState((prev) => ({ ...prev, mute: !prev.mute }))}
        bleBpm={bleBpm}
        bleDeviceName={bleDeviceName}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        {activeTab === 'quests' && (
          <QuestsView
            state={state}
            bleDeviceName={bleDeviceName}
            bleBpm={bleBpm}
            onToggleMinimumDue={(enabled) => {
              handleToggleMinimumDue(todayISO(), enabled);
              playChime(enabled ? 500 : 620, 0.09, state.mute);
              pushToast(
                enabled
                  ? 'Minimum Due mode active — 5-min micro-workout & lighter targets loaded.'
                  : state.theme === 'clean'
                    ? 'Full Plan restored for complete training & recovery progression.'
                    : 'Full Plan restored for maximum XP & progression.'
              );
            }}
            onLogWater={handleLogWater}
            onToggleManualQuest={handleToggleManualQuest}
            onSetFemaleStage={(fstage: FemaleStage) => {
              commitState((prev) => ({ ...prev, p: { ...prev.p, fstage } }), true);
              pushToast('Wellness stage updated.');
            }}
            onSyncWatch={(steps, sleep, hrvMs, rhrBpm) => {
              commitState(
                (prev) => ({
                  ...prev,
                  watch: {
                    steps,
                    sleep,
                    ...(typeof hrvMs === 'number' && hrvMs > 0 ? { hrvMs } : {}),
                    ...(typeof rhrBpm === 'number' && rhrBpm > 0 ? { rhrBpm } : {}),
                  },
                }),
                true
              );
              pushToast(
                state.theme === 'clean'
                  ? 'Telemetry synced & verified!'
                  : 'Activity synced & verified!'
              );
            }}
            onCreateDuel={(email) => {
              const trimmed = email.trim();
              if (!trimmed.includes('@')) {
                pushToast('Enter a valid friend email.', true);
                return;
              }
              setState((prev) => ({
                ...prev,
                duels: [
                  {
                    id: `d_${Date.now()}`,
                    opp: trimmed,
                    myStartXp: prev.xp,
                    oppGain: 0,
                    ends: 'In 7 days',
                    active: true,
                  },
                  ...prev.duels,
                ],
              }));
              pushToast(`7-Day Challenge sent to ${trimmed}!`);
            }}
            onUploadPhotoMilestone={(day, dataUrl) => {
              commitState((prev) => {
                const isFirst = !prev.ph[day];
                return {
                  ...prev,
                  xp: isFirst ? prev.xp + 25 : prev.xp,
                  ph: { ...prev.ph, [day]: dataUrl },
                };
              });
              pushToast(`Day ${day} progress photo saved!`);
            }}
            onDeletePhotoMilestone={(day) => {
              setState((prev) => {
                const nextPh = { ...prev.ph };
                delete nextPh[day];
                return { ...prev, ph: nextPh };
              });
            }}
            onNavigateTab={(t) => setActiveTab(t)}
            onOpenSuryaTutorial={() => setModal({ type: 'tutorial', key: 'surya', step: 0 })}
            onOpenWatch={() => setModal({ type: 'watch' })}
          />
        )}

        {activeTab === 'program' && (
          <ProgramView
            state={state}
            restRemaining={restRemaining}
            onStartRestTimer={(seconds) => setRestEndTime(Date.now() + seconds * 1000)}
            onToggleTodayMinimumDue={(enabled) => {
              handleToggleMinimumDue(todayISO(), enabled);
              playChime(enabled ? 500 : 620, 0.09, state.mute);
              pushToast(
                enabled
                  ? 'Switched to Minimum Due micro-session (3 quick exercises).'
                  : 'Switched back to Full Workout.'
              );
            }}
            onStepSetField={handleStepSetField}
            onUpdateSetField={handleUpdateSetField}
            onToggleSetDone={handleToggleSetDone}
            onAddSetRow={handleAddSetRow}
            onRemoveSetRow={handleRemoveSetRow}
            onApplyRecommended={handleApplyRecommended}
            onShuffleExercise={handleShuffleExercise}
            onShuffleDay={handleShuffleDay}
            onLogBiometrics={(weight, waist, neck, hip) => {
              const targetDate = todayISO();
              setState((prev) => {
                const nextWt =
                  weight > 25
                    ? [...prev.wt.filter((item) => item.d !== targetDate), { d: targetDate, w: weight }].sort((a, b) =>
                        a.d.localeCompare(b.d)
                      )
                    : prev.wt;

                const hasMeas = waist > 30 || neck > 20 || hip > 40;
                let nextMeas = prev.meas;
                if (hasMeas) {
                  const existing = prev.meas.find((item) => item.d === targetDate);
                  const merged = {
                    d: targetDate,
                    waist: waist > 30 ? waist : existing?.waist || 0,
                    neck: neck > 20 ? neck : existing?.neck || 0,
                    hip: hip > 40 ? hip : existing?.hip || 0,
                  };
                  nextMeas = [...prev.meas.filter((item) => item.d !== targetDate), merged].sort((a, b) =>
                    a.d.localeCompare(b.d)
                  );
                }

                return {
                  ...prev,
                  p: weight > 25 ? { ...prev.p, w: weight } : prev.p,
                  wt: nextWt,
                  meas: nextMeas,
                };
              });
              pushToast('Biometrics updated!');
            }}
            onChangeEquipment={(eq: EquipmentType) => {
              setState((prev) => ({ ...prev, p: { ...prev.p, eq }, exOverrides: {}, setLogs: {} }));
              pushToast('Equipment plan updated.');
            }}
            onChangeTier={(tier: MobilityTier) => {
              setState((prev) => ({ ...prev, p: { ...prev.p, tier }, exOverrides: {}, setLogs: {} }));
              pushToast('Training intensity updated.');
            }}
            onChangeScheduleTrack={(track: ScheduleTrackId) => {
              setState((prev) => ({ ...prev, scheduleTrack: track, exOverrides: {}, setLogs: {} }));
              pushToast('Training cadence updated.');
            }}
            onOpenTutorial={(exName) => {
              const key = Object.keys(TUTORIALS).find((k) => exName.toLowerCase().includes(k));
              if (!key) {
                pushToast('Control the 2-second lowering phase and exhale as you press or pull.');
                return;
              }
              setModal({ type: 'tutorial', key, step: 0 });
            }}
            onOpenWatch={() => setModal({ type: 'watch' })}
          />
        )}

        {activeTab === 'nutrition' && (
          <NutritionView
            state={state}
            codexRecipes={codex.recipes}
            onLogFood={handleLogFood}
            onQuickLogText={handleQuickLogText}
            onDeleteLoggedFood={handleDeleteLoggedFood}
            onLogCombo={handleLogCombo}
            onLogQuickFallbackCombo={(items, comboName) => {
              const toAdd: LoggedFood[] = [];
              items.forEach(([name, qty]) => {
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
              if (!toAdd.length) return;
              const d = todayISO();
              playChime(560, 0.1, state.mute);
              commitState(
                (prev) => ({
                  ...prev,
                  log: { ...prev.log, [d]: [...(prev.log[d] || []), ...toAdd] },
                }),
                true
              );
              pushToast(`Logged safe combo: ${comboName}`);
            }}
            onSaveCurrentAsCombo={(name) => {
              const items = state.log[todayISO()] || [];
              if (items.length === 0) return;
              const raw = items.map((x) => [
                x.n.replace(/^\d+(?:\.\d+)?×\s*/, ''),
                x.q || 1,
                x.k / (x.q || 1),
                x.p / (x.q || 1),
                x.c / (x.q || 1),
                x.f / (x.q || 1),
              ]) as Array<[string, number, number, number, number, number]>;
              setState((prev) => ({
                ...prev,
                combos: [{ n: name, raw }, ...prev.combos],
              }));
              pushToast(`Saved combo: ${name}`);
            }}
            onOpenGroceryList={() => setModal({ type: 'grocery' })}
            onLogWater={handleLogWater}
            onCompleteSanctuary={(idx, title, stat) => {
              const key = `${todayISO()}_${idx}`;
              if (state.sanct[key]) return;
              commitState((prev) => ({
                ...prev,
                xp: prev.xp + 20,
                stats: { ...prev.stats, [stat]: prev.stats[stat] + 1 },
                sanct: { ...prev.sanct, [key]: true },
              }));
              playChime(820, 0.12, state.mute);
              pushToast(
                state.theme === 'clean' ? `${title} completed!` : `${title} completed! +20 XP`
              );
            }}
            onCreateCustomSanctuary={(name) => {
              setState((prev) => ({
                ...prev,
                customSanctuary: [
                  ...prev.customSanctuary,
                  [name, 'Custom restorative practice', 'SEN'],
                ],
              }));
              pushToast(`Added sanctuary practice: ${name}`);
            }}
          />
        )}

        {activeTab === 'community' && (
          <CommunityView
            state={state}
            onCreatePost={(text, isTip, mediaUrl) => {
              const author = state.priv.name ? state.p.name : 'Anonymous Member';
              setState((prev) => ({
                ...prev,
                userStreaks: {
                  ...prev.userStreaks,
                  [author]: prev.streak,
                  [prev.p.name]: prev.streak,
                },
                feed: [
                  {
                    id: `post_${Date.now()}`,
                    u: author,
                    t: text,
                    tip: isTip,
                    likes: [],
                    cm: [],
                    ts: Date.now(),
                    mediaUrl,
                    me: true,
                    authorStreak: prev.streak,
                  },
                  ...prev.feed,
                ],
              }));
              pushToast('Update posted to community!');
            }}
            onToggleLike={(postId) => {
              setState((prev) => ({
                ...prev,
                feed: prev.feed.map((p) => {
                  if (p.id !== postId) return p;
                  const liked = p.likes.includes('me');
                  return {
                    ...p,
                    likes: liked ? p.likes.filter((x) => x !== 'me') : [...p.likes, 'me'],
                  };
                }),
              }));
            }}
            onAddComment={(postId, comment) => {
              const author = state.priv.name ? state.p.name : 'Anonymous Member';
              setState((prev) => ({
                ...prev,
                userStreaks: {
                  ...prev.userStreaks,
                  [author]: prev.streak,
                  [prev.p.name]: prev.streak,
                },
                feed: prev.feed.map((p) =>
                  p.id === postId ? { ...p, cm: [...p.cm, [author, comment]] } : p
                ),
              }));
            }}
            onDeletePost={(postId) => {
              const idx = state.feed.findIndex((p) => p.id === postId);
              if (idx < 0) return;
              const removed = state.feed[idx];
              setState((prev) => ({
                ...prev,
                feed: prev.feed.filter((p) => p.id !== postId),
              }));
              pushToast('Post deleted', false, () => {
                setState((prev) => {
                  const list = [...prev.feed];
                  list.splice(idx, 0, removed);
                  return { ...prev, feed: list };
                });
              });
            }}
            onAddStory={(text, mediaUrl) => {
              const author = state.priv.name ? state.p.name : 'Anonymous Member';
              setState((prev) => ({
                ...prev,
                stories: [
                  { id: `st_${Date.now()}`, u: author, t: text, mediaUrl, ts: Date.now() },
                  ...prev.stories,
                ],
              }));
              pushToast('Story shared!');
            }}
            onViewStory={(story) => setModal({ type: 'story', story })}
            onSendChat={(channel, message) => {
              const author = state.priv.name ? state.p.name : 'Anonymous Member';
              setState((prev) => ({
                ...prev,
                chat: {
                  ...prev.chat,
                  [channel]: [...prev.chat[channel], [author, message]],
                },
              }));
            }}
            onCheerPeer={(name) => {
              playChime(700, 0.1, state.mute);
              pushToast(`Cheer sent to ${name}!`);
            }}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            state={state}
            onToggleMinimumDueDate={(dateStr, enabled) => {
              handleToggleMinimumDue(dateStr, enabled);
              pushToast(
                enabled
                  ? `${dateStr} set to Minimum Due (Streak Saver).`
                  : `${dateStr} set to Full Plan.`
              );
            }}
            onSetCalendarTag={(dateStr, tag) => {
              setState((prev) => {
                const cal = { ...prev.cal };
                if (tag) cal[dateStr] = tag;
                else delete cal[dateStr];
                return { ...prev, cal };
              });
              pushToast('Calendar updated.');
            }}
            onApplyCalendarRange={(from, to, tag) => {
              setState((prev) => {
                const cal = { ...prev.cal };
                for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
                  const k = d.toISOString().slice(0, 10);
                  if (tag) cal[k] = tag as CalendarTag;
                  else delete cal[k];
                }
                return { ...prev, cal };
              });
              pushToast('Date range updated.');
            }}
            onSetReminderTime={(gt) => setState((prev) => ({ ...prev, gt }))}
            onTriggerReminder={(id) => {
              triggerSystemReminder(id, (msg) => pushToast(msg));
            }}
            onSaveGymGps={handleSaveGymGps}
            onCheckInGymGps={handleCheckInGymGps}
            onVerifyGymCode={handleVerifyGymCode}
            onOpenQrCheckIn={() => setModal({ type: 'qr_checkin' })}
            onConnectBleWatch={handleConnectBleWatch}
            onSyncWatch={(steps, sleep) => {
              commitState((prev) => ({ ...prev, watch: { ...prev.watch, steps, sleep } }), true);
              pushToast('Wearable activity synced & verified!');
            }}
            onOpenWatch={() => setModal({ type: 'watch' })}
            bleDeviceName={bleDeviceName}
            bleBpm={bleBpm}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            state={state}
            codex={codex}
            codexSource={codexSource}
            onSelectTheme={handleSelectTheme}
            onToggleDarkMode={handleToggleDarkMode}
            onToggleMute={() => setState((prev) => ({ ...prev, mute: !prev.mute }))}
            onUpdateProfile={(nextP) => {
              commitState((prev) => ({ ...prev, p: nextP }), true);
              pushToast('Profile updated & targets recalculated!');
            }}
            onLogBiometrics={(weight, waist, neck, hip, date) => {
              const targetDate = date || todayISO();
              setState((prev) => {
                const nextWt =
                  weight > 25
                    ? [...prev.wt.filter((item) => item.d !== targetDate), { d: targetDate, w: weight }].sort((a, b) =>
                        a.d.localeCompare(b.d)
                      )
                    : prev.wt;

                const hasMeas = waist > 30 || neck > 20 || hip > 40;
                let nextMeas = prev.meas;
                if (hasMeas) {
                  const existing = prev.meas.find((item) => item.d === targetDate);
                  const merged = {
                    d: targetDate,
                    waist: waist > 30 ? waist : existing?.waist || 0,
                    neck: neck > 20 ? neck : existing?.neck || 0,
                    hip: hip > 40 ? hip : existing?.hip || 0,
                  };
                  nextMeas = [...prev.meas.filter((item) => item.d !== targetDate), merged].sort((a, b) =>
                    a.d.localeCompare(b.d)
                  );
                }

                const latestWeight = nextWt.length ? nextWt[nextWt.length - 1].w : prev.p.w;
                return {
                  ...prev,
                  p: weight > 25 ? { ...prev.p, w: latestWeight } : prev.p,
                  wt: nextWt,
                  meas: nextMeas,
                };
              });
              pushToast('Measurement entry saved!');
            }}
            onSetFemaleStage={(fstage) => {
              commitState((prev) => ({ ...prev, p: { ...prev.p, fstage } }), true);
              pushToast('Women’s wellness stage updated.');
            }}
            onBuyFreeze={() => {
              if (state.xp < 200) {
                pushToast('Need at least 200 XP to unlock a Streak Freeze.', true);
                return;
              }
              setState((prev) => ({ ...prev, xp: prev.xp - 200, freeze: prev.freeze + 1 }));
              pushToast('Streak Freeze acquired!');
            }}
            onTogglePrivacy={(key: keyof PrivacySettings, val: boolean) => {
              setState((prev) => ({ ...prev, priv: { ...prev.priv, [key]: val } }));
            }}
            onOpenSignIn={() => {
              setOnboardingStep('login');
              setShowOnboardingScreen(true);
            }}
            onOpenQuestionnaire={() => {
              setOnboardingStep('questions');
              setShowOnboardingScreen(true);
            }}
            onSignOut={() => {
              setState((prev) => ({
                ...prev,
                acct: { email: '', signedIn: false, isAdmin: false, orgCode: prev.acct.orgCode },
              }));
              pushToast('Signed out.');
            }}
            onOpenOrgRequest={() => setModal({ type: 'org_request' })}
            onOpenAdminConsole={() => setModal({ type: 'admin' })}
            onToggleCloudAutoSync={(enabled) => {
              const nextState: AppState = {
                ...state,
                cloudSync: { ...state.cloudSync, enabled },
              };
              setState(nextState);
              if (enabled) {
                void handleCloudSyncNow(nextState);
                pushToast('Cloud Auto-Sync enabled & initial snapshot saved.');
              } else {
                pushToast('Cloud Auto-Sync paused.');
              }
            }}
            onCloudSyncNow={() => handleCloudSyncNow()}
            onCloudRestoreNow={handleCloudRestoreNow}
            cloudBusy={cloudBusy}
            onSendPlan={handleSendPlan}
            lastSentNote={lastSentNote}
            onCopyText={handleCopyText}
            onExportBackup={() =>
              handleCopyText(JSON.stringify(state), 'Backup JSON copied to clipboard!')
            }
            onImportBackup={(json) => {
              try {
                const parsed = JSON.parse(json) as Partial<AppState>;
                setState({ ...createDefaultState(), ...parsed, demoOnboarded: true });
                pushToast('Backup restored!');
              } catch {
                pushToast('Invalid backup JSON.', true);
              }
            }}
            onResetAll={() => {
              const fresh = { ...createDefaultState(), demoOnboarded: true };
              setState(fresh);
              setActiveTab('quests');
              pushToast('All data reset to default.');
            }}
          />
        )}
      </main>

      <BottomNav state={state} activeTab={activeTab} onSelectTab={setActiveTab} />

      <Modals
        modal={modal}
        state={state}
        codex={codex}
        onClose={() => setModal(null)}
        onSetModal={setModal}
        onCompleteOnboarding={(draft, recommendedTheme) => {
          const nextName = (draft.name || state.p.name).trim() || 'Member';
          commitState(
            (prev) => ({
              ...prev,
              demoOnboarded: true,
              theme: recommendedTheme,
              p: { ...prev.p, ...draft, name: nextName },
              w0: Number(draft.w) || prev.w0,
              start: todayISO(),
              xp: prev.xp + 50,
              userStreaks: { ...prev.userStreaks, [nextName]: prev.streak },
            }),
            true
          );
          pushToast('Plan calibrated! +50 Welcome XP credited.');
        }}
        onToggleGroceryItem={(item, checked) => {
          setState((prev) => ({
            ...prev,
            grocDone: { ...prev.grocDone, [item]: checked },
          }));
        }}
        onCoachAction={(reply: CoachReply) => {
          if (reply.actionType === 'log_food' && reply.suggestedFood) {
            handleLogFood(reply.suggestedFood);
          } else if (reply.actionType === 'enable_min_due') {
            handleToggleMinimumDue(todayISO(), true);
            pushToast('Minimum Due mode activated — 5-min routine saves your streak!');
          } else if (reply.actionType === 'add_circuit') {
            setState((prev) => ({
              ...prev,
              extraQuests: [
                ...prev.extraQuests,
                {
                  id: `cq_${Date.now()}`,
                  d: todayISO(),
                  t: 'Coach Bonus: 10-Min Express Circuit',
                  xp: 25,
                  st: 'AGI',
                  auto: false,
                  r: 'Quick bodyweight strength reset that fits busy schedules.',
                  l: 'Optional coach bonus — zero penalty if skipped.',
                },
              ],
            }));
            pushToast('Added 10-Min Circuit to today!');
          } else {
            setState((prev) => ({
              ...prev,
              extraQuests: [
                ...prev.extraQuests,
                {
                  id: `cq_${Date.now()}`,
                  d: todayISO(),
                  t: 'Coach Habit: 5-Min Post-Meal Walk',
                  xp: 15,
                  st: 'AGI',
                  auto: false,
                  r: 'A quick walk after eating stops sugar crashes and energy dips.',
                  l: 'Optional coach bonus — zero penalty if skipped.',
                },
              ],
            }));
            pushToast('Added 5-Min Walk to today!');
          }
        }}
        onCopyText={handleCopyText}
        onSignIn={(payload) => {
          const em = payload.email.trim();
          if (!em.includes('@')) {
            pushToast('Enter a valid email.', true);
            return;
          }
          if (em.toLowerCase() === 'admin@thesystem.app') {
            if (payload.password !== 'SystemOwner#2026') {
              pushToast('Invalid Super-Admin password.', true);
              return;
            }
            setState((prev) => ({
              ...prev,
              acct: { email: em, signedIn: true, isAdmin: true, orgCode: prev.acct.orgCode },
            }));
            setModal({ type: 'admin' });
            pushToast('Signed in as System Owner.');
            return;
          }
          const nextName = (payload.name || state.p.name).trim() || 'Member';
          setState((prev) => ({
            ...prev,
            theme: payload.recommendedTheme,
            p: {
              ...prev.p,
              name: nextName,
              sex: payload.sex || prev.p.sex,
              goalStyle: payload.goalStyle || prev.p.goalStyle,
              medicalHistory: payload.medicalHistory ?? prev.p.medicalHistory,
              medicalDeferred: Boolean(payload.medicalDeferred),
            },
            userStreaks: { ...prev.userStreaks, [nextName]: prev.streak },
            acct: { email: em, signedIn: true, isAdmin: false, orgCode: prev.acct.orgCode },
          }));
          setModal(null);
          pushToast(`Signed in as ${em}`);
        }}
        onSubmitOrgRequest={(name, type, email, challenge) => {
          if (!name.trim() || !email.includes('@')) {
            pushToast('Enter organization name and valid email.', true);
            return;
          }
          const code =
            (type === 'Gym' ? 'GYM-' : 'CORP-') +
            Math.random().toString(36).slice(2, 7).toUpperCase();
          setState((prev) => ({
            ...prev,
            b2b: {
              ...prev.b2b,
              orgs: [
                {
                  id: `org_${Date.now()}`,
                  name: name.trim(),
                  type,
                  email: email.trim(),
                  status: 'pending',
                  code,
                  members: 1,
                  challenge: challenge.trim() || '30-Day Wellness Sprint',
                },
                ...prev.b2b.orgs,
              ],
            },
          }));
          pushToast(`Request submitted for ${name}. Pending owner approval.`);
        }}
        onSaveGlobalEvent={(title, desc, active) => {
          setState((prev) => ({
            ...prev,
            b2b: { ...prev.b2b, globalEvent: { title, desc, active } },
          }));
          pushToast('Global banner updated!');
        }}
        onSetOrgStatus={(orgId, status) => {
          setState((prev) => ({
            ...prev,
            b2b: {
              ...prev.b2b,
              orgs: prev.b2b.orgs.map((o) => (o.id === orgId ? { ...o, status } : o)),
            },
          }));
          pushToast(`Organization updated to ${status.toUpperCase()}`);
        }}
        onToggleAdminUser={(email) => {
          setState((prev) => ({
            ...prev,
            b2b: {
              ...prev.b2b,
              users: prev.b2b.users.map((u) =>
                u.email === email ? { ...u, disabled: !u.disabled } : u
              ),
            },
          }));
          pushToast('User status updated.');
        }}
        onVerifyGymCode={handleVerifyGymCode}
        onCreateCrossGymEvent={(ev) => {
          setState((prev) => ({
            ...prev,
            b2b: {
              ...prev.b2b,
              crossGymEvents: [
                {
                  ...ev,
                  id: `cg_${Date.now()}`,
                  hostScore: 0,
                  partnerScore: 0,
                  active: true,
                },
                ...(prev.b2b.crossGymEvents || []),
              ],
            },
          }));
          pushToast(`Launched Cross-Gym Battle: ${ev.title}`);
        }}
        watchSnapshot={watchSnapshot}
        onWatchAction={handleWatchAction}
        onPushWatchReminder={handlePushWatchReminder}
        onRegenerateWatchCode={() => {
          const nextCode = generatePairingCode();
          setState((prev) => ({
            ...prev,
            watchBridge: {
              autoSync: prev.watchBridge?.autoSync ?? true,
              ...prev.watchBridge,
              pairingCode: nextCode,
            },
          }));
          pushToast(`New Watch Pairing Code: ${nextCode}`);
        }}
        onConnectBleWatch={handleConnectBleWatch}
        onImportWearableMetrics={(metrics) => {
          handleWatchAction({
            id: `wa_imp_${Date.now()}`,
            type: 'sync_telemetry',
            steps: metrics.steps,
            sleep: metrics.sleepHours,
            hrvMs: metrics.hrvMs,
            rhrBpm: metrics.rhrBpm,
            source: metrics.sourceLabel,
            ts: Date.now(),
          });
        }}
      />

      {/* New Personal Record Floating Banner */}
      {prBanner && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-20 z-50 flex w-[min(92vw,440px)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg"
          style={{
            backgroundColor: 'var(--sys-surface)',
            borderColor: 'var(--sys-warn)',
            color: 'var(--sys-text)',
          }}
        >
          <div className="min-w-0">
            <div className="font-mono-num text-[11px] font-bold" style={{ color: 'var(--sys-warn)' }}>
              {state.theme === 'clean'
                ? 'NEW PERSONAL RECORD · Load Progression Logged'
                : `NEW PERSONAL RECORD · +${prBanner.xp} XP · +1 STR`}
            </div>
            <div className="truncate text-sm font-semibold">
              {prBanner.exName} · {prBanner.bestStr}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPrBanner(null)}
            aria-label="Dismiss Personal Record banner"
            className="sys-btn-secondary min-h-[32px] shrink-0 px-2.5 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Floating Rest Timer HUD */}
      {restRemaining > 0 && (
        <div
          role="region"
          aria-label="Rest Timer HUD"
          className="fixed bottom-16 left-1/2 z-40 flex w-[min(94vw,460px)] -translate-x-1/2 items-center justify-between gap-2 rounded-xl border px-3 py-2 shadow-lg md:bottom-5"
          style={{
            backgroundColor: 'var(--sys-surface)',
            borderColor: 'var(--sys-primary)',
          }}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--sys-muted)' }}>
              Rest Timer
            </span>
            <span
              className="font-mono-num text-base font-bold"
              style={{ color: 'var(--sys-primary)' }}
            >
              {restRemaining}s
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setRestEndTime((t) => {
                  const next = Math.max(Date.now() + 1000, t - 15_000);
                  return next;
                })
              }
              className="sys-btn-secondary min-h-[36px] whitespace-nowrap px-2.5 text-xs font-semibold"
            >
              -15s
            </button>
            <button
              type="button"
              onClick={() =>
                setRestEndTime((t) => Math.max(Date.now(), t) + 15_000)
              }
              className="sys-btn-secondary min-h-[36px] whitespace-nowrap px-2.5 text-xs font-semibold"
            >
              +15s
            </button>
            <button
              type="button"
              onClick={() => {
                setRestEndTime(0);
                setRestRemaining(0);
              }}
              className="sys-btn-secondary min-h-[36px] whitespace-nowrap px-2.5 text-xs font-semibold"
              style={{ color: 'var(--sys-danger)' }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Toast Stack */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-32 left-1/2 z-50 flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 md:bottom-auto md:left-auto md:right-6 md:top-20 md:translate-x-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="sys-card pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 text-xs font-medium"
            style={{
              borderColor: t.isError ? 'var(--sys-danger)' : 'var(--sys-primary)',
              color: t.isError ? 'var(--sys-danger)' : 'var(--sys-text)',
            }}
          >
            <span>{t.text}</span>
            {t.onUndo && (
              <button
                type="button"
                onClick={() => {
                  t.onUndo?.();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
                className="sys-btn-secondary min-h-[28px] px-2.5 text-xs font-semibold"
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
      <OfflineIndicator />
    </div>
  );
}
