import { openDatabase, createRepository, currentCycleWeek, matchExerciseByStableId, programStatus, saveProgramJson as persistProgramJson } from './data.js';
import { formatLocalDateKey, getCalendarMonth, shiftCalendarMonth } from './calendar.js';
import { createAuthService } from './auth.js';
import { bindLocalDataOwner } from './auth-guard.js';
import { createSupabaseClient } from './supabase-client.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';
import { createSyncEngine } from './sync.js';
import { BUILTIN_PROGRAMS } from './programs-v2.js';

let profile = localStorage.getItem('forgefit-user') || null;
let repository;
let syncEngine = null;
let syncStatus = null;
let authService;
let supabaseClient;
let authSession = null;
let authStatus = 'loading';
let authError = '';
let accountLocked = false;
let authUserEmail = '';
let authGeneration = 0;
let exerciseImageInventory = null;
const today = new Date();
let state = { page: 'home', programs: [], cycles: [], sessions: [], profileState: null, active: null, restUntil: 0,
  calendarYear: today.getFullYear(), calendarMonth: today.getMonth(), selectedDateKey: formatLocalDateKey(today.getTime()) };
let motivationIndex = 0;
const el = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const uid = () => crypto.randomUUID();
const encouragements = {
  wife: ['Tu es une bête, Rania ! 🔥', 'Championne ! Encore une série de gagnée ! 💪', 'Chaque répétition compte. Tu progresses !', 'Magnifique effort ! Récupère et repars !'],
  me: ['Bien joué Rochdi ! 💪', 'Une série validée, continue !', 'Solide ! La régularité fait la différence.', 'Excellent travail ! Récupère avant la suite.']
};

function toast(message) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.style.display = 'block';
  setTimeout(() => { node.style.display = 'none'; }, 2800);
}

function onboarding() {
  document.getElementById('nav').hidden = true;
  el.innerHTML = `${connectionBadge()}<main class="welcome"><div class="welcome-mark">◆</div><div class="eyebrow">Bienvenue sur ROCH&RANIA FIT</div><h1>Qui s'entraîne ?</h1><p class="muted">Choisis ton profil sur cet iPhone. Les programmes et cycles restent séparés.</p><div class="welcome-options"><button class="welcome-card" data-action="select-user" data-id="me"><span class="welcome-avatar">R</span><span><strong>Rochdi</strong><small>Bibliothèque de programmes</small></span><span>→</span></button><button class="welcome-card" data-action="select-user" data-id="wife"><span class="welcome-avatar">R</span><span><strong>Rania</strong><small>Rania va tout casser ! C’est une bête 🔥</small></span><span>→</span></button></div><p class="hint">Données conservées localement sur cet appareil.</p></main>`;
}

function authScreen() {
  document.getElementById('nav').hidden = true;
  const configured = authStatus !== 'unconfigured';
  const title = accountLocked ? 'Données locales protégées' : configured ? 'Connexion' : 'Configuration requise';
  const content = accountLocked
    ? `<p class="muted">Cette base locale est associée à un autre compte Supabase. Pour protéger les données déjà présentes sur cet appareil, l’accès sportif reste bloqué. Les données ne sont pas effacées.</p><button class="secondary" data-action="auth-signout">Se déconnecter</button>`
    : configured
      ? `<p class="muted">Connecte-toi avec le compte partagé pour accéder aux profils Rochdi et Rania. Les données sportives restent enregistrées localement sur cet appareil.</p><form id="login-form" class="stack"><label>Adresse e-mail<input name="email" type="email" autocomplete="username" required></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" id="login-submit" type="submit">Se connecter</button></form>${authError ? `<p class="auth-error" role="alert">${esc(authError)}</p>` : ''}<p class="hint">La première connexion nécessite Internet. La session est ensuite conservée sur cet appareil.</p>`
      : `<p class="muted">Renseigne la Project URL et la Publishable Key dans <code>supabase-config.js</code>, puis recharge l’application.</p>`;
  el.innerHTML = `${connectionBadge()}<main class="welcome"><div class="welcome-mark">◆</div><div class="eyebrow">ROCH&RANIA FIT</div><h1>${title}</h1><section class="card auth-card">${content}</section></main>`;
}

function clearSportMemory() {
  repository?.close(); repository = null; profile = null;
  syncEngine = null; syncStatus = null;
  const panel = document.getElementById('sync-panel'); if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  state = { ...state, programs: [], cycles: [], sessions: [], profileState: null, active: null, restUntil: 0 };
}

