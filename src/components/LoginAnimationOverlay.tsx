import React, { useEffect } from 'react';
import { Activity, HeartHandshake, Shield } from 'lucide-react';
import type { ThemeMode } from '../types/system';

interface LoginAnimationOverlayProps {
  theme: ThemeMode;
  userName: string;
  reason: string;
  rank: string;
  onDone: () => void;
}

export const LoginAnimationOverlay: React.FC<LoginAnimationOverlayProps> = ({
  theme,
  userName,
  reason,
  rank,
  onDone,
}) => {
  useEffect(() => {
    const id = window.setTimeout(onDone, 1750);
    return () => window.clearTimeout(id);
  }, [onDone]);

  const titles: Record<ThemeMode, string> = {
    clean: `Calibrating Daily Telemetry, ${userName}`,
    women: `Aligning Restorative Rhythm, ${userName}`,
    rpg: `System Awakening: Vanguard ${userName}`,
  };

  const subLabels: Record<ThemeMode, string> = {
    clean: 'Universal Clean Mode Activated',
    women: 'Women-Centric Wellness Activated',
    rpg: 'Vanguard RPG Protocol Activated',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="login-animation-overlay"
      data-login-theme={theme}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-md"
      style={{ backgroundColor: 'color-mix(in srgb, var(--sys-bg) 94%, transparent)' }}
    >
      <div className="sys-card anim-fade-up flex w-full max-w-md flex-col items-center p-8 text-center">
        {/* Theme-Specialized Emblem & Motion */}
        {theme === 'clean' && (
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div
              className="anim-clean-ring absolute inset-0 rounded-full border-2 border-dashed"
              style={{ borderColor: 'var(--sys-primary)' }}
            />
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full border"
              style={{
                borderColor: 'var(--sys-secondary)',
                backgroundColor: 'var(--sys-surface-lowest)',
              }}
            >
              <Activity className="h-7 w-7" style={{ color: 'var(--sys-primary)' }} />
            </div>
          </div>
        )}

        {theme === 'women' && (
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div
              className="anim-women-breathe absolute inset-0 rounded-full"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--sys-primary) 16%, transparent)',
              }}
            />
            <div
              className="anim-women-breathe flex h-16 w-16 items-center justify-center rounded-full border-2"
              style={{
                borderColor: 'var(--sys-primary)',
                backgroundColor: 'var(--sys-surface-lowest)',
              }}
            >
              <HeartHandshake className="h-7 w-7" style={{ color: 'var(--sys-primary)' }} />
            </div>
          </div>
        )}

        {theme === 'rpg' && (
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div
              className="anim-rpg-crest flex h-16 w-16 items-center justify-center border-2"
              style={{
                borderColor: 'var(--sys-primary)',
                backgroundColor: 'var(--sys-surface-lowest)',
                boxShadow: 'var(--sys-glow)',
              }}
            >
              <div className="-rotate-45 text-center">
                <div className="font-mono-num text-[10px]" style={{ color: 'var(--sys-muted)' }}>
                  RANK
                </div>
                <div className="font-display text-xl font-bold leading-none" style={{ color: 'var(--sys-primary)' }}>
                  {rank}
                </div>
              </div>
            </div>
            <Shield
              className="absolute -bottom-1 right-1 h-5 w-5"
              style={{ color: 'var(--sys-secondary)' }}
            />
          </div>
        )}

        <div
          className="font-mono-num mt-5 text-xs font-semibold"
          style={{ color: 'var(--sys-primary)' }}
        >
          {subLabels[theme]}
        </div>

        <h2 className="font-display mt-2 text-xl font-bold">{titles[theme]}</h2>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
          {reason}
        </p>

        <button
          type="button"
          onClick={onDone}
          className="sys-btn-primary mt-6 min-h-[42px] px-5 text-xs"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
};
