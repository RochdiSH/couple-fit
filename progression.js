const PULL_UP_IDS = /^(?:pullup|assisted-pullup)(?:-|$)/;

function isPullUp(exercise) { return PULL_UP_IDS.test(exercise?.id || ''); }
function isModeBased(exercise) { return isPullUp(exercise) || Array.isArray(exercise?.loadModes); }
function isWarmupSet(set) { return set?.isWarmup === true || set?.warmup === true || set?.kind === 'warmup'; }

function latestExercise(history, exercise, mode) {
  return (history || []).filter(session => Number.isFinite(session.finished))
    .slice().sort((a, b) => b.finished - a.finished)
    .map(session => session.exercises?.find(item => item.id === exercise.id)
      || (exercise.id && session.exercises?.find(item => !item.id && item.name === exercise.name)))
    .find(item => item?.sets?.some(set => set.done && !isWarmupSet(set) && relevantModeSet(exercise, set, mode))) || null;
}

function canIncreaseLoad(exercise, sets, mode) {
  const prescribed = isModeBased(exercise) && mode !== 'auto' && mode && Array.isArray(exercise.sets)
    ? exercise.sets.filter(set => set.loadMode === mode).length
    : exercise.prescribedSets || (Number.isInteger(exercise.sets) ? exercise.sets : exercise.sets?.length) || 0;
  const rirMin = Number(exercise.rir ?? 2), rirMax = Number(exercise.rirMax ?? rirMin);
  return sets.length > 0 && (!prescribed || sets.length >= prescribed) && sets.every(set => set.reps >= exercise.repMax
    && set.rir !== '' && set.rir != null && Number.isFinite(Number(set.rir)) && Number(set.rir) >= rirMin && Number(set.rir) <= rirMax
    && set.techniqueOk === true
    && (mode !== 'assisted' || set.loadMode === 'assisted'));
}

function relevantModeSet(exercise, set, mode) {
  if (!isModeBased(exercise)) return set.loadMode !== 'bodyweight' && set.loadMode !== 'assisted';
  if (mode === 'auto') return ['bodyweight', 'assisted', 'weighted'].includes(set.loadMode);
  return set.loadMode === mode;
}

