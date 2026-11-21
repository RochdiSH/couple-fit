import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('PWA serves the pinned SDK and auth modules from relative GitHub Pages paths', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const asset of ['./auth.js', './auth-guard.js', './supabase-client.js', './supabase-config.js', './sync.js', './vendor/supabase-js-2.119.2.min.js']) {
    assert.ok(sw.includes(asset), `service worker cache misses ${asset}`);
    assert.ok(!asset.startsWith('/'), `${asset} must remain relative for Pages project paths`);
  }
  assert.ok(html.indexOf('./vendor/supabase-js-2.119.2.min.js') < html.indexOf('./app.js'), 'SDK must load before app module');
  assert.match(sw, /roch-rania-v3-programs/);
  assert.match(sw, /isExercisePhoto/);
});

test('PWA pre-caches the built-in program module and image inventory using relative base-path-safe URLs', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const asset of ['./programs-v2.js', './images/exercises/exercise-images.json']) {
    assert.ok(sw.includes(asset), `service worker cache misses ${asset}`);
    assert.ok(!asset.startsWith('/'), `${asset} must remain relative for Pages project paths`);
  }
  assert.match(sw, /isExercisePhoto/);
  assert.match(sw, /cache\.put\(request, response\.clone\(\)\)/);
  assert.match(sw, /cache\.addAll\(photoUrls\)/);
});

test('frontend contains no Supabase service-role or secret credential', async () => {
  const files = ['../supabase-config.js', '../app.js', '../supabase-client.js'];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9_-]{10,}|service_role\s*[:=]\s*['"][^'"]{10,}/i);
  }
});
