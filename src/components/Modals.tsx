import React, { useState } from 'react';
import { BellRing, Bluetooth, Copy, ExternalLink, RefreshCw, Upload, Watch, X } from 'lucide-react';
import { TUTORIALS } from '../data/exercises';
import { ALLERGY_OPTIONS, FOODS, RECIPES, buildGroceryList, getSafeFoods, getSafeRecipes } from '../data/foods';
import type {
  AllergyTag,
  AppState,
  CrossGymEvent,
  MedicalHistoryTag,
  OnboardingGoalStyle,
  Sex,
  StoryItem,
  ThemeMode,
  UserProfile,
  WatchActionEvent,
  WatchReminder,
  WatchSnapshot,
} from '../types/system';
import { getAutonomicReadiness } from '../utils/clinical';
import { DEFAULT_CLINICAL_CODEX, type ClinicalCodex } from '../utils/codex';
import {
  calculateMacros,
  getFemaleStageLabel,
  getLevelInfo,
  getProgramDayNumber,
  getRank,
  isFemaleProfile,
  isMaternalProfile,
  sumDailyMacros,
} from '../utils/metabolic';
import { MEDICAL_HISTORY_OPTIONS, recommendThemeFromProfile } from '../utils/onboarding';
import { getCoachReply, type CoachReply } from '../utils/quests';
import { THEME_COPY, todayISO } from '../utils/storage';
import { parseWearableHealthPayload, type ParsedWearableMetrics } from '../utils/watchSync';
import { PoseDiagram, ProgressBar } from './ProgressBar';
import { GeminiChatbot } from './GeminiChatbot';
import { WatchCompanionView } from './WatchCompanionView';

export type ActiveModal =
  | null
  | { type: 'onboarding' }
  | { type: 'tutorial'; key: string; step: number }
  | { type: 'grocery' }
  | { type: 'coach' }
  | { type: 'client_card' }
  | { type: 'story'; story: StoryItem }
  | { type: 'signin' }
  | { type: 'org_request' }
  | { type: 'admin' }
  | { type: 'qr_checkin' }
  | { type: 'watch' };

interface ModalsProps {
  modal: ActiveModal;
  state: AppState;
  codex?: ClinicalCodex;
  onClose: () => void;
  onSetModal: (m: ActiveModal) => void;
  onCompleteOnboarding: (
    draft: Partial<UserProfile>,
    recommendedTheme: ThemeMode,
    reason: string
  ) => void;
  onToggleGroceryItem: (item: string, checked: boolean) => void;
  onCoachAction: (reply: CoachReply) => void;
  onCopyText: (text: string, msg: string) => void;
  onSignIn: (payload: {
    email: string;
    password: string;
    name?: string;
    sex?: Sex;
    goalStyle?: OnboardingGoalStyle;
    medicalHistory?: MedicalHistoryTag[];
    medicalDeferred?: boolean;
    recommendedTheme: ThemeMode;
    reason: string;
  }) => void;
  onSubmitOrgRequest: (name: string, type: 'Gym' | 'Company', email: string, challenge: string) => void;
  onSaveGlobalEvent: (title: string, desc: string, active: boolean) => void;
  onSetOrgStatus: (orgId: string, status: 'approved' | 'rejected') => void;
  onToggleAdminUser: (email: string) => void;
  onVerifyGymCode: (code: string) => void;
  onCreateCrossGymEvent?: (ev: Omit<CrossGymEvent, 'id' | 'hostScore' | 'partnerScore' | 'active'>) => void;
  watchSnapshot?: WatchSnapshot;
  onWatchAction?: (action: WatchActionEvent) => void;
  onPushWatchReminder?: (reminder: WatchReminder) => void;
  onRegenerateWatchCode?: () => void;
  onConnectBleWatch?: () => void;
  onImportWearableMetrics?: (metrics: ParsedWearableMetrics) => void;
}

