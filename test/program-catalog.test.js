import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUILTIN_PROGRAMS } from '../programs-v2.js';
import { validateProgram } from '../data.js';

const source = await readFile(new URL('../PROGRAMMES_V2_SOURCE.md', import.meta.url), 'utf8');

function sourcePrograms() {
  const result = { me: [], wife: [] };
  let currentProgram = null, currentSession = null;
  for (const line of source.split('\n')) {
    const programMatch = line.match(/^## (ROCHDI|RANIA) — Programme (\d+)\s*:\s*(.+)$/);
    if (programMatch) {
      const profileId = programMatch[1] === 'ROCHDI' ? 'me' : 'wife';
      currentProgram = { profileId, number: Number(programMatch[2]), name: programMatch[3], sessions: [] };
      result[profileId].push(currentProgram); currentSession = null; continue;
    }
    if (/^## /.test(line)) { currentProgram = null; currentSession = null; continue; }
    const sessionMatch = line.match(/^### (Upper A|Lower A|Upper B|Lower B)$/);
    if (sessionMatch && currentProgram) {
      const id = sessionMatch[1].toLowerCase().replace(' ', '-');
      currentSession = { id, name: sessionMatch[1], exercises: [] };
      currentProgram.sessions.push(currentSession); continue;
    }
    if (!currentSession) continue;
    const row = line.match(/^\|\s*([^|]+)\|\s*([^|]+)\|\s*(\d+)\s*\|\s*([^|]+)\|\s*(\d+)\s*s\s*\|\s*([^|]+)\|$/);
    if (!row || row[1].trim() === 'ID' || row[1].trim() === '---') continue;
    const repMatch = row[4].match(/(\d+)\s*[–-]\s*(\d+)/);
    const rirValues = [...row[6].matchAll(/\d+/g)].map(match => Number(match[0]));
    currentSession.exercises.push({
      id: row[1].trim(), name: row[2].trim(), sets: Number(row[3]),
      repMin: Number(repMatch[1]), repMax: Number(repMatch[2]), restSeconds: Number(row[5]),
      rir: rirValues[0], ...(rirValues[1] === undefined ? {} : { rirMax: rirValues[1] }),
      ...(row[4].includes('s') ? { repUnit: 'seconds' } : {}),
      ...(row[4].includes('jambe') ? { repQualifier: 'par jambe' } : {})
    });
  }
  return result;
}

test('catalogue contient exactement trois programmes indépendants et quatre séances par profil', () => {
  for (const profileId of ['me', 'wife']) {
    assert.equal(BUILTIN_PROGRAMS[profileId].length, 3);
    assert.equal(new Set(BUILTIN_PROGRAMS[profileId].map(program => program.id)).size, 3);
    for (const program of BUILTIN_PROGRAMS[profileId]) {
      assert.equal(program.profileId, profileId);
      assert.equal(program.durationWeeks, 8);
      assert.equal(program.status, 'available');
      assert.doesNotThrow(() => validateProgram(program, profileId));
      assert.deepEqual(program.sessions.map(session => [session.id, session.name]), [
        ['upper-a', 'Upper A'], ['lower-a', 'Lower A'], ['upper-b', 'Upper B'], ['lower-b', 'Lower B']
      ]);
    }
  }
});

test('exercise IDs and all prescribed values match the Markdown for all six programs', () => {
  const expected = sourcePrograms();
  for (const profileId of ['me', 'wife']) {
    for (let index = 0; index < 3; index++) {
      const actual = BUILTIN_PROGRAMS[profileId][index];
      const fromMarkdown = expected[profileId][index];
      assert.equal(actual.name, fromMarkdown.name);
      assert.equal(actual.id, `${profileId}-${['foundations-hypertrophy', 'hypertrophy-progression', 'upper-specialization'][index]}-v1`);
      assert.deepEqual(actual.sessions.map(session => session.name), fromMarkdown.sessions.map(session => session.name));
      for (let sessionIndex = 0; sessionIndex < 4; sessionIndex++) {
        const actualExercises = actual.sessions[sessionIndex].exercises;
        const expectedExercises = fromMarkdown.sessions[sessionIndex].exercises;
        assert.equal(actualExercises.length, expectedExercises.length, `${profileId} programme ${index + 1} ${fromMarkdown.sessions[sessionIndex].name}`);
        for (let exerciseIndex = 0; exerciseIndex < expectedExercises.length; exerciseIndex++) {
          const exercise = actualExercises[exerciseIndex];
          const expectedExercise = expectedExercises[exerciseIndex];
          for (const key of ['id', 'name', 'sets', 'repMin', 'repMax', 'restSeconds', 'rir', 'rirMax', 'repUnit', 'repQualifier']) {
            assert.equal(exercise[key], expectedExercise[key], `${profileId}/${index + 1}/${fromMarkdown.sessions[sessionIndex].name}/${expectedExercise.id}/${key}`);
          }
        }
      }
    }
  }
});

test('exercise IDs remain stable when the same exercise appears across several programs', () => {
  for (const profileId of ['me', 'wife']) {
    const idsByName = new Map();
    for (const program of BUILTIN_PROGRAMS[profileId]) for (const session of program.sessions) for (const exercise of session.exercises) {
      const priorId = idsByName.get(exercise.name);
      if (priorId) assert.equal(exercise.id, priorId);
      idsByName.set(exercise.name, exercise.id);
    }
    assert.ok(idsByName.size > 15);
  }
});

test('every downloaded inventory association resolves to an unchanged static JPG and is scoped to the requested profile', async () => {
  const inventory = JSON.parse(await readFile(new URL('../images/exercises/exercise-images.json', import.meta.url), 'utf8'));
  for (const profileId of ['me', 'wife']) {
    const sourceInventory = JSON.parse(await readFile(new URL('../ROCH_RANIA_EXERCISE_IMAGES/exercise-images.json', import.meta.url), 'utf8'));
    const expected = sourceInventory.profiles[profileId].exercises.filter(item => item.status === 'matched_downloaded');
    assert.equal(inventory.profiles[profileId].exercises.length, sourceInventory.profiles[profileId].exercises.length);
    for (const exercise of expected) {
      const entry = inventory.profiles[profileId].exercises.find(item => item.exerciseId === exercise.exerciseId);
      assert.deepEqual(entry.files, exercise.files);
      for (const file of entry.files) {
        const bytes = await readFile(new URL(`../images/exercises/${file}`, import.meta.url));
        const originalBytes = await readFile(new URL(`../ROCH_RANIA_EXERCISE_IMAGES/${file}`, import.meta.url));
        assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
        assert.deepEqual(bytes, originalBytes, `${file} must remain byte-for-byte identical to its source JPG`);
      }
    }
  }
});

test('application seeds after sync initialization and resolves photos with an explicit missing-image placeholder', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /import \{ BUILTIN_PROGRAMS \} from '\.\/programs-v2\.js'/);
  assert.match(app, /ensureBuiltInPrograms\(BUILTIN_PROGRAMS\[dbRepository\.profileId\]/);
  assert.match(app, /\['needs-decision', 'conflict'\]/);
  assert.match(app, /Photo non disponible/);
  assert.match(app, /images\/exercises\/\$\{esc\(file\)\}/);
  assert.match(app, /data-action="finish-session"/);
});
