import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Lock,
  Moon,
  Newspaper,
  Quote,
  Shield,
  ShieldCheck,
  Swords,
  Trash2,
  Watch,
} from 'lucide-react';
import { MOTIVATIONAL_SLIDES, WELLNESS_NEWS } from '../data/motivation';
import type { AppState, FemaleStage, QuestItem, StatKey } from '../types/system';
import {
  computeMicronutrients,
  getAutonomicReadiness,
  getCircadianWindow,
  getKineticAndSleepMetrics,
  getMacroPercentages,
} from '../utils/clinical';
import {
  activeFemaleStage,
  calculateMacros,
  FEMALE_STAGES,
  getCyclePhaseInsight,
  getFemaleStageLabel,
  getLevelInfo,
  getProgramDayNumber,
  getRank,
  isMaternalProfile,
  sumDailyMacros,
} from '../utils/metabolic';
import { buildDailyQuests, getHabitStatementStatus } from '../utils/quests';
import { getNextBestMove } from '../utils/notifications';
import { THEME_COPY, todayISO } from '../utils/storage';
import { ProgressBar, RingGauge } from './ProgressBar';

interface QuestsViewProps {
  state: AppState;
  bleDeviceName?: string | null;
  bleBpm?: number;
  onToggleMinimumDue: (enabled: boolean) => void;
  onLogWater: (delta: number) => void;
  onToggleManualQuest: (questId: string) => void;
  onSetFemaleStage: (stage: FemaleStage) => void;
  onSyncWatch: (steps: number, sleep: number, hrvMs?: number, rhrBpm?: number) => void;
  onCreateDuel: (email: string) => void;
  onUploadPhotoMilestone: (day: number, dataUrl: string) => void;
  onDeletePhotoMilestone: (day: number) => void;
  onNavigateTab: (tab: 'program' | 'nutrition') => void;
  onOpenSuryaTutorial: () => void;
  onOpenWatch?: () => void;
}

const CLEAN_DOMAIN_LABEL: Record<StatKey, string> = {
  STR: 'Strength',
  AGI: 'Kinetic Output',
  INT: 'Energy Balance',
  VIT: 'Physiology',
  SEN: 'Recovery',
};

