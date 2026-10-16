// Evaluate in a disposable preview. Verifies the app shell with long and short pages.
(async () => {
  const originalState = state;
  const saved = localStorage.getItem(KEY);
  const originalTop = document.getElementById('app').scrollTop;
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  const click = selector => document.querySelector(selector).click();
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const barAnchored = () => {
    const bar = document.getElementById('nav').getBoundingClientRect();
    return Math.abs(bar.bottom - (window.visualViewport?.height || innerHeight)) < 2 && bar.top >= 0;
  };
  try {
    state = initial();
    const exercises = state.days.A.map((e, index) => ({ id: e.id, name: e.name, completed: index !== 5 }));
    state.history = Array.from({ length: 40 }, (_, index) => ({
      id: 'history' + index, day: 'A', date: '2026-10-16',
      completedAt: new Date(Date.UTC(2026, 9, 16, 8, index)).toISOString(), exercises
    }));
    state.tab = 'history';
    update();
    const app = document.getElementById('app');
    app.scrollTop = app.scrollHeight;
    await frame();
    const back = document.querySelector('.back-link').getBoundingClientRect();
    check(app.scrollTop > 0, 'Long history must scroll inside the content area');
    check(back.top >= 0 && back.bottom <= document.querySelector('header').getBoundingClientRect().bottom, 'Back button must stay in the header while history scrolls');
    check(barAnchored(), 'Tab bar must stay at the viewport bottom on a long history');
    check(scrollY === 0 && document.documentElement.scrollHeight <= innerHeight + 1, 'History must not move the document viewport');
    const lastCard = app.querySelector('.history-card:last-child').getBoundingClientRect();
    check(lastCard.bottom <= document.getElementById('nav').getBoundingClientRect().top, 'The last history record must remain above the tab bar');

    click('.back-link');
    check(app.scrollTop === 0, 'Navigation must reset content scroll');
    check(!app.textContent.includes('Советы') && app.textContent.includes('Данные'), 'More must replace Advice with Data');
    click('.menu-row[data-id="data"]');
    check(document.querySelector('h1').textContent === 'Данные', 'Data page must open');
    check(!!app.querySelector('[data-action="export"]') && !!app.querySelector('[data-action="import"]'), 'Data must contain export and import actions');
    check(!app.textContent.includes('Правила прогрессии'), 'Data must not contain the old advice block');
    check(barAnchored(), 'Tab bar must remain at the bottom after moving to a short page');
    check(!!document.querySelector('header .back-link'), 'Data must also show a persistent back button');
    click('.back-link');
    state.history = state.history.slice(0, 1);
    click('.menu-row[data-id="history"]');
    await frame();
    check(barAnchored(), 'Entering a short history must not lift the tab bar');
    click('.back-link');
    state.history = [];
    click('.menu-row[data-id="history"]');
    check(barAnchored() && !!app.querySelector('.empty'), 'Empty history must keep the tab bar anchored');
    click('#nav [data-id="day"]');
    check(document.getElementById('pageNavigation').hidden, 'Root tabs must not show a submenu back button');
    check(barAnchored(), 'Training must keep the tab bar anchored');
    check(typeof aiContext() === 'string', 'AI context must still build after removing the advice page');
    return { passed: !failures.length, failures };
  } finally {
    state = originalState;
    render();
    document.getElementById('app').scrollTop = originalTop;
    if (saved === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, saved);
  }
})()
