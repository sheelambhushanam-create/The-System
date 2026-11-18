import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAPTIC_PATTERNS,
  createHapticService,
  getHapticEventForWatchCommand,
  type HapticEvent,
} from './haptics';

test('HAPTIC_PATTERNS defines distinct patterns for workout completion, rest completion, and quick events', () => {
  const workoutPattern = HAPTIC_PATTERNS.workoutComplete.pattern;
  const restPattern = HAPTIC_PATTERNS.restComplete.pattern;
  const setPattern = HAPTIC_PATTERNS.setComplete.pattern;
  const waterPattern = HAPTIC_PATTERNS.waterLog.pattern;

  // Long vibration for workout completion (>= 400ms primary pulse)
  assert.ok(workoutPattern[0] >= 400, 'workoutComplete should begin with a long vibration');

  // Short double-pulse for rest timer completion ([pulse, gap, pulse])
  assert.equal(restPattern.length, 3);
  assert.ok(restPattern[0] > 0 && restPattern[0] <= 150);
  assert.ok(restPattern[2] > 0 && restPattern[2] <= 150);

  // Patterns must be distinct across key watch events
  const serialized = new Set<string>(
    (Object.keys(HAPTIC_PATTERNS) as HapticEvent[]).map((k) =>
      HAPTIC_PATTERNS[k].pattern.join(',')
    )
  );
  assert.equal(serialized.size, Object.keys(HAPTIC_PATTERNS).length);
  assert.notDeepEqual(workoutPattern, restPattern);
  assert.notDeepEqual(restPattern, setPattern);
  assert.notDeepEqual(setPattern, waterPattern);
});

test('createHapticService triggers Vibration API with exact patterns and respects enable/disable state', () => {
  const calls: Array<number | number[]> = [];
  const service = createHapticService((pattern) => {
    calls.push(pattern);
    return true;
  }, true);

  assert.equal(service.isSupported(), true);
  assert.equal(service.isEnabled(), true);

  const restRes = service.trigger('restComplete');
  assert.equal(restRes.triggered, true);
  assert.deepEqual(restRes.pattern, HAPTIC_PATTERNS.restComplete.pattern);

  const workoutRes = service.trigger('workoutComplete');
  assert.equal(workoutRes.triggered, true);
  assert.deepEqual(workoutRes.pattern, HAPTIC_PATTERNS.workoutComplete.pattern);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [90, 65, 90]);
  assert.deepEqual(calls[1], [520, 110, 320]);

  // Disabling cancels active vibration and suppresses subsequent non-forced triggers
  service.setEnabled(false);
  assert.equal(service.isEnabled(), false);
  assert.equal(calls[2], 0);

  const suppressed = service.trigger('setComplete');
  assert.equal(suppressed.triggered, false);
  assert.equal(calls.length, 3);

  // Forced trigger still works (e.g. previewing when re-enabling)
  const forced = service.trigger('tap', { force: true });
  assert.equal(forced.triggered, true);
  assert.deepEqual(calls[3], HAPTIC_PATTERNS.tap.pattern);
});

test('createHapticService handles unsupported browsers and vibrating errors gracefully', () => {
  const unsupported = createHapticService(null);
  assert.equal(unsupported.isSupported(), false);
  const resUnsupported = unsupported.trigger('workoutComplete');
  assert.equal(resUnsupported.supported, false);
  assert.equal(resUnsupported.triggered, false);
  assert.equal(unsupported.cancel(), false);

  const throwing = createHapticService(() => {
    throw new Error('Vibration blocked before user gesture');
  });
  assert.equal(throwing.isSupported(), true);
  const resThrowing = throwing.trigger('restComplete');
  assert.equal(resThrowing.supported, true);
  assert.equal(resThrowing.triggered, false);
  assert.equal(throwing.cancel(), false);
});

test('createHapticService notifies subscribers and maps watch commands to distinct haptic events', () => {
  const observed: HapticEvent[] = [];
  const service = createHapticService(() => true);
  const unsub = service.subscribe((res) => observed.push(res.event));

  service.trigger(getHapticEventForWatchCommand('COMPLETE_NEXT_SET'));
  service.trigger(getHapticEventForWatchCommand('LOG_WATER_250'));
  service.trigger(getHapticEventForWatchCommand('SYNC_TELEMETRY'));
  service.trigger(getHapticEventForWatchCommand('ADD_REST_15'));
  unsub();
  service.trigger('error');

  assert.deepEqual(observed, ['setComplete', 'waterLog', 'syncComplete', 'tap']);
  assert.equal(service.getLastResult()?.event, 'error');
});
