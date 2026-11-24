import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, makeBackup, configureDatabase } from '../data.js';

class MemoryDatabase {
  constructor(seed = {}) {
    this.stores = new Map(Object.entries(seed).map(([name, values]) => [name, new Map(values.map(value => [value.sequence ?? value.id ?? value.profileId, structuredClone(value)]))]));
    for (const name of ['programs', 'cycles', 'sessions', 'profileState', 'meta', 'outbox', 'syncMeta']) if (!this.stores.has(name)) this.stores.set(name, new Map());
    this.keyPaths = { programs: 'id', cycles: 'id', sessions: 'id', profileState: 'profileId', meta: 'id', outbox: 'sequence', syncMeta: 'id' };
    this.autoSequence = 1;
    this.transactions = [];
  }
  transaction(names) {
    const list = Array.isArray(names) ? names : [names];
    const tx = { names: [...list], pending: 0, aborted: false, scheduled: false, objectStore: name => {
      if (!list.includes(name)) throw new Error(`Store ${name} hors transaction`);
      const values = this.stores.get(name), keyPath = this.keyPaths[name];
      const request = operation => {
        const result = { result: undefined, error: null };
        tx.pending++;
        queueMicrotask(() => {
          if (tx.aborted) return;
          try { result.result = operation(); result.onsuccess?.(); }
          catch (error) { result.error = error; result.onerror?.(); }
          tx.pending--;
          scheduleCompletion();
        });
        return result;
      };
      const store = {
        get: key => request(() => structuredClone(values.get(key))),
        getAll: () => request(() => [...values.values()].map(value => structuredClone(value))),
        put: value => request(() => { const copy = structuredClone(value); if (name === 'outbox' && copy.sequence == null) copy.sequence = this.autoSequence++; values.set(copy[keyPath], copy); return copy[keyPath]; }),
        add: value => request(() => { const copy = structuredClone(value); if (name === 'outbox' && copy.sequence == null) copy.sequence = this.autoSequence++; if (values.has(copy[keyPath])) throw new Error('ConstraintError'); values.set(copy[keyPath], copy); return copy[keyPath]; }),
        delete: key => request(() => values.delete(key)),
        clear: () => request(() => values.clear())
      };
      return store;
    }, abort: () => { tx.aborted = true; queueMicrotask(() => tx.onabort?.()); } };
    const scheduleCompletion = () => {
      if (tx.scheduled || tx.pending || tx.aborted) return;
      tx.scheduled = true;
      setTimeout(() => { tx.scheduled = false; if (!tx.pending && !tx.aborted) tx.oncomplete?.(); }, 0);
    };
    this.transactions.push(tx);
    return tx;
  }
  close() {}
}

const program = { id: 'prog-a', profileId: 'me', name: 'Programme test', durationWeeks: 8, revision: 1, sessions: [
  ['upper-a', 'Upper A'], ['lower-a', 'Lower A'], ['upper-b', 'Upper B'], ['lower-b', 'Lower B']
].map(([id, name]) => ({ id, name, exercises: [] })) };

test('saving a program stores its durable outbox operation in the same IndexedDB transaction', async () => {
  const db = new MemoryDatabase();
  const repo = createRepository(db, 'me', { makeId: () => 'op-program', now: () => 100 });
  await repo.putProgram(program);
  const tx = db.transactions.at(-1);
  assert.ok(tx.names.includes('programs') && tx.names.includes('outbox'));
  const outbox = [...db.stores.get('outbox').values()][0];
  assert.equal(db.stores.get('programs').get(program.id).name, 'Programme test');
  assert.equal(outbox.opId, 'op-program');
  assert.deepEqual(outbox.changes[0], { entity: 'program', record_id: 'prog-a', deleted: false, payload: { ...program, createdAt: 100, updatedAt: 100 } });
});

test('built-in programs are inserted only when missing after initial sync and preserved on repeated startup', async () => {
  const presetOne = { ...program, id: 'me-foundations-hypertrophy-v1', name: 'Fondations hypertrophie' };
  const presetTwo = { ...program, id: 'me-hypertrophy-progression-v1', name: 'Progression hypertrophie' };
  const customized = { ...presetOne, name: 'Mon programme personnalisé', revision: 7 };
  const history = { id: 'finished-workout', profileId: 'me', cycleId: 'cycle-history', programId: presetOne.id, finished: 500, exercises: [] };
  const db = new MemoryDatabase({ programs: [customized], sessions: [history], syncMeta: [{ id: 'initialized', value: true }] });
  const repo = createRepository(db, 'me', { makeId: () => 'preset-op', now: () => 600 });
  assert.deepEqual(await repo.ensureBuiltInPrograms([presetOne, presetTwo]), [presetTwo.id]);
  assert.deepEqual(await repo.ensureBuiltInPrograms([presetOne, presetTwo]), []);
  assert.equal(db.stores.get('programs').get(presetOne.id).name, customized.name);
  assert.equal(db.stores.get('programs').get(presetTwo.id).name, presetTwo.name);
  assert.equal(db.stores.get('sessions').get(history.id).id, history.id);
  const operations = [...db.stores.get('outbox').values()];
  assert.equal(operations.length, 1);
  assert.equal(operations[0].opId, 'preset-op');
  assert.deepEqual(operations[0].changes.map(change => change.record_id), [presetTwo.id]);
  const tx = db.transactions.at(-2);
  assert.ok(['programs', 'syncMeta', 'outbox'].every(name => tx.names.includes(name)));
});

