import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  Dumbbell,
  HelpCircle,
  Minus,
  Plus,
  Shuffle,
  Timer,
  Trash2,
  Trophy,
  Watch,
  Wind,
} from 'lucide-react';
import type {
  AppState,
  EquipmentType,
  ExerciseSet,
  MobilityTier,
  ScheduleTrackId,
} from '../types/system';
import {
  calculateBodyFat,
  getExerciseExecutionCues,
  getFemaleStageLabel,
  getGoalProgress,
  getProgramDayExercises,
  getProgramDayNumber,
  getRecommendedTarget,
  isMaternalProfile,
} from '../utils/metabolic';
import { THEME_COPY, todayISO } from '../utils/storage';
import { ProgressBar } from './ProgressBar';

interface ProgramViewProps {
  state: AppState;
  restRemaining?: number;
  onStartRestTimer?: (seconds: number) => void;
  onToggleTodayMinimumDue: (enabled: boolean) => void;
  onStepSetField: (
    day: number,
    exIdx: number,
    setIdx: number,
    field: 'kg' | 'reps',
    delta: number,
    isMinMode?: boolean
  ) => void;
  onUpdateSetField: (
    day: number,
    exIdx: number,
    setIdx: number,
    field: 'kg' | 'reps',
    val: number,
    isMinMode?: boolean
  ) => void;
  onToggleSetDone: (day: number, exIdx: number, setIdx: number, isMinMode?: boolean) => void;
  onAddSetRow: (day: number, exIdx: number, isMinMode?: boolean) => void;
  onRemoveSetRow: (day: number, exIdx: number, isMinMode?: boolean) => void;
  onApplyRecommended: (day: number, exIdx: number, isMinMode?: boolean) => void;
  onShuffleExercise: (day: number, exIdx: number, isMinMode?: boolean) => void;
  onShuffleDay: (day: number) => void;
  onLogBiometrics: (weight: number, waist: number, neck: number, hip: number) => void;
  onChangeEquipment: (eq: EquipmentType) => void;
  onChangeTier: (tier: MobilityTier) => void;
  onChangeScheduleTrack: (track: ScheduleTrackId) => void;
  onOpenTutorial: (exName: string) => void;
  onOpenWatch?: () => void;
}

