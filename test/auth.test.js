import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthService,
  formatAuthError
} from '../auth.js';
import {
  createSupabaseClient,
  validateSupabaseConfig
} from '../supabase-client.js';
import { bindLocalDataOwner, LOCAL_DATA_OWNER_KEY } from '../auth-guard.js';

function fakeAuthClient(overrides = {}) {
  const calls = [];
  let listener;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async credentials => {
        calls.push(['signInWithPassword', credentials]);
        return { data: { session: { user: { id: 'owner-1' } } }, error: null };
      },
      signOut: async options => { calls.push(['signOut', options]); return { error: null }; },
      onAuthStateChange: callback => {
        listener = callback;
        return { data: { subscription: { unsubscribe: () => calls.push(['unsubscribe']) } } };
      },
      ...overrides
    }
  };
  return { client, calls, emit: (...args) => listener?.(...args) };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values
  };
}

test('client uses the public URL/key and persistent auto-refreshing browser auth settings', () => {
  let created;
  const result = createSupabaseClient((...args) => { created = args; return 'client'; }, {
    url: 'https://example.supabase.co', publishableKey: 'sb_publishable_public-value'
  });
  assert.equal(result, 'client');
  assert.equal(created[0], 'https://example.supabase.co');
  assert.equal(created[1], 'sb_publishable_public-value');
  assert.equal(created[2].auth.persistSession, true);
  assert.equal(created[2].auth.autoRefreshToken, true);
  assert.equal(created[2].auth.storageKey, 'roch-rania-fit-auth');
});

test('configuration rejects missing values, invalid origins and secret keys', () => {
  assert.throws(() => validateSupabaseConfig({ url: '', publishableKey: '' }), /configuration/i);
  assert.throws(() => validateSupabaseConfig({ url: 'http://example.supabase.co', publishableKey: 'sb_publishable_x' }), /https/i);
  assert.throws(() => validateSupabaseConfig({ url: 'https://example.supabase.co', publishableKey: 'sb_secret_do_not_use' }), /secret/i);
});

test('restores a session already persisted by Supabase Auth', async () => {
  const expected = { user: { id: 'owner-1', email: 'fit@example.test' } };
  const { client } = fakeAuthClient({ getSession: async () => ({ data: { session: expected }, error: null }) });
  const service = createAuthService(client);
  assert.equal(await service.restoreSession(), expected);
});

test('sign-in returns a safe message for invalid credentials and never exposes the password', async () => {
  let received;
  const { client } = fakeAuthClient({ signInWithPassword: async credentials => {
    received = credentials;
    return { data: { session: null }, error: { message: 'Invalid login credentials' } };
  } });
  const service = createAuthService(client);
  const result = await service.signIn('fit@example.test', 'private-password');
  assert.deepEqual(received, { email: 'fit@example.test', password: 'private-password' });
  assert.equal(result.session, null);
  assert.match(result.error, /adresse e-mail|mot de passe/i);
  assert.equal(result.error.includes('private-password'), false);
});

test('sign-out revokes only this device session so the shared account remains active elsewhere', async () => {
  const { client, calls } = fakeAuthClient();
  await createAuthService(client).signOut();
  assert.deepEqual(calls.find(([name]) => name === 'signOut'), ['signOut', { scope: 'local' }]);
});

test('auth state listener forwards session changes and can unsubscribe', () => {
  const { client, calls, emit } = fakeAuthClient();
  const received = [];
  const unsubscribe = createAuthService(client).onAuthStateChange((event, session) => received.push([event, session]));
  const session = { user: { id: 'owner-1' } };
  emit('SIGNED_IN', session);
  unsubscribe();
  assert.deepEqual(received, [['SIGNED_IN', session]]);
  assert.deepEqual(calls.at(-1), ['unsubscribe']);
});

test('local sports data is bound once and remains blocked for a different Auth account', () => {
  const storage = memoryStorage();
  assert.equal(bindLocalDataOwner('owner-1', storage), true);
  assert.equal(storage.getItem(LOCAL_DATA_OWNER_KEY), 'owner-1');
  assert.equal(bindLocalDataOwner('owner-1', storage), true);
  assert.equal(bindLocalDataOwner('owner-2', storage), false);
  assert.equal(storage.getItem(LOCAL_DATA_OWNER_KEY), 'owner-1');
});

test('auth errors do not echo credential input', () => {
  const error = formatAuthError({ message: 'Invalid login credentials', status: 400 });
  assert.match(error, /adresse e-mail|mot de passe/i);
  assert.equal(error.includes('secret'), false);
});