test('built-in program seeding waits until the initial sync decision has initialized the profile', async () => {
  const preset = { ...program, id: 'me-foundations-hypertrophy-v1' };
  const db = new MemoryDatabase();
  const repo = createRepository(db, 'me');
  assert.deepEqual(await repo.ensureBuiltInPrograms([preset]), []);
  assert.equal(db.stores.get('programs').size, 0);
  assert.equal(db.stores.get('outbox').size, 0);
});

test('a workout started from a built-in session can record set values and finish into history', async () => {
  const exercise = { id: 'bench-press-stable', name: 'Développé couché', sets: 1, repMin: 6, repMax: 8, rir: 2, restSeconds: 90 };
  const workoutProgram = { ...program, sessions: program.sessions.map((session, index) => ({ ...session, exercises: index === 0 ? [exercise] : [] })) };
  const db = new MemoryDatabase({ programs: [workoutProgram] });
  let id = 0;
  const repo = createRepository(db, 'me', { makeId: () => `record-${++id}`, now: () => 1234 });
  const cycle = await repo.startCycle(workoutProgram.id);
  const active = await repo.startSession('upper-a');
  active.exercises[0].sets[0].kg = 40;
  active.exercises[0].sets[0].reps = 8;
  active.exercises[0].sets[0].rir = 2;
  active.exercises[0].sets[0].techniqueOk = true;
  active.exercises[0].sets[0].done = true;
  await repo.saveActiveSession(active);
  const completed = await repo.finishSession();
  assert.equal(completed.cycleId, cycle.id);
  assert.equal(completed.exercises[0].id, exercise.id);
  assert.deepEqual(completed.exercises[0].sets[0], { kg: 40, reps: 8, rir: 2, techniqueOk: true, done: true });
  assert.equal((await repo.listSessions()).length, 1);
  assert.equal(await repo.getActiveSession(), null);
  const finishOutbox = [...db.stores.get('outbox').values()].at(-1);
  assert.deepEqual(finishOutbox.changes.map(change => change.entity), ['session', 'active_session']);
});

test('mode-specific set data, RIR, and rest deadline survive JSON backup and local restoration', async () => {
  const active = { id: 'active-pullup', profileId: 'me', programId: 'prog-a', cycleId: 'cycle-a', sessionId: 'upper-a', started: 100, finished: null,
    exercises: [{ id: 'pullup-pronated', name: 'Tractions', repUnit: 'reps', prescribedSets: 1,
      sets: [{ kg: 2.5, reps: 8, loadMode: 'weighted', rir: 2, techniqueOk: true, done: false }] }] };
  const source = new MemoryDatabase({ meta: [{ id: 'activeSession', data: active }, { id: 'rest', until: 5000, durationSeconds: 90 }] });
  const sourceRepo = createRepository(source, 'me');
  const backup = await sourceRepo.snapshot();
  assert.deepEqual(backup.activeSession, active);
  assert.equal(backup.restDurationSeconds, 90);
  const destination = new MemoryDatabase();
  const destinationRepo = createRepository(destination, 'me');
  await destinationRepo.importBackup(backup);
  assert.deepEqual(await destinationRepo.getActiveSession(), active);
  assert.deepEqual(await destinationRepo.getRestTimer(), { until: 5000, durationSeconds: 90 });
});

test('cycle activation queues cycle and profile state atomically', async () => {
  const db = new MemoryDatabase({ programs: [program] });
  const repo = createRepository(db, 'me', { makeId: () => 'cycle-a', now: () => 200 });
  await repo.startCycle(program.id);
  const tx = db.transactions.at(-1);
  assert.ok(['cycles', 'profileState', 'outbox'].every(name => tx.names.includes(name)));
  const operation = [...db.stores.get('outbox').values()][0];
  assert.deepEqual(operation.changes.map(change => change.entity), ['cycle', 'profile_state']);
  assert.equal(operation.changes[1].payload.activeCycleId, 'cycle-a');
});

