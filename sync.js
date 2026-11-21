const PAGE_SIZE = 500;
const MAX_BATCH_SIZE = 100;

export function snapshotSyncBatches(snapshot, { includeProfileState = true } = {}) {
  const batches = [];
  const changes = (entity, recordId, payload, deleted = false) => ({ entity, record_id: recordId, deleted, payload });
  const appendChunks = records => { for (let index = 0; index < records.length; index += MAX_BATCH_SIZE) batches.push(records.slice(index, index + MAX_BATCH_SIZE)); };
  appendChunks((snapshot.programs || []).map(program => changes('program', program.id, program)));
  const cycles = snapshot.cycles || [];
  appendChunks(cycles.filter(item => item.status !== 'active').map(cycle => changes('cycle', cycle.id, cycle)));
  const activeCycle = cycles.find(item => item.status === 'active');
  if (activeCycle) {
    const transition = [changes('cycle', activeCycle.id, activeCycle)];
    if (includeProfileState) transition.push(changes('profile_state', 'profile', snapshot.profileState || { profileId: snapshot.profileId, activeCycleId: activeCycle.id }));
    batches.push(transition);
  } else if (includeProfileState) {
    batches.push([changes('profile_state', 'profile', snapshot.profileState || { profileId: snapshot.profileId, activeCycleId: null })]);
  }
  appendChunks((snapshot.sessions || []).filter(session => Number.isFinite(session.finished)).map(session => changes('session', session.id, session)));
  if (snapshot.activeSession) batches.push([changes('active_session', 'current', snapshot.activeSession)]);
  return batches;
}

function getError(result, operation) {
  if (result?.error) throw new Error(`${operation} : ${result.error.message || 'erreur Supabase'}`);
  return result?.data;
}

function rowKey(entity, recordId) { return `${entity}/${recordId}`; }

