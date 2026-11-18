import type { WatchCommandType } from '../types/system';

export type HapticEvent =
  | 'tap'
  | 'setComplete'
  | 'restComplete'
  | 'workoutComplete'
  | 'waterLog'
  | 'hydrationGoal'
  | 'reminderAlert'
  | 'syncComplete'
  | 'error';

export type VibrateFn = (pattern: number | number[]) => boolean;

export interface HapticPatternMeta {
  pattern: number[];
  label: string;
  description: string;
}

/**
 * Distinct Vibration API patterns (durations in ms: [vibrate, pause, vibrate, ...])
 * - workoutComplete: sustained long vibration + secondary flourish
 * - restComplete: crisp short double-pulse
 * - setComplete: tactile confirmation double-tap
 * - waterLog: light droplet double-tap
 * - hydrationGoal: celebratory triple-pulse
 * - reminderAlert: attention-getting triple nudge
 * - syncComplete: single crisp acknowledgment pulse
 * - tap: subtle UI detent pulse
 * - error: rapid triple buzz
 */
export const HAPTIC_PATTERNS: Record<HapticEvent, HapticPatternMeta> = {
  tap: {
    pattern: [25],
    label: 'Tap',
    description: 'Subtle wrist detent for navigation and quick actions',
  },
  setComplete: {
    pattern: [45, 35, 65],
    label: 'Set Logged',
    description: 'Snappy confirmation pulse when completing a set',
  },
  restComplete: {
    pattern: [90, 65, 90],
    label: 'Rest Complete',
    description: 'Short double-pulse signaling rest interval ended',
  },
  workoutComplete: {
    pattern: [520, 110, 320],
    label: 'Workout Complete',
    description: 'Long celebratory vibration for finishing all workout sets',
  },
  waterLog: {
    pattern: [35, 30, 35],
    label: 'Water Logged',
    description: 'Light double-tap for hydration logging',
  },
  hydrationGoal: {
    pattern: [75, 50, 75, 50, 140],
    label: 'Hydration Goal',
    description: 'Rising triple-pulse when daily water target is met',
  },
  reminderAlert: {
    pattern: [80, 50, 80, 50, 120],
    label: 'Wrist Alert',
    description: 'Distinct triple nudge when a watch reminder arrives',
  },
  syncComplete: {
    pattern: [40],
    label: 'Synced',
    description: 'Crisp single pulse for watch telemetry sync',
  },
  error: {
    pattern: [40, 30, 40, 30, 40],
    label: 'Alert',
    description: 'Rapid warning buzz',
  },
};

export interface HapticTriggerResult {
  event: HapticEvent;
  pattern: number[];
  label: string;
  supported: boolean;
  triggered: boolean;
  timestamp: number;
}

export interface HapticTriggerOptions {
  /** Trigger even if the service is currently muted/disabled (e.g., user explicitly previews haptics). */
  force?: boolean;
}

export type HapticListener = (result: HapticTriggerResult) => void;

function getDefaultVibrator(): VibrateFn | null {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    return (pattern) => navigator.vibrate(pattern);
  }
  return null;
}

export class HapticFeedbackService {
  private vibrator: VibrateFn | null;
  private resolveDefault: boolean;
  private enabled: boolean;
  private lastResult: HapticTriggerResult | null = null;
  private listeners = new Set<HapticListener>();

  constructor(vibrator?: VibrateFn | null, initialEnabled = true) {
    if (vibrator === undefined) {
      this.vibrator = null;
      this.resolveDefault = true;
    } else {
      this.vibrator = vibrator;
      this.resolveDefault = false;
    }
    this.enabled = initialEnabled;
  }

  private getActiveVibrator(): VibrateFn | null {
    return this.resolveDefault ? getDefaultVibrator() : this.vibrator;
  }

  isSupported(): boolean {
    return this.getActiveVibrator() !== null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(next: boolean): void {
    this.enabled = next;
    if (!next) {
      this.cancel();
    }
  }

  getPattern(event: HapticEvent): number[] {
    return [...HAPTIC_PATTERNS[event].pattern];
  }

  getLastResult(): HapticTriggerResult | null {
    return this.lastResult;
  }

  subscribe(listener: HapticListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  trigger(event: HapticEvent, options: HapticTriggerOptions = {}): HapticTriggerResult {
    const meta = HAPTIC_PATTERNS[event];
    const pattern = [...meta.pattern];
    const vibrator = this.getActiveVibrator();
    const supported = vibrator !== null;
    let triggered = false;

    if (supported && (this.enabled || options.force)) {
      try {
        const ok = vibrator(pattern);
        triggered = ok !== false;
      } catch {
        triggered = false;
      }
    }

    const result: HapticTriggerResult = {
      event,
      pattern,
      label: meta.label,
      supported,
      triggered,
      timestamp: Date.now(),
    };
    this.lastResult = result;
    this.listeners.forEach((fn) => fn(result));
    return result;
  }

  cancel(): boolean {
    const vibrator = this.getActiveVibrator();
    if (!vibrator) return false;
    try {
      return vibrator(0) !== false;
    } catch {
      return false;
    }
  }
}

export function createHapticService(
  vibrator?: VibrateFn | null,
  initialEnabled = true
): HapticFeedbackService {
  return new HapticFeedbackService(vibrator, initialEnabled);
}

export function getHapticEventForWatchCommand(type: WatchCommandType): HapticEvent {
  switch (type) {
    case 'COMPLETE_NEXT_SET':
      return 'setComplete';
    case 'LOG_WATER_250':
    case 'LOG_WATER_500':
      return 'waterLog';
    case 'SYNC_TELEMETRY':
      return 'syncComplete';
    default:
      return 'tap';
  }
}

export const watchHapticService = createHapticService();
