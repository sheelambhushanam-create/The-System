import React from 'react';
import {
  Calendar,
  Compass,
  Dumbbell,
  Flame,
  Sparkles,
  User,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  Watch,
} from 'lucide-react';
import type { AppState, TabId } from '../types/system';
import { getAutonomicReadiness } from '../utils/clinical';
import { getLevelInfo, getProgramDayNumber, getRank } from '../utils/metabolic';
import { getHabitStatementStatus } from '../utils/quests';
import { THEME_COPY, todayISO } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface NavigationProps {
  state: AppState;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenCoach: () => void;
  onOpenWatch?: () => void;
  onToggleMute?: () => void;
  bleBpm?: number;
  bleDeviceName?: string | null;
}

const TAB_ICONS: Record<TabId, React.ReactNode> = {
  quests: <Compass className="h-4 w-4" />,
  program: <Dumbbell className="h-4 w-4" />,
  nutrition: <Utensils className="h-4 w-4" />,
  community: <Users className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  profile: <User className="h-4 w-4" />,
};

export const TopBar: React.FC<Pick<NavigationProps, 'state' | 'activeTab' | 'onSelectTab'>> = ({
  state,
  activeTab,
  onSelectTab,
}) => {
  const copy = THEME_COPY[state.theme];
  const primaryTabs: TabId[] = ['quests', 'program', 'nutrition', 'community', 'calendar'];

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        backgroundColor: 'var(--sys-nav-bg)',
        borderColor: 'var(--sys-border)',
      }}
    >
      <div className="mx-auto flex h-[52px] max-w-7xl items-center justify-between gap-8 px-4 md:h-16 md:px-8">
        {/* Zone 1: Single text wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('quests')}
          className="font-display shrink-0 whitespace-nowrap text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: 'var(--sys-text)' }}
        >
          The System
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-6 md:flex">
          {primaryTabs.map((id) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className="relative shrink-0 whitespace-nowrap py-2 text-sm font-medium transition-colors"
                style={{
                  color: isActive ? 'var(--sys-primary)' : 'var(--sys-muted)',
                }}
              >
                {copy.nav[id]}
                {isActive && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--sys-primary)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Install App (when eligible) + Profile & Settings */}
        <div className="flex shrink-0 items-center gap-2">
          <PWAInstallButton />
          <button
            type="button"
            aria-label={`Profile and settings for ${state.p.name}`}
            onClick={() => onSelectTab('profile')}
            className="sys-btn-secondary flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2 text-xs font-semibold"
            style={{
              borderColor: activeTab === 'profile' ? 'var(--sys-primary)' : 'var(--sys-border)',
              color: activeTab === 'profile' ? 'var(--sys-primary)' : 'var(--sys-text)',
            }}
          >
            <User className="h-3.5 w-3.5" />
            <span className="max-w-[96px] truncate sm:max-w-[120px]">{state.p.name}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export const WorkspaceToolbar: React.FC<
  Pick<
    NavigationProps,
    'state' | 'onOpenCoach' | 'onOpenWatch' | 'onToggleMute' | 'bleBpm' | 'bleDeviceName'
  >
> = ({ state, onOpenCoach, onOpenWatch, onToggleMute, bleBpm = 0, bleDeviceName = null }) => {
  const levelInfo = getLevelInfo(state.xp);
  const rank = getRank(levelInfo.l);
  const today = todayISO();
  const dayNum = getProgramDayNumber(state.start, today, state.cal, state.p.days);
  const statement = getHabitStatementStatus(state, today);
  const readiness = getAutonomicReadiness(state, today, bleBpm);
  const copy = THEME_COPY[state.theme];

  return (
    <section
      aria-label="Session status and coach"
      className="mx-auto max-w-7xl px-4 pt-3 md:px-8 md:pt-4"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
        style={{ borderColor: 'var(--sys-border)' }}
      >
        <div
          className="font-mono-num flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs"
          style={{ color: 'var(--sys-muted)' }}
        >
          <span className="hidden font-semibold sm:inline" style={{ color: 'var(--sys-text)' }}>
            {copy.label}
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="whitespace-nowrap">
            Day {dayNum}/{state.p.days}
          </span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">
            {state.theme === 'rpg'
              ? `Rank ${rank} · Lv ${levelInfo.l}`
              : state.theme === 'clean'
                ? `Readiness ${readiness.readinessPct}% · HRV ${readiness.hrvMs} ms`
                : `Level ${levelInfo.l}`}
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span
            className="hidden items-center gap-1 whitespace-nowrap font-semibold sm:inline-flex"
            style={{ color: 'var(--sys-secondary)' }}
          >
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            {state.streak}d streak
            {statement.streakProtected
              ? ' (Safe)'
              : statement.isMinimumDueMode
                ? ' (Min Due)'
                : ''}
          </span>
          {state.freeze > 0 && (
            <>
              <span aria-hidden="true" className="hidden md:inline">
                ·
              </span>
              <span className="hidden whitespace-nowrap md:inline">
                {state.freeze} Freeze
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onOpenWatch && (
            <button
              type="button"
              onClick={onOpenWatch}
              className="sys-btn-secondary inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold"
            >
              <Watch className="h-3.5 w-3.5" style={{ color: 'var(--sys-secondary)' }} />
              <span>
                {bleDeviceName && bleBpm > 0 ? `Watch · ${bleBpm} bpm` : 'Watch Sync'}
              </span>
            </button>
          )}
          {onToggleMute && (
            <button
              type="button"
              aria-label={state.mute ? 'Unmute audio chimes' : 'Mute audio chimes'}
              onClick={onToggleMute}
              className="sys-btn-secondary inline-flex min-h-[36px] w-9 shrink-0 items-center justify-center p-0 text-xs"
            >
              {state.mute ? (
                <VolumeX className="h-3.5 w-3.5" style={{ color: 'var(--sys-muted)' }} />
              ) : (
                <Volume2 className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCoach}
            aria-label={`Open Gemini ${copy.coachName} chat`}
            className="sys-btn-secondary inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} aria-hidden="true" />
            <span>Gemini {copy.coachName}</span>
          </button>
        </div>
      </div>

      {state.b2b.globalEvent.active && state.theme !== 'clean' && (
        <div
          className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 text-xs"
          style={{ borderColor: 'var(--sys-border)', color: 'var(--sys-muted)' }}
        >
          <span>
            <strong style={{ color: 'var(--sys-warn)' }}>{state.b2b.globalEvent.title}</strong>
            <span aria-hidden="true"> — </span>
            {state.b2b.globalEvent.desc}
          </span>
        </div>
      )}
    </section>
  );
};

export const BottomNav: React.FC<
  Pick<NavigationProps, 'state' | 'activeTab' | 'onSelectTab'>
> = ({ state, activeTab, onSelectTab }) => {
  const copy = THEME_COPY[state.theme];
  const tabs: TabId[] = ['quests', 'program', 'nutrition', 'community', 'calendar'];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-xl md:hidden"
      style={{
        backgroundColor: 'var(--sys-nav-bg)',
        borderColor: 'var(--sys-border)',
      }}
    >
      <div className="grid h-[60px] grid-cols-5 items-center px-1 pb-[env(safe-area-inset-bottom,0px)]">
        {tabs.map((id) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors"
              style={{
                color: isActive ? 'var(--sys-primary)' : 'var(--sys-muted)',
                backgroundColor:
                  isActive && state.theme === 'women'
                    ? 'rgba(244, 114, 182, 0.14)'
                    : 'transparent',
              }}
            >
              {TAB_ICONS[id]}
              <span className="truncate">{copy.nav[id]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
