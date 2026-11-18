import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../utils/pwa';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        aria-label="Install App"
        className="sys-btn-primary inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:opacity-95"
      >
        <span aria-hidden="true">📲</span>
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install App on iOS"
          className="sys-btn-secondary inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold"
          style={{
            borderColor: 'var(--sys-primary)',
            color: 'var(--sys-primary)',
          }}
        >
          <span aria-hidden="true">📲</span>
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <div
              className="sys-card w-full max-w-sm p-5"
              style={{
                backgroundColor: 'var(--sys-surface)',
                borderColor: 'var(--sys-primary)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-install-title"
                  className="font-display text-base font-bold"
                  style={{ color: 'var(--sys-text)' }}
                >
                  Install The System on iOS
                </h3>
                <button
                  type="button"
                  aria-label="Close install instructions"
                  onClick={() => setShowIOSGuide(false)}
                  className="sys-btn-secondary inline-flex h-8 w-8 items-center justify-center p-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol
                className="mt-3 list-decimal space-y-2 pl-5 text-sm"
                style={{ color: 'var(--sys-muted)' }}
              >
                <li>
                  Tap the <strong style={{ color: 'var(--sys-text)' }}>Share</strong> button in
                  Safari’s toolbar.
                </li>
                <li>
                  Scroll down and tap{' '}
                  <strong style={{ color: 'var(--sys-text)' }}>Add to Home Screen</strong>.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="sys-btn-primary mt-4 w-full py-2 text-xs font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg md:bottom-4"
      style={{
        backgroundColor: 'var(--sys-warn)',
        color: '#ffffff',
      }}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      <span>Offline Mode — Cached data active</span>
    </div>
  );
};
