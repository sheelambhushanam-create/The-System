import type { AppState, TabId } from '../types/system';
import {
  calculateMacros,
  getProgramDayNumber,
  isMaternalProfile,
  sumDailyMacros,
} from './metabolic';
import { getHabitStatementStatus } from './quests';

export interface NotificationTemplate {
  id: string;
  category: string;
  triggerHour: number;
  timeWindow: string;
  tone: string;
  title: string;
  body: string;
  benefit: string;
  ctaLabel: string;
  actionTab: TabId;
}

export const NOTIFICATION_MATRIX: NotificationTemplate[] = [
  {
    id: 'morning_kickoff',
    category: 'Morning Kickoff',
    triggerHour: 7,
    timeWindow: '7:00 AM – 8:00 AM',
    tone: 'Witty & Energetic',
    title: 'Good morning! Your muscles missed you.',
    body: 'Your body burned fuel while you slept. Drink a glass of water, step into 5 minutes of morning light, and set an easy win.',
    benefit: 'Jump-starts your body clock and wakes up your focus.',
    ctaLabel: 'Log 250 ml Water',
    actionTab: 'quests',
  },
  {
    id: 'water_midday',
    category: 'Midday Water Reminder',
    triggerHour: 11,
    timeWindow: '11:30 AM',
    tone: 'Caring & Playful',
    title: 'Your brain is 73% water. Do not run it on empty.',
    body: 'That slight afternoon headache is often thirst, not stress. Drink 1 tall glass now to keep energy crisp.',
    benefit: 'Stops false hunger cravings and mid-morning fog.',
    ctaLabel: 'Add Water',
    actionTab: 'quests',
  },
  {
    id: 'pre_meal_protein',
    category: 'Pre-Meal Protein Anchor',
    triggerHour: 13,
    timeWindow: '1:15 PM',
    tone: 'Professional & Witty',
    title: 'Lunch check: did protein show up to the party?',
    body: 'Include an allergen-safe protein pick on your plate today so energy stays steady past 4 PM.',
    benefit: 'Keeps you full longer and builds firm muscle while resting.',
    ctaLabel: 'Log Safe Meal',
    actionTab: 'nutrition',
  },
  {
    id: 'post_meal_walk',
    category: 'Post-Meal Glucose Walk',
    triggerHour: 14,
    timeWindow: '2:15 PM or 8:45 PM',
    tone: 'Scientific yet Funny',
    title: 'A 10-minute walk beats a 2-hour guilt trip.',
    body: 'Stepping outside right now smooths out after-meal blood sugar by up to 30%. Easy steps, huge payoff.',
    benefit: 'Stops sugar crashes and afternoon energy dips.',
    ctaLabel: 'Open Activity',
    actionTab: 'quests',
  },
  {
    id: 'afternoon_desk_slump',
    category: 'Afternoon Desk Slump',
    triggerHour: 16,
    timeWindow: '4:00 PM',
    tone: 'Caring & Relatable',
    title: 'Unclench your jaw. Drop your shoulders.',
    body: 'Hunched over screens for hours? Stand up, roll your neck, and do 10 easy wall push-ups or chair squats.',
    benefit: 'Protects your lower back and wakes up circulation.',
    ctaLabel: 'Quick Stretch',
    actionTab: 'program',
  },
  {
    id: 'workout_encouragement',
    category: 'Workout Encouragement',
    triggerHour: 18,
    timeWindow: '5:30 PM – 6:30 PM',
    tone: 'Inspiring & Professional',
    title: 'The only workout you regret is the one you skipped.',
    body: 'Today takes ~35 minutes — or just 5 minutes in Minimum Due mode. All you have to do is start Set 1.',
    benefit: 'Builds strength and protects joints without burnout.',
    ctaLabel: 'Start Workout',
    actionTab: 'program',
  },
  {
    id: 'evening_streak_shield',
    category: 'Evening Streak Shield',
    triggerHour: 20,
    timeWindow: '8:30 PM – 9:00 PM',
    tone: 'Witty & Urgent',
    title: 'Danger Zone: your streak is looking nervous.',
    body: 'You are 1 quick check-in away from locking in today. Log dinner, drink water, or tap Minimum Due before midnight.',
    benefit: 'Protects your daily habit without guilt on busy nights.',
    ctaLabel: 'Save Streak',
    actionTab: 'quests',
  },
  {
    id: 'bedtime_reset',
    category: 'Rest & Bedtime Reset',
    triggerHour: 22,
    timeWindow: '10:15 PM',
    tone: 'Calm & Grounded',
    title: 'Screen down. Tomorrow’s strength is built tonight.',
    body: 'Muscle repair peaks during deep sleep. Dim bright lights, take 3 slow breaths, and rest easy.',
    benefit: 'Supports overnight recovery and balances tomorrow’s hunger.',
    ctaLabel: 'Open Recovery',
    actionTab: 'nutrition',
  },
];

export interface NextBestMoveCard {
  id: string;
  timeTag: string;
  headline: string;
  plainBenefit: string;
  ctaLabel: string;
  actionType: 'water' | 'nutrition' | 'program' | 'min_due';
}

