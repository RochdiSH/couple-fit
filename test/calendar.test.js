import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatLocalDateKey, getCalendarMonth, shiftCalendarMonth } from '../calendar.js';

test('local date keys use the local calendar date rather than UTC date slicing', () => {
  const localMorning = new Date(2026, 0, 1, 0, 15, 0, 0);
  assert.equal(formatLocalDateKey(localMorning.getTime()), '2026-01-01');
  assert.equal(formatLocalDateKey(Number.NaN), null);
});

test('month grids handle leap February and ordinary February with Monday-first weeks', () => {
  const leap = getCalendarMonth(2024, 1, [], 'me');
  const ordinary = getCalendarMonth(2025, 1, [], 'me');
  assert.equal(leap.days.filter(day => day.inMonth).length, 29);
  assert.equal(ordinary.days.filter(day => day.inMonth).length, 28);
  assert.equal(leap.days[0].date.getDay(), 1);
  assert.equal(leap.days.length % 7, 0);
});

test('month navigation crosses year boundaries and normalizes longer jumps', () => {
  assert.deepEqual(shiftCalendarMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftCalendarMonth(2027, 0, -1), { year: 2026, month: 11 });
  assert.deepEqual(shiftCalendarMonth(2026, 0, 14), { year: 2027, month: 2 });
});

test('calendar includes only completed sessions from the active profile and groups multiple sessions per date', () => {
  const first = new Date(2026, 4, 12, 8, 15).getTime();
  const second = new Date(2026, 4, 12, 18, 45).getTime();
  const month = getCalendarMonth(2026, 4, [
    { id: 'a', profileId: 'me', finished: first, started: first - 3_600_000 },
    { id: 'b', profileId: 'me', finished: second, started: second - 3_600_000 },
    { id: 'active', profileId: 'me', finished: null, started: second },
    { id: 'other', profileId: 'wife', finished: first, started: first }
  ], 'me');
  assert.equal(month.sessionCount, 2);
  assert.deepEqual(month.days.find(day => day.key === '2026-05-12').sessions.map(session => session.id), ['a', 'b']);
  assert.equal(month.days.find(day => day.key === '2026-05-13').sessions.length, 0);
});

test('a session near UTC midnight is assigned to its local completion day', () => {
  const completion = new Date(2026, 0, 1, 0, 5).getTime();
  const month = getCalendarMonth(2026, 0, [{ id: 'local', profileId: 'wife', finished: completion }], 'wife');
  assert.equal(month.days.find(day => day.key === formatLocalDateKey(completion)).sessions.length, 1);
});

test('calendar is reachable from navigation and its module is cached for offline use', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(html, /data-page="calendar"/);
  assert.match(app, /home, programs, calendar, workout, progress, settings/);
  assert.match(app, /getCalendarMonth\(state\.calendarYear, state\.calendarMonth, state\.sessions, profile\)/);
  assert.match(app, /data-action="calendar-prev"/);
  assert.match(app, /data-action="calendar-next"/);
  assert.match(worker, /'\.\/calendar\.js'/);
});