export function recommendExercise({ exercise, history = [], loadMode = null }) {
  const previous = latestExercise(history, exercise, loadMode);
  const completedEntries = (previous?.sets || []).reduce((entries, set) => {
    if (set.done && !isWarmupSet(set) && relevantModeSet(exercise, set, loadMode)) entries.push({ set, index: entries.length });
    return entries;
  }, []);
  const completed = completedEntries.map(item => item.set);
  if (!completed.length) return { sets: [], previous: null, reason: 'Aucune performance comparable : saisis ta charge et tes répétitions.' };

  const previousSummary = completedEntries.map(({ set, index }) => ({ index, kg: Number.isFinite(Number(set.kg)) && set.kg !== '' ? Number(set.kg) : null, reps: Number(set.reps), loadMode: set.loadMode || null }));
  const topRange = canIncreaseLoad(exercise, completed, loadMode);
  const increment = Number.isFinite(exercise.loadIncrementKg) && exercise.loadIncrementKg > 0 ? exercise.loadIncrementKg : 2.5;
  const suggestions = completedEntries.map(({ set, index }) => {
    const repStep = exercise.repUnit === 'seconds' ? (Number.isFinite(exercise.repIncrement) && exercise.repIncrement > 0 ? exercise.repIncrement : 5) : 1;
    const setMode = loadMode === 'auto' ? set.loadMode : loadMode;
    const targetReps = topRange && setMode !== 'bodyweight' ? exercise.repMin
      : topRange ? exercise.repMax : Math.min(exercise.repMax, Math.max(exercise.repMin, Number(set.reps) + repStep));
    const suggestion = { reps: targetReps };
    suggestion.index = index;
    if (setMode) suggestion.loadMode = setMode;
    if (setMode === 'bodyweight') return suggestion;
    if (Number.isFinite(Number(set.kg)) && set.kg !== '') {
      suggestion.kg = topRange
        ? Math.max(0, Math.round((Number(set.kg) + (setMode === 'assisted' ? -increment : increment)) * 100) / 100)
        : Number(set.kg);
    }
    return suggestion;
  });

  let reason;
  if (topRange && (loadMode === 'assisted' || loadMode === 'auto' && completed.every(set => set.loadMode === 'assisted'))) reason = `Toutes les séries atteignent ${exercise.repMax} reps avec la technique et le RIR déclarés : diminuer l’assistance de ${increment} kg.`;
  else if (topRange && loadMode === 'bodyweight') reason = `Haut de plage maîtrisé : conserve le poids du corps; un lest reste un choix manuel.`;
  else if (topRange && loadMode === 'auto' && completed.every(set => set.loadMode === 'bodyweight')) reason = 'Haut de plage maîtrisé : conserve le poids du corps; un lest reste un choix manuel.';
  else if (topRange && loadMode === 'auto' && completed.every(set => set.loadMode === 'weighted')) reason = `Haut de plage atteint : augmenter le lest de ${increment} kg et repartir à ${exercise.repMin} reps.`;
  else if (topRange && loadMode === 'auto') reason = 'Haut de plage maîtrisé : progression série par série selon le mode enregistré, sans conversion des charges.';
  else if (topRange) reason = `Haut de plage atteint avec technique et RIR déclarés : augmenter de ${increment} kg et repartir à ${exercise.repMin} reps.`;
  else if (completed.every(set => Number(set.reps) >= exercise.repMax)) reason = 'Conserve la charge : la hausse attend une technique déclarée maîtrisée et un RIR dans la cible.';
  else reason = `Garde la même charge et vise ${exercise.repUnit === 'seconds' ? `${exercise.repIncrement || 5} secondes de plus` : 'une répétition de plus'}, sans dépasser ${exercise.repMax}.`;
  if (!topRange && completed.some(set => !Number.isFinite(Number(set.rir)))) reason += ' Note ton RIR pour débloquer une proposition de hausse de charge.';
  return { sets: suggestions, previous: previousSummary, reason };
}

export function trainingVolume(sessions) {
  const volume = { externalLoadKg: 0, bodyweightReps: 0, assistedReps: 0, weightedPullupKg: 0, timedSeconds: 0, ambiguousLegacySets: 0 };
  for (const session of sessions || []) {
    if (!Number.isFinite(session.finished)) continue;
    for (const exercise of session.exercises || []) for (const set of exercise.sets || []) {
      if (!set.done || isWarmupSet(set)) continue;
      const reps = Number(set.reps) || 0, kg = Number(set.kg) || 0;
      if (exercise.repUnit === 'seconds') { volume.timedSeconds += reps; continue; }
      if (isPullUp(exercise)) {
        if (set.loadMode === 'bodyweight') volume.bodyweightReps += reps;
        else if (set.loadMode === 'assisted') volume.assistedReps += reps;
        else if (set.loadMode === 'weighted') volume.weightedPullupKg += kg * reps;
        else volume.ambiguousLegacySets++;
      } else if (set.loadMode === 'bodyweight') volume.bodyweightReps += reps;
      else if (set.loadMode === 'assisted') volume.assistedReps += reps;
      else volume.externalLoadKg += kg * reps;
    }
  }
  return volume;
}

export function nextSessionSuggestion(cycle, sessions) {
  const templates = cycle?.programSnapshot?.sessions || [];
  if (!templates.length) return null;
  const latest = (sessions || []).filter(session => session.cycleId === cycle.id && Number.isFinite(session.finished))
    .sort((a, b) => b.finished - a.finished)[0];
  const index = templates.findIndex(session => session.id === latest?.sessionId);
  return templates[(index + 1 + templates.length) % templates.length]?.id || templates[0].id;
}

export function latestCompletedSessionForCycle(cycle, sessions) {
  return (sessions || []).filter(session => session.cycleId === cycle?.id && Number.isFinite(session.finished))
    .sort((a, b) => b.finished - a.finished)[0] || null;
}
