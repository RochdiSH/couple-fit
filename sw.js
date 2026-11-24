const CACHE = 'roch-rania-v4-session-ux';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './data.js', './calendar.js',
  './programs-v2.js', './progression.js', './rest-timer.js', './images/exercises/exercise-images.json',
  './auth.js', './auth-guard.js', './supabase-client.js', './supabase-config.js',
  './sync.js', './vendor/supabase-js-2.119.2.min.js', './images/exercises.webp',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(ASSETS);
    const manifestUrl = new URL('./images/exercises/exercise-images.json', self.registration.scope);
    const manifestResponse = await cache.match(manifestUrl);
    const manifest = await manifestResponse.json();
    const files = [...new Set(Object.values(manifest.profiles || {}).flatMap(profile =>
      (profile.exercises || []).filter(exercise => exercise.status === 'matched_downloaded').flatMap(exercise => exercise.files || [])
    ))].filter(file => /^(me|wife)\/[a-z0-9-]+-[01]\.jpg$/.test(file));
    const photoUrls = files.map(file => new URL(`./images/exercises/${file}`, self.registration.scope).href);
    await cache.addAll(photoUrls);
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isExercisePhoto = /\/images\/exercises\/(me|wife)\/[a-z0-9-]+-[01]\.jpg$/.test(url.pathname);
  if (isExercisePhoto) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return new Response('', { status: 504, statusText: 'Image indisponible hors ligne' });
      }
    }));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
