import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncEngine, snapshotSyncBatches } from '../sync.js';

function repository({ initialized = true, local = [], outbox = [] } = {}) {
  const state = { initialized, cursor: '0', versions: new Map(), outbox: structuredClone(outbox), local: structuredClone(local), applied: [], conflicts: [] };
  return {
    state,
    getSyncState: async () => ({ initialized: state.initialized, cursor: state.cursor }),
    getSyncSnapshot: async () => ({ profileId: 'me', programs: state.local, cycles: [], sessions: [], profileState: { profileId: 'me', activeCycleId: null }, activeSession: null }),
    listOutbox: async () => structuredClone(state.outbox),
    prepareOutboxOperation: async opId => state.outbox.find(op => op.opId === opId),
    acknowledgeOutboxOperation: async (opId, records) => {
      for (const record of records) state.versions.set(`${record.entity}/${record.record_id}`, record.version);
      state.outbox = state.outbox.filter(op => op.opId !== opId);
    },
    markOutboxConflict: async (opId, conflict) => { state.conflicts.push({ opId, conflict }); },
    applyRemoteRecords: async (records, cursor, versions) => { state.applied.push(...records); state.cursor = cursor; for (const [key, value] of versions) state.versions.set(key, value); },
    markSyncInitialized: async cursor => { state.initialized = true; state.cursor = cursor; },
    enqueueInitialUpload: async batches => { for (const changes of batches) state.outbox.push({ opId: `initial-${state.outbox.length}`, profileId: 'me', changes: changes.map(change => ({ ...change, expected_version: 0 })) }); },
    enqueueCurrentSnapshotForInitialUpload: async () => { for (const changes of snapshotSyncBatches(await stateSnapshot(state))) state.outbox.push({ opId: `initial-${state.outbox.length}`, profileId: 'me', changes: changes.map(change => ({ ...change, expected_version: 0 })) }); },
    mergeInitialRemote: async (records, cursor) => {
      state.applied.push(...records); state.cursor = cursor; state.initialized = true;
      const keys = new Set(records.map(row => `${row.entity}/${row.record_id}`));
      const batches = snapshotSyncBatches(await stateSnapshot(state), { includeProfileState: !keys.has('profile_state/profile') });
      for (const changes of batches) {
        const missing = changes.filter(change => !keys.has(`${change.entity}/${change.record_id}`));
        if (missing.length) state.outbox.push({ opId: `merged-${state.outbox.length}`, profileId: 'me', changes: missing.map(change => ({ ...change, expected_version: 0 })) });
      }
      return { conflicts: [], batches: [] };
    },
    replaceFromRemote: async (records, cursor) => { state.applied.push(...records); state.local = records.filter(row => !row.deleted_at).map(row => row.payload); state.cursor = cursor; state.versions = new Map(records.map(row => [`${row.entity}/${row.record_id}`, row.version])); state.initialized = true; }
  };
}

async function stateSnapshot(state) {
  return { profileId: 'me', programs: state.local, cycles: [], sessions: [], profileState: { profileId: 'me', activeCycleId: null }, activeSession: null };
}

