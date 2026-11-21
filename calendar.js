const PROFILE_IDS = new Set(['me', 'wife']);

export function formatLocalDateKey(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftCalendarMonth(year, month, amount) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(amount) || month < 0 || month > 11) throw new Error('Mois invalide');
  const shifted = new Date(year, month + amount, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

export function getCalendarMonth(year, month, sessions, profileId) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) throw new Error('Mois invalide');
  if (!PROFILE_IDS.has(profileId)) throw new Error('Profil invalide');
  if (!Array.isArray(sessions)) throw new Error('Historique invalide');

  const byDay = new Map();
  for (const session of sessions) {
    if (session.profileId !== profileId || !Number.isFinite(session.finished)) continue;
    const key = formatLocalDateKey(session.finished);
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(session);
  }
  for (const daySessions of byDay.values()) daySessions.sort((a, b) => a.finished - b.finished);

  const first = new Date(year, month, 1);
  const leadingDays = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const numberOfCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const days = Array.from({ length: numberOfCells }, (_, index) => {
    const date = new Date(year, month, 1 - leadingDays + index);
    const key = formatLocalDateKey(date.getTime());
    return { date, key, inMonth: date.getFullYear() === year && date.getMonth() === month, sessions: byDay.get(key) || [] };
  });
  const sessionCount = days.reduce((count, day) => count + (day.inMonth ? day.sessions.length : 0), 0);
  return { year, month, days, sessionCount };
}
