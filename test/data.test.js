import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DB_VERSION,
  STORE_NAMES,
  configureDatabase,
  databaseNameForProfile,
  createCycle,
  createTrainingSession,
  currentCycleWeek,
  validateProgram,
  validateBackup,
  makeBackup,
  matchExerciseByStableId,
  openDatabase,
  parseProgramJson,
  programStatus,
  saveProgramJson
} from '../data.js';

const program = {
  id: 'rochdi-program-01',
  profileId: 'me',
  name: 'Programme test',
  description: 'Programme de test',
  durationWeeks: 8,
  revision: 1,
  status: 'available',
  sessions: [['upper-a', 'Upper A'], ['lower-a', 'Lower A'], ['upper-b', 'Upper B'], ['lower-b', 'Lower B']].map(([id, name]) => ({ id, name, exercises: [] }))
};

test('V2 defines dedicated stores for programs, cycles, sessions and profile state', () => {
  assert.equal(DB_VERSION, 3);
  assert.deepEqual(STORE_NAMES, ['programs', 'cycles', 'sessions', 'profileState', 'meta', 'outbox', 'syncMeta']);
});

test('Rochdi and Rania resolve to separate IndexedDB databases', () => {
  assert.equal(databaseNameForProfile('me'), 'forgefit-db');
  assert.equal(databaseNameForProfile('wife'), 'forgefit-wife-db');
  assert.notEqual(databaseNameForProfile('me'), databaseNameForProfile('wife'));
  assert.throws(() => databaseNameForProfile('unknown'), /profil invalide/i);
});

test('an empty database upgrade creates all V2 stores', () => {
  const db = fakeDatabase([]);
  configureDatabase(db, 0);
  assert.deepEqual([...db.objectStoreNames], STORE_NAMES);
});

test('future IndexedDB upgrades preserve existing V2 stores', () => {
  const db = fakeDatabase(STORE_NAMES);
  configureDatabase(db, 2);
  assert.deepEqual([...db.objectStoreNames], STORE_NAMES);
  assert.equal(db.deleted.length, 0);
});

test('opening an older profile database adds V2 and sync stores without deleting existing stores', async () => {
  const previousIndexedDB = globalThis.indexedDB;
  const db = fakeDatabase(['routines', 'sessions', 'meta']);
  const wifeDb = fakeDatabase([]);
  db.close = wifeDb.close = () => {};
  const openedNames = [];
  globalThis.indexedDB = fakeIndexedDB(new Map([['forgefit-db', db], ['forgefit-wife-db', wifeDb]]), { 'forgefit-db': 1, 'forgefit-wife-db': 0 }, openedNames);
  try {
    const [opened, openedWife] = await Promise.all([openDatabase('me'), openDatabase('wife')]);
    assert.equal(opened, db);
    assert.equal(openedWife, wifeDb);
    assert.notEqual(opened, openedWife);
    assert.deepEqual(openedNames, ['forgefit-db', 'forgefit-wife-db']);
    assert.deepEqual(db.deleted, []);
    assert.deepEqual([...db.objectStoreNames].sort(), [...STORE_NAMES, 'routines'].sort());
    assert.deepEqual([...wifeDb.objectStoreNames], STORE_NAMES);
  } finally {
    globalThis.indexedDB = previousIndexedDB;
  }
});

test('validates stable program identifiers and exactly four named sessions', () => {
  assert.equal(validateProgram(program).id, program.id);
  assert.throws(() => validateProgram({ ...program, sessions: program.sessions.slice(1) }), /quatre séances/i);
  assert.throws(() => validateProgram({ ...program, id: '' }), /identifiant/i);
});

test('creates an active cycle with a frozen program snapshot and default duration', () => {
  const cycle = createCycle(program, 1_000);
  assert.equal(cycle.profileId, 'me');
  assert.equal(cycle.status, 'active');
  assert.equal(cycle.startedAt, 1_000);
  assert.equal(cycle.targetWeeks, 8);
  assert.deepEqual(cycle.programSnapshot, program);
  assert.notEqual(cycle.programSnapshot, program);
});

