// Run on a disposable local preview in Orca's iPhone view:
// orca eval --expression "$(cat tests/editor-regression.js)" --json
(() => {
  const saved = localStorage.getItem('gym-tracker-v1');
  const originalAlert = window.alert;
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  const click = selector => document.querySelector(selector).click();
  const navVisible = () => {
    const nav = document.getElementById('nav');
    const rect = nav.getBoundingClientRect();
    return getComputedStyle(nav).display !== 'none' && rect.top >= 0 && rect.bottom <= innerHeight;
  };
  try {
    check(innerWidth <= 480, 'Run this check with mobile device emulation enabled');
    click('#nav [data-id="day"]');
    click('[data-action="editDayExercise"]');
    document.querySelector('#editForm input').focus();
    check(parseFloat(getComputedStyle(document.querySelector('#editForm input')).fontSize) >= 16, 'Modal focus must not trigger iOS auto-zoom');
    click('[data-action="close"]');
    // Model a keyboard flag left over while its viewport resize is still pending.
    document.body.classList.add('kb');
    check(navVisible(), 'Training tab bar must stay visible after closing the editor');
    click('#nav [data-id="weights"]');
    check(navVisible(), 'Weights tab bar must stay visible');
    click('[data-action="addRecord"]');
    const form = document.getElementById('editForm');
    for (const name of ['weight', 'reps']) {
      check(form.elements[name].inputMode === 'decimal', `${name} must request a decimal keyboard`);
    }
    const before = JSON.parse(localStorage.getItem('gym-tracker-v1')).groups[0].items[0].records.length;
    form.elements.weight.value = '22,5';
    form.elements.reps.value = '8–10';
    form.requestSubmit();
    let records = JSON.parse(localStorage.getItem('gym-tracker-v1')).groups[0].items[0].records;
    check(records.length === before + 1 && records.at(-1).weight === 22.5 && records.at(-1).reps === '8–10', 'Comma weight and repetition range must be saved');
    if (!document.querySelector('dialog')) {
      document.querySelectorAll('.rec-table tbody tr')[before].click();
      const edit = document.getElementById('editForm');
      edit.elements.weight.value = '24.5';
      edit.requestSubmit();
      records = JSON.parse(localStorage.getItem('gym-tracker-v1')).groups[0].items[0].records;
      check(records.length === before + 1 && records.at(-1).weight === 24.5, 'Editing must update the existing record');
      click('[data-action="addRecord"]');
      const invalid = document.getElementById('editForm');
      let alerts = 0;
      window.alert = () => { alerts++; };
      for (const weight of ['', '0', '-1', 'abc', 'Infinity', '1,2,3']) {
        invalid.elements.weight.value = weight;
        invalid.requestSubmit();
      }
      check(alerts === 6 && JSON.parse(localStorage.getItem('gym-tracker-v1')).groups[0].items[0].records.length === before + 1, 'Invalid weights must be rejected without saving');
    }
    document.querySelector('[data-action="close"]')?.click();
    click('#nav [data-id="more"]');
    click('.menu-row[data-id="data"]');
    check(navVisible(), 'Data tab bar must stay visible');
    click('#nav [data-id="chat"]');
    check(getComputedStyle(document.getElementById('nav')).display === 'none', 'Chat must still hide tabs during keyboard input');
    const composer = document.querySelector('#chatForm').getBoundingClientRect();
    check(composer.top >= 0 && composer.bottom <= visualViewport.height, 'Chat composer must remain in the viewport');
    document.body.classList.remove('kb');
    check(navVisible(), 'Chat tabs must return after the keyboard hides');
    return { passed: !failures.length, failures, viewport: { width: innerWidth, height: innerHeight } };
  } finally {
    window.alert = originalAlert;
    document.body.classList.remove('kb');
    if (saved === null) localStorage.removeItem('gym-tracker-v1');
    else localStorage.setItem('gym-tracker-v1', saved);
    setTimeout(() => location.reload(), 1000);
  }
})()
