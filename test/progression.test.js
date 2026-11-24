import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendExercise, trainingVolume, nextSessionSuggestion } from '../progression.js';

test('double progression advances each series by repetitions without averaging its load', () => {
  const result = recommendExercise({ exercise: { id: 'row', repMin: 8, repMax: 12, rir: 2 }, history: [
    { finished: 1, exercises: [{ id: 'row', sets: [{ done: true, kg: 10, reps: 12 }, { done: true, kg: 14, reps: 10 }, { done: true, kg: 16, reps: 8 }] }] }
  ] });
  assert.deepEqual(result.sets.map(set => [set.index, set.kg, set.reps]), [[0, 10, 12], [1, 14, 11], [2, 16, 9]]);
  assert.match(result.reason, /répétition/i);
});

test('recommendations clamp reps into the prescribed range and require the RIR target range', () => {
  const exercise = { id: 'row', repMin: 8, repMax: 12, rir: 1, rirMax: 2, prescribedSets: 1 };
  const belowRange = recommendExercise({ exercise, history: [{ finished: 1, exercises: [{ id: 'row', sets: [{ done: true, kg: 10, reps: 4 }] }] }] });
  assert.equal(belowRange.sets[0].reps, 8);
  const tooEasy = recommendExercise({ exercise, history: [{ finished: 2, exercises: [{ id: 'row', sets: [{ done: true, kg: 10, reps: 12, rir: 4, techniqueOk: true }] }] }] });
  assert.equal(tooEasy.sets[0].kg, 10);
});

test('warm-up sets marked in history are excluded from working-set recommendations', () => {
  const recommendation = recommendExercise({ exercise: { id: 'press', repMin: 8, repMax: 12, prescribedSets: 2 }, history: [
    { finished: 1, exercises: [{ id: 'press', sets: [
      { done: true, warmup: true, kg: 10, reps: 15 },
      { done: true, kg: 20, reps: 8 },
      { done: true, kg: 22, reps: 9 }
    ] }] }
  ] });
  assert.deepEqual(recommendation.sets.map(set => [set.index, set.kg, set.reps]), [[0, 20, 9], [1, 22, 10]]);
});

test('exercise history matches stable IDs across renamed labels and supports ID-less legacy records', () => {
  const current = { id: 'row-stable', name: 'Rowing assis', repMin: 8, repMax: 12 };
  const byId = recommendExercise({ exercise: current, history: [{ finished: 2, exercises: [{ id: 'row-stable', name: 'Ancien libellé', sets: [{ done: true, kg: 30, reps: 8 }] }] }] });
  const legacy = recommendExercise({ exercise: current, history: [{ finished: 1, exercises: [{ name: 'Rowing assis', sets: [{ done: true, kg: 25, reps: 9 }] }] }] });
  assert.equal(byId.sets[0].kg, 30);
  assert.equal(legacy.sets[0].kg, 25);
});

test('load progression requires top-of-range reps, reported RIR, and clean technique', () => {
  const exercise = { id: 'row', repMin: 8, repMax: 12, rir: 2, loadIncrementKg: 2.5 };
  const sets = [1, 2, 3].map(() => ({ done: true, kg: 20, reps: 12, rir: 2, techniqueOk: true }));
  const result = recommendExercise({ exercise, history: [{ finished: 1, exercises: [{ id: 'row', sets }] }] });
  assert.deepEqual(result.sets.map(set => [set.index, set.kg, set.reps]), [[0, 22.5, 8], [1, 22.5, 8], [2, 22.5, 8]]);
  assert.equal(recommendExercise({ exercise, history: [{ finished: 1, exercises: [{ id: 'row', sets: sets.map(set => ({ ...set, techniqueOk: false })) }] }] }).sets[0].kg, 20);
  const oneSetOnly = recommendExercise({ exercise: { ...exercise, prescribedSets: 3 }, history: [{ finished: 2, exercises: [{ id: 'row', sets: [{ ...sets[0] }] }] }] });
  assert.equal(oneSetOnly.sets[0].kg, 20);
  assert.equal(recommendExercise({ exercise, history: [{ finished: 3, exercises: [{ id: 'row', sets: sets.map(set => ({ ...set, rir: '' })) }] }] }).sets[0].kg, 20);
});

test('bodyweight pull-up suggestions ignore ambiguous legacy kilogram values', () => {
  const result = recommendExercise({ exercise: { id: 'pullup-pronated', repMin: 6, repMax: 10 }, history: [{ finished: 1, exercises: [
    { id: 'pullup-pronated', sets: [{ done: true, kg: 70, reps: 10 }] }] }
  ], loadMode: 'bodyweight' });
  assert.deepEqual(result.sets, []);
  assert.equal(result.previous, null);
});

