import { snapshotSyncBatches } from './sync.js';

export const DB_VERSION = 3;
export const STORE_NAMES = ['programs', 'cycles', 'sessions', 'profileState', 'meta', 'outbox', 'syncMeta'];
const BACKUP_STORE_NAMES = ['programs', 'cycles', 'sessions', 'profileState', 'meta'];
const PROFILE_IDS = new Set(['me', 'wife']);
const SESSION_DEFINITIONS = [
  ['upper-a', 'Upper A'], ['lower-a', 'Lower A'], ['upper-b', 'Upper B'], ['lower-b', 'Lower B']
];

export function databaseNameForProfile(profileId) {
  if (!PROFILE_IDS.has(profileId)) throw new Error('Profil invalide');
  return profileId === 'wife' ? 'forgefit-wife-db' : 'forgefit-db';
}

export function parseProgramJson(json, profileId) {
  if (typeof json !== 'string' || json.length > 2_000_000) throw new Error('Fichier programme trop volumineux');
  let program;
  try { program = JSON.parse(json); } catch { throw new Error('JSON invalide'); }
  if (!program || typeof program !== 'object' || Array.isArray(program)) throw new Error('Programme JSON invalide');
  const normalized = { description: '', durationWeeks: 8, revision: 1, status: 'available', ...program };
  validateProgram(normalized, profileId);
  return normalized;
}

export async function saveProgramJson(repository, json, profileId, requiredId = null) {
  const program = parseProgramJson(json, profileId);
  if (requiredId && program.id !== requiredId) throw new Error('L’identifiant du programme ne peut pas être modifié ici');
  await repository.putProgram(program);
  return program;
}

export function programStatus(program, cycles, activeCycleId) {
  if (cycles.some(cycle => cycle.id === activeCycleId && cycle.programId === program.id)) return 'active';
  if (program.status === 'archived') return 'archived';
  if (cycles.some(cycle => cycle.programId === program.id)) return 'used';
  return 'available';
}

export function configureDatabase(db, oldVersion) {
  for (const name of STORE_NAMES) {
    if (!db.objectStoreNames.contains?.(name) && !Array.from(db.objectStoreNames).includes(name)) {
      const options = name === 'profileState' ? { keyPath: 'profileId' }
        : name === 'outbox' ? { keyPath: 'sequence', autoIncrement: true } : { keyPath: 'id' };
      db.createObjectStore(name, options);
    }
  }
}

function changeRecord(entity, recordId, payload, deleted = false) {
  return { entity, record_id: recordId, deleted, payload: structuredClone(payload) };
}

