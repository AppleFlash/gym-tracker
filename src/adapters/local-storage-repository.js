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
  };
}
