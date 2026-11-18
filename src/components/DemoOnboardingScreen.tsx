import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, HeartPulse, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { ALLERGY_OPTIONS } from '../data/foods';
import type {
  AllergyTag,
  AppState,
  EquipmentType,
  FemaleStage,
  MedicalHistoryTag,
  OnboardingGoalStyle,
  PrimaryGoal,
  ThemeMode,
} from '../types/system';
import { calculateMacros, FEMALE_STAGES } from '../utils/metabolic';
import {
  buildInitialPlanFromQuestionnaire,
  DEMO_PERSONAS,
  MEDICAL_HISTORY_OPTIONS,
  type CalibratedPlanOutput,
  type DemoPersona,
  type QuestionnaireInput,
} from '../utils/onboarding';
import { THEME_COPY } from '../utils/storage';

interface DemoOnboardingScreenProps {
  initialState: AppState;
  initialStep?: 'login' | 'questions';
  canCancel?: boolean;
  onCancel?: () => void;
  onQuickSkip: () => void;
  onAdminSignIn: (email: string, password: string) => void;
  onCompleteSetup: (payload: {
    email: string;
    signedIn: boolean;
    calibrated: CalibratedPlanOutput;
  }) => void;
}

const PRIMARY_GOALS: Array<{ id: PrimaryGoal; label: string; detail: string }> = [
  { id: 'fat_loss', label: 'Lose Fat Steadily', detail: 'Sustainable calorie deficit & daily steps' },
  { id: 'strength', label: 'Build Strength', detail: '3-day progressive lifting & protein focus' },
  { id: 'energy_mobility', label: 'Energy & Mobility', detail: 'Joint-safe movement & desk recovery' },
  { id: 'maternal_care', label: 'Hormone & Life-Stage', detail: 'Cycle, PCOS, or pregnancy-safe pacing' },
];

const EXPERIENCE_MODE_OPTIONS: Array<{
  id: 'auto' | ThemeMode;
  goalStyle: OnboardingGoalStyle;
  label: string;
  detail: string;
}> = [
  {
    id: 'auto',
    goalStyle: 'balanced',
    label: 'Auto-Match',
    detail: 'Pick Universal or Women’s from Q1 & Q2',
  },
  {
    id: 'clean',
    goalStyle: 'balanced',
    label: 'Universal Clean',
    detail: 'Structured execution, macros & readiness',
  },
  {
    id: 'women',
    goalStyle: 'holistic',
    label: 'Women’s Wellness',
    detail: 'Cycle pacing, iron/folate & safety',
  },
  {
    id: 'rpg',
    goalStyle: 'competitive',
    label: 'Game Mode (RPG)',
    detail: 'XP, daily quests & level ranks',
  },
];