function updateSyncPanel(status = syncEngine?.getStatus()) {
  const panel = document.getElementById('sync-panel');
  if (!panel || !repository || !status) return;
  syncStatus = status;
  const lastSync = status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString('fr-FR') : 'aucune synchronisation réussie';
  let actions = '';
  if (status.state === 'needs-decision' && status.decisionType === 'local-only') {
    actions = '<button class="primary" data-action="sync-upload">Confirmer le premier envoi</button>';
  } else if (status.state === 'needs-decision' && status.decisionType === 'both') {
    actions = '<button class="primary" data-action="sync-merge">Fusionner sans écraser les conflits</button><button class="secondary" data-action="sync-restore">Restaurer depuis le cloud</button>';
  } else if (status.state === 'error' || status.state === 'pending') {
    actions = '<button class="secondary" data-action="sync-now">Réessayer</button>';
  } else if (status.state === 'conflict') {
    actions = '<button class="secondary" data-action="export">Exporter les données locales</button>';
  }
  const label = { synchronized: 'Synchronisé', pending: 'En attente', error: 'Erreur de synchronisation', conflict: 'Conflit à résoudre', 'needs-decision': 'Choix de première synchronisation requis', syncing: 'Synchronisation…' }[status.state] || 'Synchronisation';
  const conflictSummary = status.state === 'conflict' && status.conflicts?.length ? `<div class="hint">${status.conflicts.length} enregistrement(s) concerné(s) : ${status.conflicts.slice(0, 4).map(item => `${esc(item.entity || 'donnée')} · ${esc(item.record_id || '')}`).join(', ')}. Les opérations sont conservées et la file est suspendue.</div>` : '';
  panel.innerHTML = `<div class="sync-panel-card"><div class="row"><strong>${label}</strong><small>En attente : ${Number(status.pendingCount || 0)} · dernière réussite : ${lastSync}</small></div><p>${esc(status.message || '')}</p>${conflictSummary}<div class="sync-actions">${actions}</div></div>`;
  panel.hidden = false;
}

function connectSync(dbRepository) {
  syncEngine = createSyncEngine({
    supabase: supabaseClient,
    repository: dbRepository,
    profileId: profile,
    onStatus: updateSyncPanel,
    onRemoteApplied: () => { if (repository === dbRepository) void refresh(); }
  });
  dbRepository.setOnLocalMutation(() => { void syncEngine?.syncNow(); });
  void syncAndSeedBuiltIns(dbRepository, syncEngine);
}

async function seedBuiltInsAfterSync(dbRepository, engine, result) {
  if (!dbRepository || !engine || repository !== dbRepository || ['needs-decision', 'conflict'].includes(result?.state)) return;
  if (!(await dbRepository.getSyncState()).initialized) return;
  const inserted = await dbRepository.ensureBuiltInPrograms(BUILTIN_PROGRAMS[dbRepository.profileId] || []);
  if (inserted.length && repository === dbRepository) await refresh();
}

async function syncAndSeedBuiltIns(dbRepository = repository, engine = syncEngine) {
  if (!engine) return;
  const result = await engine.syncNow();
  await seedBuiltInsAfterSync(dbRepository, engine, result);
  return result;
}

function exercisePhotos(exercise) {
  const entries = exerciseImageInventory?.profiles?.[profile]?.exercises || [];
  const entry = entries.find(item => item.exerciseId === exercise.id && item.status === 'matched_downloaded');
  const files = (entry?.files || []).filter(file => /^(me|wife)\/[a-z0-9-]+-[01]\.jpg$/.test(file)).slice(0, 2);
  if (!files.length) return '<div class="exercise-photo-placeholder" role="img" aria-label="Photo non disponible">Photo non disponible</div>';
  return `<div class="exercise-photos">${files.map((file, index) => `<img src="./images/exercises/${esc(file)}" alt="${esc(exercise.name)} — phase ${index + 1}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'exercise-photo-placeholder',textContent:'Photo non disponible'}))">`).join('')}</div>`;
}

function exercisePrescription(exercise) {
  const unit = exercise.repUnit === 'seconds' ? 's' : 'reps';
  const qualifier = exercise.repQualifier ? ` ${esc(exercise.repQualifier)}` : '';
  const rir = exercise.rirMax === undefined ? `${exercise.rir}` : `${exercise.rir}–${exercise.rirMax}`;
  return `${exercise.sets} × ${exercise.repMin}–${exercise.repMax}${qualifier} ${unit} · RIR ${rir} · repos ${exercise.restSeconds}s`;
}

async function handleAuthSession(session) {
  const previousUserId = authSession?.user?.id;
  const generation = ++authGeneration;
  const userId = session?.user?.id;
  authSession = session || null;
  authUserEmail = session?.user?.email || '';
  if (userId && userId === previousUserId && authStatus === 'signed-in' && repository) return;
  authError = '';
  if (!userId) {
    clearSportMemory(); accountLocked = false; authStatus = 'signed-out'; authScreen(); return;
  }
  if (!bindLocalDataOwner(userId)) {
    clearSportMemory(); accountLocked = true; authStatus = 'locked'; authScreen(); return;
  }
  accountLocked = false; authStatus = 'signed-in';
  profile = localStorage.getItem('forgefit-user') || null;
  if (!profile) { clearSportMemory(); authStatus = 'signed-in'; authScreen(); onboarding(); return; }
  try {
    repository?.close();
    const db = await openDatabase(profile);
    if (generation !== authGeneration || authSession?.user?.id !== userId) { db.close(); return; }
    repository = createRepository(db, profile);
    connectSync(repository);
    document.getElementById('nav').hidden = false;
    await refresh();
  } catch (error) {
    clearSportMemory(); authStatus = 'storage-error';
    el.innerHTML = `<main class="welcome"><h1>Erreur de stockage</h1><section class="card">Impossible d’ouvrir la base locale : ${esc(error.message)}. Vérifie que Safari autorise le stockage local.</section></main>`;
  }
}

