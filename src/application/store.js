// Application state holder. Changes run on a draft copy and become current only after the repository saved them,
// so a failed save (full storage) never leaves the screen showing data that is not persisted.
import { DomainError } from '../domain/shared.js';
import { initialData, normalize, VERSION } from '../domain/schema.js';

export const STORAGE_ERROR = 'Не удалось сохранить. Освободите место или экспортируйте данные и попробуйте снова.';

// repository: { load(): object|null, save(data): boolean, archive?(label): string|null }
export function createStore(repository) {
  // Stored data from an older version is archived before migration; unreadable data is archived instead of lost.
  let state, loadError = null;
  try {
    const stored = repository.load();
    if (stored && !(stored.version >= VERSION)) repository.archive?.('v' + (stored.version || 1) + '-backup');
    state = stored ? normalize(stored) : initialData();
  } catch (error) {
    loadError = { message: error.message, copy: repository.archive?.('unreadable-' + Date.now()) };
    state = initialData();
  }

  const commit = next => {
    if (!repository.save(next)) return false;
    state = next;
    return true;
  };

  return {
    get state() { return state; },
    loadError,
    set state(next) { state = next; },
    commit,
    // Saves in-place edits of the current state (draft typing, navigation, profile text).
    persist: () => repository.save(state),
    // Runs change(draft). Result: null when change returned false (nothing to do),
    // {error, storage?} when a rule failed or saving failed, {ok, value} otherwise.
    update(change) {
      const draft = structuredClone(state);
      let value;
      try { value = change(draft); }
      catch (error) { if (error instanceof DomainError) return { error: error.message }; throw error; }
      if (value === false) return null;
      return commit(draft) ? { ok: true, value } : { error: STORAGE_ERROR, storage: true };
    },
  };
}