function splitChanges(changes, maxSize = 100) {
  const batches = [];
  for (let index = 0; index < changes.length; index += maxSize) batches.push(changes.slice(index, index + maxSize));
  return batches;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function syncKey(entity, recordId) { return `${entity}/${recordId}`; }

function backupSyncBatches(before, backup, now) {
  const groups = [];
  const mapRecords = (items, entity) => new Map((items || []).map(item => [item.id, item]));
  const oldPrograms = mapRecords(before.programs, 'program'), newPrograms = mapRecords(backup.programs, 'program');
  const oldCycles = mapRecords(before.cycles, 'cycle'), newCycles = mapRecords(backup.cycles, 'cycle');
  const oldSessions = mapRecords(before.sessions, 'session'), newSessions = mapRecords(backup.sessions, 'session');
  const programChanges = [...newPrograms].filter(([id, value]) => !oldPrograms.has(id) || stableJson(oldPrograms.get(id)) !== stableJson(value))
    .map(([id, value]) => changeRecord('program', id, value));
  groups.push(...splitChanges(programChanges));

  const activeDeleted = before.activeSession && (!backup.activeSession || stableJson(before.activeSession) !== stableJson(backup.activeSession));
  if (activeDeleted) groups.push([changeRecord('active_session', 'current', before.activeSession, true)]);

  const oldActiveId = before.profileState?.activeCycleId || null, newActiveId = backup.profileState?.activeCycleId || null;
  const transition = [];
  const oldActive = oldActiveId && oldCycles.get(oldActiveId);
  if (oldActiveId && oldActiveId !== newActiveId) {
    const completed = newCycles.get(oldActiveId) || { ...oldActive, status: 'completed', endedAt: now(), updatedAt: now() };
    transition.push(changeRecord('cycle', completed.id, completed));
  }
  const newActive = newActiveId && newCycles.get(newActiveId);
  if (newActive && (!oldActiveId || oldActiveId !== newActiveId || !oldCycles.has(newActiveId) || stableJson(oldCycles.get(newActiveId)) !== stableJson(newActive))) {
    transition.push(changeRecord('cycle', newActive.id, newActive));
  }
  const oldState = before.profileState || { profileId: backup.profileId, activeCycleId: null };
  if (stableJson(oldState) !== stableJson(backup.profileState)) transition.push(changeRecord('profile_state', 'profile', backup.profileState));

  const ordinaryCycles = [];
  for (const [id, cycle] of newCycles) {
    if (id === oldActiveId || id === newActiveId) continue;
    if (!oldCycles.has(id) || stableJson(oldCycles.get(id)) !== stableJson(cycle)) ordinaryCycles.push(changeRecord('cycle', id, cycle));
  }
  // The transition is one atomic RPC batch; the SQL deferred trigger validates
  // the old/new cycle and profile_state together.
  if (transition.length) groups.push(transition);
  groups.push(...splitChanges(ordinaryCycles));

  const sessionChanges = [];
  for (const [id, session] of newSessions) if (!oldSessions.has(id) || stableJson(oldSessions.get(id)) !== stableJson(session)) sessionChanges.push(changeRecord('session', id, session));
  for (const [id, session] of oldSessions) if (!newSessions.has(id)) sessionChanges.push(changeRecord('session', id, session, true));
  groups.push(...splitChanges(sessionChanges));

  if (backup.activeSession && (!before.activeSession || stableJson(before.activeSession) !== stableJson(backup.activeSession))) {
    groups.push([changeRecord('active_session', 'current', backup.activeSession)]);
  }

  const tombstoneCycles = [...oldCycles].filter(([id]) => !newCycles.has(id))
    .map(([id, cycle]) => changeRecord('cycle', id, cycle.status === 'active' ? { ...cycle, status: 'completed', endedAt: now(), updatedAt: now() } : cycle, true));
  groups.push(...splitChanges(tombstoneCycles));
  const tombstonePrograms = [...oldPrograms].filter(([id]) => !newPrograms.has(id)).map(([id, program]) => changeRecord('program', id, program, true));
  groups.push(...splitChanges(tombstonePrograms));
  return groups.filter(batch => batch.length);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} invalide`);
}

export function validateProgram(program, expectedProfileId) {
  if (!program || typeof program !== 'object') throw new Error('Programme invalide');
  requireString(program.id, 'Identifiant du programme');
  requireString(program.name, 'Nom du programme');
  requireString(program.profileId, 'Profil du programme');
  if (!PROFILE_IDS.has(program.profileId) || (expectedProfileId && program.profileId !== expectedProfileId)) throw new Error('Profil du programme invalide');
  if (!Number.isInteger(program.durationWeeks) || program.durationWeeks < 1 || program.durationWeeks > 104) throw new Error('Durée du programme invalide');
  if (!Number.isInteger(program.revision) || program.revision < 1) throw new Error('Révision du programme invalide');
  if (program.status !== undefined && !['available', 'archived'].includes(program.status)) throw new Error('Statut du programme invalide');
  if (!Array.isArray(program.sessions) || program.sessions.length !== 4) throw new Error('Un programme doit contenir exactement quatre séances');
  const sessionNames = new Map(program.sessions.map(session => [session.id, session.name]));
  if (SESSION_DEFINITIONS.some(([id, name]) => sessionNames.get(id) !== name) || sessionNames.size !== 4) throw new Error('Les séances doivent être Upper A, Lower A, Upper B et Lower B');
  for (const session of program.sessions) {
    requireString(session.id, 'Identifiant de séance');
    requireString(session.name, 'Nom de séance');
    if (!Array.isArray(session.exercises)) throw new Error('Exercices invalides');
    for (const exercise of session.exercises) {
      requireString(exercise.id, 'Identifiant d’exercice');
      requireString(exercise.name, 'Nom d’exercice');
      if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 30) throw new Error('Nombre de séries invalide');
      if (!Number.isInteger(exercise.repMin) || !Number.isInteger(exercise.repMax) || exercise.repMin < 1 || exercise.repMax < exercise.repMin || exercise.repMax > 200) throw new Error('Plage de répétitions invalide');
      if (!Number.isFinite(exercise.rir) || exercise.rir < 0 || exercise.rir > 10) throw new Error('RIR invalide');
      if (!Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 3600) throw new Error('Temps de repos invalide');
    }
  }
  return program;
}

export function createCycle(program, startedAt = Date.now(), id = crypto.randomUUID()) {
  validateProgram(program);
  const snapshot = structuredClone(program);
  return {
    id,
    profileId: program.profileId,
    programId: program.id,
    programRevision: program.revision,
    programSnapshot: snapshot,
    status: 'active',
    startedAt,
    targetWeeks: program.durationWeeks || 8,
    endedAt: null,
    updatedAt: startedAt
  };
}

export function currentCycleWeek(cycle, at = Date.now()) {
  if (!cycle || !Number.isFinite(cycle.startedAt) || !Number.isFinite(at)) return 1;
  return Math.max(1, Math.floor(Math.max(0, at - cycle.startedAt) / 604_800_000) + 1);
}

export function createTrainingSession(cycle, sessionId, startedAt = Date.now(), id = crypto.randomUUID()) {
  if (!cycle || cycle.status !== 'active') throw new Error('Aucun cycle actif');
  const template = cycle.programSnapshot?.sessions?.find(session => session.id === sessionId);
  if (!template) throw new Error('Séance introuvable dans le cycle actif');
  return {
    id,
    profileId: cycle.profileId,
    programId: cycle.programId,
    programName: cycle.programSnapshot.name,
    cycleId: cycle.id,
    sessionId: template.id,
    routineName: template.name,
    started: startedAt,
    finished: null,
    exercises: template.exercises.map(exercise => ({ ...structuredClone(exercise), sets: Array.from({ length: exercise.sets }, () => ({ kg: '', reps: exercise.repMin, done: false })) }))
  };
}

export function matchExerciseByStableId(exercises, exerciseId, exerciseName) {
  return exercises.find(exercise => exercise.id === exerciseId)
    || exercises.find(exercise => !exercise.id && exercise.name === exerciseName)
    || null;
}

export function makeBackup(data, exportedAt = Date.now()) {
  if (!PROFILE_IDS.has(data.profileId)) throw new Error('Profil invalide');
  const backup = { app: 'ROCH&RANIA FIT', version: 2, exportedAt: new Date(exportedAt).toISOString(), profileId: data.profileId,
    programs: data.programs, cycles: data.cycles, sessions: data.sessions, profileState: data.profileState,
    activeSession: data.activeSession || null, restUntil: data.restUntil || 0 };
  return validateBackup(backup, data.profileId);
}

export function validateBackup(data, expectedProfileId) {
  if (data?.app !== 'ROCH&RANIA FIT' || data.version !== 2 || !PROFILE_IDS.has(data.profileId)) throw new Error('Format de sauvegarde V2 non reconnu');
  if (expectedProfileId && data.profileId !== expectedProfileId) throw new Error('Cette sauvegarde appartient à un autre profil');
  for (const key of ['programs', 'cycles', 'sessions']) if (!Array.isArray(data[key])) throw new Error(`Données ${key} invalides`);
  if (data.programs.length > 500 || data.cycles.length > 10000 || data.sessions.length > 100000) throw new Error('Sauvegarde trop volumineuse');
  for (const program of data.programs) validateProgram(program, data.profileId);
  for (const cycle of data.cycles) {
    requireString(cycle.id, 'Identifiant de cycle');
    if (cycle.profileId !== data.profileId || !Number.isFinite(cycle.startedAt) || !Number.isInteger(cycle.targetWeeks) || cycle.targetWeeks < 1) throw new Error('Cycle invalide');
    validateProgram(cycle.programSnapshot, data.profileId);
    if (cycle.programSnapshot.id !== cycle.programId || !['active', 'completed'].includes(cycle.status)) throw new Error('Snapshot de cycle invalide');
  }
  for (const session of data.sessions) {
    requireString(session.id, 'Identifiant de séance terminée');
    if (session.profileId !== data.profileId || !Array.isArray(session.exercises) || !Number.isFinite(session.started) || !Number.isFinite(session.finished)) throw new Error('Séance terminée invalide');
  }
  if (!data.profileState || data.profileState.profileId !== data.profileId || !('activeCycleId' in data.profileState)) throw new Error('État du profil invalide');
  const activeCycles = data.cycles.filter(cycle => cycle.status === 'active');
  if (activeCycles.length > 1) throw new Error('Un seul cycle peut être actif par profil');
  if (activeCycles.length === 1 && data.profileState.activeCycleId !== activeCycles[0].id) throw new Error('L’état du profil ne référence pas son cycle actif');
  if (activeCycles.length === 0 && data.profileState.activeCycleId !== null) throw new Error('Le cycle actif du profil est introuvable');
  if (data.sessions.some(session => !data.cycles.some(cycle => cycle.id === session.cycleId && cycle.programId === session.programId))) throw new Error('Une séance ne correspond à aucun cycle de son historique');
  if (data.activeSession && (data.activeSession.profileId !== data.profileId || !Array.isArray(data.activeSession.exercises))) throw new Error('Séance active invalide');
  return data;
}

export function openDatabase(profileId) {
  let dbName;
  try { dbName = databaseNameForProfile(profileId); } catch (error) { return Promise.reject(error); }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = event => {
      configureDatabase(request.result, event.oldVersion);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Transaction IndexedDB annulée'));
  });
}

export function createRepository(db, profileId, { now = Date.now, makeId = () => crypto.randomUUID() } = {}) {
  if (!PROFILE_IDS.has(profileId)) throw new Error('Profil invalide');
  let onLocalMutation = () => {};
  const readAll = async store => requestResult(db.transaction(store).objectStore(store).getAll());
  const read = async (store, key) => requestResult(db.transaction(store).objectStore(store).get(key));
  const write = async (store, value) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await transactionDone(tx);
  };
  const remove = async (store, key) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await transactionDone(tx);
  };
  const queueOutbox = (tx, changes) => {
    if (!changes.length) return;
    tx.objectStore('outbox').add({ opId: makeId(), profileId, createdAt: now(), changes: structuredClone(changes), status: 'pending' });
  };
  const signalMutation = () => { try { onLocalMutation(); } catch {} };
  const localData = async () => {
    const [programs, cycles, sessions, profileState, activeSession, restUntil] = await Promise.all([
      readAll('programs'), readAll('cycles'), readAll('sessions'), read('profileState', profileId), read('meta', 'activeSession'), read('meta', 'rest')
    ]);
    return { profileId, programs, cycles, sessions, profileState: profileState || { profileId, activeCycleId: null }, activeSession: activeSession?.data || null, restUntil: restUntil?.until || 0 };
  };
  const applyRemoteRow = (tx, row, versions) => {
    if (row.profile_id !== profileId) throw new Error('Enregistrement distant lié à un autre profil');
    const key = syncKey(row.entity, row.record_id);
    const known = versions.get(`version/${key}`) || 0;
    if (Number(row.version) <= Number(known)) return;
    const deleted = Boolean(row.deleted_at);
    const payload = row.payload;
    if (!payload || payload.profileId !== profileId) throw new Error('Payload distant avec un profil invalide');
    if (row.entity === 'program') {
      if (deleted) tx.objectStore('programs').delete(row.record_id); else { validateProgram(payload, profileId); tx.objectStore('programs').put(payload); }
    } else if (row.entity === 'cycle') {
      requireString(payload.id, 'Identifiant de cycle');
      if (deleted) tx.objectStore('cycles').delete(row.record_id); else tx.objectStore('cycles').put(payload);
    } else if (row.entity === 'session') {
      if (!Number.isFinite(payload.finished)) throw new Error('Séance distante non terminée invalide');
      if (deleted) tx.objectStore('sessions').delete(row.record_id); else tx.objectStore('sessions').put(payload);
    } else if (row.entity === 'profile_state') {
      if (deleted || row.record_id !== 'profile' || !('activeCycleId' in payload)) throw new Error('État de profil distant invalide');
      tx.objectStore('profileState').put(payload);
    } else if (row.entity === 'active_session') {
      if (row.record_id !== 'current' || payload.finished !== null) throw new Error('Séance active distante invalide');
      if (deleted) tx.objectStore('meta').delete('activeSession');
      else tx.objectStore('meta').put({ id: 'activeSession', data: payload });
    } else throw new Error(`Type d’enregistrement distant inconnu : ${row.entity}`);
    const versionEntry = { id: `version/${key}`, value: Number(row.version) };
    tx.objectStore('syncMeta').put(versionEntry);
    versions.set(versionEntry.id, versionEntry.value);
  };
  const readSyncMeta = async () => new Map((await readAll('syncMeta')).map(item => [item.id, item.value]));

  return {
    profileId,
    setOnLocalMutation: callback => { onLocalMutation = typeof callback === 'function' ? callback : () => {}; },
    listPrograms: () => readAll('programs'),
    listCycles: () => readAll('cycles'),
    listSessions: async () => (await readAll('sessions')).sort((a, b) => b.started - a.started),
    getProfileState: async () => (await read('profileState', profileId)) || { profileId, activeCycleId: null, updatedAt: now() },
    getActiveSession: async () => (await read('meta', 'activeSession'))?.data || null,
    getRestUntil: async () => (await read('meta', 'rest'))?.until || 0,
    saveActiveSession: async session => {
      const value = { ...session, profileId };
      const tx = db.transaction(['meta', 'outbox'], 'readwrite');
      tx.objectStore('meta').put({ id: 'activeSession', data: value });
      queueOutbox(tx, [changeRecord('active_session', 'current', value)]);
      await transactionDone(tx); signalMutation();
    },
    saveRestUntil: until => write('meta', { id: 'rest', until }),
    clearRest: () => remove('meta', 'rest'),
    startCycle: async programId => {
      const tx = db.transaction(['programs', 'cycles', 'profileState', 'meta', 'outbox'], 'readwrite');
      const programs = tx.objectStore('programs'), cycles = tx.objectStore('cycles'), states = tx.objectStore('profileState'), meta = tx.objectStore('meta');
      const programRequest = programs.get(programId), stateRequest = states.get(profileId), activeRequest = meta.get('activeSession');
      const result = await new Promise((resolve, reject) => {
        let program, state, activeSession, loaded = 0;
        const fail = message => { try { tx.abort(); } catch {} reject(new Error(message)); };
        for (const request of [programRequest, stateRequest, activeRequest]) request.onerror = () => fail('Impossible de lire les données du cycle');
        programRequest.onsuccess = () => { program = programRequest.result; loaded++; maybeWrite(); };
        stateRequest.onsuccess = () => { state = stateRequest.result; loaded++; maybeWrite(); };
        activeRequest.onsuccess = () => { activeSession = activeRequest.result; loaded++; maybeWrite(); };
        function maybeWrite() {
          if (loaded !== 3) return;
          if (activeSession?.data) return fail('Impossible de changer de cycle pendant une séance');
          if (state?.activeCycleId) return fail('Terminez le cycle actif avant d’en activer un autre');
          if (!program || program.profileId !== profileId) return fail('Programme introuvable pour ce profil');
          try { validateProgram(program, profileId); } catch (error) { return fail(error.message); }
          const cycle = createCycle(program, now(), makeId());
          cycles.put(cycle);
          const nextState = { profileId, activeCycleId: cycle.id, updatedAt: now() };
          states.put(nextState);
          queueOutbox(tx, [changeRecord('cycle', cycle.id, cycle), changeRecord('profile_state', 'profile', nextState)]);
          resolve(cycle);
        }
      });
      await transactionDone(tx);
      signalMutation();
      return result;
    },
    endCycle: async () => {
      const tx = db.transaction(['cycles', 'profileState', 'meta', 'outbox'], 'readwrite');
      const states = tx.objectStore('profileState'), meta = tx.objectStore('meta'), cycles = tx.objectStore('cycles');
      const stateRequest = states.get(profileId), activeRequest = meta.get('activeSession');
      const ended = await new Promise((resolve, reject) => {
        let state, active, loaded = 0;
        const fail = message => { try { tx.abort(); } catch {} reject(new Error(message)); };
        stateRequest.onerror = activeRequest.onerror = () => fail('Impossible de lire l’état du cycle');
        stateRequest.onsuccess = () => { state = stateRequest.result; loaded++; maybeEnd(); };
        activeRequest.onsuccess = () => { active = activeRequest.result; loaded++; maybeEnd(); };
        function maybeEnd() {
          if (loaded !== 2) return;
          if (active?.data) return fail('Impossible de terminer un cycle pendant une séance');
          if (!state?.activeCycleId) return fail('Aucun cycle actif');
          const request = cycles.get(state.activeCycleId);
          request.onerror = () => fail('Cycle actif introuvable');
          request.onsuccess = () => {
            const cycle = request.result;
            if (!cycle) return fail('Cycle actif introuvable');
            cycle.status = 'completed'; cycle.endedAt = now(); cycle.updatedAt = now();
            cycles.put(cycle);
            const nextState = { profileId, activeCycleId: null, updatedAt: now() };
            states.put(nextState);
            queueOutbox(tx, [changeRecord('cycle', cycle.id, cycle), changeRecord('profile_state', 'profile', nextState)]);
            resolve(cycle);
          };
        }
      });
      await transactionDone(tx);
      signalMutation();
      return ended;
    },
    extendActiveCycle: async weeks => {
      if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new Error('Prolongation invalide');
      const tx = db.transaction(['cycles', 'profileState', 'meta', 'outbox'], 'readwrite');
      const cycles = tx.objectStore('cycles'), states = tx.objectStore('profileState'), meta = tx.objectStore('meta');
      const active = await requestResult(meta.get('activeSession'));
      if (active?.data) { tx.abort(); throw new Error('Impossible de modifier le cycle pendant une séance'); }
      const state = await requestResult(states.get(profileId));
      const cycle = state?.activeCycleId && await requestResult(cycles.get(state.activeCycleId));
      if (!cycle) { tx.abort(); throw new Error('Aucun cycle actif'); }
      cycle.targetWeeks += weeks; cycle.updatedAt = now(); cycles.put(cycle);
      queueOutbox(tx, [changeRecord('cycle', cycle.id, cycle)]);
      await transactionDone(tx);
      signalMutation();
      return cycle;
    },
    startSession: async sessionId => {
      const tx = db.transaction(['cycles', 'profileState', 'meta', 'outbox'], 'readwrite');
      const cycles = tx.objectStore('cycles'), states = tx.objectStore('profileState'), meta = tx.objectStore('meta');
      const active = await requestResult(meta.get('activeSession'));
      if (active?.data) { tx.abort(); throw new Error('Une séance est déjà en cours'); }
      const state = await requestResult(states.get(profileId));
      const cycle = state?.activeCycleId && await requestResult(cycles.get(state.activeCycleId));
      if (!cycle || cycle.status !== 'active') { tx.abort(); throw new Error('Aucun cycle actif'); }
      let session;
      try { session = createTrainingSession(cycle, sessionId, now(), makeId()); }
      catch (error) { tx.abort(); throw error; }
      meta.put({ id: 'activeSession', data: session });
      queueOutbox(tx, [changeRecord('active_session', 'current', session)]);
      await transactionDone(tx);
      signalMutation();
      return session;
    },
    finishSession: async () => {
      const tx = db.transaction(['sessions', 'meta', 'outbox'], 'readwrite');
      const meta = tx.objectStore('meta'), active = await requestResult(meta.get('activeSession'));
      if (!active?.data) { tx.abort(); throw new Error('Aucune séance en cours'); }
      const session = { ...active.data, finished: now() };
      tx.objectStore('sessions').put(session); meta.delete('activeSession'); meta.delete('rest');
      queueOutbox(tx, [changeRecord('session', session.id, session), changeRecord('active_session', 'current', active.data, true)]);
      await transactionDone(tx);
      signalMutation();
      return session;
    },
    discardSession: async () => {
      const tx = db.transaction(['meta', 'outbox'], 'readwrite');
      const meta = tx.objectStore('meta');
      const activeRequest = meta.get('activeSession');
      const active = await requestResult(activeRequest);
      meta.delete('activeSession'); meta.delete('rest');
      if (active?.data) queueOutbox(tx, [changeRecord('active_session', 'current', active.data, true)]);
      await transactionDone(tx);
      if (active?.data) signalMutation();
    },
    saveSession: async session => {
      if (session.profileId !== profileId) throw new Error('Séance liée à un autre profil');
      if (!Number.isFinite(session.finished)) throw new Error('Seules les séances terminées sont synchronisées');
      const tx = db.transaction(['sessions', 'outbox'], 'readwrite');
      tx.objectStore('sessions').put(session);
      queueOutbox(tx, [changeRecord('session', session.id, session)]);
      await transactionDone(tx); signalMutation();
    },
    getSyncSnapshot: localData,
    getSyncState: async () => {
      const meta = await readSyncMeta();
      return { initialized: meta.get('initialized') === true, cursor: String(meta.get('historyCursor') || '0'), lastSuccessAt: meta.get('lastSuccessAt') || null };
    },
    listSyncConflicts: async () => (await readAll('syncMeta')).filter(item => item.id.startsWith('conflict/')).map(item => item.value),
    saveSyncConflicts: async conflicts => {
      const tx = db.transaction('syncMeta', 'readwrite'), meta = tx.objectStore('syncMeta');
      for (const conflict of conflicts) meta.put({ id: `conflict/${conflict.entity}/${conflict.record_id}`, value: structuredClone(conflict) });
      await transactionDone(tx);
    },
    listOutbox: async () => (await readAll('outbox')).sort((a, b) => a.sequence - b.sequence),
    prepareOutboxOperation: async opId => {
      const tx = db.transaction(['outbox', 'syncMeta'], 'readwrite');
      const outbox = tx.objectStore('outbox'), meta = tx.objectStore('syncMeta');
      const [entries, metaEntries] = await Promise.all([requestResult(outbox.getAll()), requestResult(meta.getAll())]);
      const operation = entries.find(entry => entry.opId === opId);
      if (!operation) { tx.abort(); throw new Error('Opération de synchronisation introuvable'); }
      if (operation.status === 'conflict') { tx.abort(); return operation; }
      if (!operation.prepared) {
        const versions = new Map(metaEntries.map(entry => [entry.id, entry.value]));
        operation.changes = operation.changes.map(change => ({ ...change, expected_version: Number(versions.get(`version/${syncKey(change.entity, change.record_id)}`) || 0) }));
        operation.prepared = true;
        outbox.put(operation);
      }
      await transactionDone(tx);
      return operation;
    },
    acknowledgeOutboxOperation: async (opId, records) => {
      const tx = db.transaction(['outbox', 'syncMeta'], 'readwrite');
      const outbox = tx.objectStore('outbox'), meta = tx.objectStore('syncMeta');
      const [entries, metaEntries] = await Promise.all([requestResult(outbox.getAll()), requestResult(meta.getAll())]);
      const operation = entries.find(entry => entry.opId === opId);
      if (!operation) {
        const versions = new Map(metaEntries.map(entry => [entry.id, Number(entry.value)]));
        if (records.every(record => Number(versions.get(`version/${syncKey(record.entity, record.record_id)}`) || 0) >= Number(record.version))) {
          await transactionDone(tx); return;
        }
        tx.abort(); throw new Error('Opération de synchronisation absente sans versions acquittées');
      }
      if (records.length !== operation.changes.length) { tx.abort(); throw new Error('La réponse RPC ne contient pas toutes les versions du lot'); }
      for (const record of records) {
        const change = operation.changes.find(item => item.entity === record.entity && item.record_id === record.record_id);
        if (!change || !Number.isInteger(Number(record.version)) || Number(record.version) !== Number(change.expected_version) + 1) {
          tx.abort(); throw new Error('Versions retournées par apply_sync_batch invalides');
        }
        meta.put({ id: `version/${syncKey(record.entity, record.record_id)}`, value: Number(record.version) });
      }
      outbox.delete(operation.sequence);
      await transactionDone(tx);
    },
    markOutboxConflict: async (opId, conflict) => {
      const tx = db.transaction('outbox', 'readwrite'), store = tx.objectStore('outbox');
      const entries = await requestResult(store.getAll()), operation = entries.find(entry => entry.opId === opId);
      if (!operation) { tx.abort(); throw new Error('Opération de conflit introuvable'); }
      operation.status = 'conflict'; operation.conflict = structuredClone(conflict); store.put(operation);
      await transactionDone(tx);
    },
    markSyncInitialized: async cursor => {
      const tx = db.transaction('syncMeta', 'readwrite'), meta = tx.objectStore('syncMeta');
      meta.put({ id: 'initialized', value: true }); meta.put({ id: 'historyCursor', value: String(cursor || '0') });
      await transactionDone(tx);
    },
    initializeEmptyIfUnchanged: async cursor => {
      const tx = db.transaction([...STORE_NAMES], 'readwrite');
      const requests = [tx.objectStore('programs').getAll(), tx.objectStore('cycles').getAll(), tx.objectStore('sessions').getAll(),
        tx.objectStore('profileState').get(profileId), tx.objectStore('meta').get('activeSession'), tx.objectStore('outbox').getAll(), tx.objectStore('syncMeta').getAll()];
      const initialized = await new Promise((resolve, reject) => {
        let loaded = 0;
        const fail = error => { try { tx.abort(); } catch {} reject(error); };
        requests.forEach(request => {
          request.onerror = () => fail(new Error('Impossible de vérifier la base locale vide'));
          request.onsuccess = () => {
            loaded++;
            if (loaded !== requests.length) return;
            const [programs, cycles, sessions, profileState, active, queued, syncValues] = requests.map(item => item.result);
            if (syncValues.some(item => item.id === 'initialized' && item.value === true)) return resolve(true);
            if (programs.length || cycles.length || sessions.length || active?.data || profileState?.activeCycleId || queued.length) return resolve(false);
            const meta = tx.objectStore('syncMeta');
            meta.put({ id: 'initialized', value: true }); meta.put({ id: 'historyCursor', value: String(cursor || '0') });
            resolve(true);
          };
        });
      });
      await transactionDone(tx);
      return initialized;
    },
    markSyncSuccess: async timestamp => {
      const tx = db.transaction('syncMeta', 'readwrite');
      tx.objectStore('syncMeta').put({ id: 'lastSuccessAt', value: timestamp });
      await transactionDone(tx);
    },
    enqueueInitialUpload: async (batches, { replaceUnsent = false } = {}) => {
      if (!batches.length) return;
      const tx = db.transaction(['outbox', 'syncMeta'], 'readwrite'), outbox = tx.objectStore('outbox');
      if (replaceUnsent) {
        const [queued, metaEntries] = await Promise.all([requestResult(outbox.getAll()), requestResult(tx.objectStore('syncMeta').getAll())]);
        if (metaEntries.some(entry => entry.id === 'initialized' && entry.value === true)) { tx.abort(); throw new Error('Remplacement de file refusé après la première synchronisation'); }
        for (const item of queued) outbox.delete(item.sequence);
      }
      for (const changes of batches) outbox.add({ opId: makeId(), profileId, createdAt: now(), changes: structuredClone(changes), status: 'pending' });
      await transactionDone(tx); signalMutation();
    },
    enqueueCurrentSnapshotForInitialUpload: async cursor => {
      const tx = db.transaction([...STORE_NAMES], 'readwrite');
      const requests = [tx.objectStore('programs').getAll(), tx.objectStore('cycles').getAll(), tx.objectStore('sessions').getAll(),
        tx.objectStore('profileState').get(profileId), tx.objectStore('meta').get('activeSession'), tx.objectStore('outbox').getAll(), tx.objectStore('syncMeta').getAll()];
      await new Promise((resolve, reject) => {
        let loaded = 0;
        const fail = error => { try { tx.abort(); } catch {} reject(error); };
        requests.forEach(request => {
          request.onerror = () => fail(new Error('Impossible de préparer le premier envoi'));
          request.onsuccess = () => {
            loaded++;
            if (loaded !== requests.length) return;
            const [programs, cycles, sessions, profileState, active, queued, syncValues] = requests.map(item => item.result);
            if (syncValues.some(item => item.id === 'initialized' && item.value === true)) return fail(new Error('Le profil a déjà été synchronisé ; le remplacement intégral est refusé'));
            const outbox = tx.objectStore('outbox');
            for (const item of queued) outbox.delete(item.sequence);
            const snapshot = { profileId, programs, cycles, sessions, profileState: profileState || { profileId, activeCycleId: null }, activeSession: active?.data || null };
            for (const changes of snapshotSyncBatches(snapshot)) outbox.add({ opId: makeId(), profileId, createdAt: now(), changes: structuredClone(changes), status: 'pending' });
            const syncMeta = tx.objectStore('syncMeta');
            syncMeta.put({ id: 'initialized', value: true }); syncMeta.put({ id: 'historyCursor', value: String(cursor || '0') });
            resolve();
          };
        });
      });
      await transactionDone(tx); signalMutation();
    },
    applyRemoteRecords: async (records, cursor) => {
      const tx = db.transaction(['programs', 'cycles', 'sessions', 'profileState', 'meta', 'outbox', 'syncMeta'], 'readwrite');
      const outboxRequest = tx.objectStore('outbox').getAll(), metaRequest = tx.objectStore('syncMeta').getAll();
      const conflict = await new Promise((resolve, reject) => {
        let pending, known, loaded = 0;
        const fail = error => { try { tx.abort(); } catch {} reject(error); };
        outboxRequest.onerror = metaRequest.onerror = () => fail(new Error('Impossible de lire la file locale'));
        outboxRequest.onsuccess = () => { pending = outboxRequest.result; loaded++; apply(); };
        metaRequest.onsuccess = () => { known = new Map(metaRequest.result.map(item => [item.id, item.value])); loaded++; apply(); };
        function apply() {
          if (loaded !== 2) return;
          const pendingKeys = new Set(pending.flatMap(operation => operation.changes.map(change => syncKey(change.entity, change.record_id))));
          const collision = records.find(row => pendingKeys.has(syncKey(row.entity, row.record_id)) && Number(row.version) > Number(known.get(`version/${syncKey(row.entity, row.record_id)}`) || 0));
          if (collision) return fail(Object.assign(new Error('Une modification locale non envoyée chevauche une modification distante'), { code: 'SYNC_CONFLICT', row: collision }));
          try {
            for (const row of records) applyRemoteRow(tx, row, known);
            tx.objectStore('syncMeta').put({ id: 'historyCursor', value: String(cursor || '0') });
            resolve(null);
          } catch (error) { fail(error); }
        }
      });
      await transactionDone(tx);
      return conflict;
    },
    replaceFromRemote: async (records, cursor, { allowReplace = false } = {}) => {
      const tx = db.transaction(['programs', 'cycles', 'sessions', 'profileState', 'meta', 'outbox', 'syncMeta'], 'readwrite');
      const requests = [tx.objectStore('programs').getAll(), tx.objectStore('cycles').getAll(), tx.objectStore('sessions').getAll(),
        tx.objectStore('profileState').get(profileId), tx.objectStore('meta').get('activeSession'), tx.objectStore('outbox').getAll()];
      await new Promise((resolve, reject) => {
        let loaded = 0;
        const fail = error => { try { tx.abort(); } catch {} reject(error); };
        requests.forEach(request => { request.onerror = () => fail(new Error('Impossible de vérifier les données locales avant restauration'));
          request.onsuccess = () => { loaded++; apply(); }; });
        function apply() {
          if (loaded !== requests.length) return;
          const [programs, cycles, sessions, profileState, active, pending] = requests.map(item => item.result);
          if (pending.length) return fail(new Error('Restauration cloud refusée : des opérations locales attendent encore une décision'));
          const hasLocalData = programs.length || cycles.length || sessions.length || active?.data || profileState?.activeCycleId;
          if (hasLocalData && !allowReplace) return fail(Object.assign(new Error('La base locale a changé pendant la première synchronisation ; aucun remplacement automatique n’a été fait'), { code: 'SYNC_LOCAL_CHANGED' }));
          for (const name of ['programs', 'cycles', 'sessions', 'profileState']) tx.objectStore(name).clear();
          tx.objectStore('meta').delete('activeSession');
          tx.objectStore('syncMeta').clear();
          const known = new Map();
          try {
            for (const row of records) applyRemoteRow(tx, row, known);
            tx.objectStore('syncMeta').put({ id: 'initialized', value: true });
            tx.objectStore('syncMeta').put({ id: 'historyCursor', value: String(cursor || '0') });
            resolve();
          } catch (error) { fail(error); }
        }
      });
      await transactionDone(tx);
    },
    mergeInitialRemote: async (records, cursor) => {
      const tx = db.transaction([...STORE_NAMES], 'readwrite');
      const requests = [tx.objectStore('programs').getAll(), tx.objectStore('cycles').getAll(), tx.objectStore('sessions').getAll(),
        tx.objectStore('profileState').get(profileId), tx.objectStore('meta').get('activeSession'), tx.objectStore('outbox').getAll(), tx.objectStore('syncMeta').getAll()];
      const result = await new Promise((resolve, reject) => {
        let loaded = 0;
        const fail = error => { try { tx.abort(); } catch {} reject(error); };
        requests.forEach(request => {
          request.onerror = () => fail(new Error('Impossible de lire les données avant la fusion initiale'));
          request.onsuccess = () => {
            loaded++;
            if (loaded !== requests.length) return;
            const [programs, cycles, sessions, profileState, active, pending, metaEntries] = requests.map(item => item.result);
            const meta = tx.objectStore('syncMeta'), outbox = tx.objectStore('outbox');
            if (metaEntries.some(item => item.id === 'initialized' && item.value === true)) return fail(new Error('La première synchronisation a déjà été initialisée dans un autre onglet'));
            const local = { profileId, programs, cycles, sessions, profileState: profileState || { profileId, activeCycleId: null }, activeSession: active?.data || null };
            const localRecords = new Map();
            for (const program of programs) localRecords.set(syncKey('program', program.id), program);
            for (const cycle of cycles) localRecords.set(syncKey('cycle', cycle.id), cycle);
            for (const session of sessions) localRecords.set(syncKey('session', session.id), session);
            localRecords.set(syncKey('profile_state', 'profile'), local.profileState);
            if (local.activeSession) localRecords.set(syncKey('active_session', 'current'), local.activeSession);
            const remoteKeys = new Set(), conflicts = [], known = new Map(metaEntries.map(item => [item.id, item.value]));
            for (const row of records) {
              const key = syncKey(row.entity, row.record_id), localValue = localRecords.get(key);
              remoteKeys.add(key);
              if (!localValue) continue;
              if (!row.deleted_at && stableJson(localValue) === stableJson(row.payload)) continue;
              conflicts.push({ entity: row.entity, record_id: row.record_id, local: localValue, remote: { version: row.version, payload: row.payload, deleted_at: row.deleted_at } });
            }
            if (conflicts.length) {
              for (const conflict of conflicts) meta.put({ id: `conflict/${conflict.entity}/${conflict.record_id}`, value: structuredClone(conflict) });
              meta.put({ id: 'initialized', value: true }); meta.put({ id: 'historyCursor', value: String(cursor || '0') });
              return resolve({ conflicts, batches: [] });
            }
            for (const row of records) {
              const key = syncKey(row.entity, row.record_id);
              if (!localRecords.has(key) && !row.deleted_at) { known.delete(`version/${key}`); applyRemoteRow(tx, row, known); }
              else {
                const version = { id: `version/${key}`, value: Number(row.version) };
                meta.put(version); known.set(version.id, version.value);
              }
            }
            const localOnly = { ...local,
              programs: programs.filter(item => !remoteKeys.has(syncKey('program', item.id))),
              cycles: cycles.filter(item => !remoteKeys.has(syncKey('cycle', item.id))),
              sessions: sessions.filter(item => !remoteKeys.has(syncKey('session', item.id))),
              profileState: remoteKeys.has(syncKey('profile_state', 'profile')) ? null : local.profileState,
              activeSession: remoteKeys.has(syncKey('active_session', 'current')) ? null : local.activeSession
            };
            const batches = snapshotSyncBatches(localOnly, { includeProfileState: Boolean(localOnly.profileState) });
            for (const changes of batches) outbox.add({ opId: makeId(), profileId, createdAt: now(), changes: structuredClone(changes), status: 'pending' });
            meta.put({ id: 'initialized', value: true }); meta.put({ id: 'historyCursor', value: String(cursor || '0') });
            resolve({ conflicts: [], batches });
          };
        });
      });
      await transactionDone(tx);
      return result;
    },
    snapshot: async () => {
      const local = await localData();
      return makeBackup(local);
    },
    importBackup: async backup => {
      validateBackup(backup, profileId);
      const tx = db.transaction([...STORE_NAMES], 'readwrite');
      const outbox = tx.objectStore('outbox'), meta = tx.objectStore('syncMeta');
      const programsRequest = tx.objectStore('programs').getAll(), cyclesRequest = tx.objectStore('cycles').getAll();
      const sessionsRequest = tx.objectStore('sessions').getAll(), profileStateRequest = tx.objectStore('profileState').get(profileId);
      const activeRequest = tx.objectStore('meta').get('activeSession'), restRequest = tx.objectStore('meta').get('rest');
      const outboxRequest = outbox.getAll(), syncMetaRequest = meta.getAll();
      await new Promise((resolve, reject) => {
        let programs, cycles, sessions, profileState, active, rest, queued, syncValues, loaded = 0;
        const fail = error => { try { tx.abort(); } catch {} reject(error); };
        const requests = [programsRequest, cyclesRequest, sessionsRequest, profileStateRequest, activeRequest, restRequest, outboxRequest, syncMetaRequest];
        requests.forEach(request => {
          request.onerror = () => fail(new Error('Impossible de lire la base avant import'));
          request.onsuccess = () => { loaded++; apply(); };
        });
        function apply() {
          if (loaded !== requests.length) return;
          [programs, cycles, sessions, profileState, active, rest, queued, syncValues] = requests.map(request => request.result);
          if (queued.length) return fail(new Error('Import refusé : synchronise ou résous d’abord les opérations locales en attente.'));
          const before = { profileId, programs, cycles, sessions, profileState: profileState || { profileId, activeCycleId: null }, activeSession: active?.data || null, restUntil: rest?.until || 0 };
          for (const name of BACKUP_STORE_NAMES) tx.objectStore(name).clear();
          for (const program of backup.programs) tx.objectStore('programs').put(program);
          for (const cycle of backup.cycles) tx.objectStore('cycles').put(cycle);
          for (const session of backup.sessions) tx.objectStore('sessions').put(session);
          tx.objectStore('profileState').put(backup.profileState || { profileId, activeCycleId: null, updatedAt: now() });
          tx.objectStore('meta').delete('activeSession'); tx.objectStore('meta').delete('rest');
          if (backup.activeSession) tx.objectStore('meta').put({ id: 'activeSession', data: backup.activeSession });
          if (backup.restUntil) tx.objectStore('meta').put({ id: 'rest', until: backup.restUntil });
          // Before first pairing, the user must still choose the bootstrap action.
          // After pairing, represent the import as durable ordered RPC operations.
          if (syncValues.some(item => item.id === 'initialized' && item.value === true)) {
            for (const changes of backupSyncBatches(before, backup, now)) outbox.add({ opId: makeId(), profileId, createdAt: now(), changes, status: 'pending' });
          }
          resolve();
        }
      });
      await transactionDone(tx); signalMutation();
    },
    putProgram: async program => {
      validateProgram(program, profileId);
      const tx = db.transaction(['programs', 'outbox'], 'readwrite'), programs = tx.objectStore('programs');
      const request = programs.get(program.id);
      await new Promise((resolve, reject) => {
        request.onerror = () => { try { tx.abort(); } catch {} reject(request.error); };
        request.onsuccess = () => {
          const existing = request.result;
          const value = { ...program, revision: existing ? existing.revision + 1 : program.revision, createdAt: existing?.createdAt || now(), updatedAt: now() };
          programs.put(value);
          queueOutbox(tx, [changeRecord('program', value.id, value)]);
          resolve(value);
        };
      });
      await transactionDone(tx); signalMutation();
    },
    close: () => db.close()
  };
}