export const Modals: React.FC<ModalsProps> = ({
  modal,
  state,
  codex = DEFAULT_CLINICAL_CODEX,
  onClose,
  onSetModal,
  onCompleteOnboarding,
  onToggleGroceryItem,
  onCoachAction,
  onCopyText,
  onSignIn,
  onSubmitOrgRequest,
  onSaveGlobalEvent,
  onSetOrgStatus,
  onToggleAdminUser,
  onVerifyGymCode,
  onCreateCrossGymEvent,
  watchSnapshot,
  onWatchAction,
  onPushWatchReminder,
  onRegenerateWatchCode,
  onConnectBleWatch,
  onImportWearableMetrics,
}) => {
  // Onboarding state
  const [obStep, setObStep] = useState(0);
  const [obDraft, setObDraft] = useState({
    name: state.p.name,
    sex: state.p.sex,
    age: state.p.age,
    h: state.p.h,
    w: state.p.w,
    tw: state.p.tw,
    act: state.p.act,
    diet: state.p.diet,
    days: state.p.days,
    goalStyle: (state.p.goalStyle || 'balanced') as OnboardingGoalStyle,
    medicalHistory: (state.p.medicalHistory || []) as MedicalHistoryTag[],
    medicalDeferred: Boolean(state.p.medicalDeferred),
    allergies: (state.p.allergies || []) as AllergyTag[],
  });

  // Coach state (defaults to multi-turn Gemini Chat; can switch to Offline Codex anytime)
  const [coachHistory, setCoachHistory] = useState<
    Array<{ role: 'u' | 'a'; text: string; action?: CoachReply }>
  >([]);
  const [coachInput, setCoachInput] = useState('');
  const [useLiveGemini, setUseLiveGemini] = useState(true);
  const [coachLoading, setCoachLoading] = useState(false);

  // Sign-in & Org state
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siName, setSiName] = useState(state.p.name);
  const [siSex, setSiSex] = useState<Sex>(state.p.sex);
  const [siGoalStyle, setSiGoalStyle] = useState<OnboardingGoalStyle>(state.p.goalStyle || 'balanced');
  const [siMedical, setSiMedical] = useState<MedicalHistoryTag[]>(state.p.medicalHistory || []);
  const [siShowMedical, setSiShowMedical] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'Gym' | 'Company'>('Gym');
  const [orgEmail, setOrgEmail] = useState(state.acct.email || '');
  const [orgChallenge, setOrgChallenge] = useState('');
  const [qrCodeInput, setQrCodeInput] = useState('GYM-IRON88');

  // Admin state
  const [evTitle, setEvTitle] = useState(state.b2b.globalEvent.title);
  const [evDesc, setEvDesc] = useState(state.b2b.globalEvent.desc);
  const [evActive, setEvActive] = useState(state.b2b.globalEvent.active);
  const [cgTitle, setCgTitle] = useState('Weekend Studio Step Showdown');
  const [cgHostName, setCgHostName] = useState('Iron Temple Studio');
  const [cgPartnerName, setCgPartnerName] = useState('Apex Tech Wellness');

  // Watch import paste buffer
  const [wearableText, setWearableText] = useState('');

  const toggleTag = (list: MedicalHistoryTag[], tag: MedicalHistoryTag): MedicalHistoryTag[] =>
    list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag];

  const toggleAllergy = (list: AllergyTag[], tag: AllergyTag): AllergyTag[] =>
    list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag];

  if (!modal) return null;

  const askCoach = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || coachLoading) return;
    setCoachInput('');
    setCoachHistory((prev) => [...prev, { role: 'u', text: trimmed }]);

    if (!useLiveGemini) {
      const reply = getCoachReply(trimmed, state, todayISO(), codex);
      setCoachHistory((prev) => [...prev, { role: 'a', text: reply.text, action: reply }]);
      return;
    }

    setCoachLoading(true);
    try {
      const dateStr = todayISO();
      const macros = calculateMacros(state.p);
      const logged = sumDailyMacros(state.log[dateStr] || []);
      const readiness = getAutonomicReadiness(state, dateStr);
      const allergies = state.p.allergies || [];
      const safeRecipes = getSafeRecipes([...RECIPES, ...(codex.recipes || [])], allergies, {
        isFemaleOrWomen: isFemaleProfile(state.p) || state.theme === 'women',
        diet: state.p.diet,
      });
      const safeFoods = getSafeFoods(allergies, FOODS);

      const resp = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          profileSummary: {
            sex: state.p.sex,
            diet: state.p.diet,
            equipment: state.p.eq,
            stage: state.p.fstage,
            allergies,
          },
          dailyTelemetry: {
            steps: state.watch.steps,
            sleepHours: state.watch.sleep,
            hrvMs: readiness.hrvMs,
            rhrBpm: readiness.rhrBpm,
            streak: state.streak,
            remKcal: Math.max(0, macros.t - Math.round(logged.k)),
            remProt: Math.max(0, macros.pr - Math.round(logged.p)),
          },
          safeRecipes,
          safeFoods,
        }),
      });

      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.ok && data?.text) {
        const liveReply: CoachReply = {
          text: String(data.text),
          actionLabel: String(data.actionLabel || '+ Add 5-Min Post-Meal Walk'),
          actionType: data.actionType || 'add_walk',
          suggestedFood: data.suggestedFood,
          calendarUrl: data.calendarUrl,
          sources: Array.isArray(data.sources) ? data.sources : undefined,
          modeUsed: 'gemini_live',
        };
        setCoachHistory((prev) => [...prev, { role: 'a', text: liveReply.text, action: liveReply }]);
      } else {
        const fallback = getCoachReply(trimmed, state, dateStr, codex);
        const note =
          data?.error ||
          'Live AI Search is unavailable right now — answered with your offline Clinical Codex.';
        const replyWithNote: CoachReply = { ...fallback, note };
        setCoachHistory((prev) => [
          ...prev,
          { role: 'a', text: replyWithNote.text, action: replyWithNote },
        ]);
      }
    } catch {
      const fallback = getCoachReply(trimmed, state, todayISO(), codex);
      const replyWithNote: CoachReply = {
        ...fallback,
        note: 'Offline or server unreachable — answered using your cached Clinical Codex.',
      };
      setCoachHistory((prev) => [
        ...prev,
        { role: 'a', text: replyWithNote.text, action: replyWithNote },
      ]);
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        className={`sys-card max-h-[92vh] w-full overflow-y-auto ${
          modal.type === 'coach' ? 'max-w-2xl p-4 sm:p-6' : 'max-w-xl p-6'
        }`}
      >
        {/* 1. 7-Step Calibrated Onboarding (with Optional Medical History) */}
        {modal.type === 'onboarding' && (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                {obStep < 7 ? `Step ${obStep + 1} of 7 · ~20 sec setup` : 'Blueprint Ready'}
              </span>
              <button
                type="button"
                aria-label="Close setup"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2">
              <ProgressBar value={Math.min(7, obStep + 1)} max={7} />
            </div>

            {obStep === 0 && (
              <div className="mt-5 space-y-3">
                <h2 className="font-display text-xl font-bold">What is your name?</h2>
                <input
                  type="text"
                  value={obDraft.name}
                  onChange={(e) => setObDraft({ ...obDraft, name: e.target.value })}
                  placeholder="Enter your name"
                  className="sys-input w-full px-3 py-2.5"
                />
              </div>
            )}

            {obStep === 1 && (
              <div className="mt-5 space-y-3">
                <h2 className="font-display text-xl font-bold">Are you male or female?</h2>
                {(['m', 'f'] as const).map((sex) => (
                  <button
                    key={sex}
                    type="button"
                    onClick={() => {
                      setObDraft({ ...obDraft, sex });
                      setObStep(2);
                    }}
                    className={`${obDraft.sex === sex ? 'sys-btn-primary' : 'sys-btn-secondary'} min-h-[48px] w-full text-sm`}
                  >
                    {sex === 'm' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            )}

            {obStep === 2 && (
              <div className="mt-5 space-y-3">
                <h2 className="font-display text-xl font-bold">Age &amp; Height</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Age (years)
                    </label>
                    <input
                      type="number"
                      min={14}
                      max={90}
                      value={obDraft.age}
                      onChange={(e) => setObDraft({ ...obDraft, age: Number(e.target.value) || 25 })}
                      className="sys-input w-full px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      min={120}
                      max={220}
                      value={obDraft.h}
                      onChange={(e) => setObDraft({ ...obDraft, h: Number(e.target.value) || 170 })}
                      className="sys-input w-full px-3 py-2.5"
                    />
                  </div>
                </div>
                <div className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                  ≈ {Math.floor(obDraft.h / 30.48)} ft {Math.round((obDraft.h / 2.54) % 12)} in
                </div>
              </div>
            )}

            {obStep === 3 && (
              <div className="mt-5 space-y-3">
                <h2 className="font-display text-xl font-bold">Current &amp; Target Weight</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Current weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={obDraft.w}
                      onChange={(e) => setObDraft({ ...obDraft, w: Number(e.target.value) || 70 })}
                      className="sys-input w-full px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Target weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={obDraft.tw}
                      onChange={(e) => setObDraft({ ...obDraft, tw: Number(e.target.value) || 65 })}
                      className="sys-input w-full px-3 py-2.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {obStep === 4 && (
              <div className="mt-5 space-y-3">
                <h2 className="font-display text-xl font-bold">Daily Activity, Diet &amp; Style</h2>
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Activity Level
                  </label>
                  <select
                    value={obDraft.act}
                    onChange={(e) => setObDraft({ ...obDraft, act: Number(e.target.value) })}
                    className="sys-input w-full px-3 py-2.5 text-sm"
                  >
                    <option value={1.2}>Mostly sitting (desk / home)</option>
                    <option value={1.375}>Light walking &amp; errands</option>
                    <option value={1.55}>Active / on feet often</option>
                    <option value={1.725}>Very active / physical job</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Preferred Diet
                  </label>
                  <select
                    value={obDraft.diet}
                    onChange={(e) => setObDraft({ ...obDraft, diet: e.target.value })}
                    className="sys-input w-full px-3 py-2.5 text-sm"
                  >
                    {['Indian High-Protein Veg', 'Eggetarian', 'Omnivore', 'Plant-Based'].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    App Style
                  </label>
                  <select
                    value={obDraft.goalStyle}
                    onChange={(e) =>
                      setObDraft({ ...obDraft, goalStyle: e.target.value as OnboardingGoalStyle })
                    }
                    className="sys-input w-full px-3 py-2.5 text-sm"
                  >
                    <option value="balanced">Simple &amp; Clean Daily Tracker</option>
                    <option value="holistic">Calm &amp; Gentle Wellness</option>
                    <option value="competitive">Game Mode (XP, Levels &amp; Ranks)</option>
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Allergies / Intolerances (Optional — hides flagged foods everywhere)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALLERGY_OPTIONS.map((alg) => {
                      const checked = obDraft.allergies.includes(alg.id);
                      return (
                        <label
                          key={alg.id}
                          className="sys-card-nested flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs"
                          style={{
                            borderColor: checked ? 'var(--sys-primary)' : 'var(--sys-border)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setObDraft({
                                ...obDraft,
                                allergies: toggleAllergy(obDraft.allergies, alg.id),
                              })
                            }
                            className="h-3.5 w-3.5 shrink-0 accent-[var(--sys-primary)]"
                          />
                          <span className="truncate font-medium">{alg.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {obStep === 5 && (
              <div className="mt-5 space-y-3">
                <h2 className="font-display text-xl font-bold">Health Notes (Optional)</h2>
                <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Helps us pick safe workouts for you right away. You can skip this now and add it
                  later in Profile.
                </p>
                <div className="space-y-2">
                  {MEDICAL_HISTORY_OPTIONS.map((item) => {
                    const checked = obDraft.medicalHistory.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="sys-card-nested flex cursor-pointer items-start gap-2.5 p-2.5 text-xs"
                        style={{
                          borderColor: checked ? 'var(--sys-primary)' : 'var(--sys-border)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setObDraft({
                              ...obDraft,
                              medicalHistory: toggleTag(obDraft.medicalHistory, item.id),
                              medicalDeferred: false,
                            })
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sys-primary)]"
                        />
                        <div>
                          <div className="font-semibold">{item.label}</div>
                          <div style={{ color: 'var(--sys-muted)' }}>{item.detail}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setObDraft({ ...obDraft, medicalDeferred: true });
                    setObStep(6);
                  }}
                  className="sys-btn-secondary min-h-[40px] w-full text-xs font-semibold"
                >
                  Skip &amp; Enter Medical History Later
                </button>
              </div>
            )}

            {obStep === 6 && (
              <div className="mt-5 space-y-2.5">
                <h2 className="font-display text-xl font-bold">Choose Commitment Timeline</h2>
                {[
                  [14, '14 Days — Quick Momentum'],
                  [30, '30 Days — Habit & Fat-Loss Ignition'],
                  [60, '60 Days — Visible Transformation'],
                  [90, '90 Days — Full Body Recomposition'],
                ].map(([d, label]) => (
                  <button
                    key={String(d)}
                    type="button"
                    onClick={() => {
                      setObDraft({ ...obDraft, days: Number(d) });
                      setObStep(7);
                    }}
                    className={`${obDraft.days === d ? 'sys-btn-primary' : 'sys-btn-secondary'} min-h-[46px] w-full text-sm`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {obStep >= 7 && (() => {
              const rec = recommendThemeFromProfile({
                sex: obDraft.sex,
                medicalHistory: obDraft.medicalHistory,
                goalStyle: obDraft.goalStyle,
              });
              const preview = calculateMacros({
                ...state.p,
                ...obDraft,
                fstage: rec.recommendedFstage || 'std',
              });
              return (
                <div className="mt-5 space-y-4">
                  <h2 className="font-display text-xl font-bold">
                    Your Plan is Ready, {obDraft.name || 'Friend'}
                  </h2>
                  <div className="sys-card-nested p-3.5 text-xs">
                    <div className="font-semibold" style={{ color: 'var(--sys-primary)' }}>
                      Chosen Style: {THEME_COPY[rec.theme].label}
                    </div>
                    <p className="mt-1" style={{ color: 'var(--sys-muted)' }}>
                      {rec.reason} (You can switch anytime in Profile.)
                    </p>
                  </div>
                  <div className="sys-card-nested grid grid-cols-2 gap-4 p-4">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                        Daily Calories
                      </div>
                      <div className="font-mono-num text-lg font-bold" style={{ color: 'var(--sys-primary)' }}>
                        {preview.t} cal
                      </div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                        Daily Protein
                      </div>
                      <div className="font-mono-num text-lg font-bold" style={{ color: 'var(--sys-secondary)' }}>
                        {preview.pr} g
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onCompleteOnboarding(
                        {
                          ...obDraft,
                          fstage: rec.recommendedFstage || 'std',
                          tier: rec.recommendedTier || state.p.tier,
                        },
                        rec.theme,
                        rec.reason
                      );
                      onClose();
                    }}
                    className="sys-btn-primary min-h-[48px] w-full text-sm"
                  >
                    Save Plan &amp; Start Day 1
                  </button>
                </div>
              );
            })()}

            {obStep < 7 && (
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  disabled={obStep === 0}
                  onClick={() => setObStep((s) => Math.max(0, s - 1))}
                  className="sys-btn-secondary min-h-[40px] px-4 text-xs disabled:opacity-40"
                >
                  Back
                </button>
                {obStep !== 1 && obStep !== 6 && (
                  <button
                    type="button"
                    onClick={() => setObStep((s) => s + 1)}
                    className="sys-btn-primary min-h-[40px] px-5 text-xs"
                  >
                    Continue
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Exercise Form Tutorial */}
        {modal.type === 'tutorial' && (() => {
          const tut = TUTORIALS[modal.key];
          if (!tut) return null;
          const step = tut.steps[modal.step] || tut.steps[0];
          return (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                  {tut.name} · Step {modal.step + 1} of {tut.steps.length}
                </span>
                <button
                  type="button"
                  aria-label="Close tutorial"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3">
                <PoseDiagram pose={step.pose} />
              </div>
              {step.title && <h3 className="font-display mt-3 text-base font-bold">{step.title}</h3>}
              <p className="mt-1.5 text-sm leading-relaxed">{step.text}</p>
              <div className="mt-3">
                <ProgressBar value={modal.step + 1} max={tut.steps.length} />
              </div>
              <div className="mt-4 flex justify-between">
                <button
                  type="button"
                  disabled={modal.step === 0}
                  onClick={() => onSetModal({ ...modal, step: modal.step - 1 })}
                  className="sys-btn-secondary min-h-[40px] px-4 text-xs disabled:opacity-40"
                >
                  Back
                </button>
                {modal.step < tut.steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => onSetModal({ ...modal, step: modal.step + 1 })}
                    className="sys-btn-primary min-h-[40px] px-5 text-xs"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="sys-btn-primary min-h-[40px] px-5 text-xs"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* 3. 7-Day Grocery List */}
        {modal.type === 'grocery' && (() => {
          const allergies = state.p.allergies || [];
          const { categories, totalInr } = buildGroceryList(state.p.diet, allergies);
          const macros = calculateMacros(state.p);
          const shareText = categories
            .map((g) => `${g.cat}\n` + g.list.map(([n, c]) => `- ${n} (~₹${c})`).join('\n'))
            .join('\n\n');
          return (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold">7-Day Kirana &amp; Sabzi List</h2>
                  <p className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                    {state.p.diet} · {macros.pr} g protein/day · Est. ₹{totalInr}/wk
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close grocery list"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {allergies.length > 0 && (
                <div
                  className="sys-card-nested mt-3 p-2.5 text-xs"
                  style={{ borderColor: 'var(--sys-secondary)', color: 'var(--sys-secondary)' }}
                >
                  Allergy Shield active: excluded{' '}
                  {allergies
                    .map((id) => ALLERGY_OPTIONS.find((a) => a.id === id)?.label || id)
                    .join(', ')}
                  .
                </div>
              )}
              <div className="mt-4 space-y-4">
                {categories.map((cat) => (
                  <div key={cat.cat} className="sys-card-nested p-3.5">
                    <div className="text-xs font-semibold" style={{ color: 'var(--sys-primary)' }}>
                      {cat.cat}
                    </div>
                    <div className="mt-2 space-y-2">
                      {cat.list.map(([nm, cost]) => (
                        <label key={nm} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(state.grocDone[nm])}
                            onChange={(e) => onToggleGroceryItem(nm, e.target.checked)}
                            className="h-4 w-4 accent-[var(--sys-secondary)]"
                          />
                          <span>
                            {nm}{' '}
                            <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                              (~₹{cost})
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sys-btn-secondary inline-flex min-h-[40px] items-center px-4 text-xs font-semibold"
                  style={{ color: 'var(--sys-secondary)' }}
                >
                  WhatsApp Share
                </a>
                <button
                  type="button"
                  onClick={() => onCopyText(shareText, 'Grocery list copied!')}
                  className="sys-btn-primary min-h-[40px] px-4 text-xs"
                >
                  Copy List
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="sys-btn-secondary min-h-[40px] px-4 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}

        {/* 4. Contextual Coaching Assistant */}
        {modal.type === 'coach' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold">
                  {THEME_COPY[state.theme].coachName}
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  {useLiveGemini
                    ? 'Multi-turn Gemini Chat · Selectable roles · Allergy-safe context'
                    : `Offline Clinical Codex v${codex.version} · Instant local guidance`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  role="group"
                  aria-label="Coach engine mode"
                  className="inline-flex rounded-lg border p-0.5 text-[11px]"
                  style={{
                    backgroundColor: 'var(--sys-surface-lowest)',
                    borderColor: 'var(--sys-border)',
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={useLiveGemini}
                    onClick={() => setUseLiveGemini(true)}
                    className="rounded-md px-2.5 py-1 font-semibold"
                    style={{
                      backgroundColor: useLiveGemini ? 'var(--sys-primary)' : 'transparent',
                      color: useLiveGemini ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
                    }}
                  >
                    Gemini Chat
                  </button>
                  <button
                    type="button"
                    aria-pressed={!useLiveGemini}
                    onClick={() => setUseLiveGemini(false)}
                    className="rounded-md px-2.5 py-1 font-semibold"
                    style={{
                      backgroundColor: !useLiveGemini ? 'var(--sys-surface)' : 'transparent',
                      color: !useLiveGemini ? 'var(--sys-text)' : 'var(--sys-muted)',
                    }}
                  >
                    Offline Codex
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Close coach"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {useLiveGemini ? (
              <GeminiChatbot
                state={state}
                codex={codex}
                onSwitchToOfflineCodex={() => setUseLiveGemini(false)}
              />
            ) : (
              <>
                <div className="sys-card-nested mt-3 max-h-64 space-y-3 overflow-y-auto p-3.5 text-sm">
                  {coachHistory.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Ask for allergy-safe meals, busy-day workout scheduling, or tired-day
                      adjustments using your offline Clinical Codex.
                    </p>
                  ) : (
                    coachHistory.map((m, idx) => (
                      <div key={idx} className={m.role === 'u' ? 'text-right' : 'text-left'}>
                        <div
                          className="inline-block max-w-[92%] rounded-xl px-3.5 py-2.5 text-left text-xs leading-relaxed"
                          style={{
                            backgroundColor:
                              m.role === 'u' ? 'var(--sys-primary)' : 'var(--sys-surface-high)',
                            color: m.role === 'u' ? 'var(--sys-on-primary)' : 'var(--sys-text)',
                          }}
                        >
                          {m.action?.note && (
                            <div
                              className="mb-1.5 rounded-md border px-2 py-1 text-[11px]"
                              style={{
                                borderColor: 'var(--sys-warn)',
                                color: 'var(--sys-warn)',
                              }}
                            >
                              {m.action.note}
                            </div>
                          )}
                          <div>{m.text}</div>
                          {m.action?.sources && m.action.sources.length > 0 && (
                            <div
                              className="mt-2 space-y-1 border-t pt-1.5 text-[11px]"
                              style={{ borderColor: 'var(--sys-border)' }}
                            >
                              <div style={{ color: 'var(--sys-muted)' }}>Sources:</div>
                              {m.action.sources.map((src) => (
                                <a
                                  key={src.uri}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block truncate underline"
                                  style={{ color: 'var(--sys-primary)' }}
                                >
                                  {src.title}
                                </a>
                              ))}
                            </div>
                          )}
                          {m.action &&
                            (m.action.actionType === 'open_calendar' && m.action.calendarUrl ? (
                              <a
                                href={m.action.calendarUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sys-btn-secondary mt-2 inline-flex min-h-[34px] w-full items-center justify-center px-3 text-xs font-semibold"
                              >
                                {m.action.actionLabel}
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onCoachAction(m.action!);
                                  onClose();
                                }}
                                className="sys-btn-secondary mt-2 min-h-[34px] w-full px-3 text-xs font-semibold"
                              >
                                {m.action.actionLabel}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    'What should I eat tonight?',
                    'Is sprouted moong safe in pregnancy?',
                    'Busy meeting day — fit my workout in',
                    'Why am I so exhausted today?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={coachLoading}
                      onClick={() => askCoach(prompt)}
                      className="sys-btn-secondary min-h-[34px] px-2.5 text-xs disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') askCoach(coachInput);
                    }}
                    placeholder="Ask offline codex…"
                    className="sys-input flex-1 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={coachLoading}
                    onClick={() => askCoach(coachInput)}
                    className="sys-btn-primary min-h-[40px] px-4 text-xs disabled:opacity-50"
                  >
                    {coachLoading ? 'Thinking…' : 'Ask'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 5. Client Summary Card */}
        {modal.type === 'client_card' && (() => {
          const c = calculateMacros(state.p);
          const dayNum = getProgramDayNumber(state.start, todayISO(), state.cal, state.p.days);
          const endDt = new Date();
          endDt.setDate(endDt.getDate() + Math.max(1, state.p.days - dayNum + 1));
          const summary =
            `The System — Client Blueprint for ${state.p.name}\n` +
            `• Daily Nutrition: ${c.t} kcal | ${c.pr}g Protein | ${c.c}g Carbs | ${c.f}g Fat\n` +
            `• Training Rhythm: 35-Min Strength + 10-Min Post-Meal Walks (${state.p.eq})\n` +
            `• Hydration & NEAT: 3.0L Water + ${isMaternalProfile(state.p) ? '6,000' : '8,000'} Daily Steps\n` +
            `• Target Goal: ${isMaternalProfile(state.p) ? getFemaleStageLabel(state.p) : `${state.p.tw} kg`} by ${endDt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}\n` +
            `• Level ${getLevelInfo(state.xp).l} (Rank ${getRank(getLevelInfo(state.xp).l)}) · ${state.streak}-Day Streak`;
          return (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Client Coaching Summary</h2>
                <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                readOnly
                value={summary}
                rows={7}
                className="sys-input font-mono-num mt-3 w-full p-3 text-xs"
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(summary)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sys-btn-secondary inline-flex min-h-[40px] items-center px-4 text-xs font-semibold"
                  style={{ color: 'var(--sys-secondary)' }}
                >
                  WhatsApp Share
                </a>
                <button
                  type="button"
                  onClick={() => onCopyText(summary, 'Client summary copied!')}
                  className="sys-btn-primary min-h-[40px] px-4 text-xs"
                >
                  Copy Summary
                </button>
                <button type="button" onClick={onClose} className="sys-btn-secondary min-h-[40px] px-4 text-xs">
                  Close
                </button>
              </div>
            </div>
          );
        })()}

        {/* 6. Story Viewer */}
        {modal.type === 'story' && (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{modal.story.u}</div>
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="sys-card-nested mt-3 flex min-h-[180px] flex-col items-center justify-center p-6 text-center">
              {modal.story.mediaUrl && (
                <img
                  src={modal.story.mediaUrl}
                  alt={modal.story.u}
                  referrerPolicy="no-referrer"
                  className="mb-3 max-h-60 rounded-lg object-cover"
                />
              )}
              <p className="font-display text-lg font-semibold">{modal.story.t}</p>
            </div>
          </div>
        )}

        {/* 7. Sign In with Automatic Theme Calibration & Optional Medical History */}
        {modal.type === 'signin' && (() => {
          const rec = recommendThemeFromProfile({
            sex: siSex,
            medicalHistory: siMedical,
            goalStyle: siGoalStyle,
          });
          return (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Sign In &amp; Personalize</h2>
              <button type="button" aria-label="Close sign in" onClick={onClose} className="flex h-9 w-9 items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
              We pick the best layout and safe workouts from your answers. You can skip health notes
              now and add them later in Profile.
            </p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="si-name" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Your Name
                </label>
                <input
                  id="si-name"
                  type="text"
                  value={siName}
                  onChange={(e) => setSiName(e.target.value)}
                  placeholder="Your name"
                  className="sys-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="si-email" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Email
                </label>
                <input
                  id="si-email"
                  type="email"
                  value={siEmail}
                  onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="sys-input w-full px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="si-sex" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Male / Female
                </label>
                <select
                  id="si-sex"
                  value={siSex}
                  onChange={(e) => setSiSex(e.target.value as Sex)}
                  className="sys-input w-full px-3 py-2 text-sm"
                >
                  <option value="m">Male</option>
                  <option value="f">Female</option>
                </select>
              </div>
              <div>
                <label htmlFor="si-goal" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  App Style
                </label>
                <select
                  id="si-goal"
                  value={siGoalStyle}
                  onChange={(e) => setSiGoalStyle(e.target.value as OnboardingGoalStyle)}
                  className="sys-input w-full px-3 py-2 text-sm"
                >
                  <option value="balanced">Simple &amp; Clean</option>
                  <option value="holistic">Calm &amp; Gentle</option>
                  <option value="competitive">Game Mode (RPG)</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="button"
                aria-expanded={siShowMedical}
                onClick={() => setSiShowMedical((v) => !v)}
                className="text-xs font-semibold underline"
                style={{ color: 'var(--sys-primary)' }}
              >
                {siShowMedical
                  ? 'Hide Medical History Options'
                  : `Optional: Add Medical History (${siMedical.length} selected) — or Enter Later`}
              </button>

              {siShowMedical && (
                <div className="mt-2.5 space-y-1.5">
                  {MEDICAL_HISTORY_OPTIONS.map((item) => {
                    const checked = siMedical.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="sys-card-nested flex cursor-pointer items-center gap-2.5 p-2.5 text-xs"
                        style={{ borderColor: checked ? 'var(--sys-primary)' : 'var(--sys-border)' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSiMedical((prev) => toggleTag(prev, item.id))}
                          className="h-4 w-4 accent-[var(--sys-primary)]"
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sys-card-nested p-3 text-xs">
              <div className="font-semibold" style={{ color: 'var(--sys-primary)' }}>
                Decided Theme: {THEME_COPY[rec.theme].label}
              </div>
              <div className="mt-0.5" style={{ color: 'var(--sys-muted)' }}>
                {rec.reason}
              </div>
            </div>

            <div>
              <label htmlFor="si-pass" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Password (optional · required for Owner Console)
              </label>
              <input
                id="si-pass"
                type="password"
                value={siPassword}
                onChange={(e) => setSiPassword(e.target.value)}
                placeholder="Password"
                className="sys-input w-full px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onSignIn({
                    email: siEmail,
                    password: siPassword,
                    name: siName.trim() || state.p.name,
                    sex: siSex,
                    goalStyle: siGoalStyle,
                    medicalHistory: [],
                    medicalDeferred: true,
                    recommendedTheme: recommendThemeFromProfile({
                      sex: siSex,
                      goalStyle: siGoalStyle,
                      medicalHistory: [],
                    }).theme,
                    reason: recommendThemeFromProfile({
                      sex: siSex,
                      goalStyle: siGoalStyle,
                      medicalHistory: [],
                    }).reason,
                  })
                }
                className="sys-btn-secondary min-h-[40px] px-3.5 text-xs font-semibold"
              >
                Skip Medical &amp; Sign In
              </button>
              <button
                type="button"
                onClick={() =>
                  onSignIn({
                    email: siEmail,
                    password: siPassword,
                    name: siName.trim() || state.p.name,
                    sex: siSex,
                    goalStyle: siGoalStyle,
                    medicalHistory: siMedical,
                    medicalDeferred: siMedical.length === 0,
                    recommendedTheme: rec.theme,
                    reason: rec.reason,
                  })
                }
                className="sys-btn-primary min-h-[40px] px-4 text-xs"
              >
                Sign In &amp; Launch
              </button>
            </div>
          </div>
          );
        })()}

        {/* 8. Org Request */}
        {modal.type === 'org_request' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Gym &amp; Company Access</h2>
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Gym or Company Name"
              className="sys-input w-full px-3 py-2.5 text-sm"
            />
            <select
              value={orgType}
              onChange={(e) => setOrgType(e.target.value as 'Gym' | 'Company')}
              className="sys-input w-full px-3 py-2.5 text-sm"
            >
              <option value="Gym">Gym / Fitness Studio</option>
              <option value="Company">Company / Corporate Wellness</option>
            </select>
            <input
              type="email"
              value={orgEmail}
              onChange={(e) => setOrgEmail(e.target.value)}
              placeholder="Admin Contact Email"
              className="sys-input w-full px-3 py-2.5 text-sm"
            />
            <input
              type="text"
              value={orgChallenge}
              onChange={(e) => setOrgChallenge(e.target.value)}
              placeholder="First Private Challenge Name"
              className="sys-input w-full px-3 py-2.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onSubmitOrgRequest(orgName, orgType, orgEmail, orgChallenge);
                  onClose();
                }}
                className="sys-btn-primary min-h-[40px] px-4 text-xs"
              >
                Submit Request
              </button>
              <button type="button" onClick={onClose} className="sys-btn-secondary min-h-[40px] px-4 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* 9. Super-Admin Console */}
        {modal.type === 'admin' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold" style={{ color: 'var(--sys-warn)' }}>
                Super-Admin Command Console
              </h2>
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="sys-card-nested space-y-2 p-4">
              <div className="text-xs font-semibold">Global Challenge Banner</div>
              <input
                type="text"
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                className="sys-input w-full px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={evDesc}
                onChange={(e) => setEvDesc(e.target.value)}
                className="sys-input w-full px-3 py-2 text-xs"
              />
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={evActive}
                    onChange={(e) => setEvActive(e.target.checked)}
                    className="h-4 w-4 accent-[var(--sys-warn)]"
                  />
                  <span>Active banner</span>
                </label>
                <button
                  type="button"
                  onClick={() => onSaveGlobalEvent(evTitle, evDesc, evActive)}
                  className="sys-btn-primary min-h-[36px] px-3 text-xs"
                >
                  Broadcast
                </button>
              </div>
            </div>

            <div className="sys-card-nested space-y-2 p-4">
              <div className="text-xs font-semibold">
                Gym &amp; Company Approvals ({state.b2b.orgs.length})
              </div>
              {state.b2b.orgs.map((o) => (
                <div key={o.id} className="border-t pt-2 text-xs" style={{ borderColor: 'var(--sys-border)' }}>
                  <div className="flex items-center justify-between">
                    <strong>
                      {o.name} ({o.type})
                    </strong>
                    <span className="font-mono-num">{o.status.toUpperCase()}</span>
                  </div>
                  <div className="mt-0.5" style={{ color: 'var(--sys-muted)' }}>
                    {o.email} · Code {o.code}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {o.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => onSetOrgStatus(o.id, 'approved')}
                        className="sys-btn-secondary min-h-[32px] px-2.5 text-xs"
                        style={{ color: 'var(--sys-secondary)' }}
                      >
                        Approve
                      </button>
                    )}
                    {o.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => onSetOrgStatus(o.id, 'rejected')}
                        className="sys-btn-secondary min-h-[32px] px-2.5 text-xs"
                        style={{ color: 'var(--sys-danger)' }}
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="sys-card-nested space-y-2 p-4">
              <div className="text-xs font-semibold">User Moderation</div>
              {state.b2b.users.map((u) => (
                <div key={u.email} className="flex items-center justify-between border-t pt-2 text-xs" style={{ borderColor: 'var(--sys-border)' }}>
                  <span>
                    {u.name} (Lv {u.lv}) {u.disabled ? '· Disabled' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleAdminUser(u.email)}
                    className="sys-btn-secondary min-h-[32px] px-2.5 text-xs"
                    style={{ color: u.disabled ? 'var(--sys-secondary)' : 'var(--sys-danger)' }}
                  >
                    {u.disabled ? 'Enable' : 'Disable'}
                  </button>
                </div>
              ))}
            </div>

            {onCreateCrossGymEvent && (
              <div className="sys-card-nested space-y-2 p-4">
                <div className="text-xs font-semibold">Launch Cross-Gym Co-Hosted Event</div>
                <input
                  type="text"
                  value={cgTitle}
                  onChange={(e) => setCgTitle(e.target.value)}
                  placeholder="Event title"
                  className="sys-input w-full px-3 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={cgHostName}
                    onChange={(e) => setCgHostName(e.target.value)}
                    placeholder="Host gym name"
                    className="sys-input px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={cgPartnerName}
                    onChange={(e) => setCgPartnerName(e.target.value)}
                    placeholder="Partner club name"
                    className="sys-input px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onCreateCrossGymEvent({
                      title: cgTitle.trim() || 'Cross-Gym Step Battle',
                      hostOrgCode: 'GYM-IRON88',
                      hostOrgName: cgHostName.trim() || 'Iron Temple Studio',
                      partnerOrgCode: 'CORP-APEX26',
                      partnerOrgName: cgPartnerName.trim() || 'Apex Tech Wellness',
                      metric: 'steps',
                      endsLabel: 'Ends in 7 days',
                    })
                  }
                  className="sys-btn-primary min-h-[36px] w-full text-xs"
                >
                  Create Cross-Gym Battle
                </button>
              </div>
            )}
          </div>
        )}

        {/* 10. QR Check-in */}
        {modal.type === 'qr_checkin' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Scan or Enter Gym QR Code</h2>
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
              Enter the code displayed on your studio’s front-desk QR poster to verify your daily
              session (+30 XP).
            </p>
            <input
              type="text"
              value={qrCodeInput}
              onChange={(e) => setQrCodeInput(e.target.value)}
              className="sys-input w-full px-3 py-2.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onVerifyGymCode(qrCodeInput);
                  onClose();
                }}
                className="sys-btn-primary min-h-[40px] px-4 text-xs"
              >
                Verify Check-In
              </button>
              <button type="button" onClick={onClose} className="sys-btn-secondary min-h-[40px] px-4 text-xs">
                Close
              </button>
            </div>
          </div>
        )}

        {/* 11. Smartwatch Companion App & Two-Way Sync Hub */}
        {modal.type === 'watch' && (() => {
          const code = state.watchBridge?.pairingCode || 'SYS742';
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const watchUrl = `${origin}/?mode=watch&code=${encodeURIComponent(code)}`;
          const shortcutWebhook = `${origin}/api/watch/action`;
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Watch className="h-5 w-5" style={{ color: 'var(--sys-primary)' }} />
                  <div>
                    <h2 className="font-display text-lg font-bold">Smartwatch Companion &amp; 1-Tap Sync</h2>
                    <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Zero manual typing · 1-tap sets, water, meals &amp; push alerts
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close watch hub"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Interactive Live Smartwatch Dial */}
              <WatchCompanionView
                variant="embedded"
                snapshot={watchSnapshot}
                pairingCode={code}
                onDispatchAction={onWatchAction}
                onConnectBle={onConnectBleWatch}
              />

              {/* Pairing Code & Standalone Watch Link */}
              <div className="sys-card-nested space-y-2.5 p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Watch Pairing Code:{' '}
                    <strong className="font-mono-num text-sm" style={{ color: 'var(--sys-primary)' }}>
                      {code}
                    </strong>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {onRegenerateWatchCode && (
                      <button
                        type="button"
                        onClick={onRegenerateWatchCode}
                        className="sys-btn-secondary inline-flex min-h-[32px] items-center gap-1 px-2.5 text-[11px]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>New Code</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCopyText(watchUrl, 'Watch Companion link copied!')}
                      className="sys-btn-secondary inline-flex min-h-[32px] items-center gap-1 px-2.5 text-[11px]"
                    >
                      <Copy className="h-3 w-3" />
                      <span>Copy Watch URL</span>
                    </button>
                    <a
                      href={watchUrl}
                      className="sys-btn-primary inline-flex min-h-[32px] items-center gap-1 px-2.5 text-[11px]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Open Watch Mode</span>
                    </a>
                  </div>
                </div>
                <div className="font-mono-num truncate text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                  Watch URL: {watchUrl}
                </div>
              </div>

              {/* Push Alerts to Watch */}
              {onPushWatchReminder && (
                <div className="sys-card-nested space-y-2 p-3.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <BellRing className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />
                    <span>Push Live Reminder to Watch Dial</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() =>
                        onPushWatchReminder({
                          id: `rem_water_${Date.now()}`,
                          category: 'water',
                          title: 'Hydration Reminder',
                          body: 'Drink 250 ml water now to stay sharp.',
                          ctaLabel: '1-Tap +250 ml',
                          actionType: 'log_water',
                          actionAmount: 0.25,
                          ts: Date.now(),
                        })
                      }
                      className="sys-btn-secondary min-h-[36px] px-2 text-[11px] font-semibold"
                    >
                      Drink Water
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onPushWatchReminder({
                          id: `rem_set_${Date.now()}`,
                          category: 'set',
                          title: 'Next Set Ready',
                          body: `${watchSnapshot?.nextSet.exName || 'Workout'} Set ${
                            watchSnapshot?.nextSet.setNumber || 1
                          } ready!`,
                          ctaLabel: '1-Tap Log Set',
                          actionType: 'complete_set',
                          ts: Date.now(),
                        })
                      }
                      className="sys-btn-secondary min-h-[36px] px-2 text-[11px] font-semibold"
                    >
                      Start / Log Set
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onPushWatchReminder({
                          id: `rem_walk_${Date.now()}`,
                          category: 'walk',
                          title: 'Post-Meal Walk',
                          body: '2-min stretch or 5-min walk stabilizes energy.',
                          ctaLabel: '1-Tap Mark Done',
                          actionType: 'complete_bonus',
                          ts: Date.now(),
                        })
                      }
                      className="sys-btn-secondary min-h-[36px] px-2 text-[11px] font-semibold"
                    >
                      Quick Walk
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onPushWatchReminder({
                          id: `rem_streak_${Date.now()}`,
                          category: 'streak',
                          title: 'Streak Protection',
                          body: 'Busy day? Tap once to switch to 5-min Minimum Due.',
                          ctaLabel: '1-Tap Min Due',
                          actionType: 'toggle_min_due',
                          ts: Date.now(),
                        })
                      }
                      className="sys-btn-secondary min-h-[36px] px-2 text-[11px] font-semibold"
                    >
                      Streak Shield
                    </button>
                  </div>
                </div>
              )}

              {/* Auto-Import Watch Export (Zero Manual Typing) */}
              {onImportWearableMetrics && (
                <div className="sys-card-nested space-y-2.5 p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">Auto-Import Watch Export (JSON / CSV)</span>
                    <div className="flex flex-wrap gap-2">
                      {onConnectBleWatch && (
                        <button
                          type="button"
                          onClick={onConnectBleWatch}
                          className="sys-btn-secondary inline-flex min-h-[32px] items-center gap-1 px-2.5 text-[11px]"
                        >
                          <Bluetooth className="h-3 w-3" />
                          <span>Pair BLE HR</span>
                        </button>
                      )}
                      <label className="sys-btn-secondary inline-flex min-h-[32px] cursor-pointer items-center gap-1 px-2.5 text-[11px]">
                        <Upload className="h-3 w-3" />
                        <span>Upload JSON/CSV</span>
                        <input
                          type="file"
                          accept=".json,.csv,.txt"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                const parsed = parseWearableHealthPayload(reader.result);
                                if (parsed) onImportWearableMetrics(parsed);
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={wearableText}
                    onChange={(e) => setWearableText(e.target.value)}
                    placeholder='Paste watch JSON/CSV e.g. {"steps":9250,"sleep":7.6,"hrvMs":72,"rhrBpm":55}'
                    className="sys-input font-mono-num w-full p-2.5 text-[11px]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setWearableText('{"steps":9420,"sleep":7.8,"hrvMs":74,"rhrBpm":54}')
                      }
                      className="sys-btn-secondary min-h-[34px] px-3 text-[11px]"
                    >
                      Fill Sample Data
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseWearableHealthPayload(wearableText);
                        if (parsed) {
                          onImportWearableMetrics(parsed);
                          setWearableText('');
                        }
                      }}
                      className="sys-btn-primary min-h-[34px] px-3 text-[11px]"
                    >
                      Auto-Import &amp; Verify
                    </button>
                  </div>
                </div>
              )}

              {/* Setup Guide for Apple Watch, Wear OS & Bluetooth */}
              <div className="sys-card-nested space-y-1.5 p-3.5 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                <div className="font-semibold" style={{ color: 'var(--sys-text)' }}>
                  How to Connect Your Real Smartwatch
                </div>
                <p>
                  1. <strong>Wear OS / Watch Browser</strong>: Open the Watch URL above on your watch or phone — 1-tap buttons sync live via BroadcastChannel &amp; Watch Bridge API.
                </p>
                <p>
                  2. <strong>Apple Watch Siri Shortcuts / Wear OS HTTP</strong>: Configure a 1-tap wrist Shortcut to POST JSON{' '}
                  <code className="font-mono-num">{`{"code":"${code}","type":"log_water","amount":0.25}`}</code> or{' '}
                  <code className="font-mono-num">{`{"code":"${code}","type":"complete_set"}`}</code> to{' '}
                  <code className="font-mono-num">{shortcutWebhook}</code>.
                </p>
                <p>
                  3. <strong>Bluetooth Heart-Rate Straps &amp; Watches</strong>: Use <em>Pair BLE HR</em> in Chrome/Android to stream live BPM into your readiness score.
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