function connectionBadge() {
  if (authStatus !== 'signed-in') return '';
  const online = navigator.onLine;
  return `<div class="connection-badge" role="status">${online ? 'Compte authentifié' : 'Hors ligne · données locales'}${online ? ` · ${esc(authUserEmail)}` : ''}</div>`;
}

async function selectUser(target) {
  if (!['me', 'wife'].includes(target)) return;
  repository?.close();
  profile = target;
  localStorage.setItem('forgefit-user', target);
  localStorage.setItem('forgefit-profile', target);
  repository = createRepository(await openDatabase(profile), profile);
  connectSync(repository);
  state.page = 'home';
  document.getElementById('nav').hidden = false;
  await refresh();
}

async function refresh() {
  [state.programs, state.cycles, state.sessions, state.profileState, state.active, state.restUntil] = await Promise.all([
    repository.listPrograms(), repository.listCycles(), repository.listSessions(), repository.getProfileState(),
    repository.getActiveSession(), repository.getRestUntil()
  ]);
  render();
}

function activeCycle() {
  return state.cycles.find(cycle => cycle.id === state.profileState?.activeCycleId && cycle.status === 'active') || null;
}

function header(title, subtitle) {
  return `<header><div class="eyebrow">ROCH&RANIA FIT · ${profile === 'wife' ? 'Rania · Une vraie championne 🔥' : 'Rochdi'}</div><h1>${title}</h1><div class="muted">${subtitle}</div></header>`;
}

function nav() {
  document.querySelectorAll('#nav button').forEach(button => button.classList.toggle('active', button.dataset.page === state.page));
}

function render() {
  if (!repository || authStatus !== 'signed-in') { authScreen(); return; }
  nav();
  const pages = { home, programs, calendar, workout, progress, settings };
  el.innerHTML = connectionBadge() + (pages[state.page] || home)();
  updateTimer();
}

function programCard(program) {
  const status = programStatus(program, state.cycles, state.profileState?.activeCycleId);
  const statusLabels = { active: 'Cycle actif', used: 'Déjà utilisé', archived: 'Archivé', available: 'Disponible' };
  const actionLabel = status === 'available' ? 'Activer' : 'Réactiver';
  const sessions = program.sessions.map(session => `<section class="program-session"><div class="row"><b>${esc(session.name)}</b><span class="hint">${session.exercises.length} exercices</span></div>${session.exercises.map(exercise => `<article class="program-exercise">${exercisePhotos(exercise)}<div><b>${esc(exercise.name)}</b><div class="hint">${exercisePrescription(exercise)}</div></div></article>`).join('')}</section>`).join('');
  const editableJson = esc(JSON.stringify(program, null, 2));
  return `<article class="card program-card"><div class="row"><div><h3>${esc(program.name)}</h3><div class="muted">${esc(program.description || 'Aucune description')}</div><div class="hint">${program.durationWeeks} semaines indicatives · révision ${program.revision}</div></div><span class="pill">${statusLabels[status]}</span></div><div class="row program-actions"><button class="primary" data-action="activate" data-id="${esc(program.id)}" ${state.profileState?.activeCycleId || state.active ? 'disabled' : ''}>${actionLabel}</button><details><summary>Voir les séances</summary>${sessions}</details></div><details class="program-editor"><summary>Modifier ce programme en JSON</summary><label class="hint" for="program-editor-${esc(program.id)}">Conserve l’identifiant du programme et les identifiants d’exercices pour préserver le suivi.</label><textarea class="program-json" id="program-editor-${esc(program.id)}" data-program-editor="${esc(program.id)}" spellcheck="false">${editableJson}</textarea><button class="secondary" data-action="save-program" data-id="${esc(program.id)}">Enregistrer les modifications</button></details></article>`;
}

function home() {
  const cycle = activeCycle();
  const finished = state.sessions.filter(session => session.finished);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
  const thisWeek = finished.filter(session => session.finished >= weekStart.getTime()).length;
  return header('Accueil', 'Entraîne-toi à ton rythme') + `<main>
    <div class="grid2"><div class="card"><div class="stats">${thisWeek}</div><small>Séances terminées cette semaine</small></div><div class="card"><div class="stats">${finished.length}</div><small>Séances terminées</small></div></div>
    ${state.active ? `<div class="card"><h3>Séance en cours · ${esc(state.active.routineName)}</h3><button class="primary" data-action="resume">Reprendre la séance →</button></div>` : ''}
    ${cycle ? `<div class="card"><div class="eyebrow">Cycle actif</div><h2>${esc(cycle.programSnapshot.name)}</h2><div class="hint">Semaine ${currentCycleWeek(cycle)} · cible ${cycle.targetWeeks} semaines</div><button class="secondary smallbtn" data-page="programs" style="margin-top:12px">Gérer le cycle et les programmes</button></div>` : '<div class="card"><h2>Aucun cycle actif</h2><p class="muted">Choisis un programme dans « Mes programmes » pour commencer. Aucun changement ne se fait automatiquement.</p><button class="primary" data-page="programs">Voir mes programmes</button></div>'}
    <button class="secondary" data-page="programs" style="width:100%">Mes programmes · ${state.programs.length}</button>
  </main>`;
}

