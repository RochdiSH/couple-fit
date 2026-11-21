export const AUTH_STORAGE_KEY = 'roch-rania-fit-auth';

export function validateSupabaseConfig({ url, publishableKey }) {
  if (typeof url !== 'string' || !url.trim() || typeof publishableKey !== 'string' || !publishableKey.trim()) {
    throw new Error('Configuration Supabase manquante. Renseigne supabase-config.js.');
  }
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('URL Supabase invalide.'); }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
    throw new Error('L’URL Supabase doit utiliser HTTPS.');
  }
  if (/sb_secret_|service[_-]?role/i.test(publishableKey)) {
    throw new Error('Clé secret refusée : utilise uniquement la Publishable Key.');
  }
  return { url: parsed.origin, publishableKey: publishableKey.trim() };
}

export function createSupabaseClient(createClient, config) {
  if (typeof createClient !== 'function') throw new Error('SDK Supabase local indisponible.');
  const { url, publishableKey } = validateSupabaseConfig(config);
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_STORAGE_KEY }
  });
}
