import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRemainingSeconds, remainingRestSeconds, restProgress } from '../rest-timer.js';

test('rest display uses a deadline and formats minutes and seconds', () => {
  assert.equal(remainingRestSeconds(61_000, 1_000), 60);
  assert.equal(formatRemainingSeconds(61), '01:01');
  assert.equal(remainingRestSeconds(999, 1_000), 0);
});

test('rest progress is clamped and restarts correctly with a later deadline', () => {
  assert.equal(restProgress(11_000, 10, 1_000), 1);
  assert.equal(restProgress(6_000, 10, 1_000), 0.5);
  assert.equal(restProgress(41_000, 40, 1_000), 1);
});