function fakeSupabase({ rpc, current = [], history = [], highWater = '0', failCurrent = null } = {}) {
  const rpcCalls = [];
  const syncHistory = [...history];
  const api = {
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      if (rpc) return rpc(name, args);
      const changes = args.p_changes;
      return { data: { status: 'applied', op_id: args.p_op_id, records: changes.map(change => ({ entity: change.entity, record_id: change.record_id, version: change.expected_version + 1 })) }, error: null };
    },
    from(table) {
      const query = { table, filters: [], sort: null, maximum: Infinity, offset: 0,
        select(columns) { this.columns = columns; return this; }, eq(key, value) { this.filters.push([key, 'eq', value]); return this; }, gt(key, value) { this.filters.push([key, 'gt', value]); return this; },
        order(key, options = {}) { this.sort = [key, options.ascending !== false]; return this; }, limit(value) { this.maximum = value; return this; }, range(from, to) { this.offset = from; this.maximum = to - from + 1; return this; },
        then(resolve, reject) {
          if (table === 'sync_records' && failCurrent) return Promise.reject(failCurrent).then(resolve, reject);
          if (table === 'sync_record_history' && this.columns === 'change_id' && !this.filters.some(([key]) => key === 'gt')) return Promise.resolve({ data: highWater === '0' ? [] : [{ change_id: highWater }], error: null }).then(resolve, reject);
          let rows = table === 'sync_records' ? current : syncHistory;
          for (const [key, type, value] of this.filters) rows = rows.filter(row => type === 'eq' ? row[key] === value : BigInt(row[key]) > BigInt(value));
          if (this.sort) rows = rows.slice().sort((a, b) => (BigInt(a[this.sort[0]]) < BigInt(b[this.sort[0]]) ? -1 : 1) * (this.sort[1] ? 1 : -1));
          if (table === 'sync_record_history' && this.filters.some(([key]) => key === 'gt')) return Promise.resolve({ data: rows.slice(0, this.maximum), error: null }).then(resolve, reject);
          if (this.sort?.[0] === 'change_id' && this.maximum === 1) return Promise.resolve({ data: rows.slice(0, 1), error: null }).then(resolve, reject);
          return Promise.resolve({ data: rows.slice(this.offset, this.offset + this.maximum), error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return { client: api, rpcCalls, history: syncHistory };
}

test('offline sync leaves durable outbox entries queued', async () => {
  const repo = repository({ outbox: [{ opId: 'op-a', profileId: 'me', changes: [] }] });
  const supabase = fakeSupabase();
  const engine = createSyncEngine({ supabase: supabase.client, repository: repo, profileId: 'me', isOnline: () => false });
  const status = await engine.syncNow();
  assert.equal(status.state, 'pending');
  assert.equal(repo.state.outbox.length, 1);
  assert.equal(supabase.rpcCalls.length, 0);
});

test('network failure keeps the prepared operation and retry uses the same op_id and payload', async () => {
  const op = { opId: 'stable-op', profileId: 'me', changes: [{ entity: 'program', record_id: 'p1', expected_version: 0, deleted: false, payload: { id: 'p1', profileId: 'me' } }] };
  const repo = repository({ outbox: [op] });
  let calls = 0;
  const supabase = fakeSupabase({ rpc: async (_name, args) => {
    calls++;
    if (calls === 1) throw new Error('Failed to fetch');
    return { data: { status: 'applied', op_id: args.p_op_id, records: [{ entity: 'program', record_id: 'p1', version: 1 }] }, error: null };
  } });
  const engine = createSyncEngine({ supabase: supabase.client, repository: repo, profileId: 'me' });
  assert.equal((await engine.syncNow()).state, 'error');
  assert.equal(repo.state.outbox.length, 1);
  assert.equal((await engine.syncNow()).state, 'synchronized');
  assert.equal(supabase.rpcCalls[0].args.p_op_id, supabase.rpcCalls[1].args.p_op_id);
  assert.deepEqual(supabase.rpcCalls[0].args.p_changes, supabase.rpcCalls[1].args.p_changes);
  assert.equal(supabase.rpcCalls[0].name, 'apply_sync_batch');
  assert.deepEqual(Object.keys(supabase.rpcCalls[0].args.p_changes[0]).sort(), ['deleted', 'entity', 'expected_version', 'payload', 'profile_id', 'record_id']);
  assert.equal(repo.state.outbox.length, 0);
});

test('server conflict freezes the batch and never deletes it from the outbox', async () => {
  const op = { opId: 'conflicted-op', profileId: 'me', changes: [{ entity: 'program', record_id: 'p1', expected_version: 1, deleted: false, payload: { id: 'p1', profileId: 'me' } }] };
  const repo = repository({ outbox: [op] });
  const supabase = fakeSupabase({ rpc: async (_name, args) => ({ data: { status: 'conflict', op_id: args.p_op_id, conflicts: [{ entity: 'program', record_id: 'p1', remote: { version: 2, payload: { id: 'p1', profileId: 'me', name: 'remote' } } }] }, error: null }) });
  const engine = createSyncEngine({ supabase: supabase.client, repository: repo, profileId: 'me' });
  assert.equal((await engine.syncNow()).state, 'conflict');
  assert.equal(repo.state.outbox.length, 1);
  assert.equal(repo.state.conflicts[0].opId, 'conflicted-op');
  assert.equal(supabase.rpcCalls.length, 1);
});

test('empty local database restores the current cloud records and sync versions', async () => {
  const remote = [{ profile_id: 'me', entity: 'program', record_id: 'p1', version: 4, payload: { id: 'p1', profileId: 'me' }, deleted_at: null, updated_at: '2026-01-01T00:00:00Z' }];
  const repo = repository({ initialized: false });
  const engine = createSyncEngine({ supabase: fakeSupabase({ current: remote, highWater: '12' }).client, repository: repo, profileId: 'me' });
  assert.equal((await engine.syncNow()).state, 'synchronized');
  assert.equal(repo.state.applied[0].record_id, 'p1');
  assert.equal(repo.state.versions.get('program/p1'), 4);
  assert.equal(repo.state.cursor, '12');
});

test('local data and cloud data require an explicit bootstrap decision', async () => {
  const remote = [{ profile_id: 'me', entity: 'program', record_id: 'cloud', version: 1, payload: { id: 'cloud', profileId: 'me' }, deleted_at: null }];
  const repo = repository({ initialized: false, local: [{ id: 'local', profileId: 'me' }] });
  const engine = createSyncEngine({ supabase: fakeSupabase({ current: remote, highWater: '2' }).client, repository: repo, profileId: 'me' });
  assert.equal((await engine.syncNow()).state, 'needs-decision');
  assert.equal(repo.state.applied.length, 0);
  assert.equal(repo.state.outbox.length, 0);
  assert.equal((await engine.chooseInitialSync('merge')).state, 'synchronized');
  assert.equal(repo.state.applied[0].record_id, 'cloud');
});

test('local-only data is never uploaded before explicit confirmation', async () => {
  const repo = repository({ initialized: false, local: [{ id: 'local', profileId: 'me' }] });
  const supabase = fakeSupabase();
  const engine = createSyncEngine({ supabase: supabase.client, repository: repo, profileId: 'me' });
  assert.equal((await engine.syncNow()).state, 'needs-decision');
  assert.equal(supabase.rpcCalls.length, 0);
  assert.equal((await engine.chooseInitialSync('upload')).state, 'synchronized');
});

test('bootstrap snapshot groups the active cycle with profile state and sends active sessions last', () => {
  const cycle = { id: 'cycle-1', profileId: 'me', programId: 'prog-1', status: 'active', programSnapshot: { id: 'prog-1', profileId: 'me' } };
  const workout = { id: 'workout-1', profileId: 'me', cycleId: 'cycle-1', finished: null };
  const batches = snapshotSyncBatches({ profileId: 'me', programs: [{ id: 'prog-1', profileId: 'me' }], cycles: [cycle], sessions: [], profileState: { profileId: 'me', activeCycleId: 'cycle-1' }, activeSession: workout });
  const cycleBatch = batches.find(batch => batch.some(change => change.entity === 'cycle'));
  assert.deepEqual(cycleBatch.map(change => change.entity), ['cycle', 'profile_state']);
  assert.equal(batches.at(-1)[0].entity, 'active_session');
  assert.equal(batches.at(-1)[0].record_id, 'current');
  assert.ok(batches.every(batch => batch.length <= 100));
});
