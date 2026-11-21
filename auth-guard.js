export const LOCAL_DATA_OWNER_KEY = 'forgefit-auth-owner';

// La première connexion lie la base locale présente sur cet appareil. Une
// autre identité est bloquée ensuite sans effacer les données ni la liaison.
export function bindLocalDataOwner(userId, storage = globalThis.localStorage) {
  if (!userId || !storage) return false;
  const owner = storage.getItem(LOCAL_DATA_OWNER_KEY);
  if (owner === null) {
    storage.setItem(LOCAL_DATA_OWNER_KEY, userId);
    return true;
  }
  return owner === userId;
}
