import React, { useState } from 'react';
import {
  BellRing,
  Bluetooth,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  QrCode,
  Watch,
} from 'lucide-react';
import type { AppState, CalendarTag } from '../types/system';
import { getProgramDayNumber } from '../utils/metabolic';
import {
  NOTIFICATION_MATRIX,
  buildGoogleCalendarReminderUrl,
  requestNotificationPermission,
} from '../utils/notifications';
import { THEME_COPY, todayISO } from '../utils/storage';

interface CalendarViewProps {
  state: AppState;
  onToggleMinimumDueDate: (dateStr: string, enabled: boolean) => void;
  onSetCalendarTag: (dateStr: string, tag: CalendarTag | '') => void;
  onApplyCalendarRange: (from: string, to: string, tag: CalendarTag | '') => void;
  onSetReminderTime: (time: string) => void;
  onTriggerReminder?: (reminderId: string) => void;
  onSaveGymGps: () => void;
  onCheckInGymGps: () => void;
  onVerifyGymCode: (code: string) => void;
  onOpenQrCheckIn: () => void;
  onConnectBleWatch: () => void;
  onSyncWatch: (steps: number, sleep: number) => void;
  onOpenWatch?: () => void;
  bleDeviceName: string | null;
  bleBpm: number;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  state,
  onToggleMinimumDueDate,
  onSetCalendarTag,
  onApplyCalendarRange,
  onSetReminderTime,
  onTriggerReminder,
  onSaveGymGps,
  onCheckInGymGps,
  onVerifyGymCode,
  onOpenQrCheckIn,
  onConnectBleWatch,
  onSyncWatch,
  onOpenWatch,
  bleDeviceName,
  bleBpm,
}) => {
  const [notifStatus, setNotifStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const copy = THEME_COPY[state.theme];
  const currentDate = todayISO();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeTag, setRangeTag] = useState<CalendarTag | ''>('h');
  const [gymCode, setGymCode] = useState('');
  const [stepsInput, setStepsInput] = useState(String(state.watch.steps || ''));
  const [sleepInput, setSleepInput] = useState(String(state.watch.sleep || ''));

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = base.getDay();

  const tagLabel: Record<CalendarTag, string> = {
    h: 'Off',
    t: 'Trip',
    b: 'Busy',
  };

  const tagColor: Record<CalendarTag, string> = {
    h: 'var(--sys-secondary)',
    t: 'var(--sys-primary)',
    b: 'var(--sys-warn)',
  };

  const remainingDays = Math.max(
    1,
    state.p.days - getProgramDayNumber(state.start, currentDate, state.cal, state.p.days) + 1
  );

  const buildGoogleCalendarUrl = () =>
    buildGoogleCalendarReminderUrl(
      'The System: Daily Wellness Target',
      'Complete your daily wellness & training targets.',
      state.gt || '07:00',
      currentDate,
      remainingDays
    );

  const joinedOrg = state.b2b.orgs.find(
    (o) => o.code === state.acct.orgCode && o.status === 'approved'
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Monthly Schedule & Bulk Range */}
      <div className="space-y-6 lg:col-span-7">
        <div className="sys-card p-6">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonthOffset((m) => m - 1)}
              className="sys-btn-secondary flex min-h-[40px] min-w-[40px] items-center justify-center p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="font-display text-lg font-bold">
              {base.toLocaleString('en', { month: 'long' })} {year}
            </h1>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonthOffset((m) => m + 1)}
              className="sys-btn-secondary flex min-h-[40px] min-w-[40px] items-center justify-center p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1 font-medium" style={{ color: 'var(--sys-muted)' }}>
                {d}
              </div>
            ))}

            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const dt = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const tag = state.cal[dt];
              const isMinDue = Boolean(state.minimumDueDays?.[dt]);
              const isToday = dt === currentDate;
              const isSelected = dt === selectedDate;
              const progDay =
                dt >= state.start && !tag
                  ? getProgramDayNumber(state.start, dt, state.cal, state.p.days)
                  : null;

              return (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setSelectedDate(dt)}
                  className="flex min-h-[50px] flex-col items-center justify-center rounded-lg border text-xs transition-colors"
                  style={{
                    borderColor: isSelected
                      ? 'var(--sys-primary)'
                      : tag
                        ? tagColor[tag]
                        : isMinDue
                          ? 'var(--sys-warn)'
                          : 'var(--sys-border)',
                    backgroundColor: isToday
                      ? 'color-mix(in srgb, var(--sys-primary) 16%, transparent)'
                      : 'var(--sys-surface-lowest)',
                    color: tag ? tagColor[tag] : isMinDue ? 'var(--sys-warn)' : 'var(--sys-text)',
                  }}
                >
                  <span className="font-mono-num font-semibold">{d}</span>
                  <span className="text-[10px]" style={{ color: 'var(--sys-muted)' }}>
                    {tag
                      ? tagLabel[tag]
                      : isMinDue
                        ? 'Min'
                        : progDay && progDay <= state.p.days
                          ? `D${progDay}`
                          : '·'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Date Action Bar */}
          <div className="sys-card-nested mt-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
            <div className="font-mono-num text-xs">
              Selected: <strong>{selectedDate}</strong>
              {state.minimumDueDays?.[selectedDate] && (
                <span className="ml-2 font-semibold" style={{ color: 'var(--sys-warn)' }}>
                  · Minimum Due
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['', 'Normal'],
                  ['h', 'Holiday'],
                  ['t', 'Travel'],
                  ['b', 'Busy'],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onSetCalendarTag(selectedDate, code)}
                  className={`${
                    (state.cal[selectedDate] || '') === code ? 'sys-btn-primary' : 'sys-btn-secondary'
                  } min-h-[36px] px-3 text-xs`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={Boolean(state.minimumDueDays?.[selectedDate])}
                onClick={() =>
                  onToggleMinimumDueDate(
                    selectedDate,
                    !Boolean(state.minimumDueDays?.[selectedDate])
                  )
                }
                className={`${
                  state.minimumDueDays?.[selectedDate] ? 'sys-btn-primary' : 'sys-btn-secondary'
                } min-h-[36px] px-3 text-xs`}
              >
                Minimum Due
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Range Planner */}
        <div className="sys-card p-5">
          <h2 className="font-display text-base font-semibold">
            Plan Around Holidays &amp; Travel
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
            Marked days preserve your streak and replace heavy workouts with a light 10-minute walk.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label htmlFor="cal-from" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                From
              </label>
              <input
                id="cal-from"
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="sys-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cal-to" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                To
              </label>
              <input
                id="cal-to"
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="sys-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cal-tag" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Day Type
              </label>
              <select
                id="cal-tag"
                value={rangeTag}
                onChange={(e) => setRangeTag(e.target.value as CalendarTag | '')}
                className="sys-input w-full px-3 py-2 text-xs"
              >
                <option value="h">Holiday</option>
                <option value="t">Travel</option>
                <option value="b">Busy</option>
                <option value="">Normal day</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!rangeStart) return;
              onApplyCalendarRange(rangeStart, rangeEnd || rangeStart, rangeTag);
            }}
            className="sys-btn-primary mt-3 min-h-[40px] px-4 text-xs"
          >
            Apply Date Range
          </button>
        </div>
      </div>

      {/* Right Column: Google Calendar, Gym Check-In & Watch Sync */}
      <div className="space-y-6 lg:col-span-5">
        <div className="sys-card p-5">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
            <h2 className="font-display text-base font-semibold">Google Calendar Reminder</h2>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <label htmlFor="gcal-time" className="sr-only">
              Reminder time
            </label>
            <input
              id="gcal-time"
              type="time"
              value={state.gt}
              onChange={(e) => onSetReminderTime(e.target.value)}
              className="sys-input flex-1 px-3 py-2 text-sm"
            />
            <a
              href={buildGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="sys-btn-primary inline-flex min-h-[40px] shrink-0 items-center px-4 text-xs"
            >
              Add Daily Reminder
            </a>
          </div>
        </div>

        {/* Smart Reminders Matrix */}
        <div className="sys-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
              <h2 className="font-display text-base font-semibold">Smart Reminders</h2>
            </div>
            <button
              type="button"
              onClick={async () => {
                const res = await requestNotificationPermission();
                setNotifStatus(res);
              }}
              className="sys-btn-secondary min-h-[34px] px-3 text-xs font-semibold"
            >
              {notifStatus === 'granted'
                ? 'Browser Alerts On'
                : notifStatus === 'unsupported'
                  ? 'In-App Alerts Active'
                  : 'Enable Browser Alerts'}
            </button>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--sys-muted)' }}>
            Friendly nudges for water, protein, post-meal walks, and evening streak protection.
          </p>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {NOTIFICATION_MATRIX.map((n) => (
              <div key={n.id} className="sys-card-nested p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{n.category}</span>
                  <span className="font-mono-num text-[11px]" style={{ color: 'var(--sys-muted)' }}>
                    {n.timeWindow}
                  </span>
                </div>
                <div className="mt-1 font-medium" style={{ color: 'var(--sys-primary)' }}>
                  {n.title}
                </div>
                <p className="mt-0.5 leading-relaxed" style={{ color: 'var(--sys-muted)' }}>
                  {n.benefit}
                </p>
                {onTriggerReminder && (
                  <button
                    type="button"
                    onClick={() => onTriggerReminder(n.id)}
                    className="sys-btn-secondary mt-2 min-h-[32px] px-3 text-[11px] font-semibold"
                  >
                    Preview Reminder
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Gym & Corporate Check-In */}
        <div className="sys-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Gym &amp; Corporate Check-In</h2>
            <span className="font-mono-num text-xs font-semibold" style={{ color: 'var(--sys-secondary)' }}>
              +30 XP
            </span>
          </div>

          {joinedOrg && (
            <div className="sys-card-nested mt-3 p-3 text-xs">
              Member of <strong>{joinedOrg.name}</strong> · Active Challenge:{' '}
              <strong style={{ color: 'var(--sys-secondary)' }}>{joinedOrg.challenge}</strong>
            </div>
          )}

          <p className="mt-2 text-xs" style={{ color: 'var(--sys-muted)' }}>
            {state.gym
              ? 'Gym coordinates saved. Check in within 250 m, scan QR, or enter an organization Join Code.'
              : 'Save your gym GPS location, scan a QR poster, or verify a Gym / Company code.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveGymGps}
              className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Save Gym GPS</span>
            </button>
            {state.gym && (
              <button
                type="button"
                onClick={onCheckInGymGps}
                className="sys-btn-secondary min-h-[40px] px-3 text-xs"
                style={{ color: 'var(--sys-secondary)' }}
              >
                GPS Check-In
              </button>
            )}
            <button
              type="button"
              onClick={onOpenQrCheckIn}
              className="sys-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Scan QR</span>
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              aria-label="Gym or Company Join Code"
              value={gymCode}
              onChange={(e) => setGymCode(e.target.value)}
              placeholder="Join code (e.g. GYM-IRON88)"
              className="sys-input flex-1 px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                onVerifyGymCode(gymCode);
                setGymCode('');
              }}
              className="sys-btn-secondary min-h-[40px] px-3 text-xs font-semibold"
            >
              Verify Code
            </button>
          </div>
        </div>

        {/* Smartwatch & Biometric Sync */}
        <div className="sys-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">{copy.calendarTitle}</h2>
            <Watch className="h-4 w-4" style={{ color: 'var(--sys-primary)' }} />
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--sys-muted)' }}>
            {bleDeviceName
              ? `Connected: ${bleDeviceName} · Heart Rate ${bleBpm || '--'} bpm`
              : 'Connect a Bluetooth heart-rate wearable or log daily steps and sleep.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConnectBleWatch}
              className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
            >
              <Bluetooth className="h-3.5 w-3.5" />
              <span>Connect BLE Watch</span>
            </button>
            {onOpenWatch && (
              <button
                type="button"
                onClick={onOpenWatch}
                className="sys-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
              >
                <Watch className="h-3.5 w-3.5" style={{ color: 'var(--sys-primary)' }} />
                <span>Open Watch Companion</span>
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="cal-steps" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Steps today
              </label>
              <input
                id="cal-steps"
                type="number"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                className="sys-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cal-sleep" className="mb-1 block text-xs" style={{ color: 'var(--sys-muted)' }}>
                Sleep (hrs)
              </label>
              <input
                id="cal-sleep"
                type="number"
                step="0.5"
                value={sleepInput}
                onChange={(e) => setSleepInput(e.target.value)}
                className="sys-input w-full px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSyncWatch(Number(stepsInput) || 0, Number(sleepInput) || 0)}
            className="sys-btn-primary mt-3 min-h-[42px] w-full text-xs"
          >
            Save Steps &amp; Sleep
          </button>
        </div>
      </div>
    </div>
  );
};