test('calculates the current cycle week from its start date and target duration', () => {
  const cycle = { startedAt: Date.UTC(2026, 0, 1), targetWeeks: 8 };
  assert.equal(currentCycleWeek(cycle, cycle.startedAt), 1);
  assert.equal(currentCycleWeek(cycle, cycle.startedAt + 7 * 86_400_000), 2);
  assert.equal(currentCycleWeek(cycle, cycle.startedAt + 56 * 86_400_000), 9);
  assert.equal(currentCycleWeek(cycle, cycle.startedAt + 90 * 86_400_000), 13);
});

test('starts a session from the frozen cycle snapshot with stable exercise ids', () => {
  const template = { ...program, sessions: program.sessions.map((session, index) => ({ ...session, name: ['Upper A', 'Lower A', 'Upper B', 'Lower B'][index], exercises: index === 0 ? [{ id: 'bench-press', name: 'Développé', sets: 2, repMin: 6, repMax: 8, rir: 2, restSeconds: 90 }] : [] })) };
  const cycle = createCycle(template, 100, 'cycle-1');
  const session = createTrainingSession(cycle, 'upper-a', 200, 'session-1');
  assert.equal(session.programId, template.id);
  assert.equal(session.cycleId, cycle.id);
  assert.equal(session.exercises[0].id, 'bench-press');
  assert.deepEqual(session.exercises[0].sets, [{ kg: '', reps: 6, done: false }, { kg: '', reps: 6, done: false }]);
  assert.throws(() => createTrainingSession({ ...cycle, status: 'completed' }, 'upper-a'), /cycle actif/i);
});

test('performance matching uses stable exercise ids and falls back to name only for id-less history', () => {
  const oldSameName = { id: 'different-exercise', name: 'Row' };
  const oldLegacy = { name: 'Row' };
  assert.equal(matchExerciseByStableId([oldSameName], 'stable-row', 'Row'), null);
  assert.equal(matchExerciseByStableId([oldLegacy], 'stable-row', 'Row'), oldLegacy);
  assert.equal(matchExerciseByStableId([oldSameName], 'different-exercise', 'Row'), oldSameName);
});

test('V2 backup includes all profile data and rejects another profile', () => {
  const backup = makeBackup({ profileId: 'me', programs: [program], cycles: [], sessions: [], profileState: { profileId: 'me', activeCycleId: null }, activeSession: null }, 2_000);
  assert.equal(validateBackup(backup, 'me').profileId, 'me');
  assert.equal(backup.version, 2);
  assert.throws(() => validateBackup(backup, 'wife'), /autre profil/i);
  assert.throws(() => validateBackup({ ...backup, programs: [{ ...program, sessions: [] }] }, 'me'), /quatre séances/i);
});

test('an empty profile can be exported and imported as a valid V2 backup', () => {
  const empty = makeBackup({ profileId: 'wife', programs: [], cycles: [], sessions: [], profileState: { profileId: 'wife', activeCycleId: null }, activeSession: null }, 3_000);
  assert.equal(validateBackup(empty, 'wife').programs.length, 0);
  assert.equal(empty.cycles.length, 0);
  assert.equal(empty.sessions.length, 0);
});

test('a backup cannot contain an active cycle without matching profile state', () => {
  const active = createCycle(program, 100, 'active-cycle');
  const backup = { app: 'ROCH&RANIA FIT', version: 2, exportedAt: new Date(200).toISOString(), profileId: 'me', programs: [program], cycles: [active], sessions: [], activeSession: null };
  assert.throws(() => validateBackup(backup, 'me'), /état du profil|cycle actif/i);
});

test('six separately identified programs fit the same import format', () => {
  const sixPrograms = Array.from({ length: 6 }, (_, index) => ({ ...structuredClone(program), id: `rochdi-program-${index + 1}` }));
  const backup = makeBackup({ profileId: 'me', programs: sixPrograms, cycles: [], sessions: [], profileState: { profileId: 'me', activeCycleId: null }, activeSession: null });
  assert.equal(validateBackup(backup, 'me').programs.length, 6);
});

test('a program can be imported independently without requiring a full backup', () => {
  const imported = parseProgramJson(JSON.stringify(program), 'me');
  assert.equal(imported.id, program.id);
  assert.equal(programStatus(imported, [], null), 'available');
  assert.throws(() => parseProgramJson('{invalid json', 'me'), /JSON invalide/i);
  assert.throws(() => parseProgramJson(JSON.stringify({ ...program, profileId: 'wife' }), 'me'), /profil/i);
});

