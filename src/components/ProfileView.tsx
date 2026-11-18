import React, { useMemo, useState } from 'react';
import {
  Building2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Crown,
  Download,
  HeartPulse,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sun,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ALLERGY_OPTIONS } from '../data/foods';
import type {
  AllergyTag,
  AppState,
  FemaleStage,
  MedicalHistoryTag,
  PrivacySettings,
  ThemeMode,
  UserProfile,
} from '../types/system';
import type { ClinicalCodex } from '../utils/codex';
import {
  activeFemaleStage,
  FEMALE_STAGES,
  getGoalProgress,
  getLevelInfo,
  getRank,
  isFemaleProfile,
} from '../utils/metabolic';
import {
  buildMemberCode,
  formatShareableSummary,
  MEDICAL_HISTORY_OPTIONS,
  recommendThemeFromProfile,
} from '../utils/onboarding';
import { THEME_COPY, todayISO } from '../utils/storage';
import { BiometricsChartCard } from './BiometricsChartCard';
import { ProgressBar } from './ProgressBar';

export type ProfileSectionTab = 'overview' | 'appearance' | 'health' | 'cloud_share' | 'privacy';

interface ProfileViewProps {
  state: AppState;
  codex?: ClinicalCodex;
  codexSource?: 'remote' | 'cache' | 'fallback';
  onSelectTheme: (theme: ThemeMode) => void;
  onToggleDarkMode: () => void;
  onToggleMute: () => void;
  onUpdateProfile: (next: UserProfile) => void;
  onLogBiometrics: (weight: number, waist: number, neck: number, hip: number, date?: string) => void;
  onSetFemaleStage: (stage: FemaleStage) => void;
  onBuyFreeze: () => void;
  onTogglePrivacy: (key: keyof PrivacySettings, val: boolean) => void;
  onOpenSignIn: () => void;
  onOpenQuestionnaire: () => void;
  onSignOut: () => void;
  onOpenOrgRequest: () => void;
  onOpenAdminConsole: () => void;
  onToggleCloudAutoSync: (enabled: boolean) => void;
  onCloudSyncNow: () => Promise<void> | void;
  onCloudRestoreNow: () => Promise<void> | void;
  cloudBusy?: boolean;
  onSendPlan: (recipient: string, summary: string, planUrl: string) => Promise<void> | void;
  lastSentNote?: string;
  onCopyText: (text: string, msg: string) => void;
  onExportBackup: () => void;
  onImportBackup: (json: string) => void;
  onResetAll: () => void;
}

const PRIVACY_OPTIONS: Array<[keyof PrivacySettings, string]> = [
  ['on', 'Appear on public community leaderboard'],
  ['name', 'Show display name (off = Anonymous Member)'],
  ['rank', 'Share level and rank'],
  ['stats', 'Share attribute breakdown (STR/AGI/INT/VIT/SEN)'],
  ['prog', 'Share goal completion %'],
  ['bio', 'Share exact height and weight'],
];

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; desc: string }> = [
  {
    id: 'clean',
    label: 'Universal Clean',
    desc: 'Clinical sports-science telemetry, HRV readiness, and tabular tracking without fantasy/gaming clutter.',
  },
  {
    id: 'women',
    label: 'Women’s Wellness',
    desc: 'Cycle rhythm, PCOS care, and gentle pregnancy/postpartum workouts.',
  },
  {
    id: 'rpg',
    label: 'Game Mode (RPG)',
    desc: 'Levels, ranks, XP quests, and fun daily challenges.',
  },
];

