import React, { useState } from 'react';
import {
  Bell,
  Bluetooth,
  Copy,
  ExternalLink,
  RefreshCw,
  Smartphone,
  Watch,
  X,
} from 'lucide-react';
import type { AppState, WatchCommandType, WatchReminderPrefs } from '../types/system';
import type { WatchSnapshot } from '../utils/watchBridge';
import { WatchCompanionFace } from './WatchCompanionApp';

interface WatchHubModalProps {
  state: AppState;
  snapshot: WatchSnapshot;
  bleDeviceName: string | null;
  bleBpm: number;
  onClose: () => void;
  onWatchCommand: (type: WatchCommandType, payload?: Record<string, unknown>) => void;
  onUpdateWatchPrefs: (patch: Partial<WatchReminderPrefs>) => void;
  onConnectBleWatch: () => void;
  onOpenStandaloneWatch: () => void;
  onCopyText: (text: string, msg: string) => void;
}

export const WatchHubModal: React.FC<WatchHubModalProps> = ({
  state,
  snapshot,
  bleDeviceName,
  bleBpm,
  onClose,
  onWatchCommand,
  onUpdateWatchPrefs,
  onConnectBleWatch,
  onOpenStandaloneWatch,
  onCopyText,
}) => {
  const [showWebhook, setShowWebhook] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const watchUrl = `${origin}/watch?code=${encodeURIComponent(snapshot.code)}`;
  const webhookUrl = `${origin}/api/watch/webhook`;
  const shortcutPayload = JSON.stringify(
    {
      code: snapshot.code,
      command: 'LOG_WATER_250',
      source: 'apple_watch_shortcut',
    },
    null,
    2
  );

  const prefs = snapshot.watchPrefs;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Smartwatch Sync Hub"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="sys-card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--sys-border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{
                borderColor: 'var(--sys-primary)',
                backgroundColor: 'color-mix(in srgb, var(--sys-primary) 12%, transparent)',
                color: 'var(--sys-primary)',
              }}
            >
              <Watch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">
                Smartwatch Companion &amp; 1-Tap Wrist Sync
              </h2>
              <p className="text-xs" style={{ color: 'var(--sys-muted)' }}>
                Start/complete sets, log +250 ml water, and act on hydration reminders in one tap — zero manual typing.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Smartwatch Hub"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Live Interactive Watch Companion */}
          <div className="flex flex-col items-center justify-start lg:col-span-5">
            <WatchCompanionFace
              snapshot={snapshot}
              connectedLabel={bleDeviceName ? `${bleBpm || '--'} bpm` : 'Live'}
              onSendCommand={(type, payload) => onWatchCommand(type, payload)}
              embedded
            />
            <div className="mt-3 flex w-full max-w-[310px] flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenStandaloneWatch}
                className="sys-btn-primary inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Watch App</span>
              </button>
              <button
                type="button"
                onClick={() => onWatchCommand('SYNC_TELEMETRY')}
                className="sys-btn-secondary inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync Now</span>
              </button>
            </div>
          </div>

          {/* Right: Pairing Code, Reminder Schedule & Setup Guide */}
          <div className="space-y-4 lg:col-span-7">
            {/* Pairing & BLE Connection */}
            <div className="sys-card-nested p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">Watch Pairing Code</div>
                  <div className="font-mono-num mt-0.5 text-xl font-bold" style={{ color: 'var(--sys-primary)' }}>
                    {snapshot.code}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyText(watchUrl, 'Watch companion link copied!')}
                    className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Watch Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={onConnectBleWatch}
                    className="sys-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
                  >
                    <Bluetooth className="h-3.5 w-3.5" />
                    <span>{bleDeviceName ? `BLE: ${bleDeviceName}` : 'Pair BLE HR'}</span>
                  </button>
                </div>
              </div>
              <div className="font-mono-num mt-2 truncate text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                {watchUrl}
              </div>
            </div>

            {/* Watch Reminder Settings */}
            <div className="sys-card-nested p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
                  <span className="text-sm font-semibold">Wrist Reminder Cadence</span>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={prefs.enabled}
                    onChange={(e) => onUpdateWatchPrefs({ enabled: e.target.checked })}
                    className="h-4 w-4 accent-[var(--sys-primary)]"
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="watch-water-interval" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                    Drink Water Reminder
                  </label>
                  <select
                    id="watch-water-interval"
                    value={prefs.waterIntervalMin}
                    onChange={(e) =>
                      onUpdateWatchPrefs({ waterIntervalMin: Number(e.target.value) || 60 })
                    }
                    className="sys-input w-full px-3 py-2 text-xs"
                  >
                    <option value={45}>Every 45 min</option>
                    <option value={60}>Every 60 min</option>
                    <option value={90}>Every 90 min</option>
                    <option value={120}>Every 2 hours</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={prefs.postMealWalkReminder}
                      onChange={(e) =>
                        onUpdateWatchPrefs({ postMealWalkReminder: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--sys-primary)]"
                    />
                    <span>Post-meal walk nudge</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={prefs.restAlertVibrate}
                      onChange={(e) =>
                        onUpdateWatchPrefs({ restAlertVibrate: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--sys-primary)]"
                    />
                    <span>Haptic buzz when rest ends</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Setup & Integration Instructions */}
            <div className="sys-card-nested p-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Smartphone className="h-4 w-4" style={{ color: 'var(--sys-secondary)' }} />
                  <span>How to Use on Your Real Smartwatch</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWebhook((v) => !v)}
                  className="font-semibold underline"
                  style={{ color: 'var(--sys-primary)' }}
                >
                  {showWebhook ? 'Hide Shortcut API' : 'Apple Watch / Webhook API'}
                </button>
              </div>

              <ol className="mt-2.5 space-y-2 leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                <li>
                  <strong style={{ color: 'var(--sys-text)' }}>1. Wear OS / Galaxy / Pixel Watch:</strong>{' '}
                  Open the copied Watch Link in your watch browser (or tap <em>Open Watch App</em> on a second device) and enter code <strong className="font-mono-num">{snapshot.code}</strong>. Every tap on the wrist updates sets, water, and quests live.
                </li>
                <li>
                  <strong style={{ color: 'var(--sys-text)' }}>2. Apple Watch 1-Tap Shortcuts:</strong>{' '}
                  Create a Shortcut that sends a POST request to <span className="font-mono-num">/api/watch/webhook</span> with your code and command (<span className="font-mono-num">COMPLETE_NEXT_SET</span> or <span className="font-mono-num">LOG_WATER_250</span>), then pin it to your Watch Face.
                </li>
                <li>
                  <strong style={{ color: 'var(--sys-text)' }}>3. Bluetooth Heart Rate:</strong>{' '}
                  Enable Heart Rate Broadcast on Garmin, Polar, or Wear OS and tap <em>Pair BLE HR</em> for live BPM &amp; readiness sync.
                </li>
              </ol>

              {showWebhook && (
                <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--sys-border)' }}>
                  <div className="font-mono-num text-[11px]" style={{ color: 'var(--sys-primary)' }}>
                    POST {webhookUrl}
                  </div>
                  <pre
                    className="font-mono-num overflow-x-auto rounded-lg border p-2.5 text-[11px]"
                    style={{
                      borderColor: 'var(--sys-border)',
                      backgroundColor: 'var(--sys-surface)',
                    }}
                  >
                    {shortcutPayload}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onCopyText(webhookUrl, 'Webhook URL copied!')}
                      className="sys-btn-secondary min-h-[34px] px-3 text-[11px] font-semibold"
                    >
                      Copy Webhook URL
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyText(shortcutPayload, 'JSON payload copied!')}
                      className="sys-btn-secondary min-h-[34px] px-3 text-[11px] font-semibold"
                    >
                      Copy Water JSON
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onCopyText(
                          JSON.stringify(
                            { code: snapshot.code, command: 'COMPLETE_NEXT_SET', source: 'apple_watch_shortcut' },
                            null,
                            2
                          ),
                          'Complete Set JSON copied!'
                        )
                      }
                      className="sys-btn-secondary min-h-[34px] px-3 text-[11px] font-semibold"
                    >
                      Copy Set JSON
                    </button>
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                    Supported commands: <span className="font-mono-num">COMPLETE_NEXT_SET</span>,{' '}
                    <span className="font-mono-num">LOG_WATER_250</span>,{' '}
                    <span className="font-mono-num">LOG_WATER_500</span>,{' '}
                    <span className="font-mono-num">LOG_WALK_1500</span>,{' '}
                    <span className="font-mono-num">TOGGLE_MIN_DUE</span>,{' '}
                    <span className="font-mono-num">SYNC_TELEMETRY</span>
                  </div>
                </div>
              )}
            </div>

            {state.watch.lastSyncedAt && (
              <div className="font-mono-num text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                Last wrist sync: {new Date(state.watch.lastSyncedAt).toLocaleTimeString()} ·{' '}
                {state.watch.deviceLabel || 'Watch Companion'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