function programs() {
  const cycle = activeCycle();
  return header('Mes programmes', 'Bibliothèque personnelle · programmes modifiables en JSON') + `<main>
    ${cycle ? `<section class="card"><div class="eyebrow">Cycle actif</div><h2>${esc(cycle.programSnapshot.name)}</h2><div class="hint">Semaine ${currentCycleWeek(cycle)} · durée cible ${cycle.targetWeeks} semaines · commencé le ${new Date(cycle.startedAt).toLocaleDateString('fr-FR')}</div><div class="row program-actions"><button class="secondary" data-action="extend-cycle" ${state.active ? 'disabled' : ''}>Prolonger d’une semaine</button><button class="danger" data-action="end-cycle" ${state.active ? 'disabled' : ''}>Terminer le cycle</button></div>${state.active ? '<div class="hint">Termine ou abandonne la séance en cours avant de modifier le cycle.</div>' : ''}<h3 style="margin-top:16px">Séances du cycle</h3>${cycle.programSnapshot.sessions.map(session => `<div class="row exercise"><div><b>${esc(session.name)}</b><div class="hint">${session.exercises.length} exercices</div></div><button class="primary" data-action="start-session" data-id="${esc(session.id)}" ${state.active ? 'disabled' : ''}>Démarrer</button></div>`).join('')}</section>` : `<section class="card"><h2>Aucun cycle actif</h2><p class="muted">Active un programme disponible. Pour passer à un autre programme, termine d’abord le cycle actif.</p>${state.active ? '<div class="hint">Les actions de cycle sont bloquées pendant une séance.</div>' : ''}</section>`}
    <div class="row"><h2>Bibliothèque</h2><span class="pill">${state.programs.length} programme(s)</span></div>
    ${state.programs.length ? state.programs.map(program => programCard(program)).join('') : '<div class="empty card">Aucun programme pour ce profil. Importe un fichier programme JSON pour remplir ta bibliothèque ; l’historique ne sera pas remplacé.</div>'}
    <section class="card"><h3>Ajouter ou importer un programme</h3><p class="muted">Choisis un fichier JSON contenant un seul programme, ou colle son contenu ci-dessous. Réimporter un identifiant existant met à jour le programme sans modifier ses anciens cycles ni l’historique.</p><label class="button program-file-label">Importer un programme JSON<input type="file" id="program-file" accept="application/json,.json" hidden></label><label class="hint" for="new-program-json">JSON du programme</label><textarea class="program-json" id="new-program-json" spellcheck="false" placeholder="Colle ici un objet programme V2"></textarea><button class="primary" data-action="save-new-program">Enregistrer le programme</button></section>
  </main>`;
}

function calendar() {
  const month = getCalendarMonth(state.calendarYear, state.calendarMonth, state.sessions, profile);
  const monthTitle = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(month.year, month.month, 1));
  const selectedDate = month.days.find(day => day.key === state.selectedDateKey);
  const hasAnyCompleted = state.sessions.some(session => session.profileId === profile && Number.isFinite(session.finished));
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const cells = month.days.map(day => {
    const classes = ['calendar-day', day.inMonth ? '' : 'outside-month', day.sessions.length ? 'has-sessions' : '', day.key === state.selectedDateKey ? 'selected' : ''].filter(Boolean).join(' ');
    const sessionLabel = day.sessions.length ? `, ${day.sessions.length} séance${day.sessions.length > 1 ? 's' : ''} terminée${day.sessions.length > 1 ? 's' : ''}` : '';
    return `<button class="${classes}" data-action="select-calendar-day" data-date="${day.key}" aria-pressed="${day.key === state.selectedDateKey}" aria-label="${day.date.toLocaleDateString('fr-FR', { dateStyle: 'full' })}${sessionLabel}"><span>${day.date.getDate()}</span>${day.sessions.length ? `<small>${day.sessions.length}</small>` : ''}</button>`;
  }).join('');
  const selectedSessions = selectedDate?.sessions || [];
  const details = selectedSessions.length ? selectedSessions.map(session => `<article class="card calendar-session"><div class="row"><div><h3>${esc(session.routineName || session.sessionName || 'Séance')}</h3><div class="hint">${esc(session.programName || 'Programme')} · terminée à ${new Date(session.finished).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></div></div>${(session.exercises || []).map(exercise => {
    const completedSets = (exercise.sets || []).map((set, index) => ({ set, index })).filter(item => item.set.done);
    return `<div class="calendar-exercise"><b>${esc(exercise.name)}</b>${completedSets.length ? completedSets.map(({ set, index }) => `<div class="hint">Série ${index + 1} · ${esc(set.kg === '' || set.kg == null ? '—' : set.kg)} kg × ${esc(set.reps)} reps</div>`).join('') : '<div class="hint">Aucune série validée</div>'}</div>`;
  }).join('')}</article>`).join('') : '<div class="empty card">Aucune séance terminée à cette date.</div>';
  const selectedDateTitle = state.selectedDateKey ? (() => {
    const [year, monthNumber, day] = state.selectedDateKey.split('-').map(Number);
    return new Date(year, monthNumber - 1, day).toLocaleDateString('fr-FR', { dateStyle: 'full' });
  })() : 'Sélectionne une date';
  return header('Calendrier', 'Jours marqués : au moins une séance réellement terminée') + `<main>
    <section class="card calendar-card"><div class="calendar-heading"><button class="secondary" data-action="calendar-prev" aria-label="Mois précédent">‹</button><h2>${esc(monthTitle.charAt(0).toLocaleUpperCase('fr-FR') + monthTitle.slice(1))}</h2><button class="secondary" data-action="calendar-next" aria-label="Mois suivant">›</button></div><div class="calendar-count"><span class="calendar-legend"></span>${month.sessionCount} séance${month.sessionCount === 1 ? '' : 's'} terminée${month.sessionCount === 1 ? '' : 's'} ce mois</div><div class="calendar-grid calendar-weekdays">${weekdays.map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells}</div></section>
    <h2>${esc(selectedDateTitle)}</h2>
    ${!hasAnyCompleted ? '<div class="empty card">Aucune séance terminée pour ce profil. Les séances commencées ou planifiées n’apparaissent pas dans le calendrier.</div>' : details}
  </main>`;
}