test('finishing a workout queues its completed record and active-slot tombstone in one transaction', async () => {
  const active = { id: 'workout-a', profileId: 'me', programId: 'prog-a', cycleId: 'cycle-a', finished: null, exercises: [] };
  const db = new MemoryDatabase({ meta: [{ id: 'activeSession', data: active }] });
  const repo = createRepository(db, 'me', { makeId: () => 'finish-op', now: () => 300 });
  const finished = await repo.finishSession();
  const tx = db.transactions.at(-1), operation = [...db.stores.get('outbox').values()][0];
  assert.ok(['sessions', 'meta', 'outbox'].every(name => tx.names.includes(name)));
  assert.equal(db.stores.get('sessions').get('workout-a').finished, 300);
  assert.deepEqual(operation.changes.map(change => [change.entity, change.deleted]), [['session', false], ['active_session', true]]);
  assert.equal(finished.finished, 300);
});

test('JSON import refuses to clear a pending outbox operation', async () => {
  const pending = { opId: 'pending-op', sequence: 1, profileId: 'me', changes: [] };
  const db = new MemoryDatabase({ outbox: [pending], programs: [program] });
  const repo = createRepository(db, 'me');
  const backup = makeBackup({ profileId: 'me', programs: [], cycles: [], sessions: [], profileState: { profileId: 'me', activeCycleId: null } });
  await assert.rejects(repo.importBackup(backup), /opérations locales en attente/i);
  assert.equal(db.stores.get('programs').has(program.id), true);
  assert.equal(db.stores.get('outbox').get(1).opId, 'pending-op');
});

test('a synchronized JSON import writes its data changes and outbox batches together', async () => {
  const db = new MemoryDatabase({ programs: [program], syncMeta: [{ id: 'initialized', value: true }] });
  const repo = createRepository(db, 'me', { makeId: () => 'import-op', now: () => 400 });
  const imported = makeBackup({ profileId: 'me', programs: [{ ...program, name: 'Importé', revision: 2 }], cycles: [], sessions: [], profileState: { profileId: 'me', activeCycleId: null } });
  await repo.importBackup(imported);
  const tx = db.transactions.at(-1), operations = [...db.stores.get('outbox').values()];
  assert.ok(tx.names.includes('programs') && tx.names.includes('outbox'));
  assert.equal(db.stores.get('programs').get(program.id).name, 'Importé');
  assert.equal(operations.length, 1);
  assert.equal(operations[0].changes[0].payload.name, 'Importé');
});

test('prepared operation freezes the server version and acknowledgement advances it atomically', async () => {
  const op = { opId: 'op-v', profileId: 'me', sequence: 1, changes: [{ entity: 'program', record_id: 'prog-a', deleted: false, payload: program }], status: 'pending' };
  const db = new MemoryDatabase({ outbox: [op], syncMeta: [{ id: 'version/program/prog-a', value: 7 }] });
  const repo = createRepository(db, 'me');
  const prepared = await repo.prepareOutboxOperation('op-v');
  assert.equal(prepared.changes[0].expected_version, 7);
  assert.equal((await repo.prepareOutboxOperation('op-v')).changes[0].expected_version, 7);
  await repo.acknowledgeOutboxOperation('op-v', [{ entity: 'program', record_id: 'prog-a', version: 8 }]);
  assert.equal(db.stores.get('syncMeta').get('version/program/prog-a').value, 8);
  assert.equal(db.stores.get('outbox').has(1), false);
});

test('a duplicate acknowledgement from another tab is harmless after the first tab removed the outbox entry', async () => {
  const db = new MemoryDatabase({ syncMeta: [{ id: 'version/program/prog-a', value: 8 }] });
  const repo = createRepository(db, 'me');
  await assert.doesNotReject(repo.acknowledgeOutboxOperation('already-acked', [{ entity: 'program', record_id: 'prog-a', version: 8 }]));
});

test('remote records and server versions are applied without creating outbox work', async () => {
  const db = new MemoryDatabase();
  const repo = createRepository(db, 'me');
  const row = { profile_id: 'me', entity: 'program', record_id: program.id, version: 3, payload: program, deleted_at: null };
  await repo.applyRemoteRecords([row], '22');
  assert.equal(db.stores.get('programs').get(program.id).name, program.name);
  assert.equal(db.stores.get('syncMeta').get('version/program/prog-a').value, 3);
  assert.equal(db.stores.get('syncMeta').get('historyCursor').value, '22');
  assert.equal(db.stores.get('outbox').size, 0);
});

