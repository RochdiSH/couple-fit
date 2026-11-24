export function formatRemainingSeconds(seconds) {
  const remaining = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
}

export function remainingRestSeconds(until, now = Date.now()) {
  if (!Number.isFinite(until) || until <= 0) return 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export function restProgress(until, durationSeconds, now = Date.now()) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, remainingRestSeconds(until, now) / durationSeconds));
}