function lastSet(exerciseId, exerciseName, index) {
  for (const session of state.sessions) {
    if (!session.finished) continue;
    const exercise = matchExerciseByStableId(session.exercises, exerciseId, exerciseName);
    if (exercise?.sets[index]?.done) return exercise.sets[index];
  }
  return null;
}

async function startSession(sessionId) {
  if (state.active) return toast('Termine ou abandonne la séance en cours avant d’en démarrer une autre.');
  const session = await repository.startSession(sessionId);
  const cycle = activeCycle();
  for (const exercise of session.exercises) exercise.sets.forEach((set, index) => {
    const previous = lastSet(exercise.id, exercise.name, index);
    if (previous) { set.kg = previous.kg; set.reps = previous.reps; }
  });
  await repository.saveActiveSession(session);
  state.active = session;
  page('workout');
}

function workout() {
  const session = state.active;
  if (!session) return header('Séance', 'Aucune séance en cours') + '<main><div class="empty">Choisis une séance depuis le programme actif.</div></main>';
  const done = session.exercises.reduce((count, exercise) => count + exercise.sets.filter(set => set.done).length, 0);
  const total = session.exercises.reduce((count, exercise) => count + exercise.sets.length, 0);
  return header(esc(session.routineName), `Commencée à ${new Date(session.started).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`) + `<main><div id="motivation-banner" class="motivation-banner" role="status" hidden></div><div class="card"><div class="row"><b>${done} / ${total} séries</b><div><div class="timer" id="timer">--:--</div><button class="smallbtn secondary" data-action="cancel-rest">Arrêter repos</button></div></div><div class="progressbar" style="margin-top:12px"><div style="width:${100 * done / Math.max(1, total)}%"></div></div></div>
    ${session.exercises.map((exercise, ei) => `<div class="card"><div class="row"><div><b>${esc(exercise.name)}</b><div class="hint">${exercisePrescription(exercise)}</div></div><button class="secondary smallbtn" data-action="add-set" data-e="${ei}">+ série</button></div>${exercisePhotos(exercise)}
    ${exercise.sets.map((set, si) => `<div class="set"><div class="pill">${si + 1}</div><label>kg<input type="number" min="0" max="1000" step="0.5" data-field="kg" data-e="${ei}" data-s="${si}" value="${esc(set.kg)}"></label><label>${exercise.repUnit === 'seconds' ? 'secondes' : 'reps'}<input type="number" min="0" max="200" step="1" data-field="reps" data-e="${ei}" data-s="${si}" value="${esc(set.reps)}"></label><button class="${set.done ? 'done' : ''}" data-action="toggle-set" data-e="${ei}" data-s="${si}">${set.done ? '✓' : '○'}</button></div>`).join('')}
    <div class="hint">Dernière séance : ${exercise.sets.map((_, index) => { const previous = lastSet(exercise.id, exercise.name, index); return previous ? `${previous.kg} kg × ${previous.reps}` : null; }).filter(Boolean).join(' · ') || 'Pas encore d’historique'}</div></div>`).join('')}
    <button class="primary" style="width:100%;margin-top:10px" data-action="finish-session">Terminer et enregistrer</button><button class="danger" style="width:100%;margin-top:10px" data-action="discard-session">Abandonner la séance</button></main>`;
}