const SECTION_TABS: Array<{ id: ProfileSectionTab; label: string }> = [
  { id: 'overview', label: 'Overview & Body' },
  { id: 'appearance', label: 'Theme & Settings' },
  { id: 'health', label: 'Health & Allergies' },
  { id: 'cloud_share', label: 'Cloud & Share' },
  { id: 'privacy', label: 'Privacy & Account' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  state,
  codex,
  codexSource = 'fallback',
  onSelectTheme,
  onToggleDarkMode,
  onToggleMute,
  onUpdateProfile,
  onLogBiometrics,
  onSetFemaleStage,
  onBuyFreeze,
  onTogglePrivacy,
  onOpenSignIn,
  onOpenQuestionnaire,
  onSignOut,
  onOpenOrgRequest,
  onOpenAdminConsole,
  onToggleCloudAutoSync,
  onCloudSyncNow,
  onCloudRestoreNow,
  cloudBusy = false,
  onSendPlan,
  lastSentNote = '',
  onCopyText,
  onExportBackup,
  onImportBackup,
  onResetAll,
}) => {
  const today = todayISO();
  const levelInfo = getLevelInfo(state.xp);
  const rank = getRank(levelInfo.l);
  const pubName = state.priv.name ? state.p.name : 'Anonymous Member';
  const goalPct = getGoalProgress(state, today);
  const memberCode = buildMemberCode(state.p.name);

  const [section, setSection] = useState<ProfileSectionTab>('overview');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(state.p);
  const [medHistory, setMedHistory] = useState<MedicalHistoryTag[]>(state.p.medicalHistory || []);
  const [medNotes, setMedNotes] = useState(state.p.medicalNotes || '');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [restoreText, setRestoreText] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const shareablePlanUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const encoded = btoa(JSON.stringify(state.p));
      return `${window.location.origin}${window.location.pathname}#plan=${encodeURIComponent(encoded)}`;
    } catch {
      return window.location.href;
    }
  }, [state.p]);

  const shareSummaryText = useMemo(() => formatShareableSummary(state, today), [state, today]);

  const toggleMedicalTag = (tag: MedicalHistoryTag) => {
    setMedHistory((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const activeAllergies = state.p.allergies || [];
  const toggleAllergyTag = (tag: AllergyTag) => {
    const nextAllergies = activeAllergies.includes(tag)
      ? activeAllergies.filter((item) => item !== tag)
      : [...activeAllergies, tag];
    onUpdateProfile({
      ...state.p,
      allergies: nextAllergies,
    });
  };

  const initials = (state.p.name || 'M')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const downloadTextFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Clean Profile Header */}
      <section className="sys-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold"
              style={{
                borderColor: 'var(--sys-primary)',
                backgroundColor: 'color-mix(in srgb, var(--sys-primary) 12%, var(--sys-surface-lowest))',
                color: 'var(--sys-primary)',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="font-display text-2xl font-bold">{state.p.name}</h1>
                <span className="font-mono-num text-xs" style={{ color: 'var(--sys-muted)' }}>
                  {state.acct.signedIn ? state.acct.email : 'Guest Session'}
                </span>
              </div>
              <div className="font-mono-num mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
                <span>{isFemaleProfile(state.p) ? 'Female' : 'Male'}</span>
                <span aria-hidden="true">·</span>
                <span>{state.p.h} cm</span>
                <span aria-hidden="true">·</span>
                <span>
                  {state.p.w} kg → {state.p.tw} kg
                </span>
                <span aria-hidden="true">·</span>
                <span>{state.streak}d streak</span>
                {state.theme !== 'clean' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Lv {levelInfo.l} (Rank {rank})
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(state.p);
                setSection('overview');
                setEditing((v) => !v);
              }}
              className="sys-btn-secondary min-h-[40px] px-3.5 text-xs font-semibold"
            >
              {editing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
            <button
              type="button"
              onClick={onOpenQuestionnaire}
              className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Re-run Plan Setup</span>
            </button>
            {state.acct.signedIn ? (
              <button
                type="button"
                onClick={onSignOut}
                className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSignIn}
                className="sys-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean Section Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Profile and settings sections"
          className="mt-5 flex flex-wrap gap-1.5 border-t pt-4"
          style={{ borderColor: 'var(--sys-border)' }}
        >
          {SECTION_TABS.map((tab) => {
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(tab.id)}
                className="min-h-[38px] whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: active ? 'var(--sys-primary)' : 'var(--sys-surface-lowest)',
                  color: active ? 'var(--sys-on-primary)' : 'var(--sys-muted)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 1: Overview & Body */}
      {section === 'overview' && (
        <div className="space-y-6">
          {editing && (
            <div className="sys-card p-6">
              <h2 className="font-display text-lg font-bold">Edit Personal Baseline</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="prof-name" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Name
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-title" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Title
                  </label>
                  <input
                    id="prof-title"
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-sex" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Sex
                  </label>
                  <select
                    id="prof-sex"
                    value={draft.sex}
                    onChange={(e) => setDraft({ ...draft, sex: e.target.value as 'm' | 'f' })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  >
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="prof-age" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Age
                  </label>
                  <input
                    id="prof-age"
                    type="number"
                    value={draft.age}
                    onChange={(e) => setDraft({ ...draft, age: Number(e.target.value) || 25 })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-h" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Height (cm)
                  </label>
                  <input
                    id="prof-h"
                    type="number"
                    value={draft.h}
                    onChange={(e) => setDraft({ ...draft, h: Number(e.target.value) || 170 })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-w" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Current Weight (kg)
                  </label>
                  <input
                    id="prof-w"
                    type="number"
                    step="0.1"
                    value={draft.w}
                    onChange={(e) => setDraft({ ...draft, w: Number(e.target.value) || 70 })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-tw" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Target Weight (kg)
                  </label>
                  <input
                    id="prof-tw"
                    type="number"
                    step="0.1"
                    value={draft.tw}
                    onChange={(e) => setDraft({ ...draft, tw: Number(e.target.value) || 65 })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-days" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Commitment (days)
                  </label>
                  <input
                    id="prof-days"
                    type="number"
                    value={draft.days}
                    onChange={(e) =>
                      setDraft({ ...draft, days: Math.max(1, Number(e.target.value) || 30) })
                    }
                    className="sys-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="prof-diet" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Diet Preference
                  </label>
                  <select
                    id="prof-diet"
                    value={draft.diet}
                    onChange={(e) => setDraft({ ...draft, diet: e.target.value })}
                    className="sys-input w-full px-3 py-2 text-sm"
                  >
                    {['Indian High-Protein Veg', 'Eggetarian', 'Omnivore', 'Plant-Based'].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProfile({
                        ...draft,
                        name: draft.name.trim() || 'Member',
                        fstage: draft.sex === 'm' ? 'std' : draft.fstage,
                      });
                      setEditing(false);
                    }}
                    className="sys-btn-primary min-h-[40px] flex-1 text-xs"
                  >
                    Save Profile Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="sys-btn-secondary min-h-[40px] px-4 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <BiometricsChartCard state={state} onLogBiometrics={onLogBiometrics} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {isFemaleProfile(state.p) && (
              <div className="sys-card p-5 lg:col-span-6">
                <h2 className="font-display text-base font-semibold">Women’s Wellness Stage</h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Automatically tunes calorie targets and replaces contraindicated exercises.
                </p>
                <select
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

            <div className={`sys-card p-5 ${isFemaleProfile(state.p) ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold">Streak Freeze Protection</h2>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Owned: {state.freeze} · Automatically protects your streak if you miss a day.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-num text-xs font-semibold" style={{ color: 'var(--sys-primary)' }}>
                    {state.xp} XP available
                  </span>
                  <button
                    type="button"
                    onClick={onBuyFreeze}
                    className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
                  >
                    <Snowflake className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
                    <span>Buy · 200 XP</span>
                  </button>
                </div>
              </div>
              {state.theme !== 'clean' && (
                <div className="mt-4">
                  <ProgressBar value={levelInfo.x} max={levelInfo.n} label="XP to next level" />
                  <div className="font-mono-num mt-2 text-xs" style={{ color: 'var(--sys-muted)' }}>
                    {Object.entries(state.stats)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Theme & Settings (Moved cleanly out of the top toolbar!) */}
      {section === 'appearance' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="sys-card p-6 lg:col-span-7">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" style={{ color: 'var(--sys-primary)' }} />
              <div>
                <h2 className="font-display text-lg font-bold">Behavioral Theme &amp; Layout</h2>
                <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Choose how your workouts, nutrition, and daily check-ins are framed.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {THEME_OPTIONS.map((opt) => {
                const active = state.theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectTheme(opt.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors"
                    style={{
                      borderColor: active ? 'var(--sys-primary)' : 'var(--sys-border)',
                      backgroundColor: active
                        ? 'color-mix(in srgb, var(--sys-primary) 10%, var(--sys-surface-lowest))'
                        : 'var(--sys-surface-lowest)',
                    }}
                  >
                    <div>
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
                        {opt.desc}
                      </div>
                    </div>
                    <span
                      className="font-mono-num shrink-0 text-xs font-semibold"
                      style={{ color: active ? 'var(--sys-primary)' : 'var(--sys-muted)' }}
                    >
                      {active ? 'Active' : 'Select'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div className="sys-card space-y-4 p-6">
              <h2 className="font-display text-lg font-bold">Display &amp; Audio Preferences</h2>

              <div className="flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--sys-border)' }}>
                <div>
                  <div className="text-sm font-semibold">Color Appearance</div>
                  <div className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                    {state.darkMode ? 'Dark Mode is currently active' : 'Light Mode is currently active'}
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={state.darkMode}
                  onClick={onToggleDarkMode}
                  className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-2 px-3.5 text-xs font-semibold"
                >
                  {state.darkMode ? (
                    <>
                      <Sun className="h-4 w-4" style={{ color: 'var(--sys-warn)' }} />
                      <span>Switch to Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
                      <span>Switch to Dark</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--sys-border)' }}>
                <div>
                  <div className="text-sm font-semibold">Sound &amp; Rest Timer Chimes</div>
                  <div className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Audio cues for completed sets, water, and rest timers.
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={!state.mute}
                  onClick={onToggleMute}
                  className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-2 px-3.5 text-xs font-semibold"
                >
                  {state.mute ? (
                    <>
                      <VolumeX className="h-4 w-4" />
                      <span>Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" style={{ color: 'var(--sys-secondary)' }} />
                      <span>Sound On</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Wellness Questionnaire</div>
                  <div className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Recalculate calories, workout track, and theme from fresh answers.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenQuestionnaire}
                  className="sys-btn-primary min-h-[40px] shrink-0 px-4 text-xs"
                >
                  Open Setup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Health & Allergies */}
      {section === 'health' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="sys-card p-6 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5" style={{ color: 'var(--sys-secondary)' }} />
                <div>
                  <h2 className="font-display text-lg font-bold">Health Notes &amp; Safety</h2>
                  <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Tailors exercise swaps and safe pacing automatically.
                  </p>
                </div>
              </div>
              {state.p.medicalDeferred && (state.p.medicalHistory?.length || 0) === 0 && (
                <span className="font-mono-num text-xs" style={{ color: 'var(--sys-warn)' }}>
                  Deferred at sign-in
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MEDICAL_HISTORY_OPTIONS.map((item) => {
                const checked = medHistory.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs"
                    style={{
                      borderColor: checked ? 'var(--sys-secondary)' : 'var(--sys-border)',
                      backgroundColor: 'var(--sys-surface-lowest)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMedicalTag(item.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sys-secondary)]"
                    />
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      <div className="mt-0.5 leading-snug" style={{ color: 'var(--sys-muted)' }}>
                        {item.detail}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-3">
              <label htmlFor="prof-med-notes" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Additional Medical / Injury Notes (optional)
              </label>
              <input
                id="prof-med-notes"
                type="text"
                value={medNotes}
                onChange={(e) => setMedNotes(e.target.value)}
                placeholder="e.g. Left knee recovery, thyroid support…"
                className="sys-input w-full px-3 py-2 text-xs"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const rec = recommendThemeFromProfile({
                    sex: state.p.sex,
                    fstage: state.p.fstage,
                    medicalHistory: medHistory,
                    goalStyle: state.p.goalStyle,
                    tier: state.p.tier,
                  });
                  onUpdateProfile({
                    ...state.p,
                    medicalHistory: medHistory,
                    medicalNotes: medNotes.trim(),
                    medicalDeferred: false,
                    tier: rec.recommendedTier || state.p.tier,
                    fstage: rec.recommendedFstage || state.p.fstage,
                  });
                  onSelectTheme(rec.theme);
                }}
                className="sys-btn-primary min-h-[40px] px-4 text-xs"
              >
                Save &amp; Match Theme (
                {
                  THEME_COPY[
                    recommendThemeFromProfile({
                      sex: state.p.sex,
                      fstage: state.p.fstage,
                      medicalHistory: medHistory,
                      goalStyle: state.p.goalStyle,
                      tier: state.p.tier,
                    }).theme
                  ].label
                }
                )
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateProfile({
                    ...state.p,
                    medicalHistory: medHistory,
                    medicalNotes: medNotes.trim(),
                    medicalDeferred: false,
                  });
                }}
                className="sys-btn-secondary min-h-[40px] px-4 text-xs font-semibold"
              >
                Save Notes Only
              </button>
            </div>
          </div>

          <div className="sys-card p-6 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold">Allergy &amp; Intolerance Shield</h2>
                <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Checked foods are hidden across meals, recipes, coach &amp; grocery lists.
                </p>
              </div>
              {codex && (
                <span className="font-mono-num text-[11px]" style={{ color: 'var(--sys-primary)' }}>
                  Codex v{codex.version} · {codexSource === 'remote' ? 'Live' : codexSource === 'cache' ? 'Cached' : 'Offline'}
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ALLERGY_OPTIONS.map((alg) => {
                const checked = activeAllergies.includes(alg.id);
                return (
                  <label
                    key={alg.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs"
                    style={{
                      borderColor: checked ? 'var(--sys-primary)' : 'var(--sys-border)',
                      backgroundColor: 'var(--sys-surface-lowest)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAllergyTag(alg.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sys-primary)]"
                    />
                    <div>
                      <div className="font-semibold">{alg.label}</div>
                      <div className="mt-0.5 leading-snug" style={{ color: 'var(--sys-muted)' }}>
                        {alg.detail}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Cloud Sync & Send / Share */}
      {section === 'cloud_share' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cloud Sync Option */}
          <div className="sys-card space-y-4 p-6 lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-5 w-5" style={{ color: 'var(--sys-primary)' }} />
                <div>
                  <h2 className="font-display text-lg font-bold">Cloud Sync Vault</h2>
                  <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Back up and restore your personalized plan, workouts, and daily logs.
                  </p>
                </div>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(state.cloudSync?.enabled)}
                  onChange={(e) => onToggleCloudAutoSync(e.target.checked)}
                  className="h-4 w-4 accent-[var(--sys-primary)]"
                />
                <span>Auto-sync</span>
              </label>
            </div>

            <div
              className="rounded-xl border p-4 text-xs"
              style={{
                borderColor: 'var(--sys-border)',
                backgroundColor: 'var(--sys-surface-lowest)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: 'var(--sys-muted)' }}>Account</span>
                <span className="font-mono-num font-semibold">
                  {state.acct.email || `${state.p.name.toLowerCase().replace(/\s+/g, '.')}@demo.local`}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span style={{ color: 'var(--sys-muted)' }}>Cloud ID</span>
                <span className="font-mono-num font-semibold" style={{ color: 'var(--sys-primary)' }}>
                  {state.cloudSync?.cloudId || 'Not assigned yet'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span style={{ color: 'var(--sys-muted)' }}>Last Synced</span>
                <span className="font-mono-num">
                  {state.cloudSync?.lastSyncedAt
                    ? new Date(state.cloudSync.lastSyncedAt).toLocaleString()
                    : 'Not synced yet'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={cloudBusy}
                onClick={onCloudSyncNow}
                className="sys-btn-primary inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 px-4 text-xs disabled:opacity-50"
              >
                {cloudBusy ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="h-3.5 w-3.5" />
                )}
                <span>Sync to Cloud Now</span>
              </button>
              <button
                type="button"
                disabled={cloudBusy}
                onClick={onCloudRestoreNow}
                className="sys-btn-secondary inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 px-4 text-xs font-semibold disabled:opacity-50"
              >
                <CloudDownload className="h-3.5 w-3.5" />
                <span>Restore from Cloud</span>
              </button>
            </div>

            {/* Local File Backup & Reset */}
            <div className="border-t pt-4" style={{ borderColor: 'var(--sys-border)' }}>
              <h3 className="font-display text-sm font-semibold">Local Data Backup &amp; Reset</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `the-system-backup-${today}.json`,
                      JSON.stringify(state, null, 2),
                      'application/json'
                    )
                  }
                  className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .json</span>
                </button>
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestore((v) => !v)}
                  className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Restore JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset((v) => !v)}
                  className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
                  style={{ color: 'var(--sys-danger)' }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset All Data</span>
                </button>
              </div>

              {showRestore && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={restoreText}
                    onChange={(e) => setRestoreText(e.target.value)}
                    placeholder="Paste backup JSON here…"
                    rows={3}
                    className="sys-input w-full p-2.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onImportBackup(restoreText);
                      setRestoreText('');
                      setShowRestore(false);
                    }}
                    className="sys-btn-primary min-h-[38px] px-4 text-xs"
                  >
                    Apply Restore
                  </button>
                </div>
              )}

              {confirmReset && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--sys-danger)' }}>
                  <span>Reset all workouts, logs, and XP?</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetAll();
                        setConfirmReset(false);
                      }}
                      className="sys-btn-secondary min-h-[34px] px-3 font-semibold"
                      style={{ color: 'var(--sys-danger)', borderColor: 'var(--sys-danger)' }}
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="sys-btn-secondary min-h-[34px] px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Send & Share Plan / Summary */}
          <div className="sys-card space-y-5 p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5" style={{ color: 'var(--sys-secondary)' }} />
                <div>
                  <h2 className="font-display text-lg font-bold">Send &amp; Share Wellness Plan</h2>
                  <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Send your plan link, coach summary, or member invite directly from Settings.
                  </p>
                </div>
              </div>
              <span className="font-mono-num text-xs font-semibold" style={{ color: 'var(--sys-primary)' }}>
                Code: {memberCode}
              </span>
            </div>

            <div>
              <label htmlFor="share-summary-box" className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--sys-muted)' }}>
                Progress &amp; Plan Summary Preview
              </label>
              <textarea
                id="share-summary-box"
                readOnly
                value={shareSummaryText}
                rows={8}
                className="sys-input font-mono-num w-full p-3 text-xs leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <label htmlFor="send-recipient" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                  Send to Coach / Friend Email (optional)
                </label>
                <input
                  id="send-recipient"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="coach@example.com"
                  className="sys-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end sm:col-span-5">
                <button
                  type="button"
                  onClick={() => onSendPlan(recipientEmail, shareSummaryText, shareablePlanUrl)}
                  className="sys-btn-primary inline-flex min-h-[42px] w-full items-center justify-center gap-2 text-xs"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Send Wellness Plan</span>
                </button>
              </div>
            </div>
            {lastSentNote && (
              <div
                className="rounded-lg border px-3.5 py-2 text-xs font-medium"
                style={{ borderColor: 'var(--sys-secondary)', color: 'var(--sys-secondary)' }}
              >
                {lastSentNote}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--sys-border)' }}>
              <button
                type="button"
                onClick={() => onCopyText(shareSummaryText, 'Wellness summary copied!')}
                className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Summary</span>
              </button>
              <button
                type="button"
                onClick={() => onCopyText(shareablePlanUrl, 'Shareable plan link copied!')}
                className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Copy Plan Link</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile(`wellness-summary-${today}.txt`, `${shareSummaryText}\n`)}
                className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download .txt</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onCopyText(
                    `Join me on The System! Member Code: ${memberCode} · ${shareablePlanUrl}`,
                    'Friend invite copied!'
                  )
                }
                className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Copy Friend Invite</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: Privacy & Account */}
      {section === 'privacy' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="sys-card p-6 lg:col-span-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" style={{ color: 'var(--sys-secondary)' }} />
              <h2 className="font-display text-lg font-bold">Privacy Controls</h2>
            </div>

            <div className="mt-4 space-y-2.5">
              {PRIVACY_OPTIONS.map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={state.priv[key]}
                    onChange={(e) => onTogglePrivacy(key, e.target.checked)}
                    className="h-4 w-4 accent-[var(--sys-primary)]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div
              className="mt-4 rounded-xl border p-3.5 text-xs"
              style={{
                borderColor: 'var(--sys-border)',
                backgroundColor: 'var(--sys-surface-lowest)',
              }}
            >
              <div className="font-semibold" style={{ color: 'var(--sys-muted)' }}>
                Live Public Card Preview
              </div>
              {state.priv.on ? (
                <div className="mt-1.5 space-y-1">
                  <div>
                    <strong>{pubName}</strong> ·{' '}
                    {state.priv.rank ? `Lv ${levelInfo.l} (Rank ${rank})` : 'Rank hidden'} ·{' '}
                    {state.priv.prog ? `Goal ${goalPct}%` : 'Progress hidden'}
                  </div>
                  {state.priv.stats && (
                    <div className="font-mono-num" style={{ color: 'var(--sys-muted)' }}>
                      {Object.entries(state.stats)
                        .map(([k, v]) => `${k} ${v}`)
                        .join(' · ')}
                    </div>
                  )}
                  {state.priv.bio && (
                    <div className="font-mono-num" style={{ color: 'var(--sys-muted)' }}>
                      {state.p.h} cm · {state.p.w} kg
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1" style={{ color: 'var(--sys-muted)' }}>
                  You appear offline and hidden from public leaderboards.
                </div>
              )}
            </div>
          </div>

          <div className="sys-card p-6 lg:col-span-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: 'var(--sys-primary)' }} />
              <h2 className="font-display text-lg font-bold">Account &amp; Organization Portal</h2>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
              {state.acct.signedIn
                ? `Signed in as ${state.acct.email}${state.acct.isAdmin ? ' (Super-Admin)' : ''}`
                : 'Sign in to access Gym/Company workspaces or the Super-Admin console.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {state.acct.signedIn ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="sys-btn-secondary min-h-[40px] px-4 text-xs font-semibold"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSignIn}
                  className="sys-btn-primary min-h-[40px] px-4 text-xs"
                >
                  Sign In / Switch Account
                </button>
              )}

              <button
                type="button"
                onClick={onOpenOrgRequest}
                className="sys-btn-secondary min-h-[40px] px-4 text-xs font-semibold"
              >
                Request Gym / Company Access
              </button>

              {state.acct.isAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdminConsole}
                  className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs font-semibold"
                  style={{ color: 'var(--sys-warn)', borderColor: 'var(--sys-warn)' }}
                >
                  <Crown className="h-3.5 w-3.5" />
                  <span>Super-Admin Console</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