test('bodyweight progress uses repetitions and assisted progress reduces assistance only after criteria', () => {
  const bodyweight = recommendExercise({ exercise: { id: 'pullup-pronated', repMin: 6, repMax: 10, rir: 2 }, loadMode: 'bodyweight', history: [{ finished: 1, exercises: [
    { id: 'pullup-pronated', sets: [{ done: true, loadMode: 'bodyweight', reps: 8, rir: 2 }] }] }
  ] });
  assert.deepEqual(bodyweight.sets, [{ reps: 9, index: 0, loadMode: 'bodyweight' }]);
  const assisted = recommendExercise({ exercise: { id: 'assisted-pullup', repMin: 8, repMax: 12, rir: 2 }, loadMode: 'assisted', history: [{ finished: 1, exercises: [
    { id: 'assisted-pullup', sets: [{ done: true, loadMode: 'assisted', kg: 25, reps: 12, rir: 2, techniqueOk: true }] }] }
  ] });
  assert.deepEqual(assisted.sets, [{ kg: 22.5, reps: 8, index: 0, loadMode: 'assisted' }]);
});

test('mixed pull-up modes retain series identity and progress without converting their loads', () => {
  const exercise = { id: 'pullup-pronated', repMin: 6, repMax: 10, rir: 2, prescribedSets: 3,
    sets: [{ loadMode: 'bodyweight' }, { loadMode: 'assisted' }, { loadMode: 'weighted' }] };
  const history = [{ finished: 1, exercises: [{ id: 'pullup-pronated', sets: [
    { done: true, loadMode: 'bodyweight', reps: 10, rir: 2, techniqueOk: true },
    { done: true, loadMode: 'assisted', kg: 25, reps: 10, rir: 2, techniqueOk: true },
    { done: true, loadMode: 'weighted', kg: 5, reps: 10, rir: 2, techniqueOk: true }
  ] }] }];
  const result = recommendExercise({ exercise, history, loadMode: 'auto' });
  assert.deepEqual(result.sets.map(set => [set.index, set.loadMode, set.kg ?? null, set.reps]), [
    [0, 'bodyweight', null, 10], [1, 'assisted', 22.5, 6], [2, 'weighted', 7.5, 6]
  ]);
});

test('volume separates external load, bodyweight reps and assisted work without interpreting legacy pull-up kilograms', () => {
  const volume = trainingVolume([{ finished: 1, exercises: [
    { id: 'bench', sets: [{ done: true, kg: 40, reps: 8 }] },
    { id: 'pullup-pronated', sets: [{ done: true, kg: 70, reps: 10 }] },
    { id: 'pullup-pronated', sets: [{ done: true, loadMode: 'bodyweight', reps: 8 }] },
    { id: 'assisted-pullup', sets: [{ done: true, loadMode: 'assisted', kg: 25, reps: 8 }] }
  ] }]);
  assert.deepEqual(volume, { externalLoadKg: 320, bodyweightReps: 8, assistedReps: 8, weightedPullupKg: 0, timedSeconds: 0, ambiguousLegacySets: 1 });
});

test('timed exercises progress by seconds and do not inflate kilogram volume', () => {
  const recommendation = recommendExercise({ exercise: { id: 'plank', repMin: 30, repMax: 60, repUnit: 'seconds' }, history: [
    { finished: 1, exercises: [{ id: 'plank', repUnit: 'seconds', sets: [{ done: true, reps: 35, kg: 5 }] }] }
  ] });
  assert.equal(recommendation.sets[0].reps, 40);
  assert.equal(trainingVolume([{ finished: 1, exercises: [{ id: 'plank', repUnit: 'seconds', sets: [{ done: true, reps: 35, kg: 5 }] }] }]).timedSeconds, 35);
});

test('next session follows the active cycle history and wraps to the first session', () => {
  const cycle = { id: 'cycle-a', programSnapshot: { sessions: [{ id: 'upper-a' }, { id: 'lower-a' }, { id: 'upper-b' }, { id: 'lower-b' }] } };
  const sessions = [{ cycleId: 'other', sessionId: 'lower-b', finished: 99 }, { cycleId: 'cycle-a', sessionId: 'upper-a', finished: 100 }];
  assert.equal(nextSessionSuggestion(cycle, sessions), 'lower-a');
  assert.equal(nextSessionSuggestion(cycle, [...sessions, { cycleId: 'cycle-a', sessionId: 'lower-b', finished: 101 }]), 'upper-a');
});
