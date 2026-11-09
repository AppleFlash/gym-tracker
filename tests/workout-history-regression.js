// Evaluate in a disposable local preview, like tests/editor-regression.js.
// Tests replace the current program temporarily and restore the original data.
(async () => {
  const saved = localStorage.getItem(gym.KEY);
  const originalState = gym.state;
  const originalProgress = { ...gym.previousProgress };
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;
  const originalSetItem = Storage.prototype.setItem;
  const settle=()=>new Promise(r=>setTimeout(r,30)),originalDsConfirm=ds.confirm;
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  const click = selector => document.querySelector(selector).click();
  const nav = id => click(`#nav [data-id="${id}"]`);
  const importData = async data => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' }));
    const input = document.getElementById('importFile');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
  };
  try {
    window.confirm = () => true; ds.confirm = async () => true;
    window.alert = () => {};
    gym.state = gym.initial();
    gym.update();
    nav('more');
    check(document.querySelectorAll('.menu-row').length === 2, 'More must contain two menu rows');
    click('.menu-row[data-id="data"]');
    check(document.querySelector('h1').textContent === 'Данные', 'Data must open from More');
    check(document.querySelector('#nav [data-id="more"]').getAttribute('aria-current') === 'page', 'More must stay selected in its subpages');
    click('.nav-back');
    click('.menu-row[data-id="history"]');
    check(!!document.querySelector('.empty'), 'A new history must be empty');

    nav('day');
    click('[data-action="openWorkout"][data-day="A"]');
    click('[data-action="done"][data-id="a1"]');
    click('[data-action="done"][data-id="a2"]');
    click('[data-action="today"]');
    const weights = JSON.stringify(gym.state.groups);
    window.confirm = () => false; ds.confirm = async () => false;
    click('[data-action="finish"]');await settle();
    check(gym.state.history.length === 0 && gym.state.done.A.length === 2, 'Cancel must preserve progress without creating history');
    window.confirm = () => true; ds.confirm = async () => true;
    click('[data-action="finish"]');await settle();
    const first = gym.state.history[0];
    check(gym.state.tab === 'history' && gym.state.history.length === 1, 'Finish must create one history entry and open history');
    check(document.querySelector('.percent').textContent === '33%', 'Two of six exercises must display 33%');
    check(first.exercises.filter(e => !e.completed).length === 4 && document.querySelectorAll('.history-list li').length === 4, 'History must list all four unfinished exercises');
    check(gym.state.done.A.length === 0 && gym.state.today === null, 'Finish must clear the completed session markers');
    check(JSON.stringify(gym.state.groups) === weights, 'Finish must preserve weight records');
    check(JSON.parse(localStorage.getItem(gym.KEY)).history.length === 1, 'History must be persisted');
    const snapshot = JSON.stringify(first);
    gym.state.days.A[2].name = 'Changed later';
    gym.state.days.A.splice(3, 1);
    gym.update();
    check(JSON.stringify(first) === snapshot, 'Program edits must not rewrite earlier history');
    check(!document.querySelector('.history-list').textContent.includes('Changed later'), 'History must render saved exercise names');

    nav('day');
    click('[data-action="openWorkout"][data-day="B"]');
    for (const exercise of gym.state.days.B) click(`[data-action="done"][data-id="${exercise.id}"]`);
    click('[data-action="finish"]');await settle();
    check(gym.state.history.length === 2, 'Several workouts on one day must remain separate entries');
    check(document.querySelectorAll('.history-date').length === 1, 'Same-day workouts must share one date heading');
    check(document.querySelectorAll('.history-card')[0].textContent.includes('100%') && document.querySelectorAll('.history-card')[0].textContent.includes('Все упражнения выполнены'), 'A fully completed workout must show 100% without an unfinished list');

    nav('day');
    click('[data-action="openWorkout"][data-day="C"]');
    click('[data-action="finish"]');await settle();
    check(gym.state.history.length === 3 && document.querySelector('.percent').textContent === '0%', 'An unfinished workout may be recorded at 0%');
    nav('day');
    click('[data-action="openWorkout"][data-day="star"]');
    check(document.querySelector('[data-action="finish"]').disabled, 'An empty workout must not be finishable');
    click('[data-action="workoutBack"]');
    click('[data-action="openWorkout"][data-day="A"]');
    click('[data-action="done"][data-id="a1"]');
    click('[data-action="reset"]');await settle();
    check(gym.state.history.length === 3 && gym.state.done.A.length === 0, 'Reset must clear progress without adding history');

    click('[data-action="done"][data-id="a1"]');
    const beforeFailure = localStorage.getItem(gym.KEY);
    let storageAlerts = 0;
    window.alert = () => { storageAlerts++; };
    Storage.prototype.setItem = function (key, value) {
      if (key === gym.KEY) throw new DOMException('Full', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
    click('[data-action="finish"]');await settle();
    check(storageAlerts === 1 && gym.state.tab === 'A' && gym.state.done.A.includes('a1') && gym.state.history.length === 3, 'Storage failure must keep progress and avoid an unsaved history entry');
    check(localStorage.getItem(gym.KEY) === beforeFailure, 'Storage failure must preserve the stored backup');
    Storage.prototype.setItem = originalSetItem;

    const backup = JSON.parse(beforeFailure);
    await importData(backup);
    check(JSON.stringify(gym.state.history) === JSON.stringify(backup.history), 'JSON import must restore history');
    const oldBackup = { ...backup, tab: 'recommendations' };
    delete oldBackup.history;
    await importData(oldBackup);
    check(Array.isArray(gym.state.history) && gym.state.history.length === 0 && gym.state.done.A.includes('a1'), 'Old backups must import with an empty history and retain progress');
    check(document.querySelector('h1').textContent === 'Данные', 'A saved legacy Advice tab must migrate to Data');
    const invalid = { ...backup, history: [{}] };
    const beforeInvalid = JSON.stringify(gym.state);
    await importData(invalid);
    check(JSON.stringify(gym.state) === beforeInvalid, 'Invalid history import must not replace existing data');

    gym.state = gym.initial();gym.state.tab='A';
    gym.state.days.A[0].name = '<img src=x onerror=alert(1)>';
    gym.update();
    click('[data-action="finish"]');await settle();
    check(!document.querySelector('.history-list img') && document.querySelector('.history-list').textContent.includes('<img'), 'Saved exercise names must be escaped');
    check(gym.localDate(new Date(2026, 9, 16, 0, 5)) === '2026-10-16', 'History must use the local calendar date around midnight');
    return { passed: !failures.length, failures };
  } finally {
    Storage.prototype.setItem = originalSetItem;
    window.confirm = originalConfirm; ds.confirm = originalDsConfirm;
    window.alert = originalAlert;
    gym.state = originalState;
    gym.previousProgress = originalProgress;
    gym.render();
    if (saved === null) localStorage.removeItem(gym.KEY);
    else localStorage.setItem(gym.KEY, saved);
  }
})()