function progress() {
  const finished = state.sessions.filter(session => session.finished);
  const volume = finished.reduce((sum, session) => sum + session.exercises.reduce((subtotal, exercise) => subtotal + exercise.sets.reduce((value, set) => value + (set.done ? Number(set.kg || 0) * Number(set.reps || 0) : 0), 0), 0), 0);
  const exercises = new Map();
  for (const session of finished) for (const exercise of session.exercises) {
    const key = exercise.id || `legacy:${exercise.name}`;
    if (!exercises.has(key)) exercises.set(key, exercise.name);
  }
  const options = [...exercises].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  return header('Progression', 'Performances et historique de tes séances') + `<main><div class="grid2"><div class="card"><div class="stats">${finished.length}</div><small>Séances terminées</small></div><div class="card"><div class="stats">${Math.round(volume).toLocaleString('fr-FR')}</div><small>kg de volume cumulé</small></div></div><div class="card"><h3>Évolution par exercice</h3><select id="exercise-select"><option value="">Choisir un exercice</option>${options.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select><div id="exercise-chart" class="hint" style="margin-top:15px">Sélectionne un exercice pour voir tes charges.</div></div><h2>Historique</h2>${finished.length ? finished.map(session => `<div class="card"><div class="row"><div><b>${esc(session.programName)} · ${esc(session.routineName)}</b><div class="hint">${new Date(session.finished).toLocaleDateString('fr-FR')} · ${session.exercises.reduce((count, exercise) => count + exercise.sets.filter(set => set.done).length, 0)} séries</div></div><button class="smallbtn secondary" data-action="detail" data-id="${esc(session.id)}">Détails</button></div></div>`).join('') : '<div class="empty">Termine une première séance pour voir ta progression.</div>'}</main>`;
}

function drawChart(name) {
  const out = document.getElementById('exercise-chart');
  if (!out) return;
  const points = state.sessions.filter(session => session.finished).slice().reverse().map(session => {
    const exercise = session.exercises.find(item => item.id === name) || session.exercises.find(item => !item.id && `legacy:${item.name}` === name);
    const weights = exercise?.sets.filter(set => set.done && Number(set.kg) > 0).map(set => Number(set.kg)) || [];
    return weights.length ? { date: new Date(session.finished).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), kg: Math.max(...weights) } : null;
  }).filter(Boolean);
  if (!points.length) { out.textContent = 'Aucune série avec charge pour cet exercice.'; return; }
  const min = Math.min(...points.map(point => point.kg)), max = Math.max(...points.map(point => point.kg)), span = Math.max(max - min, 1);
  const x = index => 20 + index * 300 / Math.max(1, points.length - 1), y = point => 145 - (point.kg - min) / span * 115;
  const coords = points.map((point, index) => `${x(index)},${y(point)}`).join(' ');
  out.innerHTML = `<svg viewBox="0 0 340 180" class="chart" role="img" aria-label="Évolution des charges maximales"><line x1="20" y1="150" x2="330" y2="150" stroke="#66748a"/><polyline fill="none" stroke="#f6c83e" stroke-width="3" points="${coords}"/>${points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point)}" r="4" fill="#59d7a5"/><text x="${x(index)}" y="${y(point) - 9}" font-size="10" fill="white" text-anchor="middle">${point.kg}</text>`).join('')}</svg><div class="hint">Charge maximale par séance (kg), ${points.length} point(s).</div>`;
}

function settings() {
  return header('Réglages', 'Profil, compte et sauvegarde locale') + `<main><div class="card"><h3>Profil : ${profile === 'wife' ? 'Rania' : 'Rochdi'}</h3><p class="hint">Compte connecté : ${esc(authUserEmail)}</p><button class="secondary" data-action="change-user">Changer d’utilisateur</button><p class="hint">Les bibliothèques, cycles et historiques restent séparés.</p><button class="secondary" data-action="auth-signout">Déconnexion de cet appareil</button></div><div class="card"><h3>Synchronisation du compte</h3><p class="muted">${esc(syncStatus?.message || 'Les modifications sont conservées localement et envoyées lorsque le réseau est disponible.')}</p><button class="secondary" data-action="sync-now">Synchroniser maintenant</button></div><div class="card"><h3>Motivation après chaque série</h3><label class="voice-setting"><input id="voice-toggle" type="checkbox" ${localStorage.getItem('forgefit-voice') === 'on' ? 'checked' : ''}> Lire les encouragements à voix haute</label></div><div class="card"><h3>Sauvegarde V2</h3><p class="muted">L’export contient programmes, cycles, historique, séance active et minuteur. L’import remplace les données locales de ce profil ; il est refusé si des opérations attendent leur synchronisation ou leur résolution.</p><div class="stack"><button class="primary" data-action="export">Exporter JSON V2</button><label class="button" style="display:block;background:#273247;border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center">Importer JSON V2<input type="file" id="import-file" accept="application/json,.json" style="display:none"></label></div></div><div class="card"><p class="muted">ROCH&RANIA FIT conserve une copie locale. L’export JSON reste une sauvegarde supplémentaire.</p></div></main>`;
}

async function persistActive() { await repository.saveActiveSession(state.active); }
function page(name) { state.page = name; render(); scrollTo(0, 0); }
function encourage() {
  const phrases = encouragements[profile === 'wife' ? 'wife' : 'me'];
  const message = phrases[motivationIndex++ % phrases.length];
  const banner = document.getElementById('motivation-banner');
  if (banner) { banner.textContent = message; banner.hidden = false; }
  toast(message);
  if (localStorage.getItem('forgefit-voice') === 'on' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.replace(/[🔥💪🚀]/gu, '')); utterance.lang = 'fr-FR'; window.speechSynthesis.speak(utterance); } catch {}
  }
}

function updateTimer() {
  const timer = document.getElementById('timer');
  if (!timer) return;
  const remaining = Math.max(0, Math.ceil((state.restUntil - Date.now()) / 1000));
  timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  if (!remaining && state.restUntil) {
    state.restUntil = 0; repository.clearRest();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    toast('Repos terminé !');
  }
}

function detail(id) {
  const session = state.sessions.find(item => item.id === id);
  if (!session) return;
  const lines = session.exercises.map(exercise => `${exercise.name}\n${exercise.sets.filter(set => set.done).map(set => `${set.kg || 0} kg × ${set.reps}`).join(' / ')}`).join('\n\n');
  alert(`${session.programName} · ${session.routineName} — ${new Date(session.finished).toLocaleDateString('fr-FR')}\n\n${lines}`);
}

async function exportData() {
  const backup = await repository.snapshot();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `roch-rania-fit-${profile}-v2-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function saveProgramJson(json, requiredId = null) {
  await persistProgramJson(repository, json, profile, requiredId);
  await refresh();
  toast(requiredId ? 'Programme modifié' : 'Programme ajouté');
}

