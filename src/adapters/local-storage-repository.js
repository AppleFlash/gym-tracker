// Repository port implemented with localStorage. Data lives only on this device and origin.
export function createLocalStorageRepository(key, onStatus = () => {}) {
  return {
    load: () => JSON.parse(localStorage.getItem(key)),
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        onStatus('Локально сохранено');
        return true;
      } catch {
        onStatus('Не удалось сохранить');
        return false;
      }
    },
    // Keeps an untouched copy of the stored data under "<key>:<label>" (once), e.g. before a migration.
    archive(label) {
      try {
        const raw = localStorage.getItem(key), target = key + ':' + label;
        if (raw !== null && localStorage.getItem(target) === null) localStorage.setItem(target, raw);
        return target;
      } catch { return null; }
    },
  };
}