test('program status reflects active, previously used and archived programs', () => {
  assert.equal(programStatus(program, [{ id: 'cycle-1', programId: program.id }], 'cycle-1'), 'active');
  assert.equal(programStatus(program, [{ id: 'cycle-2', programId: program.id }], null), 'used');
  assert.equal(programStatus({ ...program, status: 'archived' }, [], null), 'archived');
});

test('saving a program writes only that program and never imports a full backup', async () => {
  const saved = [];
  const repository = {
    putProgram: async value => saved.push(value),
    importBackup: async () => { throw new Error('Full backup import must not be used'); }
  };
  await saveProgramJson(repository, JSON.stringify(program), 'me');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, program.id);
});

test('program editor keeps its identifier stable and rejects invalid edits before writing', async () => {
  const saved = [];
  const repository = { putProgram: async value => saved.push(value) };
  await assert.rejects(saveProgramJson(repository, JSON.stringify({ ...program, id: 'replacement-id' }), 'me', program.id), /identifiant/i);
  await assert.rejects(saveProgramJson(repository, '{broken', 'me', program.id), /json invalide/i);
  assert.equal(saved.length, 0);
});

test('the application exposes program management navigation, JSON editing and cycle actions', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(html, /data-page="programs"/);
  assert.match(app, /const pages = \{ home, programs, calendar, workout, progress, settings \}/);
  assert.match(app, /id="program-file"/);
  assert.match(app, /data-program-editor=/);
  assert.match(app, /data-action="extend-cycle"/);
  assert.match(app, /data-action="end-cycle"/);
  assert.match(app, /data-action="start-session"/);
});

test('a populated V2 backup round-trips programs, cycles, stable exercise ids and sessions', () => {
  const populatedProgram = { ...structuredClone(program), sessions: program.sessions.map((session, index) => ({
    ...session,
    exercises: index === 0 ? [{ id: 'stable-row-id', name: 'Row', sets: 1, repMin: 8, repMax: 12, rir: 2, restSeconds: 90 }] : []
  })) };
  const cycle = createCycle(populatedProgram, 100, 'cycle-1');
  const activeSession = createTrainingSession(cycle, 'upper-a', 200, 'session-1');
  activeSession.exercises[0].sets[0] = { kg: 40, reps: 10, done: true };
  activeSession.finished = 300;
  const backup = makeBackup({ profileId: 'me', programs: [populatedProgram], cycles: [{ ...cycle, status: 'completed', endedAt: 300 }], sessions: [activeSession], profileState: { profileId: 'me', activeCycleId: null }, activeSession: null }, 400);
  const parsedJson = JSON.parse(JSON.stringify(backup));
  assert.equal(validateBackup(parsedJson, 'me').sessions[0].exercises[0].id, 'stable-row-id');
  assert.equal(parsedJson.sessions[0].cycleId, 'cycle-1');
});

test('the service worker pre-caches the module at paths relative to a GitHub Pages subdirectory', async () => {
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const assetsSource = worker.match(/const ASSETS=\[(.*?)\]/)?.[1] || '';
  const assets = [...assetsSource.matchAll(/'([^']+)'/g)].map(match => match[1]);
  const deploymentBase = 'https://example.github.io/couple-fit/sw.js';
  const cachedUrls = assets.map(asset => new URL(asset, deploymentBase).pathname);
  assert.ok(app.includes("from './data.js'"));
  assert.ok(assets.includes('./app.js') && assets.includes('./data.js'));
  assert.ok(cachedUrls.includes('/couple-fit/app.js') && cachedUrls.includes('/couple-fit/data.js'));
  assert.ok(cachedUrls.every(path => path.startsWith('/couple-fit/')));
});

function fakeDatabase(names) {
  const stores = new Set(names);
  const db = {
    deleted: [],
    get objectStoreNames() { return [...stores]; },
    deleteObjectStore(name) { db.deleted.push(name); stores.delete(name); },
    createObjectStore(name) { stores.add(name); }
  };
  return db;
}

function fakeIndexedDB(databases, oldVersions, openedNames) {
  return {
    open(name) {
      openedNames.push(name);
      const db = databases.get(name), oldVersion = oldVersions[name];
      const request = { result: db, error: null };
      queueMicrotask(() => {
        request.onupgradeneeded?.({ oldVersion });
        queueMicrotask(() => request.onsuccess?.());
      });
      return request;
    }
  };
}