export const ProgramView: React.FC<ProgramViewProps> = ({
  state,
  restRemaining = 0,
  onStartRestTimer,
  onToggleTodayMinimumDue,
  onStepSetField,
  onUpdateSetField,
  onToggleSetDone,
  onAddSetRow,
  onRemoveSetRow,
  onApplyRecommended,
  onShuffleExercise,
  onShuffleDay,
  onLogBiometrics,
  onChangeEquipment,
  onChangeTier,
  onChangeScheduleTrack,
  onOpenTutorial,
  onOpenWatch,
}) => {
  const copy = THEME_COPY[state.theme];
  const dateStr = todayISO();
  const totalDays = state.p.days;
  const currentDay = getProgramDayNumber(state.start, dateStr, state.cal, totalDays);
  const currentWeight = state.wt.length ? state.wt[state.wt.length - 1].w : state.p.w;
  const goalPct = getGoalProgress(state, dateStr);
  const bodyFat = calculateBodyFat(state.p, state.meas);
  const maternal = isMaternalProfile(state.p);

  const [weightInput, setWeightInput] = useState('');
  const [waistInput, setWaistInput] = useState('');
  const [neckInput, setNeckInput] = useState('');
  const [hipInput, setHipInput] = useState('');
  const [openWeek, setOpenWeek] = useState<number>(Math.floor((currentDay - 1) / 7));
  const [selectedDay, setSelectedDay] = useState<number>(currentDay);
  const [previewMinDue, setPreviewMinDue] = useState<boolean>(false);
  const [openCues, setOpenCues] = useState<Record<string, boolean>>({});

  const isViewingToday = selectedDay === currentDay;
  const isMinMode = isViewingToday
    ? Boolean(state.minimumDueDays?.[dateStr])
    : previewMinDue;

  const setDayMinimumMode = (enabled: boolean) => {
    if (isViewingToday) {
      onToggleTodayMinimumDue(enabled);
    } else {
      setPreviewMinDue(enabled);
    }
  };

  const getSetsForExercise = (
    day: number,
    exIdx: number,
    exName: string,
    defSets: number,
    defReps: number,
    defKg: number,
    bwRatio: number
  ): ExerciseSet[] => {
    const key = isMinMode ? `min_${day}_${exIdx}` : `${day}_${exIdx}`;
    if (state.setLogs[key] && state.setLogs[key].length > 0) {
      return state.setLogs[key];
    }
    const rec = getRecommendedTarget(exName, defSets, defReps, defKg, bwRatio, state.p, state.prs);
    return Array.from({ length: defSets }, () => ({
      reps: rec.reps,
      kg: rec.kg,
      done: false,
    }));
  };

  const weekCount = Math.ceil(totalDays / 7);
  const weekStart = openWeek * 7 + 1;
  const weekEnd = Math.min(totalDays, weekStart + 6);
  const dayExercises = getProgramDayExercises(
    selectedDay,
    state.p,
    state.shuf,
    isMinMode,
    state.scheduleTrack,
    state.exOverrides
  );
  const dayProg = state.prog[selectedDay] || {};
  const minDayDone = Boolean(dayProg.min);
  const fullDayDone = Boolean(dayProg.x);

  const exerciseSetsList = dayExercises.map((ex, idx) =>
    getSetsForExercise(selectedDay, idx, ex.name, ex.sets, ex.reps, ex.baseKg, ex.bwRatio)
  );
  const totalSetsCount = exerciseSetsList.reduce((sum, list) => sum + list.length, 0);
  const completedSetsCount = exerciseSetsList.reduce(
    (sum, list) => sum + list.filter((s) => s.done).length,
    0
  );
  const firstIncompleteExIdx = Math.max(
    0,
    dayExercises.findIndex((_, idx) => !Boolean(dayProg[isMinMode ? `min_${idx}` : String(idx)]))
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Roadmap, Equipment, Cadence & Biometrics */}
        <div className="space-y-6 lg:col-span-4">
          <div className="sys-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display text-xl font-bold">{copy.programTitle}</h1>
              <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                Day {currentDay}/{totalDays}
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
              {maternal
                ? getFemaleStageLabel(state.p)
                : `${currentWeight} kg → ${state.p.tw} kg target (${goalPct}%)`}
            </p>
            <div className="mt-3">
              <ProgressBar value={goalPct} max={100} tone="secondary" label="Goal progress" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="equip-select" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Equipment
                </label>
                <select
                  id="equip-select"
                  value={state.p.eq}
                  onChange={(e) => onChangeEquipment(e.target.value as EquipmentType)}
                  className="sys-input w-full px-2.5 py-2 text-xs"
                >
                  <option value="body">Bodyweight</option>
                  <option value="dumb">Dumbbells / Bands</option>
                  <option value="gym">Full Gym</option>
                  <option value="desi">Traditional / Flow</option>
                </select>
              </div>
              <div>
                <label htmlFor="tier-select" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Intensity
                </label>
                <select
                  id="tier-select"
                  value={state.p.tier}
                  onChange={(e) => onChangeTier(e.target.value as MobilityTier)}
                  className="sys-input w-full px-2.5 py-2 text-xs"
                >
                  <option value="joint">Gentle / Joint-Safe</option>
                  <option value="bal">Balanced</option>
                  <option value="hiit">High-Intensity</option>
                </select>
              </div>
            </div>

            <div className="mt-2.5">
              <label htmlFor="track-select" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Workout Style
              </label>
              <select
                id="track-select"
                value={state.scheduleTrack || 'adaptive'}
                onChange={(e) => onChangeScheduleTrack(e.target.value as ScheduleTrackId)}
                className="sys-input w-full px-2.5 py-2 text-xs"
              >
                <option value="adaptive">Smart Daily Plan (Matches You)</option>
                <option value="high_roi_3day">3-Day Strength Plan (35 min)</option>
                <option value="joint_safe_beginner">Gentle &amp; Joint-Friendly</option>
                <option value="maternal_shield_track">Pregnancy &amp; Postpartum Safe</option>
                <option value="desk_worker_express">10-Min Quick Desk Break</option>
              </select>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => onShuffleDay(selectedDay)}
                className="sys-btn-secondary inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>Refresh Day {selectedDay}</span>
              </button>
            </div>
          </div>

          {/* Biometrics & Body Fat Estimator */}
          <div className="sys-card p-5">
            <h2 className="font-display text-base font-semibold">Body Weight &amp; Tape Log</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="bio-w" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Weight (kg)
                </label>
                <input
                  id="bio-w"
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder={String(currentWeight)}
                  className="sys-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bio-waist" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Waist (cm)
                </label>
                <input
                  id="bio-waist"
                  type="number"
                  step="0.1"
                  value={waistInput}
                  onChange={(e) => setWaistInput(e.target.value)}
                  placeholder="84"
                  className="sys-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bio-neck" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Neck (cm)
                </label>
                <input
                  id="bio-neck"
                  type="number"
                  step="0.1"
                  value={neckInput}
                  onChange={(e) => setNeckInput(e.target.value)}
                  placeholder="38"
                  className="sys-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bio-hip" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Hip (cm, opt)
                </label>
                <input
                  id="bio-hip"
                  type="number"
                  step="0.1"
                  value={hipInput}
                  onChange={(e) => setHipInput(e.target.value)}
                  placeholder="98"
                  className="sys-input w-full px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onLogBiometrics(
                  Number(weightInput) || 0,
                  Number(waistInput) || 0,
                  Number(neckInput) || 0,
                  Number(hipInput) || 0
                );
                setWeightInput('');
              }}
              className="sys-btn-primary mt-3 min-h-[42px] w-full text-xs"
            >
              Save Measurements
            </button>

            {bodyFat && (
              <div
                className="font-mono-num mt-3 border-t pt-3 text-xs"
                style={{ borderColor: 'var(--sys-border)', color: 'var(--sys-muted)' }}
              >
                Body Fat: <strong style={{ color: 'var(--sys-text)' }}>~{bodyFat.bf}%</strong> · Lean
                Mass: <strong style={{ color: 'var(--sys-secondary)' }}>{bodyFat.lean} kg</strong> ·
                Waist {bodyFat.waist} cm
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Week & Day Selector + Active Sets Logger */}
        <div className="space-y-5 lg:col-span-8">
          {/* Week / Floor Selector + Day Buttons */}
          <div className="sys-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: weekCount }, (_, wIdx) => {
                  const active = openWeek === wIdx;
                  return (
                    <button
                      key={wIdx}
                      type="button"
                      onClick={() => {
                        setOpenWeek(wIdx);
                        setSelectedDay(wIdx * 7 + 1);
                      }}
                      className="min-h-[38px] whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--sys-primary)' : 'var(--sys-surface-lowest)',
                        color: active ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
                      }}
                    >
                      {state.theme === 'rpg' ? `Floor ${wIdx + 1}` : `Week ${wIdx + 1}`}
                    </button>
                  );
                })}
              </div>
              <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                Days {weekStart}–{weekEnd}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {Array.from({ length: weekEnd - weekStart + 1 }, (_, i) => {
                const d = weekStart + i;
                const isSelected = selectedDay === d;
                const progEntry = state.prog[d] || {};
                const isCleared = Boolean(progEntry.x);
                const isMinCleared = Boolean(progEntry.min);
                const isRecovery = d % 4 === 0;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className="flex min-h-[48px] flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-colors"
                    style={{
                      borderColor: isSelected
                        ? 'var(--sys-primary)'
                        : isCleared || isMinCleared
                          ? 'var(--sys-secondary)'
                          : 'var(--sys-border)',
                      backgroundColor: isSelected
                        ? 'color-mix(in srgb, var(--sys-primary) 16%, transparent)'
                        : 'var(--sys-surface-lowest)',
                      color: isSelected ? 'var(--sys-primary)' : 'var(--sys-text)',
                    }}
                  >
                    <span className="font-mono-num">D{d}</span>
                    <span className="text-[10px]" style={{ color: 'var(--sys-muted)' }}>
                      {isCleared ? 'Done' : isMinCleared ? 'Min' : isRecovery ? 'Rest' : 'Train'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Workout Header */}
          <div className="space-y-4">
            <div className="sys-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 shrink-0" style={{ color: 'var(--sys-primary)' }} />
                  <div>
                    <h2 className="font-display text-lg font-semibold">
                      Day {selectedDay}{' '}
                      {isMinMode
                        ? '· Minimum Due (5-Min Quick Workout)'
                        : state.scheduleTrack === 'desk_worker_express'
                          ? '· 10-Min Quick Desk Break'
                          : state.scheduleTrack === 'maternal_shield_track'
                            ? '· Pregnancy & Postpartum Safe'
                            : selectedDay % 4 === 0 && state.scheduleTrack === 'adaptive'
                              ? '· Easy Stretch & Walk'
                              : '· Workout Session'}
                    </h2>
                    <p className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                      {
                        dayExercises.filter((_, idx) =>
                          Boolean(dayProg[isMinMode ? `min_${idx}` : String(idx)])
                        ).length
                      }
                      /{dayExercises.length} exercises done
                      {isMinMode && minDayDone ? ' · Streak Safe Today' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onOpenWatch && (
                    <button
                      type="button"
                      onClick={onOpenWatch}
                      className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold"
                    >
                      <Watch className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />
                      <span>Watch Remote</span>
                    </button>
                  )}
                  {onStartRestTimer && (
                    <button
                      type="button"
                      onClick={() => onStartRestTimer(45)}
                      className={`${restRemaining > 0 ? 'sys-btn-primary' : 'sys-btn-secondary'} font-mono-num inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold`}
                    >
                      <Timer className="h-3.5 w-3.5" />
                      <span>
                        {restRemaining > 0 ? `Resting: ${restRemaining}s` : 'Start 45s Rest Interval'}
                      </span>
                    </button>
                  )}
                  <div
                    role="group"
                    aria-label="Workout intensity mode"
                    className="inline-flex shrink-0 items-center rounded-lg border p-1"
                    style={{
                      backgroundColor: 'var(--sys-surface-lowest)',
                      borderColor: 'var(--sys-border)',
                    }}
                  >
                    <button
                      type="button"
                      aria-pressed={!isMinMode}
                      onClick={() => setDayMinimumMode(false)}
                      className="min-h-[34px] whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: !isMinMode ? 'var(--sys-surface)' : 'transparent',
                        color: !isMinMode ? 'var(--sys-text)' : 'var(--sys-muted)',
                      }}
                    >
                      Full Workout
                    </button>
                    <button
                      type="button"
                      aria-pressed={isMinMode}
                      onClick={() => setDayMinimumMode(true)}
                      className="min-h-[34px] whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: isMinMode ? 'var(--sys-primary)' : 'transparent',
                        color: isMinMode ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
                      }}
                    >
                      Minimum Due
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <ProgressBar
                  value={
                    dayExercises.filter((_, idx) =>
                      Boolean(dayProg[isMinMode ? `min_${idx}` : String(idx)])
                    ).length
                  }
                  max={Math.max(1, dayExercises.length)}
                  tone="secondary"
                  label="Session completion"
                />
              </div>

              {(state.theme === 'clean' || state.theme === 'women') && (
                <div
                  className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs"
                  style={{ borderColor: 'var(--sys-border)' }}
                >
                  <div>
                    <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                      Completed Sets
                    </div>
                    <div className="font-mono-num mt-0.5 text-sm font-bold" style={{ color: 'var(--sys-primary)' }}>
                      {completedSetsCount} / {totalSetsCount} sets
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                      Pulse &amp; Recovery Baseline
                    </div>
                    <div className="font-mono-num mt-0.5 text-sm font-bold">
                      {state.watch.rhrBpm || 58} bpm · HRV {state.watch.hrvMs || 62} ms
                    </div>
                  </div>
                </div>
              )}

              {isMinMode && (
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs"
                  style={{ borderColor: 'var(--sys-border)', color: 'var(--sys-muted)' }}
                >
                  <span>
                    {minDayDone
                      ? 'Minimum Due complete! Your daily streak is safe.'
                      : 'Low-energy day mode: 3 easy moves (~5 min) matched to your setup so you keep your streak.'}
                  </span>
                  {minDayDone && !fullDayDone && (
                    <button
                      type="button"
                      onClick={() => setDayMinimumMode(false)}
                      className="sys-btn-secondary min-h-[34px] shrink-0 whitespace-nowrap px-3 text-xs font-semibold"
                    >
                      Do Full Workout Too
                    </button>
                  )}
                </div>
              )}
            </div>

            {dayExercises.map((ex, exIdx) => {
              const sets = exerciseSetsList[exIdx] || [];
              const rec = getRecommendedTarget(
                ex.name,
                ex.sets,
                ex.reps,
                ex.baseKg,
                ex.bwRatio,
                state.p,
                state.prs
              );
              const pr = state.prs[ex.name];
              const isCleared = Boolean(dayProg[isMinMode ? `min_${exIdx}` : String(exIdx)]);
              const isTime = /\((sec|min)\)/.test(ex.name);
              const doneSetsCount = sets.filter((s) => s.done).length;
              const nextActiveIdx = sets.findIndex((s) => !s.done);
              const cueKey = `${selectedDay}_${isMinMode ? 'min' : 'full'}_${exIdx}`;
              const cueOpen = openCues[cueKey] ?? exIdx === firstIncompleteExIdx;
              const executionGuide = getExerciseExecutionCues(ex.name, state.p);
              const domainLabel =
                ex.xpType === 'STR'
                  ? 'Strength Load'
                  : ex.xpType === 'VIT'
                    ? 'Core Stability'
                    : 'Mobility';

              return (
                <div
                  key={`${selectedDay}_${exIdx}_${ex.name}`}
                  className="sys-card p-4"
                  style={{
                    borderColor: isCleared ? 'var(--sys-secondary)' : 'var(--sys-border)',
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold">{ex.name}</h3>
                        {ex.isInvariantCore && (
                          <span
                            className="font-mono-num text-[11px] font-semibold"
                            style={{ color: 'var(--sys-primary)' }}
                          >
                            Core Lift · Locked 4–6 wk
                          </span>
                        )}
                        {!ex.isInvariantCore && !isMinMode && selectedDay % 4 !== 0 && (
                          <span
                            className="font-mono-num text-[11px]"
                            style={{ color: 'var(--sys-muted)' }}
                          >
                            Rotational Slot
                          </span>
                        )}
                        {isCleared && (
                          <span
                            className="font-mono-num text-xs font-semibold"
                            style={{ color: 'var(--sys-secondary)' }}
                          >
                            Completed
                          </span>
                        )}
                      </div>
                      <div
                        className="font-mono-num mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                        style={{ color: 'var(--sys-muted)' }}
                      >
                        <span>
                          {doneSetsCount}/{sets.length} {sets.length === 1 ? 'set' : 'sets'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Goal: {rec.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {state.theme === 'clean' ? `RPE ${ex.rpe}` : `Effort ${ex.rpe}/10`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {state.theme === 'clean'
                            ? `${ex.restSec}s rest · ${domainLabel}`
                            : `+${ex.xpType}`}
                        </span>
                        {ex.safetyNote && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: 'var(--sys-secondary)' }}>{ex.safetyNote}</span>
                          </>
                        )}
                        {pr && pr.bestStr && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className="inline-flex items-center gap-1"
                              style={{ color: 'var(--sys-warn)' }}
                            >
                              <Trophy className="h-3 w-3" />
                              Best: {pr.bestStr}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {!ex.isInvariantCore && (
                        <button
                          type="button"
                          aria-label={`Swap ${ex.name}`}
                          onClick={() => onShuffleExercise(selectedDay, exIdx, isMinMode)}
                          className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap px-3 text-xs font-semibold"
                        >
                          <Shuffle className="h-3.5 w-3.5" />
                          <span>Swap</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onApplyRecommended(selectedDay, exIdx, isMinMode)}
                        className="sys-btn-secondary min-h-[38px] whitespace-nowrap px-3 text-xs font-semibold"
                      >
                        Use Suggested
                      </button>
                      <button
                        type="button"
                        aria-expanded={cueOpen}
                        onClick={() => setOpenCues((prev) => ({ ...prev, [cueKey]: !cueOpen }))}
                        className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap px-3 text-xs font-semibold"
                      >
                        <Wind className="h-3.5 w-3.5" />
                        <span>{cueOpen ? 'Hide Cues' : 'Execution Cues'}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`How to do ${ex.name}`}
                        onClick={() => onOpenTutorial(ex.name)}
                        className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap px-3 text-xs"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>How-To</span>
                      </button>
                    </div>
                  </div>

                  {cueOpen && (
                    <div className="sys-card-nested mt-3 space-y-2.5 p-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold" style={{ color: 'var(--sys-primary)' }}>
                          Execution Cues &amp; Breath Guide
                        </span>
                        <span className="font-mono-num text-[11px]" style={{ color: 'var(--sys-secondary)' }}>
                          {executionGuide.cadence}
                        </span>
                      </div>
                      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {executionGuide.steps.map((step, stepIdx) => (
                          <li
                            key={step.title}
                            className="rounded-lg border p-2.5"
                            style={{
                              borderColor: 'var(--sys-border)',
                              backgroundColor: 'var(--sys-surface)',
                            }}
                          >
                            <div className="font-mono-num text-[11px] font-semibold" style={{ color: 'var(--sys-primary)' }}>
                              0{stepIdx + 1} · {step.title}
                            </div>
                            <p className="mt-1 leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                              {step.detail}
                            </p>
                          </li>
                        ))}
                      </ol>
                      <div style={{ color: 'var(--sys-muted)' }}>
                        <strong style={{ color: 'var(--sys-text)' }}>Alignment: </strong>
                        {executionGuide.postureCue}
                      </div>
                    </div>
                  )}

                  {/* Sets x Lift x Reps Table */}
                  <div className="sys-card-nested mt-3 p-3">
                    <div
                      className="font-mono-num mb-2 hidden grid-cols-[44px_1fr_1fr_52px_36px] gap-2 text-center text-[11px] sm:grid"
                      style={{ color: 'var(--sys-muted)' }}
                    >
                      <span>SET</span>
                      <span>WEIGHT (KG)</span>
                      <span>{isTime ? 'SEC / MIN' : 'REPS'}</span>
                      <span>DONE</span>
                      <span />
                    </div>

                    <div className="space-y-3 sm:space-y-2">
                      {sets.map((s, sIdx) => {
                        const setStateLabel = s.done
                          ? 'Done'
                          : sIdx === nextActiveIdx
                            ? 'Active'
                            : 'Upcoming';
                        return (
                        <div
                          key={sIdx}
                          className="grid grid-cols-1 gap-2 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[44px_1fr_1fr_52px_36px] sm:items-center sm:border-b-0 sm:pb-0"
                          style={{ borderColor: 'var(--sys-border)' }}
                        >
                          {/* Set number + mobile Done/Remove header */}
                          <div className="flex items-center justify-between sm:flex-col sm:justify-center">
                            <span
                              className="font-mono-num text-xs font-semibold"
                              style={{ color: s.done ? 'var(--sys-secondary)' : sIdx === nextActiveIdx ? 'var(--sys-primary)' : 'var(--sys-muted)' }}
                            >
                              Set {sIdx + 1}
                              {pr?.bestStr ? (
                                <span className="ml-2 font-normal sm:hidden">· Best: {pr.bestStr}</span>
                              ) : null}
                            </span>
                            <span
                              className="hidden text-[10px] sm:block"
                              style={{
                                color: s.done
                                  ? 'var(--sys-secondary)'
                                  : sIdx === nextActiveIdx
                                    ? 'var(--sys-primary)'
                                    : 'var(--sys-muted)',
                              }}
                            >
                              {setStateLabel}
                            </span>
                            <div className="flex items-center gap-2 sm:hidden">
                              {sIdx === sets.length - 1 && sets.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Remove last set from ${ex.name}`}
                                  onClick={() => onRemoveSetRow(selectedDay, exIdx, isMinMode)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border"
                                  style={{
                                    borderColor: 'var(--sys-border)',
                                    color: 'var(--sys-danger)',
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                aria-pressed={s.done}
                                aria-label={`Complete ${ex.name} set ${sIdx + 1}`}
                                onClick={() => onToggleSetDone(selectedDay, exIdx, sIdx, isMinMode)}
                                className="inline-flex h-9 min-w-[44px] items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors"
                                style={{
                                  backgroundColor: s.done
                                    ? 'var(--sys-secondary)'
                                    : 'var(--sys-surface)',
                                  borderColor: s.done
                                    ? 'var(--sys-secondary)'
                                    : 'var(--sys-border)',
                                  color: s.done ? '#ffffff' : 'var(--sys-muted)',
                                }}
                              >
                                <Check className="h-4 w-4" />
                                <span>{s.done ? 'Done' : 'Log'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Steppers container on mobile wraps cleanly side by side */}
                          <div className="grid grid-cols-2 gap-2 sm:contents">
                            {/* Weight Stepper */}
                            <div>
                              <span
                                className="mb-1 block text-[10px] font-medium sm:hidden"
                                style={{ color: 'var(--sys-muted)' }}
                              >
                                Lift (kg)
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Decrease weight for ${ex.name} set ${sIdx + 1}`}
                                  onClick={() =>
                                    onStepSetField(selectedDay, exIdx, sIdx, 'kg', -2.5, isMinMode)
                                  }
                                  className="sys-btn-secondary flex h-9 w-8 shrink-0 items-center justify-center p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  aria-label={`Lift weight kg for ${ex.name} set ${sIdx + 1}`}
                                  value={s.kg}
                                  onChange={(e) =>
                                    onUpdateSetField(
                                      selectedDay,
                                      exIdx,
                                      sIdx,
                                      'kg',
                                      parseFloat(e.target.value) || 0,
                                      isMinMode
                                    )
                                  }
                                  className="sys-input font-mono-num h-9 w-full min-w-[40px] px-1 text-center text-xs font-semibold"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase weight for ${ex.name} set ${sIdx + 1}`}
                                  onClick={() =>
                                    onStepSetField(selectedDay, exIdx, sIdx, 'kg', 2.5, isMinMode)
                                  }
                                  className="sys-btn-secondary flex h-9 w-8 shrink-0 items-center justify-center p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {/* Reps Stepper */}
                            <div>
                              <span
                                className="mb-1 block text-[10px] font-medium sm:hidden"
                                style={{ color: 'var(--sys-muted)' }}
                              >
                                {isTime ? 'Sec / Min' : 'Reps'}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Decrease reps for ${ex.name} set ${sIdx + 1}`}
                                  onClick={() =>
                                    onStepSetField(selectedDay, exIdx, sIdx, 'reps', -1, isMinMode)
                                  }
                                  className="sys-btn-secondary flex h-9 w-8 shrink-0 items-center justify-center p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  type="number"
                                  aria-label={`Reps for ${ex.name} set ${sIdx + 1}`}
                                  value={s.reps}
                                  onChange={(e) =>
                                    onUpdateSetField(
                                      selectedDay,
                                      exIdx,
                                      sIdx,
                                      'reps',
                                      parseFloat(e.target.value) || 0,
                                      isMinMode
                                    )
                                  }
                                  className="sys-input font-mono-num h-9 w-full min-w-[40px] px-1 text-center text-xs font-semibold"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase reps for ${ex.name} set ${sIdx + 1}`}
                                  onClick={() =>
                                    onStepSetField(selectedDay, exIdx, sIdx, 'reps', 1, isMinMode)
                                  }
                                  className="sys-btn-secondary flex h-9 w-8 shrink-0 items-center justify-center p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Desktop Done Checkmark Button */}
                          <div className="hidden justify-center sm:flex">
                            <button
                              type="button"
                              aria-pressed={s.done}
                              aria-label={`Complete ${ex.name} set ${sIdx + 1}`}
                              onClick={() => onToggleSetDone(selectedDay, exIdx, sIdx, isMinMode)}
                              className="flex h-9 w-10 items-center justify-center rounded-lg border transition-colors"
                              style={{
                                backgroundColor: s.done
                                  ? 'var(--sys-secondary)'
                                  : 'var(--sys-surface)',
                                borderColor: s.done
                                  ? 'var(--sys-secondary)'
                                  : 'var(--sys-border)',
                                color: s.done ? '#ffffff' : 'var(--sys-muted)',
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Desktop Remove Set */}
                          <div className="hidden justify-center sm:flex">
                            {sIdx === sets.length - 1 && sets.length > 1 && (
                              <button
                                type="button"
                                aria-label={`Remove last set from ${ex.name}`}
                                onClick={() => onRemoveSetRow(selectedDay, exIdx, isMinMode)}
                                className="flex h-8 w-8 items-center justify-center rounded"
                                style={{ color: 'var(--sys-danger)' }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onAddSetRow(selectedDay, exIdx, isMinMode)}
                        className="sys-btn-secondary inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap px-3 text-xs"
                      >
                        <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                        <span>Add Set</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