export function createSyncEngine({ supabase, repository, profileId, isOnline = () => globalThis.navigator?.onLine !== false, now = Date.now, onStatus = () => {}, onRemoteApplied = () => {} }) {
  if (!supabase?.rpc || !supabase?.from || !repository || !['me', 'wife'].includes(profileId)) throw new Error('Configuration du moteur de synchronisation invalide');
  let status = { state: 'pending', pendingCount: 0, lastSuccessAt: null, conflicts: [], message: 'En attente de la première synchronisation.' };
  let running = null;
  let initialDecision = null;
  const listeners = new Set([onStatus]);
  const setStatus = patch => {
    status = { ...status, ...patch };
    for (const listener of listeners) { try { listener({ ...status }); } catch {} }
    return { ...status };
  };
  const readResult = async query => getError(await query, 'Lecture Supabase');

  async function readHighWater() {
    const rows = await readResult(supabase.from('sync_record_history').select('change_id').eq('profile_id', profileId).order('change_id', { ascending: false }).limit(1));
    return rows?.[0]?.change_id || '0';
  }

  async function readCurrentRecords() {
    const records = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await readResult(supabase.from('sync_records').select('profile_id,entity,record_id,version,payload,updated_at,deleted_at').eq('profile_id', profileId).order('entity', { ascending: true }).order('record_id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1));
      records.push(...(page || []));
      if (!page || page.length < PAGE_SIZE) return records;
    }
  }

  async function pullHistory() {
    let syncState = await repository.getSyncState();
    let cursor = String(syncState.cursor || '0');
    for (;;) {
      const page = await readResult(supabase.from('sync_record_history').select('change_id,profile_id,entity,record_id,version,payload,deleted_at,changed_at').eq('profile_id', profileId).gt('change_id', cursor).order('change_id', { ascending: true }).limit(PAGE_SIZE));
      if (!page?.length) break;
      const latest = new Map();
      for (const row of page) {
        const key = rowKey(row.entity, row.record_id);
        const current = latest.get(key);
        if (!current || BigInt(row.version) > BigInt(current.version)) latest.set(key, row);
      }
      cursor = String(page.at(-1).change_id);
      const versions = [...latest.values()].map(row => [rowKey(row.entity, row.record_id), Number(row.version)]);
      await repository.applyRemoteRecords([...latest.values()], cursor, versions);
      onRemoteApplied();
      syncState = await repository.getSyncState();
      cursor = String(syncState.cursor || cursor);
      if (page.length < PAGE_SIZE) break;
    }
  }

  async function drainOutbox() {
    for (;;) {
      const outbox = await repository.listOutbox();
      setStatus({ pendingCount: outbox.length });
      if (!outbox.length) return;
      const operation = outbox[0];
      if (operation.status === 'conflict') {
        setStatus({ state: 'conflict', conflicts: [operation.conflict], message: 'Une modification locale entre en conflit avec une version distante. Rien n’a été écrasé.' });
        return false;
      }
      const prepared = await repository.prepareOutboxOperation(operation.opId);
      const changes = prepared.changes.map(change => ({
        profile_id: profileId,
        entity: change.entity,
        record_id: change.record_id,
        expected_version: Number(change.expected_version),
        deleted: Boolean(change.deleted),
        payload: change.payload
      }));
      const result = getError(await supabase.rpc('apply_sync_batch', { p_op_id: prepared.opId, p_changes: changes }), 'Envoi Supabase');
      if (result?.status === 'conflict') {
        await repository.markOutboxConflict(prepared.opId, result);
        setStatus({ state: 'conflict', conflicts: result.conflicts || [], pendingCount: (await repository.listOutbox()).length, message: 'Conflit détecté. Les deux versions sont conservées pour décision.' });
        return false;
      }
      if (result?.status !== 'applied' || result.op_id !== prepared.opId || !Array.isArray(result.records)) throw new Error('Réponse RPC apply_sync_batch invalide');
      await repository.acknowledgeOutboxOperation(prepared.opId, result.records);
    }
  }

  async function initialSync() {
    const local = await repository.getSyncSnapshot();
    const localHasData = Boolean(local.programs?.length || local.cycles?.length || local.sessions?.length || local.activeSession || local.profileState?.activeCycleId);
    const highWater = await readHighWater(); // Capture avant le snapshot : les écritures ultérieures seront dans l’historique après ce curseur.
    const remote = await readCurrentRecords();
    if (!localHasData && !remote.length) {
      const initialized = await repository.initializeEmptyIfUnchanged?.(highWater);
      if (initialized === false) return initialSync();
      if (initialized === undefined) await repository.markSyncInitialized(highWater);
      return true;
    }
    if (!localHasData && remote.length) {
      try { await repository.replaceFromRemote(remote, highWater); }
      catch (error) { if (error.code === 'SYNC_LOCAL_CHANGED') return initialSync(); throw error; }
      await pullHistory();
      await repository.markSyncInitialized((await repository.getSyncState()).cursor);
      onRemoteApplied();
      return true;
    }
    initialDecision = { local, remote, highWater };
    setStatus({ state: 'needs-decision', decisionType: remote.length ? 'both' : 'local-only', pendingCount: (await repository.listOutbox()).length,
      message: remote.length ? 'Des données existent sur cet appareil et dans le cloud. Choisis explicitement comment les réunir.' : 'Des données locales existent. Confirme leur premier envoi vers le cloud.' });
    return false;
  }

  async function chooseInitialSync(choice) {
    if (!initialDecision) throw new Error('Aucune décision de première synchronisation n’est attendue');
    if (!isOnline()) return setStatus({ state: 'pending', message: 'Choix enregistré localement ; connexion requise pour synchroniser.' });
    const { local, remote, highWater } = initialDecision;
    if (choice === 'upload') {
      if (remote.length) throw new Error('Le cloud contient déjà des données ; un envoi intégral n’est pas autorisé.');
      if (repository.enqueueCurrentSnapshotForInitialUpload) await repository.enqueueCurrentSnapshotForInitialUpload(highWater);
      else await repository.enqueueInitialUpload(snapshotSyncBatches(await repository.getSyncSnapshot()), { replaceUnsent: true });
    } else if (choice === 'merge') {
      if (!remote.length) throw new Error('Aucune donnée cloud à fusionner. Confirme plutôt le premier envoi.');
      const merged = await repository.mergeInitialRemote(remote, highWater);
      if (merged.conflicts?.length) {
        initialDecision = null;
        await repository.markSyncInitialized(highWater);
        setStatus({ state: 'conflict', conflicts: merged.conflicts, pendingCount: (await repository.listOutbox()).length,
          message: 'La fusion a conservé les versions différentes sans les écraser. Résous les conflits avant de poursuivre.' });
        return { ...status };
      }
    } else if (choice === 'restore') {
      if ((await repository.listOutbox()).length) throw new Error('Synchronise ou exporte d’abord les opérations locales en attente.');
      await repository.replaceFromRemote(remote, highWater, { allowReplace: true });
      onRemoteApplied();
    } else throw new Error('Choix de synchronisation invalide');
    await repository.markSyncInitialized(highWater);
    initialDecision = null;
    return runSync();
  }

  async function runSync() {
    if (!isOnline()) return setStatus({ state: 'pending', pendingCount: (await repository.listOutbox()).length, message: 'Hors ligne. Les modifications restent dans la file locale.' });
    setStatus({ state: 'pending', message: 'Vérification de la file locale…' });
    const syncState = await repository.getSyncState();
    if (syncState.lastSuccessAt && !status.lastSuccessAt) setStatus({ lastSuccessAt: syncState.lastSuccessAt });
    const persistedConflicts = await repository.listSyncConflicts?.() || [];
    if (persistedConflicts.length) return setStatus({ state: 'conflict', conflicts: persistedConflicts,
      pendingCount: (await repository.listOutbox()).length, message: 'Des conflits conservés nécessitent une décision avant la reprise.' });
    if (!syncState.initialized) {
      const completed = await initialSync();
      if (!completed) return { ...status };
    }
    const drained = await drainOutbox();
    if (drained === false) return { ...status };
    await pullHistory();
    const pendingCount = (await repository.listOutbox()).length;
    const lastSuccessAt = pendingCount ? status.lastSuccessAt : now();
    if (!pendingCount) await repository.markSyncSuccess?.(lastSuccessAt);
    return setStatus({ state: pendingCount ? 'pending' : 'synchronized', pendingCount,
      lastSuccessAt, conflicts: [],
      message: pendingCount ? 'Des modifications restent en attente.' : 'Données à jour sur cet appareil.' });
  }

  return {
    syncNow() {
      if (running) return running;
    running = runSync().catch(async error => {
      if (error.code === 'SYNC_CONFLICT') return setStatus({ state: 'conflict', conflicts: [error.row].filter(Boolean), pendingCount: (await repository.listOutbox()).length, message: 'Une modification locale chevauche une modification distante. Les données restent conservées.' });
      return setStatus({ state: 'error', pendingCount: (await repository.listOutbox()).length, message: `Synchronisation en erreur : ${error.message}` });
    })
        .finally(() => { running = null; });
      return running;
    },
    chooseInitialSync,
    getStatus: () => ({ ...status }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}