async function importData(file) {
  if (file.size > 10_000_000) throw new Error('Fichier trop volumineux');
  const backup = JSON.parse(await file.text());
  if (state.active && !confirm('Une séance est en cours. L’import la remplacera avec les données du fichier. Continuer ?')) return;
  if (!confirm('Importer cette sauvegarde V2 ? Toutes les données actuelles de ce profil seront remplacées.')) return;
  await repository.importBackup(backup);
  await refresh(); toast('Sauvegarde importée');
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.page) return page(button.dataset.page);
  const action = button.dataset.action;
  if (!action) return;
  try {
    if (action === 'auth-signout') { await authService?.signOut(); clearSportMemory(); authSession = null; accountLocked = false; authStatus = 'signed-out'; authScreen(); return; }
    if (action === 'sync-now') { await syncAndSeedBuiltIns(); return; }
    if (action === 'sync-upload') {
      if (!confirm('Envoyer les données locales actuelles vers ce compte Supabase ? Le cloud est vide pour ce profil.')) return;
      const result = await syncEngine?.chooseInitialSync('upload'); await seedBuiltInsAfterSync(repository, syncEngine, result); return;
    }
    if (action === 'sync-merge') { const result = await syncEngine?.chooseInitialSync('merge'); await seedBuiltInsAfterSync(repository, syncEngine, result); return; }
    if (action === 'sync-restore') {
      if (!confirm('Restaurer les données du cloud ? Cette action remplacera les données locales de ce profil après export conseillé.')) return;
      const result = await syncEngine?.chooseInitialSync('restore'); await seedBuiltInsAfterSync(repository, syncEngine, result); return;
    }
      if (action === 'select-user') {
          await selectUser(button.dataset.id);
          return;
      }

      if (!repository) return;
    if (action === 'change-user') {
      if (state.active && !confirm('Une séance est en cours. Changer d’utilisateur sans la terminer ?')) return;
      localStorage.removeItem('forgefit-user'); clearSportMemory(); onboarding();
    }
    if (action === 'activate') { await repository.startCycle(button.dataset.id); await refresh(); }
    if (action === 'end-cycle') { await repository.endCycle(); await refresh(); toast('Cycle terminé. Choisis le prochain programme quand tu le souhaites.'); }
    if (action === 'extend-cycle') { await repository.extendActiveCycle(1); await refresh(); toast('Cycle prolongé d’une semaine'); }
    if (action === 'start-session') await startSession(button.dataset.id);
    if (action === 'resume') page('workout');
    if (action === 'toggle-set') {
      const exercise = state.active.exercises[Number(button.dataset.e)], set = exercise.sets[Number(button.dataset.s)];
      if (!set.done && (set.kg === '' || Number(set.reps) < 1)) return toast('Renseigne les kg et les répétitions');
      set.done = !set.done;
      if (set.done) { state.restUntil = Date.now() + exercise.restSeconds * 1000; await repository.saveRestUntil(state.restUntil); }
      await persistActive(); render(); if (set.done) encourage();
    }
    if (action === 'add-set') { const exercise = state.active.exercises[Number(button.dataset.e)], last = exercise.sets.at(-1); exercise.sets.push({ kg: last?.kg ?? '', reps: last?.reps ?? exercise.repMin, done: false }); await persistActive(); render(); }
    if (action === 'cancel-rest') { state.restUntil = 0; await repository.clearRest(); updateTimer(); }
    if (action === 'finish-session') {
      const done = state.active.exercises.flatMap(exercise => exercise.sets).filter(set => set.done).length;
      if (!done) return toast('Valide au moins une série');
      if (!confirm(`Enregistrer la séance avec ${done} séries terminées ?`)) return;
      await repository.finishSession(); state.active = null; await refresh(); page('progress'); toast('Séance enregistrée');
    }
    if (action === 'discard-session' && confirm('Abandonner la séance en cours ?')) { await repository.discardSession(); state.active = null; state.restUntil = 0; await refresh(); }
    if (action === 'detail') detail(button.dataset.id);
    if (action === 'export') await exportData();
    if (action === 'save-new-program') {
      const input = document.getElementById('new-program-json');
      await saveProgramJson(input.value);
    }
    if (action === 'save-program') {
      const input = [...document.querySelectorAll('[data-program-editor]')].find(item => item.dataset.programEditor === button.dataset.id);
      if (!input) throw new Error('Éditeur du programme introuvable');
      await saveProgramJson(input.value, button.dataset.id);
    }
    if (action === 'calendar-prev' || action === 'calendar-next') {
      const next = shiftCalendarMonth(state.calendarYear, state.calendarMonth, action === 'calendar-next' ? 1 : -1);
      state.calendarYear = next.year; state.calendarMonth = next.month; state.selectedDateKey = null;
      render();
    }
    if (action === 'select-calendar-day') {
      state.selectedDateKey = button.dataset.date;
      const [year, monthNumber] = state.selectedDateKey.split('-').map(Number);
      state.calendarYear = year; state.calendarMonth = monthNumber - 1;
      render();
    }
  } catch (error) { toast(`Erreur : ${error.message}`); }
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'login-form') return;
  event.preventDefault();
  if (!authService) return;
  const form = event.target;
  const submit = form.querySelector('[type="submit"]');
  const email = form.elements.email.value;
  const password = form.elements.password.value;
  submit.disabled = true; authError = '';
  try {
    const result = await authService.signIn(email, password);
    if (result.error) { authError = result.error; authScreen(); }
    else if (result.session) await handleAuthSession(result.session);
    else { authError = 'Connexion impossible pour le moment. Réessaie.'; authScreen(); }
  } finally {
    // Évite de conserver le mot de passe dans le formulaire après la requête.
    form.elements.password.value = '';
    if (document.getElementById('login-submit')) document.getElementById('login-submit').disabled = false;
  }
});

