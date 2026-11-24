import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workout inputs retain Safari zoom access while meeting the iOS 16px focus threshold', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(html, /name="viewport"[^>]*width=device-width[^>]*viewport-fit=cover/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  assert.match(css, /\.set label input[^}]*font-size:16px/);
});

test('workout timer is a single deadline-based floating control with extend and stop actions', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(app, /data-action="extend-rest"/);
  assert.match(app, /data-action="finish-rest"/);
  assert.match(app, /state\.restUntil\s*\+=\s*30_000/);
  assert.match(app, /remainingRestSeconds\(state\.restUntil\)/);
  assert.match(app, /document\.visibilityState === 'visible'[\s\S]{0,80}updateTimer\(\)/);
  assert.match(css, /\.rest-floating\{position:fixed/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('workout display separates prescribed set count from recorded series arrays', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const data = await readFile(new URL('../data.js', import.meta.url), 'utf8');
  assert.match(app, /Number\.isInteger\(exercise\.prescribedSets\)[\s\S]{0,100}Array\.isArray\(exercise\.sets\)/);
  assert.match(data, /cloned\.prescribedSets = exercise\.sets/);
});

test('program session cards identify last completed and next suggested sessions from active-cycle history', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const progression = await readFile(new URL('../progression.js', import.meta.url), 'utf8');
  assert.match(app, /Dernière séance effectuée/);
  assert.match(app, /Prochaine séance suggérée/);
  assert.match(progression, /session\.cycleId === cycle\.id/);
});