export const DemoOnboardingScreen: React.FC<DemoOnboardingScreenProps> = ({
  initialState,
  initialStep = 'login',
  canCancel = false,
  onCancel,
  onQuickSkip,
  onAdminSignIn,
  onCompleteSetup,
}) => {
  const [step, setStep] = useState<'login' | 'questions'>(initialStep);
  const [email, setEmail] = useState(initialState.acct.email || '');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  const [form, setForm] = useState<QuestionnaireInput>(() => ({
    name: initialState.demoOnboarded ? initialState.p.name || '' : '',
    sex: initialState.p.sex,
    fstage: initialState.p.fstage || 'std',
    age: initialState.p.age,
    h: initialState.p.h,
    w: initialState.p.w,
    tw: initialState.p.tw,
    act: initialState.p.act,
    eq: initialState.p.eq,
    diet: initialState.p.diet,
    days: initialState.p.days,
    primaryGoal: initialState.p.primaryGoal || 'fat_loss',
    goalStyle: initialState.p.goalStyle || 'balanced',
    preferredThemeMode: 'auto',
    medicalHistory: initialState.p.medicalHistory || [],
    medicalNotes: initialState.p.medicalNotes || '',
    medicalDeferred: Boolean(initialState.p.medicalDeferred),
    allergies: initialState.p.allergies || [],
  }));
  const [formError, setFormError] = useState('');

  const calibrated = useMemo(() => buildInitialPlanFromQuestionnaire(form), [form]);
  const previewMacros = useMemo(
    () =>
      calculateMacros({
        ...initialState.p,
        ...calibrated.profilePatch,
      }),
    [initialState.p, calibrated.profilePatch]
  );

  const handleSelectPersona = (persona: DemoPersona, instantLaunch = false) => {
    setSelectedPersonaId(persona.id);
    setEmail(persona.email);
    setForm({ preferredThemeMode: 'auto', ...persona.input });
    setLoginError('');
    if (instantLaunch) {
      const plan = buildInitialPlanFromQuestionnaire({ preferredThemeMode: 'auto', ...persona.input });
      onCompleteSetup({
        email: persona.email,
        signedIn: true,
        calibrated: plan,
      });
    } else {
      setStep('questions');
    }
  };

  const deriveDisplayName = (rawName: string, rawEmail: string) => {
    const trimmed = rawName.trim();
    if (trimmed) return trimmed;
    const localPart = rawEmail.trim().split('@')[0]?.replace(/[^a-zA-Z0-9._-]/g, '');
    if (localPart) {
      return localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }
    return 'Member';
  };

  const handleLoginContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (cleanEmail.toLowerCase() === 'admin@thesystem.app') {
      onAdminSignIn(cleanEmail, password);
      return;
    }

    const derivedName = deriveDisplayName(form.name, cleanEmail);
    const resolvedEmail = cleanEmail.includes('@')
      ? cleanEmail
      : `${derivedName.toLowerCase().replace(/\s+/g, '.')}@thesystem.app`;

    setEmail(resolvedEmail);
    setForm((prev) => ({
      ...prev,
      name: prev.name.trim() || derivedName,
    }));
    setLoginError('');
    setStep('questions');
  };

  const toggleMedical = (tag: MedicalHistoryTag) => {
    setForm((prev) => ({
      ...prev,
      medicalDeferred: false,
      medicalHistory: prev.medicalHistory.includes(tag)
        ? prev.medicalHistory.filter((x) => x !== tag)
        : [...prev.medicalHistory, tag],
    }));
  };

  const toggleAllergy = (tag: AllergyTag) => {
    setForm((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(tag)
        ? prev.allergies.filter((x) => x !== tag)
        : [...prev.allergies, tag],
    }));
  };

  const handleFinishQuestions = (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = deriveDisplayName(form.name, email);
    const safeForm: QuestionnaireInput = {
      ...form,
      name: safeName,
      age: Math.max(14, Math.min(95, Number(form.age) || 28)),
      h: Math.max(120, Math.min(220, Number(form.h) || 170)),
      w: Math.max(35, Math.min(220, Number(form.w) || 70)),
      tw: Math.max(35, Math.min(220, Number(form.tw) || 65)),
    };
    const finalPlan = buildInitialPlanFromQuestionnaire(safeForm);
    setFormError('');
    const finalEmail = email.trim().includes('@')
      ? email.trim()
      : `${safeName.toLowerCase().replace(/\s+/g, '.')}@thesystem.app`;
    onCompleteSetup({
      email: finalEmail,
      signedIn: true,
      calibrated: finalPlan,
    });
  };

  const profileChoice =
    form.sex === 'm'
      ? 'male'
      : form.fstage && form.fstage !== 'std'
        ? 'women_stage'
        : 'women_std';

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        {/* Clean Brand Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--sys-border)' }}>
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">The System</div>
            <p className="mt-1 text-sm" style={{ color: 'var(--sys-muted)' }}>
              {step === 'login'
                ? 'Sign in or jump straight in to personalize your workouts, nutrition, and daily habits'
                : 'First 3 Questions decide Universal Clean vs Women’s Wellness · Live plan calibration'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono-num text-xs font-semibold" style={{ color: 'var(--sys-muted)' }}>
              Step {step === 'login' ? '1 of 2' : '2 of 2'}
            </span>
            <button
              type="button"
              onClick={canCancel && onCancel ? onCancel : onQuickSkip}
              className="sys-btn-secondary min-h-[38px] px-3.5 text-xs font-semibold"
            >
              {canCancel && onCancel ? 'Back to Dashboard' : 'Skip to App'}
            </button>
          </div>
        </header>

        {step === 'login' ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Sign In Form */}
            <form noValidate onSubmit={handleLoginContinue} className="sys-card space-y-5 p-6 md:p-8 lg:col-span-7">
              <div>
                <h1 className="font-display text-2xl font-bold">Sign In to Start Your Plan</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--sys-muted)' }}>
                  Enter your name or email (both optional), then answer the first 3 wellness
                  questions to tailor your Universal or Women’s plan.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="demo-name" className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--sys-muted)' }}>
                    Your Name
                  </label>
                  <input
                    id="demo-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Anmol or Ananya"
                    className="sys-input w-full px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="demo-email" className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--sys-muted)' }}>
                    Email Address (optional)
                  </label>
                  <input
                    id="demo-email"
                    type="text"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="sys-input w-full px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="demo-pass" className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--sys-muted)' }}>
                  Password (optional · required only for System Owner)
                </label>
                <input
                  id="demo-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Optional passcode"
                  className="sys-input w-full px-3.5 py-2.5 text-sm"
                />
              </div>

              {loginError && (
                <div
                  role="alert"
                  className="rounded-lg border px-3.5 py-2.5 text-xs font-medium"
                  style={{ borderColor: 'var(--sys-danger)', color: 'var(--sys-danger)' }}
                >
                  {loginError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={onQuickSkip}
                  className="sys-btn-secondary min-h-[44px] px-4 text-xs font-semibold"
                >
                  Skip Setup &amp; Open App
                </button>
                <button
                  type="submit"
                  className="sys-btn-primary inline-flex min-h-[44px] items-center gap-2 px-6 text-sm"
                >
                  <span>Continue to Wellness Questions</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Right: 1-Click Quick-Start Profiles */}
            <aside className="sys-card space-y-4 p-6 lg:col-span-5">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
                <h2 className="font-display text-base font-semibold">Quick-Start Profiles</h2>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                Pick a starter profile to prefill the first 3 wellness questions, or launch straight
                into the app with one click.
              </p>

              <div className="space-y-2.5">
                {DEMO_PERSONAS.map((persona) => {
                  const isSelected = selectedPersonaId === persona.id;
                  return (
                    <div
                      key={persona.id}
                      className="rounded-xl border p-3.5 transition-colors"
                      style={{
                        borderColor: isSelected ? 'var(--sys-primary)' : 'var(--sys-border)',
                        backgroundColor: 'var(--sys-surface-lowest)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{persona.label}</div>
                          <div className="mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
                            {persona.subtitle}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectPersona(persona, false)}
                          className="sys-btn-secondary min-h-[36px] flex-1 px-3 text-xs font-semibold"
                        >
                          Customize
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectPersona(persona, true)}
                          className="sys-btn-primary min-h-[36px] flex-1 px-3 text-xs"
                        >
                          Start Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        ) : (
          <form noValidate onSubmit={handleFinishQuestions} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Clean Questionnaire Sections */}
            <div className="sys-card divide-y p-6 md:p-8 lg:col-span-7" style={{ borderColor: 'var(--sys-border)' }}>
              {/* Section 1: First 3 Focused Questions (Decide Universal vs Women) */}
              <section className="space-y-5 pb-6" style={{ borderColor: 'var(--sys-border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h1 className="font-display text-lg font-bold">
                      First 3 Questions · Universal or Women’s Mode
                    </h1>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Your first three answers immediately select Universal Clean or Women’s Wellness.
                    </p>
                  </div>
                  <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                    {email || 'Guest session'}
                  </span>
                </div>

                {/* Q01: Profile & Life Stage */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="font-mono-num" style={{ color: 'var(--sys-primary)' }}>
                      01
                    </span>
                    <span>Who are we tailoring your plan for?</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          id: 'male',
                          label: 'General / Male',
                          detail: 'Standard metabolic & strength baseline',
                        },
                        {
                          id: 'women_std',
                          label: 'Women · Standard',
                          detail: 'Female physiology & cycle-aware targets',
                        },
                        {
                          id: 'women_stage',
                          label: 'Women · PCOS / Maternal',
                          detail: 'Hormone, pregnancy or postpartum safety',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = profileChoice === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            if (opt.id === 'male') {
                              setForm((prev) => ({
                                ...prev,
                                sex: 'm',
                                fstage: 'std',
                                primaryGoal:
                                  prev.primaryGoal === 'maternal_care' ? 'fat_loss' : prev.primaryGoal,
                              }));
                            } else if (opt.id === 'women_std') {
                              setForm((prev) => ({
                                ...prev,
                                sex: 'f',
                                fstage: 'std',
                              }));
                            } else {
                              setForm((prev) => ({
                                ...prev,
                                sex: 'f',
                                fstage: prev.fstage && prev.fstage !== 'std' ? prev.fstage : 'pcos',
                                primaryGoal: 'maternal_care',
                              }));
                            }
                          }}
                          className="rounded-xl border p-3 text-left transition-colors"
                          style={{
                            borderColor: active ? 'var(--sys-primary)' : 'var(--sys-border)',
                            backgroundColor: active
                              ? 'color-mix(in srgb, var(--sys-primary) 10%, var(--sys-surface-lowest))'
                              : 'var(--sys-surface-lowest)',
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>{opt.label}</span>
                            {active && <Check className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />}
                          </div>
                          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                            {opt.detail}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {form.sex === 'f' && (
                    <div className="pt-1">
                      <label htmlFor="q-fstage" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                        Women’s Life Stage Detail (adjusts calories &amp; exercise safety)
                      </label>
                      <select
                        id="q-fstage"
                        value={form.fstage || 'std'}
                        onChange={(e) => setForm({ ...form, fstage: e.target.value as FemaleStage })}
                        className="sys-input w-full px-3 py-2 text-sm"
                      >
                        {FEMALE_STAGES.map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Q02: Primary 30-Day Focus */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="font-mono-num" style={{ color: 'var(--sys-primary)' }}>
                      02
                    </span>
                    <span>What is your #1 wellness focus right now?</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {PRIMARY_GOALS.map((g) => {
                      const active = form.primaryGoal === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              primaryGoal: g.id,
                              sex: g.id === 'maternal_care' ? 'f' : prev.sex,
                            }))
                          }
                          className="rounded-xl border p-3 text-left transition-colors"
                          style={{
                            borderColor: active ? 'var(--sys-primary)' : 'var(--sys-border)',
                            backgroundColor: active
                              ? 'color-mix(in srgb, var(--sys-primary) 10%, var(--sys-surface-lowest))'
                              : 'var(--sys-surface-lowest)',
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>{g.label}</span>
                            {active && <Check className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />}
                          </div>
                          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                            {g.detail}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q03: Experience Mode Calibration */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="font-mono-num" style={{ color: 'var(--sys-primary)' }}>
                      03
                    </span>
                    <span>How should The System look and guide you?</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {EXPERIENCE_MODE_OPTIONS.map((opt) => {
                      const active = (form.preferredThemeMode || 'auto') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              preferredThemeMode: opt.id,
                              goalStyle:
                                opt.id === 'auto'
                                  ? prev.sex === 'f' && prev.primaryGoal === 'maternal_care'
                                    ? 'holistic'
                                    : 'balanced'
                                  : opt.goalStyle,
                            }))
                          }
                          className="rounded-xl border p-3 text-left transition-colors"
                          style={{
                            borderColor: active ? 'var(--sys-primary)' : 'var(--sys-border)',
                            backgroundColor: active
                              ? 'color-mix(in srgb, var(--sys-primary) 10%, var(--sys-surface-lowest))'
                              : 'var(--sys-surface-lowest)',
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>{opt.label}</span>
                            {active && <Check className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />}
                          </div>
                          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                            {opt.detail}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Mode Decision Callout */}
                  <div
                    className="sys-card-nested px-3.5 py-2.5 text-xs"
                    style={{ borderColor: 'var(--sys-primary)' }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--sys-primary)' }}>
                      Selected Mode: {THEME_COPY[calibrated.theme].label}
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span style={{ color: 'var(--sys-muted)' }}>{calibrated.reason}</span>
                  </div>
                </div>
              </section>

              {/* Section 2: Body Baseline & Routine */}
              <section className="space-y-4 py-6" style={{ borderColor: 'var(--sys-border)' }}>
                <h2 className="font-display text-lg font-bold">Body Baseline &amp; Equipment</h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="q-name" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Display Name
                    </label>
                    <input
                      id="q-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="sys-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="q-days" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Plan Commitment
                    </label>
                    <select
                      id="q-days"
                      value={form.days}
                      onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                      className="sys-input w-full px-3 py-2 text-sm"
                    >
                      <option value={14}>14 Days — Quick Momentum</option>
                      <option value={30}>30 Days — Habit Foundation</option>
                      <option value={60}>60 Days — Visible Change</option>
                      <option value={90}>90 Days — Full Recomposition</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label htmlFor="q-age" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Age
                    </label>
                    <input
                      id="q-age"
                      type="number"
                      min={14}
                      max={95}
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: Number(e.target.value) || 25 })}
                      className="sys-input font-mono-num w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="q-height" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Height (cm)
                    </label>
                    <input
                      id="q-height"
                      type="number"
                      min={120}
                      max={220}
                      value={form.h}
                      onChange={(e) => setForm({ ...form, h: Number(e.target.value) || 170 })}
                      className="sys-input font-mono-num w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="q-weight" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Weight (kg)
                    </label>
                    <input
                      id="q-weight"
                      type="number"
                      step="0.5"
                      value={form.w}
                      onChange={(e) => setForm({ ...form, w: Number(e.target.value) || 70 })}
                      className="sys-input font-mono-num w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="q-target" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Target (kg)
                    </label>
                    <input
                      id="q-target"
                      type="number"
                      step="0.5"
                      value={form.tw}
                      onChange={(e) => setForm({ ...form, tw: Number(e.target.value) || 65 })}
                      className="sys-input font-mono-num w-full px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="q-act" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Daily Activity Level
                    </label>
                    <select
                      id="q-act"
                      value={form.act}
                      onChange={(e) => setForm({ ...form, act: Number(e.target.value) })}
                      className="sys-input w-full px-3 py-2 text-sm"
                    >
                      <option value={1.2}>Mostly sitting (desk / home)</option>
                      <option value={1.375}>Light walking &amp; errands</option>
                      <option value={1.55}>Active / on feet often</option>
                      <option value={1.725}>Very active / physical job</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="q-eq" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                      Available Equipment
                    </label>
                    <select
                      id="q-eq"
                      value={form.eq}
                      onChange={(e) => setForm({ ...form, eq: e.target.value as EquipmentType })}
                      className="sys-input w-full px-3 py-2 text-sm"
                    >
                      <option value="body">Bodyweight at Home</option>
                      <option value="dumb">Dumbbells / Resistance Bands</option>
                      <option value="gym">Full Gym</option>
                      <option value="desi">Traditional / Flow &amp; Yoga</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Section 3: Diet, Allergies & Health Context */}
              <section className="space-y-4 pt-6" style={{ borderColor: 'var(--sys-border)' }}>
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4" style={{ color: 'var(--sys-secondary)' }} />
                  <h2 className="font-display text-lg font-bold">Food &amp; Health Notes (Optional)</h2>
                </div>

                <div>
                  <label htmlFor="q-diet" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Diet Preference
                  </label>
                  <select
                    id="q-diet"
                    value={form.diet}
                    onChange={(e) => setForm({ ...form, diet: e.target.value })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  >
                    {['Indian High-Protein Veg', 'Eggetarian', 'Omnivore', 'Plant-Based'].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-medium" style={{ color: 'var(--sys-muted)' }}>
                    Allergies &amp; Intolerances (automatically excluded across meals &amp; groceries)
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ALLERGY_OPTIONS.map((alg) => {
                      const checked = form.allergies.includes(alg.id);
                      return (
                        <label
                          key={alg.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs"
                          style={{
                            borderColor: checked ? 'var(--sys-primary)' : 'var(--sys-border)',
                            backgroundColor: 'var(--sys-surface-lowest)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAllergy(alg.id)}
                            className="h-3.5 w-3.5 shrink-0 accent-[var(--sys-primary)]"
                          />
                          <span className="truncate font-medium">{alg.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-medium" style={{ color: 'var(--sys-muted)' }}>
                    Health &amp; Safety Considerations
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MEDICAL_HISTORY_OPTIONS.map((item) => {
                      const checked = form.medicalHistory.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs"
                          style={{
                            borderColor: checked ? 'var(--sys-secondary)' : 'var(--sys-border)',
                            backgroundColor: 'var(--sys-surface-lowest)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMedical(item.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sys-secondary)]"
                          />
                          <div>
                            <div className="font-semibold">{item.label}</div>
                            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                              {item.detail}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="rounded-lg border px-3.5 py-2.5 text-xs font-medium"
                    style={{ borderColor: 'var(--sys-danger)', color: 'var(--sys-danger)' }}
                  >
                    {formError}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className="sys-btn-secondary inline-flex min-h-[42px] items-center gap-1.5 px-4 text-xs font-semibold"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                  <button
                    type="submit"
                    className="sys-btn-primary inline-flex min-h-[44px] items-center gap-2 px-6 text-sm lg:hidden"
                  >
                    <span>Start My Wellness Plan</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            </div>

            {/* Right: Live Personalized Plan Preview */}
            <aside className="lg:col-span-5">
              <div className="sys-card sticky top-6 space-y-5 p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
                    <h2 className="font-display text-lg font-bold">Your Personalized Plan</h2>
                  </div>
                  <span className="font-mono-num text-xs font-semibold" style={{ color: 'var(--sys-secondary)' }}>
                    {form.days} Days
                  </span>
                </div>

                <div
                  className="rounded-xl border p-4 text-xs"
                  style={{
                    borderColor: 'var(--sys-border)',
                    backgroundColor: 'var(--sys-surface-lowest)',
                  }}
                >
                  <div className="font-semibold" style={{ color: 'var(--sys-primary)' }}>
                    Mode: {THEME_COPY[calibrated.theme].label}
                  </div>
                  <div className="mt-1 font-medium">Track: {calibrated.trackLabel}</div>
                  <p className="mt-1.5 leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                    {calibrated.reason} You can switch themes anytime under Profile &amp; Settings.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--sys-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                      Daily Calories
                    </div>
                    <div className="font-mono-num mt-0.5 text-xl font-bold" style={{ color: 'var(--sys-primary)' }}>
                      {previewMacros.t} kcal
                    </div>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--sys-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                      Daily Protein
                    </div>
                    <div className="font-mono-num mt-0.5 text-xl font-bold" style={{ color: 'var(--sys-secondary)' }}>
                      {previewMacros.pr} g
                    </div>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--sys-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                      Hydration Target
                    </div>
                    <div className="font-mono-num mt-0.5 text-base font-bold">
                      {calibrated.dailyWaterLitres.toFixed(2)} L / day
                    </div>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--sys-border)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                      Daily Movement
                    </div>
                    <div className="font-mono-num mt-0.5 text-base font-bold">
                      {calibrated.dailyStepsTarget.toLocaleString()} steps
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--sys-muted)' }}>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--sys-secondary)' }} />
                  <span>{previewMacros.modeNote}</span>
                </div>

                <button
                  type="submit"
                  className="sys-btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 text-sm"
                >
                  <span>Start My Wellness Plan</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </aside>
          </form>
        )}
      </div>
    </div>
  );
};