document.addEventListener('change', async event => {
  const input = event.target;
  if (input.matches('[data-field]') && state.active) {
    const exercise = state.active.exercises[Number(input.dataset.e)], set = exercise?.sets[Number(input.dataset.s)];
    if (!set) return;
    const value = input.value === '' && input.dataset.field === 'kg' ? '' : Number(input.value);
    const max = input.dataset.field === 'kg' ? 1000 : 200;
    if ((value !== '' && (!Number.isFinite(value) || value < 0 || value > max))) { toast('Valeur invalide'); input.value = set[input.dataset.field]; return; }
    set[input.dataset.field] = value; await persistActive();
  }
  if (input.id === 'exercise-select') drawChart(input.value);
  if (input.id === 'import-file' && input.files[0]) { try { await importData(input.files[0]); } catch (error) { alert(`Import impossible : ${error.message}`); } input.value = ''; }
  if (input.id === 'program-file' && input.files[0]) {
    try { await saveProgramJson(await input.files[0].text()); }
    catch (error) { alert(`Import du programme impossible : ${error.message}`); }
    input.value = '';
  }
  if (input.id === 'voice-toggle') { localStorage.setItem('forgefit-voice', input.checked ? 'on' : 'off'); toast(input.checked ? 'Voix activée' : 'Voix désactivée'); }
});

window.addEventListener('online', () => { if (authStatus === 'signed-in') { render(); void syncAndSeedBuiltIns(); } });
window.addEventListener('offline', () => { if (authStatus === 'signed-in') { render(); void syncEngine?.syncNow(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && authStatus === 'signed-in') void syncAndSeedBuiltIns(); });

(async () => {
  setInterval(updateTimer, 1000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  try {
    const response = await fetch('./images/exercises/exercise-images.json');
    if (response.ok) exerciseImageInventory = await response.json();
  } catch { /* Les vues gardent un placeholder si l’inventaire n’est pas disponible. */ }
  try {
    supabaseClient = createSupabaseClient(window.supabase?.createClient, { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY });
    authService = createAuthService(supabaseClient);
  } catch (error) {
    authStatus = 'unconfigured'; authError = error.message; authScreen(); return;
  }
  // Supabase recommande un callback synchrone ; le traitement IndexedDB est
  // reporté hors du callback pour ne pas conserver son verrou Auth.
  authService.onAuthStateChange((_event, session) => { queueMicrotask(() => { void handleAuthSession(session); }); });
  try {
    const session = await authService.restoreSession();
    await handleAuthSession(session);
  } catch (error) {
    authStatus = 'signed-out'; authError = error.message; clearSportMemory(); authScreen();
  }
})();