export const QuestsView: React.FC<QuestsViewProps> = ({
  state,
  bleDeviceName = null,
  bleBpm = 0,
  onToggleMinimumDue,
  onLogWater,
  onToggleManualQuest,
  onSetFemaleStage,
  onSyncWatch,
  onCreateDuel,
  onUploadPhotoMilestone,
  onDeletePhotoMilestone,
  onNavigateTab,
  onOpenSuryaTutorial,
  onOpenWatch,
}) => {
  const dateStr = todayISO();
  const copy = THEME_COPY[state.theme];
  const quests = buildDailyQuests(state, dateStr);
  const statement = getHabitStatementStatus(state, dateStr);
  const doneMap = state.done[dateStr] || {};
  const doneCount = quests.filter((q) => doneMap[q.id]).length;
  const macros = calculateMacros(state.p);
  const loggedMacros = sumDailyMacros(state.log[dateStr] || []);
  const waterLitres = Number(state.water[dateStr] || 0);
  const levelInfo = getLevelInfo(state.xp);
  const rank = getRank(levelInfo.l);
  const maternal = isMaternalProfile(state.p);
  const showWomenModule = state.theme === 'women' || maternal;
  const isClean = state.theme === 'clean';
  const circadian = getCircadianWindow();
  const readiness = getAutonomicReadiness(state, dateStr, bleBpm);
  const micros = computeMicronutrients(state.log[dateStr] || [], state.p);
  const macroPct = getMacroPercentages(state, dateStr);
  const kinetic = getKineticAndSleepMetrics(state.watch, bleDeviceName);
  const nextMove = getNextBestMove(state, dateStr);

  const [duelEmail, setDuelEmail] = useState('');
  const [stepsInput, setStepsInput] = useState(String(state.watch.steps || ''));
  const [sleepInput, setSleepInput] = useState(String(state.watch.sleep || ''));
  const [hrvInput, setHrvInput] = useState(String(state.watch.hrvMs || readiness.hrvMs));
  const [rhrInput, setRhrInput] = useState(String(state.watch.rhrBpm || readiness.rhrBpm));
  const [countdown, setCountdown] = useState('--:--:--');
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState<number>(() => {
    const match = MOTIVATIONAL_SLIDES.findIndex((s) => s.themeFocus === state.theme);
    return match >= 0 ? match : 0;
  });
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(WELLNESS_NEWS[0]?.id || null);
  const [showMorePanels, setShowMorePanels] = useState(false);

  useEffect(() => {
    const match = MOTIVATIONAL_SLIDES.findIndex((s) => s.themeFocus === state.theme);
    if (match >= 0) setSlideIdx(match);
  }, [state.theme]);

  useEffect(() => {
    setStepsInput(String(state.watch.steps || ''));
    setSleepInput(String(state.watch.sleep || ''));
    setHrvInput(String(state.watch.hrvMs || readiness.hrvMs));
    setRhrInput(String(state.watch.rhrBpm || readiness.rhrBpm));
  }, [state.watch.steps, state.watch.sleep, state.watch.hrvMs, state.watch.rhrBpm, readiness.hrvMs, readiness.rhrBpm]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const sec = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
      const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      setCountdown(`${hh}:${mm}:${ss}`);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handlePhotoSelect = (day: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawData = reader.result;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 640;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            onUploadPhotoMilestone(day, canvas.toDataURL('image/jpeg', 0.72));
            return;
          }
        } catch {
          // Fallback to raw image if canvas unavailable
        }
        onUploadPhotoMilestone(day, rawData);
      };
      img.onerror = () => onUploadPhotoMilestone(day, rawData);
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const bossRem = Math.max(0, state.boss.max - state.boss.dmg);
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const cycleInsight = getCyclePhaseInsight(dayNum, state.p);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left / Primary Column */}
      <div className="space-y-6 lg:col-span-8">
        {/* Theme-Adaptive Hero Summary Card */}
        {state.theme === 'rpg' ? (
          <div className="sys-card sys-card-chamfer p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 rotate-45 items-center justify-center border-2"
                  style={{
                    borderColor: 'var(--sys-primary)',
                    boxShadow: '0 0 16px rgba(0, 229, 255, 0.35)',
                  }}
                >
                  <span
                    className="font-display -rotate-45 text-2xl font-bold"
                    style={{ color: 'var(--sys-primary)' }}
                  >
                    {rank}
                  </span>
                </div>
                <div>
                  <div className="font-display text-xl font-bold">
                    {state.p.name} · {state.p.title}
                  </div>
                  <div
                    className="font-mono-num text-xs"
                    style={{ color: 'var(--sys-muted)' }}
                  >
                    Level {levelInfo.l} · {levelInfo.x}/{levelInfo.n} XP · {state.streak}d Streak
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Quest Reset In
                </div>
                <div
                  className="font-mono-num text-lg font-bold"
                  style={{ color: 'var(--sys-danger)' }}
                >
                  {countdown}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar value={levelInfo.x} max={levelInfo.n} label="Level experience" />
            </div>

            <div
              className="font-mono-num mt-4 grid grid-cols-5 gap-2 border-t pt-4 text-center text-xs"
              style={{ borderColor: 'var(--sys-border)' }}
            >
              {Object.entries(state.stats).map(([key, val]) => (
                <div key={key}>
                  <div style={{ color: 'var(--sys-muted)' }}>{key}</div>
                  <div className="mt-0.5 text-base font-bold">{val}</div>
                </div>
              ))}
            </div>
          </div>
        ) : state.theme === 'women' ? (
          <div className="sys-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div
                  className="font-mono-num text-xs font-semibold"
                  style={{ color: 'var(--sys-primary)' }}
                >
                  {maternal ? getFemaleStageLabel(state.p) : `Cycle Day ${cycleInsight.cycleDay} of 28`}
                </div>
                <h1 className="font-display mt-1 text-2xl font-semibold">
                  {cycleInsight.phaseLabel}
                </h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--sys-muted)' }}>
                  {maternal
                    ? 'Pregnancy safety is on · Calorie cuts are turned off and gentle, safe moves are selected.'
                    : statement.isMinimumDueMode
                      ? `Minimum Due is on · Complete ${statement.minPillarsMet}/${statement.minRequired} quick habits to keep your ${state.streak}-day streak.`
                      : cycleInsight.dailyTip}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <RingGauge
                  value={readiness.readinessPct}
                  max={100}
                  color="var(--sys-secondary)"
                  centerText={`${readiness.readinessPct}%`}
                  subText="Energy"
                />
                <RingGauge
                  value={doneCount}
                  max={quests.length}
                  color="var(--sys-primary)"
                  centerText={`${doneCount}/${quests.length}`}
                  subText="Habits"
                />
              </div>
            </div>

            <div
              className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4"
              style={{ borderColor: 'var(--sys-border)' }}
            >
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Phase &amp; Rhythm
                </div>
                <div className="mt-0.5 text-xs font-semibold leading-snug">
                  {maternal ? getFemaleStageLabel(state.p) : `Day ${cycleInsight.cycleDay} · 28d`}
                </div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Recommended Pace
                </div>
                <div className="mt-0.5 text-xs font-semibold leading-snug" style={{ color: 'var(--sys-secondary)' }}>
                  {cycleInsight.energyPace}
                </div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Key Nutrients
                </div>
                <div className="mt-0.5 text-xs font-semibold leading-snug">
                  {cycleInsight.nutrientFocus}
                </div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Daily Target
                </div>
                <div className="font-mono-num mt-0.5 text-xs font-bold" style={{ color: 'var(--sys-primary)' }}>
                  {macros.t} cal · {macros.pr}g P
                </div>
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar
                value={doneCount}
                max={quests.length}
                tone="primary"
                label="Daily care habits completion"
              />
            </div>
          </div>
        ) : (
          <div className="sys-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div
                  className="font-mono-num text-xs font-semibold"
                  style={{ color: 'var(--sys-primary)' }}
                >
                  {circadian.windowLabel} · {circadian.phase}
                </div>
                <h1 className="font-display mt-1 text-2xl font-semibold">
                  Autonomic Readiness &amp; Daily Protocol · Day {dayNum}
                </h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--sys-muted)' }}>
                  {circadian.guidance}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <RingGauge
                  value={readiness.readinessPct}
                  max={100}
                  color={readiness.isReadyForLoad ? 'var(--sys-secondary)' : 'var(--sys-warn)'}
                  centerText={`${readiness.readinessPct}%`}
                  subText="Readiness"
                />
                <RingGauge
                  value={doneCount}
                  max={quests.length}
                  color="var(--sys-primary)"
                  centerText={`${Math.round((doneCount / Math.max(1, quests.length)) * 100)}%`}
                  subText="Protocol"
                />
              </div>
            </div>

            <div
              className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4"
              style={{ borderColor: 'var(--sys-border)' }}
            >
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  HRV (RMSSD)
                </div>
                <div className="font-mono-num mt-0.5 text-lg font-bold">
                  {readiness.hrvMs} ms
                </div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Resting HR
                </div>
                <div className="font-mono-num mt-0.5 text-lg font-bold">
                  {readiness.rhrBpm} bpm
                </div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Autonomic State
                </div>
                <div
                  className="mt-0.5 text-xs font-semibold leading-snug"
                  style={{
                    color: readiness.isReadyForLoad ? 'var(--sys-secondary)' : 'var(--sys-warn)',
                  }}
                >
                  {readiness.statusLabel}
                </div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Optimal Window
                </div>
                <div className="mt-0.5 text-xs font-semibold leading-snug">
                  {circadian.optimalLoad}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar
                value={doneCount}
                max={quests.length}
                tone="secondary"
                label="Daily protocol completion"
              />
            </div>
          </div>
        )}

        {/* Plain-English Next Best Move (3-Second Rule) */}
        <section
          aria-label="Next best move"
          className="sys-card flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
        >
          <div className="min-w-0">
            <div className="font-mono-num text-[11px] font-semibold" style={{ color: 'var(--sys-primary)' }}>
              Next Best Move · {nextMove.timeTag}
            </div>
            <h2 className="font-display mt-0.5 text-base font-bold">
              {nextMove.headline}
            </h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
              {nextMove.plainBenefit}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (nextMove.actionType === 'water') onLogWater(0.25);
              else if (nextMove.actionType === 'nutrition') onNavigateTab('nutrition');
              else if (nextMove.actionType === 'program') onNavigateTab('program');
              else onToggleMinimumDue(true);
            }}
            className="sys-btn-primary min-h-[44px] shrink-0 px-4 text-xs"
          >
            {nextMove.ctaLabel}
          </button>
        </section>

        {/* Daily Habit Statement & Minimum Due Switcher (Credit-Card Streak Guard) */}
        <section
          aria-label="Daily streak statement and minimum due mode"
          className="sys-card p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 shrink-0"
                  style={{
                    color: statement.streakProtected
                      ? 'var(--sys-secondary)'
                      : statement.isMinimumDueMode
                        ? 'var(--sys-warn)'
                        : 'var(--sys-primary)',
                  }}
                />
                <h2 className="font-display text-base font-semibold">
                  Keep Your Streak Alive · Minimum Due
                </h2>
              </div>
              <p className="font-mono-num mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
                {statement.statementTier === 'full_paid' ? (
                  <span style={{ color: 'var(--sys-secondary)' }}>
                    Full Day Complete · {state.streak}d streak safe
                  </span>
                ) : statement.statementTier === 'minimum_paid' ? (
                  <span style={{ color: 'var(--sys-secondary)' }}>
                    Streak Saved (Minimum Due) · {state.streak}d streak safe
                  </span>
                ) : statement.isMinimumDueMode ? (
                  <span style={{ color: 'var(--sys-warn)' }}>
                    Minimum Due On · {statement.minPillarsMet}/{statement.minRequired} quick habits
                    done to keep your {state.streak}d streak
                  </span>
                ) : (
                  <span>
                    Minimum Due: {statement.minPillarsMet}/{statement.minRequired} quick habits ·
                    Full Day: {statement.fullTargetsMet}/{statement.fullRequired} goals
                  </span>
                )}
              </p>
            </div>

            <div
              role="group"
              aria-label="Daily commitment mode"
              className="grid w-full shrink-0 grid-cols-2 rounded-lg border p-1 sm:inline-flex sm:w-auto"
              style={{
                backgroundColor: 'var(--sys-surface-lowest)',
                borderColor: 'var(--sys-border)',
              }}
            >
              <button
                type="button"
                aria-pressed={!statement.isMinimumDueMode}
                onClick={() => onToggleMinimumDue(false)}
                className="min-h-[36px] whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: !statement.isMinimumDueMode
                    ? 'var(--sys-surface)'
                    : 'transparent',
                  color: !statement.isMinimumDueMode ? 'var(--sys-text)' : 'var(--sys-muted)',
                }}
              >
                Full Plan
              </button>
              <button
                type="button"
                aria-pressed={statement.isMinimumDueMode}
                onClick={() => onToggleMinimumDue(true)}
                className="min-h-[36px] whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: statement.isMinimumDueMode
                    ? 'var(--sys-primary)'
                    : 'transparent',
                  color: statement.isMinimumDueMode
                    ? 'var(--sys-on-primary)'
                    : 'var(--sys-muted)',
                }}
              >
                Minimum Due
              </button>
            </div>
          </div>

          <div className="mt-3">
            <ProgressBar
              value={
                statement.isMinimumDueMode
                  ? Math.min(statement.minPillarsMet, statement.minRequired)
                  : statement.fullTargetsMet
              }
              max={
                statement.isMinimumDueMode ? statement.minRequired : statement.fullRequired
              }
              tone={statement.streakProtected ? 'secondary' : 'primary'}
              label="Statement streak protection progress"
            />
          </div>

          <div
            className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-4"
            style={{ borderColor: 'var(--sys-border)' }}
          >
            <button
              type="button"
              onClick={() => onNavigateTab('program')}
              className="flex min-h-[44px] flex-col items-start justify-center rounded-md px-2 py-1.5 text-left transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--sys-surface-lowest)' }}
            >
              <span className="text-[11px] font-semibold">5-Min Micro-Workout</span>
              <span
                className="font-mono-num mt-0.5 inline-flex items-center gap-1 text-[11px]"
                style={{
                  color: statement.minWorkoutDone ? 'var(--sys-secondary)' : 'var(--sys-primary)',
                }}
              >
                {statement.minWorkoutDone && <CheckCircle2 className="h-3 w-3" />}
                {statement.minWorkoutDone ? 'Done' : 'Start 3 moves →'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!statement.minHydrationMet) onLogWater(0.5);
              }}
              className="flex min-h-[44px] flex-col items-start justify-center rounded-md px-2 py-1.5 text-left transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--sys-surface-lowest)' }}
            >
              <span className="text-[11px] font-semibold">1.5 L Hydration</span>
              <span
                className="font-mono-num mt-0.5 inline-flex items-center gap-1 text-[11px]"
                style={{
                  color: statement.minHydrationMet ? 'var(--sys-secondary)' : 'var(--sys-primary)',
                }}
              >
                {statement.minHydrationMet && <CheckCircle2 className="h-3 w-3" />}
                {statement.minHydrationMet
                  ? 'Done'
                  : `${waterLitres.toFixed(1)}/1.5 L (+500ml)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('nutrition')}
              className="flex min-h-[44px] flex-col items-start justify-center rounded-md px-2 py-1.5 text-left transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--sys-surface-lowest)' }}
            >
              <span className="text-[11px] font-semibold">1 Healthy Meal</span>
              <span
                className="font-mono-num mt-0.5 inline-flex items-center gap-1 text-[11px]"
                style={{
                  color: statement.minNourishMet ? 'var(--sys-secondary)' : 'var(--sys-primary)',
                }}
              >
                {statement.minNourishMet && <CheckCircle2 className="h-3 w-3" />}
                {statement.minNourishMet ? 'Done' : 'Add meal →'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onToggleManualQuest('b')}
              className="flex min-h-[44px] flex-col items-start justify-center rounded-md px-2 py-1.5 text-left transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--sys-surface-lowest)' }}
            >
              <span className="text-[11px] font-semibold">2-Min Stretch</span>
              <span
                className="font-mono-num mt-0.5 inline-flex items-center gap-1 text-[11px]"
                style={{
                  color: statement.minMovementCheckInMet
                    ? 'var(--sys-secondary)'
                    : 'var(--sys-primary)',
                }}
              >
                {statement.minMovementCheckInMet && <CheckCircle2 className="h-3 w-3" />}
                {statement.minMovementCheckInMet ? 'Done' : 'Mark complete'}
              </span>
            </button>
          </div>
        </section>

        {/* Hydration Quick Action Bar */}
        <div className="sys-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Droplets className="h-5 w-5" style={{ color: 'var(--sys-primary)' }} />
            <div>
              <div className="text-sm font-semibold">Hydration Tracker</div>
              <div className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                {waterLitres.toFixed(2)} / {statement.hydrationTargetLitres.toFixed(2)} L logged
                today
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onLogWater(0.25)}
              className="sys-btn-secondary min-h-[42px] px-3.5 text-xs font-semibold"
            >
              +250 ml
            </button>
            <button
              type="button"
              onClick={() => onLogWater(0.5)}
              className="sys-btn-secondary min-h-[42px] px-3.5 text-xs font-semibold"
            >
              +500 ml
            </button>
            <button
              type="button"
              onClick={() => onLogWater(1.0)}
              className="sys-btn-primary min-h-[42px] px-4 text-xs"
            >
              +1.0 L
            </button>
          </div>
        </div>

        {/* Daily Quests / Protocol Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{copy.dailyTitle}</h2>
            <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
              {doneCount}/{quests.length} done
            </span>
          </div>

          {quests.map((q: QuestItem) => {
            const isDone = Boolean(doneMap[q.id]);
            const isExpanded = expandedQuestId === q.id;

            return (
              <div
                key={q.id}
                className="sys-card p-4"
                style={{
                  borderColor: isDone ? 'var(--sys-secondary)' : 'var(--sys-border)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-semibold ${isDone ? 'line-through opacity-70' : ''}`}
                    >
                      {q.t}
                    </div>
                    <div
                      className="font-mono-num mt-1 flex flex-wrap items-center gap-1.5 text-xs"
                      style={{ color: 'var(--sys-muted)' }}
                    >
                      <span>{isClean ? CLEAN_DOMAIN_LABEL[q.st] : `+${q.xp} XP`}</span>
                      {!isClean && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{q.st}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {q.auto ? 'Checks off automatically' : 'Tap when done'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {q.id === 'sn' && (
                      <button
                        type="button"
                        onClick={onOpenSuryaTutorial}
                        className="sys-btn-secondary min-h-[40px] px-3 text-xs"
                      >
                        12-Pose Guide
                      </button>
                    )}

                    {q.auto ? (
                      isDone ? (
                        <span
                          className="inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
                          style={{ color: 'var(--sys-secondary)' }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Done
                        </span>
                      ) : q.id === 'w' ? (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('program')}
                          className="sys-btn-primary min-h-[40px] px-3.5 text-xs"
                        >
                          Go to Workout
                        </button>
                      ) : q.id === 'p' || q.id === 'c' ? (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('nutrition')}
                          className="sys-btn-primary min-h-[40px] px-3.5 text-xs"
                        >
                          Add Meal
                        </button>
                      ) : (
                        <span
                          className="inline-flex min-h-[40px] items-center gap-1 px-2 text-xs"
                          style={{ color: 'var(--sys-muted)' }}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Log below
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleManualQuest(q.id)}
                        className={`${isDone ? 'sys-btn-secondary' : 'sys-btn-primary'} min-h-[40px] px-3.5 text-xs`}
                      >
                        {isDone ? 'Done' : 'Mark Done'}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedQuestId(isExpanded ? null : q.id)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--sys-primary)' }}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  <span>Why this helps</span>
                </button>

                {isExpanded && (
                  <div
                    className="sys-card-nested mt-2 p-3 text-xs leading-relaxed"
                    style={{ color: 'var(--sys-muted)' }}
                  >
                    <div>
                      <strong style={{ color: 'var(--sys-secondary)' }}>Why it helps: </strong>
                      {q.r}
                    </div>
                    <div className="mt-1">
                      <strong style={{ color: 'var(--sys-danger)' }}>If skipped: </strong>
                      {q.l}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right / Secondary Column */}
      <div className="space-y-6 lg:col-span-4">
        {/* Daily Motivation: Photography, Quotes & Wellness News */}
        {(() => {
          const slide = MOTIVATIONAL_SLIDES[slideIdx % MOTIVATIONAL_SLIDES.length] || MOTIVATIONAL_SLIDES[0];
          return (
            <section aria-label="Daily Motivation and Wellness News" className="sys-card overflow-hidden">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                <img
                  src={slide.imageUrl}
                  alt={slide.imageAlt}
                  referrerPolicy="no-referrer"
                  className="sys-media-img h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/55 to-black/10"
                  aria-hidden="true"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white drop-shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-white/90">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Quote className="h-3.5 w-3.5" aria-hidden="true" />
                      {slide.author}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Previous motivation slide"
                        onClick={() =>
                          setSlideIdx((i) => (i - 1 + MOTIVATIONAL_SLIDES.length) % MOTIVATIONAL_SLIDES.length)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next motivation slide"
                        onClick={() => setSlideIdx((i) => (i + 1) % MOTIVATIONAL_SLIDES.length)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-white">
                    &ldquo;{slide.quote}&rdquo;
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display flex items-center gap-2 text-base font-semibold">
                    <Newspaper className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
                    <span>Quick Health Tips</span>
                  </h2>
                  <span className="font-mono-num text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                    Daily Reads
                  </span>
                </div>

                <div className="mt-3 divide-y" style={{ borderColor: 'var(--sys-border)' }}>
                  {WELLNESS_NEWS.map((news) => {
                    const open = expandedNewsId === news.id;
                    return (
                      <div key={news.id} className="py-2.5 first:pt-0 last:pb-0" style={{ borderColor: 'var(--sys-border)' }}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setExpandedNewsId(open ? null : news.id)}
                          className="flex w-full items-start justify-between gap-2 text-left"
                        >
                          <div>
                            <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                              {news.category} <span aria-hidden="true">·</span> {news.readTime}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold leading-snug">
                              {news.title}
                            </div>
                          </div>
                          <ChevronDown
                            className={`mt-1 h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--sys-muted)' }}
                          />
                        </button>
                        {open && (
                          <div className="mt-2 space-y-1.5 text-xs leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                            <p>{news.summary}</p>
                            <p className="font-medium" style={{ color: 'var(--sys-secondary)' }}>
                              Easy tip: {news.takeaway}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

        {/* Women's Wellness Stage Card */}
        {showWomenModule && (
          <div className="sys-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">Life Stage &amp; Safety</h2>
              <Shield className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
              Adjusts daily calories and automatically swaps unsafe workouts when pregnancy or
              new-mom recovery is selected.
            </p>
            <label htmlFor="women-stage-select" className="sr-only">
              Select life stage
            </label>
            <select
              id="women-stage-select"
              value={activeFemaleStage(state.p)}
              onChange={(e) => onSetFemaleStage(e.target.value as FemaleStage)}
              className="sys-input mt-3 w-full px-3 py-2.5 text-sm"
            >
              {FEMALE_STAGES.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Activity & Sleep Sync / Clinical Kinetic & Sleep Telemetry */}
        <div className="sys-card p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold">
                {isClean ? 'Rest & Kinetic Displacement' : 'Today’s Steps & Sleep'}
              </h2>
              {isClean && (
                <p className="mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
                  {kinetic.sensorSource}
                </p>
              )}
            </div>
            <Moon className="h-4 w-4 shrink-0" style={{ color: 'var(--sys-accent)' }} />
          </div>

          {isClean ? (
            <div className="mt-3 space-y-3">
              <div className="sys-card-nested p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold">Dual-Layer Displacement</span>
                  <span className="font-mono-num text-xs font-bold" style={{ color: 'var(--sys-primary)' }}>
                    {kinetic.totalSteps.toLocaleString()} steps · {kinetic.cadenceSpm} spm
                  </span>
                </div>
                <div className="font-mono-num mt-1 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Wearable: {kinetic.wearableSteps.toLocaleString()} · Phone Coprocessor:{' '}
                  {kinetic.coprocessorSteps.toLocaleString()}
                </div>
              </div>

              <div className="sys-card-nested p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold">Sleep Architecture</span>
                  <span className="font-mono-num text-xs font-bold" style={{ color: 'var(--sys-secondary)' }}>
                    {kinetic.formattedSleep} · {kinetic.repairStatus}
                  </span>
                </div>
                <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--sys-surface-high)' }}>
                  <div style={{ width: `${kinetic.deepPct}%`, backgroundColor: 'var(--sys-secondary)' }} />
                  <div style={{ width: `${kinetic.remPct}%`, backgroundColor: 'var(--sys-primary)' }} />
                  <div style={{ width: `${kinetic.lightPct}%`, backgroundColor: 'var(--sys-muted)', opacity: 0.4 }} />
                </div>
                <div className="font-mono-num mt-1.5 flex flex-wrap gap-x-2 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  <span>Deep {kinetic.deepPct}% ({kinetic.deepMins}m)</span>
                  <span aria-hidden="true">·</span>
                  <span>REM {kinetic.remPct}% ({kinetic.remMins}m)</span>
                  <span aria-hidden="true">·</span>
                  <span>Light {kinetic.lightPct}% ({kinetic.lightMins}m)</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
              Enter your daily steps and sleep hours to check off your movement &amp; rest goals.
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="q-steps" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Steps
              </label>
              <input
                id="q-steps"
                type="number"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                placeholder="8420"
                className="sys-input w-full px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="q-sleep" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Sleep (hrs)
              </label>
              <input
                id="q-sleep"
                type="number"
                step="0.2"
                value={sleepInput}
                onChange={(e) => setSleepInput(e.target.value)}
                placeholder="8.2"
                className="sys-input w-full px-3 py-2"
              />
            </div>
            {isClean && (
              <>
                <div>
                  <label htmlFor="q-hrv" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    HRV RMSSD (ms)
                  </label>
                  <input
                    id="q-hrv"
                    type="number"
                    value={hrvInput}
                    onChange={(e) => setHrvInput(e.target.value)}
                    placeholder="74"
                    className="sys-input w-full px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="q-rhr" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Resting HR (bpm)
                  </label>
                  <input
                    id="q-rhr"
                    type="number"
                    value={rhrInput}
                    onChange={(e) => setRhrInput(e.target.value)}
                    placeholder="54"
                    className="sys-input w-full px-3 py-2"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                onSyncWatch(
                  Number(stepsInput) || 0,
                  Number(sleepInput) || 0,
                  isClean ? Number(hrvInput) || undefined : undefined,
                  isClean ? Number(rhrInput) || undefined : undefined
                )
              }
              className="sys-btn-primary min-h-[42px] flex-1 text-xs"
            >
              {isClean ? 'Sync Telemetry' : 'Save Steps & Sleep'}
            </button>
            {onOpenWatch && (
              <button
                type="button"
                onClick={onOpenWatch}
                className="sys-btn-secondary inline-flex min-h-[42px] items-center justify-center gap-1.5 px-3 text-xs font-semibold"
              >
                <Watch className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />
                <span>Watch 1-Tap</span>
              </button>
            )}
          </div>

          {isClean ? (
            <div
              className="mt-3 border-t pt-3"
              style={{ borderColor: 'var(--sys-border)' }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Macro &amp; Micronutrient Precision</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('nutrition')}
                  className="font-semibold underline"
                  style={{ color: 'var(--sys-primary)' }}
                >
                  Food Log
                </button>
              </div>
              <div className="font-mono-num mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
                {Math.round(loggedMacros.k)} / {macros.t} kcal · P {macroPct.protPct}% · C {macroPct.carbPct}% · F {macroPct.fatPct}%
              </div>
              <div className="font-mono-num mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div style={{ color: 'var(--sys-muted)' }}>Iron</div>
                  <div className="font-semibold">{micros.ironMg}/{micros.ironTargetMg}mg</div>
                </div>
                <div>
                  <div style={{ color: 'var(--sys-muted)' }}>Magnesium</div>
                  <div className="font-semibold">{micros.magnesiumMg}/{micros.magnesiumTargetMg}mg</div>
                </div>
                <div>
                  <div style={{ color: 'var(--sys-muted)' }}>Folate</div>
                  <div className="font-semibold">{micros.folateMcg}/{micros.folateTargetMcg}mcg</div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="font-mono-num mt-3 border-t pt-3 text-xs"
              style={{ borderColor: 'var(--sys-border)', color: 'var(--sys-muted)' }}
            >
              Food today: {Math.round(loggedMacros.k)}/{macros.t} cal ·{' '}
              {Math.round(loggedMacros.p)}/{macros.pr} g protein
            </div>
          )}
        </div>

        {/* Collapsible Secondary Modules (keeps front page clean & focused) */}
        <div className="sys-card p-4">
          <button
            type="button"
            aria-expanded={showMorePanels}
            onClick={() => setShowMorePanels((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold"
          >
            <span>Friend Challenges &amp; Progress Photos</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showMorePanels ? 'rotate-180' : ''}`}
              style={{ color: 'var(--sys-muted)' }}
            />
          </button>

          {showMorePanels && (
            <div className="mt-4 space-y-5 border-t pt-4" style={{ borderColor: 'var(--sys-border)' }}>
              {/* Weekly Milestone + Duels */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold">{copy.bossTitle}</h3>
                  <span className="font-mono-num text-xs" style={{ color: 'var(--sys-danger)' }}>
                    {bossRem === 0 ? 'Cleared' : `${bossRem.toLocaleString()} left`}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
                  {isClean
                    ? 'Every completed daily goal contributes toward your weekly training milestone.'
                    : 'Every completed target contributes 18× XP impact.'}
                </p>
                <div className="mt-2">
                  <ProgressBar value={bossRem} max={state.boss.max} tone="danger" label="Weekly milestone remaining" />
                </div>

                <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--sys-border)' }}>
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4" style={{ color: 'var(--sys-accent)' }} />
                    <h4 className="font-display text-xs font-semibold">{copy.duelTitle}</h4>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <label htmlFor="duel-email" className="sr-only">
                      Opponent email
                    </label>
                    <input
                      id="duel-email"
                      type="email"
                      value={duelEmail}
                      onChange={(e) => setDuelEmail(e.target.value)}
                      placeholder="friend@email.com"
                      className="sys-input min-w-0 flex-1 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onCreateDuel(duelEmail);
                        setDuelEmail('');
                      }}
                      className="sys-btn-secondary min-h-[38px] shrink-0 px-3 text-xs font-semibold"
                    >
                      Challenge
                    </button>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {state.duels
                      .filter((d) => d.active)
                      .map((dl) => {
                        const myGain = Math.max(0, state.xp - dl.myStartXp);
                        const ahead = myGain >= dl.oppGain;
                        return (
                          <div key={dl.id} className="sys-card-nested p-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">You vs {dl.opp}</span>
                              <span
                                className="font-mono-num"
                                style={{ color: ahead ? 'var(--sys-secondary)' : 'var(--sys-warn)' }}
                              >
                                {ahead ? 'Leading' : 'Behind'} · {dl.ends}
                              </span>
                            </div>
                            <div className="font-mono-num mt-1" style={{ color: 'var(--sys-muted)' }}>
                              +{myGain} XP vs +{dl.oppGain} XP
                            </div>
                            <div className="mt-2">
                              <ProgressBar
                                value={myGain + 10}
                                max={myGain + dl.oppGain + 20}
                                tone={ahead ? 'secondary' : 'primary'}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* 30-Day Transformation Photo Check-In */}
              <div className="border-t pt-4" style={{ borderColor: 'var(--sys-border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold">30-Day Photo Check-In</h3>
                  <span className="font-mono-num text-[11px] font-semibold" style={{ color: [1, 7, 15, 21, 30].every((d) => Boolean(state.ph[d])) ? 'var(--sys-secondary)' : 'var(--sys-muted)' }}>
                    {[1, 7, 15, 21, 30].every((d) => Boolean(state.ph[d]))
                      ? 'Transformation Monarch Unlocked'
                      : `${[1, 7, 15, 21, 30].filter((d) => Boolean(state.ph[d])).length}/5 milestones`}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
                  {isClean
                    ? 'Compressed and stored privately on this device for longitudinal body composition check-ins.'
                    : 'Compressed & stored privately on this device. +25 XP on each milestone check-in.'}
                </p>

                <div className="mt-3 grid grid-cols-5 gap-2">
                  {[1, 7, 15, 21, 30].map((day) => {
                    const photo = state.ph[day];
                    return (
                      <div key={day} className="sys-card-nested flex flex-col items-center p-2 text-center">
                        <span className="font-mono-num text-[11px] font-semibold">D{day}</span>
                        {photo ? (
                          <>
                            <img
                              src={photo}
                              alt={`Day ${day} progress`}
                              referrerPolicy="no-referrer"
                              className="sys-media-img mt-1.5 h-12 w-full rounded object-cover"
                            />
                            <button
                              type="button"
                              aria-label={`Remove Day ${day} photo`}
                              onClick={() => onDeletePhotoMilestone(day)}
                              className="mt-1 p-1 text-xs"
                              style={{ color: 'var(--sys-danger)' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <label className="mt-2 flex min-h-[36px] cursor-pointer items-center justify-center rounded px-1.5 text-[11px] font-medium underline" style={{ color: 'var(--sys-primary)' }}>
                            Add
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => handlePhotoSelect(day, e)}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