test('confirmed initial upload replaces only unsent operations and marks the bootstrap in the same transaction', async () => {
  const oldOp = { opId: 'old-unsent', sequence: 1, profileId: 'me', changes: [] };
  const db = new MemoryDatabase({ programs: [program], outbox: [oldOp] });
  const repo = createRepository(db, 'me', { makeId: () => 'snapshot-op', now: () => 500 });
  await repo.enqueueCurrentSnapshotForInitialUpload('31');
  const tx = db.transactions.at(-1), queued = [...db.stores.get('outbox').values()];
  assert.ok(['programs', 'outbox', 'syncMeta'].every(name => tx.names.includes(name)));
  assert.equal(queued.length, 2);
  assert.equal(queued[0].opId, 'snapshot-op');
  assert.equal(db.stores.get('syncMeta').get('initialized').value, true);
  assert.equal(db.stores.get('syncMeta').get('historyCursor').value, '31');
  await assert.rejects(repo.enqueueCurrentSnapshotForInitialUpload('31'), /déjà été synchronisé/i);
  assert.equal([...db.stores.get('outbox').values()][0].opId, 'snapshot-op');
});

test('empty bootstrap is committed only if no local data or outbox appeared after its snapshot', async () => {
  const db = new MemoryDatabase();
  const repo = createRepository(db, 'me');
  assert.equal(await repo.initializeEmptyIfUnchanged('3'), true);
  assert.equal(db.stores.get('syncMeta').get('historyCursor').value, '3');
  const changedDb = new MemoryDatabase({ programs: [program] });
  const changedRepo = createRepository(changedDb, 'me');
  assert.equal(await changedRepo.initializeEmptyIfUnchanged('3'), false);
  assert.equal(changedDb.stores.get('syncMeta').has('initialized'), false);
});

test('cloud restoration updates domain data, versions and cursor without creating outbox entries', async () => {
  const db = new MemoryDatabase();
  const repo = createRepository(db, 'me');
  await repo.replaceFromRemote([{ profile_id: 'me', entity: 'program', record_id: program.id, version: 2, payload: program, deleted_at: null }], '14');
  assert.equal(db.stores.get('programs').get(program.id).id, program.id);
  assert.equal(db.stores.get('syncMeta').get('version/program/prog-a').value, 2);
  assert.equal(db.stores.get('syncMeta').get('historyCursor').value, '14');
  assert.equal(db.stores.get('syncMeta').get('initialized').value, true);
  assert.equal(db.stores.get('outbox').size, 0);
});

test('automatic cloud restore refuses local data that appeared after the first-sync check', async () => {
  const db = new MemoryDatabase({ programs: [program] });
  const repo = createRepository(db, 'me');
  const remote = [{ profile_id: 'me', entity: 'program', record_id: 'remote', version: 1, payload: { ...program, id: 'remote' }, deleted_at: null }];
  await assert.rejects(repo.replaceFromRemote(remote, '14'), /base locale a changé/i);
  assert.equal(db.stores.get('programs').has(program.id), true);
  assert.equal(db.stores.get('programs').has('remote'), false);
});

test('initial merge commits cloud restoration, local-only outbox and bootstrap marker in one transaction', async () => {
  const local = { ...program, id: 'local-program', name: 'Local' };
  const remote = { ...program, id: 'cloud-program', name: 'Cloud' };
  const db = new MemoryDatabase({ programs: [local] });
  const repo = createRepository(db, 'me', { makeId: (() => { let index = 0; return () => `merge-op-${++index}`; })() });
  const result = await repo.mergeInitialRemote([{ profile_id: 'me', entity: 'program', record_id: remote.id, version: 1, payload: remote, deleted_at: null }], '9');
  const tx = db.transactions.at(-1), queued = [...db.stores.get('outbox').values()];
  assert.deepEqual(result.conflicts, []);
  assert.ok(['programs', 'outbox', 'syncMeta'].every(name => tx.names.includes(name)));
  assert.equal(db.stores.get('programs').has(remote.id), true);
  assert.equal(queued.some(op => op.changes.some(change => change.record_id === local.id)), true);
  assert.equal(db.stores.get('syncMeta').get('initialized').value, true);
});

test('additive IndexedDB upgrade never deletes a pre-existing V1 store', () => {
  const names = new Set(['routines', 'sessions', 'meta']);
  const db = { deleted: [], get objectStoreNames() { return [...names]; }, deleteObjectStore(name) { this.deleted.push(name); names.delete(name); }, createObjectStore(name) { names.add(name); } };
  configureDatabase(db, 1);
  assert.deepEqual(db.deleted, []);
  assert.ok(names.has('routines') && names.has('sessions') && names.has('meta'));
});
