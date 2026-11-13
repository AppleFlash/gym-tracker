// API key lives in its own localStorage entry: never in app data, so exports and backups don't carry it.
const KEY = 'gym-tracker-api-key';
export const apiKeyStorage = {
  get() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(value) { try { localStorage.setItem(KEY, value); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(KEY); return true; } catch { return false; } },
};
