export function formatAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (/invalid login|invalid email|invalid credentials|credentials/i.test(message)) return 'Adresse e-mail ou mot de passe incorrect.';
  if (/confirm|not confirmed/i.test(message)) return 'Confirme l’adresse e-mail du compte avant de te connecter.';
  if (/network|fetch|offline|timeout/i.test(message)) return 'Connexion impossible. Vérifie le réseau puis réessaie.';
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives. Attends un peu avant de réessayer.';
  return 'Connexion impossible pour le moment. Vérifie la configuration Supabase et réessaie.';
}

export function createAuthService(client) {
  if (!client?.auth) throw new Error('Client Supabase Auth invalide.');
  return {
    async restoreSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error(formatAuthError(error));
      return data?.session || null;
    },
    async signIn(email, password) {
      if (!String(email || '').trim() || !String(password || '')) return { session: null, error: 'Renseigne ton adresse e-mail et ton mot de passe.' };
      try {
        const { data, error } = await client.auth.signInWithPassword({ email: String(email).trim(), password });
        return error ? { session: null, error: formatAuthError(error) } : { session: data?.session || null, error: null };
      } catch (error) { return { session: null, error: formatAuthError(error) }; }
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw new Error(formatAuthError(error));
    },
    onAuthStateChange(callback) {
      const result = client.auth.onAuthStateChange((event, session) => callback(event, session));
      return () => result.data.subscription.unsubscribe();
    }
  };
}