export function getNextBestMove(
  state: AppState,
  dateStr: string,
  hourOverride?: number
): NextBestMoveCard {
  const hour = typeof hourOverride === 'number' ? hourOverride : new Date().getHours();
  const macros = calculateMacros(state.p);
  const logged = sumDailyMacros(state.log[dateStr] || []);
  const water = Number(state.water[dateStr] || 0);
  const dayNum = getProgramDayNumber(state.start, dateStr, state.cal, state.p.days);
  const dayProg = state.prog[dayNum] || {};
  const workoutDone = Boolean(dayProg.x || dayProg.min);
  const statement = getHabitStatementStatus(state, dateStr);
  const maternal = isMaternalProfile(state.p);
  const remProt = Math.max(0, Math.round(macros.pr - logged.p));

  if (hour >= 20 && !statement.streakProtected) {
    return {
      id: 'evening_streak_shield',
      timeTag: 'Evening Streak Check',
      headline: `Keep your ${state.streak}-day streak safe with 1 quick win`,
      plainBenefit: 'Tap Minimum Due for a 5-minute check-in so busy nights never break your habit.',
      ctaLabel: statement.isMinimumDueMode ? 'Start 5-Min Moves' : 'Turn On Minimum Due',
      actionType: statement.isMinimumDueMode ? 'program' : 'min_due',
    };
  }

  if (hour < 11 && water < 0.75) {
    return {
      id: 'morning_kickoff',
      timeTag: 'Morning Kickoff',
      headline: 'Drink 1 tall glass of water + get 5 min sunlight',
      plainBenefit: 'Wakes up your focus and stops mid-morning tiredness before coffee.',
      ctaLabel: '+250 ml Water',
      actionType: 'water',
    };
  }

  if (((hour >= 11 && hour <= 15) || hour >= 19) && remProt > 18) {
    return {
      id: 'pre_meal_protein',
      timeTag: hour < 16 ? 'Lunch Focus' : 'Dinner Focus',
      headline: `Add ~${Math.min(25, remProt)} g allergen-safe protein + 10-min walk`,
      plainBenefit: 'Builds firm muscle that burns fat while you rest, and stops after-meal energy dips.',
      ctaLabel: 'Pick Safe Meal',
      actionType: 'nutrition',
    };
  }

  if (!workoutDone) {
    return {
      id: 'workout_encouragement',
      timeTag: 'Today’s Movement',
      headline: maternal
        ? `Start Day ${dayNum} gentle safe movement`
        : statement.isMinimumDueMode
          ? `Do today’s 5-min Minimum Due moves`
          : `Start Day ${dayNum} Workout — just Set 1`,
      plainBenefit: maternal
        ? 'Protects your lower back, eases stiffness, and keeps blood flow steady.'
        : 'Protects your back and knees while building steady everyday strength.',
      ctaLabel: 'Open Workout',
      actionType: 'program',
    };
  }

  if (water < statement.hydrationTargetLitres) {
    return {
      id: 'water_midday',
      timeTag: 'Hydration Check',
      headline: `Log ${(statement.hydrationTargetLitres - water).toFixed(1)} L more water today`,
      plainBenefit: 'Keeps joints smooth and stops false snack cravings.',
      ctaLabel: '+250 ml Water',
      actionType: 'water',
    };
  }

  return {
    id: 'bedtime_reset',
    timeTag: 'All Key Targets On Track',
    headline: 'Take a 10-minute post-meal walk or wind down early',
    plainBenefit: 'Deep sleep repairs muscles and keeps tomorrow’s hunger calm.',
    ctaLabel: 'View Food & Rest',
    actionType: 'nutrition',
  };
}

export function triggerSystemReminder(
  reminderId: string,
  onFallbackToast: (msg: string) => void
): boolean {
  const item = NOTIFICATION_MATRIX.find((n) => n.id === reminderId);
  if (!item) return false;

  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(item.title, {
        body: item.body,
        icon: '/assets/icon-192.png',
      });
      onFallbackToast(`${item.title} — ${item.body}`);
      return true;
    } catch {
      // Fallback below
    }
  }

  onFallbackToast(`${item.title} — ${item.body}`);
  return false;
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    const res = await Notification.requestPermission();
    return res === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function buildGoogleCalendarReminderUrl(
  title: string,
  details: string,
  hhmm = '07:00',
  dateStr = new Date().toISOString().slice(0, 10),
  recurDays = 1
): string {
  const cleanTime = (hhmm || '07:00').replace(':', '').padStart(4, '0');
  const hh = Number(cleanTime.slice(0, 2)) || 7;
  const mm = cleanTime.slice(2, 4) || '00';
  const dFormatted = dateStr.replace(/-/g, '');
  const endHour = String((hh + 1) % 24).padStart(2, '0');
  const base = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${dFormatted}T${cleanTime}00/${dFormatted}T${endHour}${mm}00&details=${encodeURIComponent(
    details
  )}`;
  return recurDays > 1
    ? `${base}&recur=${encodeURIComponent(`RRULE:FREQ=DAILY;COUNT=${recurDays}`)}`
    : base;
}
