// Evaluate in a disposable local preview, like tests/editor-regression.js.
// Tests replace the current program temporarily and restore the original data.
(async () => {
  const saved = localStorage.getItem(KEY);
  const originalState = state;
  const originalProgress = { ...previousProgress };
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;
  const originalSetItem = Storage.prototype.setItem;
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
    window.confirm = () => true;
    window.alert = () => {};
    state = initial();
    update();
    nav('more');
    check(document.querySelectorAll('.menu-row').length === 2, 'More must contain two menu rows');
    click('.menu-row[data-id="recommendations"]');
    check(document.querySelector('h1').textContent === 'Советы', 'Advice must open from More');
    check(document.querySelector('#nav [data-id="more"]').getAttribute('aria-current') === 'page', 'More must stay selected in its subpages');
    click('.back-link');
    click('.menu-row[data-id="history"]');
    check(!!document.querySelector('.empty'), 'A new history must be empty');

    nav('day');
    click('[data-action="done"][data-id="a1"]');
    click('[data-action="done"][data-id="a2"]');
    click('[data-action="today"]');
    const weights = JSON.stringify(state.groups);
    window.confirm = () => false;
    click('[data-action="finish"]');
    check(state.history.length === 0 && state.done.A.length === 2, 'Cancel must preserve progress without creating history');
    window.confirm = () => true;
    click('[data-action="finish"]');
    const first = state.history[0];
    check(state.tab === 'history' && state.history.length === 1, 'Finish must create one history entry and open history');
    check(document.querySelector('.percent').textContent === '33%', 'Two of six exercises must display 33%');
    check(first.exercises.filter(e => !e.completed).length === 4 && document.querySelectorAll('.history-list li').length === 4, 'History must list all four unfinished exercises');
    check(state.done.A.length === 0 && state.today === null, 'Finish must clear the completed session markers');
    check(JSON.stringify(state.groups) === weights, 'Finish must preserve weight records');
    check(JSON.parse(localStorage.getItem(KEY)).history.length === 1, 'History must be persisted');
    const snapshot = JSON.stringify(first);
    state.days.A[2].name = 'Changed later';
    state.days.A.splice(3, 1);
    update();
    check(JSON.stringify(first) === snapshot, 'Program edits must not rewrite earlier history');
    check(!document.querySelector('.history-list').textContent.includes('Changed later'), 'History must render saved exercise names');

    nav('day');
    click('.seg-btn[data-id="B"]');
    for (const exercise of state.days.B) click(`[data-action="done"][data-id="${exercise.id}"]`);
    click('[data-action="finish"]');
    check(state.history.length === 2, 'Several workouts on one day must remain separate entries');
    check(document.querySelectorAll('.history-date').length === 1, 'Same-day workouts must share one date heading');
    check(document.querySelectorAll('.history-card')[0].textContent.includes('100%') && document.querySelectorAll('.history-card')[0].textContent.includes('Все упражнения выполнены'), 'A fully completed workout must show 100% without an unfinished list');

    nav('day');
    click('.seg-btn[data-id="C"]');
    click('[data-action="finish"]');
    check(state.history.length === 3 && document.querySelector('.percent').textContent === '0%', 'An unfinished workout may be recorded at 0%');
    nav('day');
    click('.seg-btn[data-id="star"]');
    check(document.querySelector('[data-action="finish"]').disabled, 'An empty workout must not be finishable');
    click('.seg-btn[data-id="A"]');
    click('[data-action="done"][data-id="a1"]');
    click('[data-action="reset"]');
    check(state.history.length === 3 && state.done.A.length === 0, 'Reset must clear progress without adding history');

    click('[data-action="done"][data-id="a1"]');
    const beforeFailure = localStorage.getItem(KEY);
    let storageAlerts = 0;
    window.alert = () => { storageAlerts++; };
    Storage.prototype.setItem = function (key, value) {
      if (key === KEY) throw new DOMException('Full', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
    click('[data-action="finish"]');
    check(storageAlerts === 1 && state.tab === 'A' && state.done.A.includes('a1') && state.history.length === 3, 'Storage failure must keep progress and avoid an unsaved history entry');
    check(localStorage.getItem(KEY) === beforeFailure, 'Storage failure must preserve the stored backup');
    Storage.prototype.setItem = originalSetItem;

    const backup = JSON.parse(beforeFailure);
    await importData(backup);
    check(JSON.stringify(state.history) === JSON.stringify(backup.history), 'JSON import must restore history');
    const oldBackup = { ...backup, tab: 'recommendations' };
    delete oldBackup.history;
    await importData(oldBackup);
    check(Array.isArray(state.history) && state.history.length === 0 && state.done.A.includes('a1'), 'Old backups must import with an empty history and retain progress');
    check(document.querySelector('h1').textContent === 'Советы', 'A saved legacy Advice tab must still open');
    const invalid = { ...backup, history: [{}] };
    const beforeInvalid = JSON.stringify(state);
    await importData(invalid);
    check(JSON.stringify(state) === beforeInvalid, 'Invalid history import must not replace existing data');

    state = initial();
    state.days.A[0].name = '<img src=x onerror=alert(1)>';
    update();
    click('[data-action="finish"]');
    check(!document.querySelector('.history-list img') && document.querySelector('.history-list').textContent.includes('<img'), 'Saved exercise names must be escaped');
    check(localDate(new Date(2026, 9, 16, 0, 5)) === '2026-10-16', 'History must use the local calendar date around midnight');
    return { passed: !failures.length, failures };
  } finally {
    Storage.prototype.setItem = originalSetItem;
    window.confirm = originalConfirm;
    window.alert = originalAlert;
    state = originalState;
    previousProgress = originalProgress;
    render();
    if (saved === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, saved);
  }
})()
