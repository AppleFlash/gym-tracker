// Evaluate in a disposable preview. Spec §3, §10, §14.14: tabs, profile tiles, scrolling, back keeps the position.
(async () => {
  const originalState = gym.state, saved = localStorage.getItem(gym.KEY), originalTop = document.getElementById('app').scrollTop;
  const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
  const $ = selector => (selector.startsWith('#nav') ? document : document.getElementById('app')).querySelector(selector);
  const click = selector => { const el = $(selector); if (!el) throw Error('Missing ' + selector); el.click(); };
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const transition = () => new Promise(resolve => setTimeout(resolve, 650));
  const barAnchored = () => {
    const bar = document.getElementById('nav').getBoundingClientRect();
    return Math.abs(bar.bottom - (window.visualViewport?.height || innerHeight)) < 2 && bar.top >= 0;
  };
  try {
    gym.state = gym.initial();
    gym.state.workouts = Array.from({ length: 40 }, (_, i) => ({
      id: 'w' + i, day: 'A', status: 'completed', startedAt: new Date(Date.UTC(2026, 9, 1 + i % 28, 8)).toISOString(),
      completedAt: new Date(Date.UTC(2026, 9, 1 + i % 28, 9, i)).toISOString(), date: `2026-10-${String(1 + i % 28).padStart(2, '0')}`,
      slots: [{ id: 'a1', name: 'Жим', variants: [{ id: 'a1', name: 'Жим', weightId: 'incline' }], selectedId: 'a1', status: 'done', performed: { a1: { sets: [{ id: 's' + i, weight: 20, reps: 8 }] } } }],
    }));
    gym.update();
    const tabs = [...document.querySelectorAll('#nav .tab')].map(t => t.textContent.trim());
    check(tabs.join() === 'Тренировки,Чат,Профиль', 'The tab bar must be Workouts · Chat · Profile');

    click('#nav [data-id="profile"]');
    const tiles = [...document.querySelectorAll('#app .tile')];
    check(tiles.length === 4 && tiles.every(t => t.tagName === 'BUTTON'), 'Profile must show four whole-tile buttons');
    check(tiles[0].textContent.includes('1 упражнение') && tiles[1].textContent.includes('Последняя') && tiles[3].textContent.includes('Цель не задана'), 'Tiles must summarize progress, history and the goal');
    const firstTile = tiles[0].getBoundingClientRect(), secondTile = tiles[1].getBoundingClientRect();
    check(Math.abs(firstTile.top - secondTile.top) < 1 && firstTile.right <= secondTile.left, 'Tiles must sit two per row');

    const labels = [...document.querySelectorAll('.tile strong, .tile span')];
    const sizes = labels.map(el => parseFloat(getComputedStyle(el).fontSize));
    labels.forEach((el, i) => { el.style.fontSize = sizes[i] * 2 + 'px'; });
    await frame();
    check(tiles.every(t => t.scrollHeight <= t.clientHeight + 1 && t.scrollWidth <= t.clientWidth + 1), 'Profile tiles must grow to fit doubled text without overflow');
    gym.render();

    click('[data-action="tab"][data-id="history"]');
    const app = document.getElementById('app');
    app.scrollTop = app.scrollHeight;
    await frame();
    const back = $('.nav-back').getBoundingClientRect();
    check(app.scrollTop > 0 && document.querySelectorAll('#app .history-row').length === 40, 'A long history must scroll inside the content area');
    check(back.top >= 0 && back.bottom <= $('.navbar').getBoundingClientRect().bottom, 'Back must stay in the navigation bar while history scrolls');
    check(barAnchored() && scrollY === 0 && document.documentElement.scrollHeight <= innerHeight + 1, 'History must not move the document viewport');
    check($('.history-row:last-child').getBoundingClientRect().bottom <= document.getElementById('nav').getBoundingClientRect().top, 'The last history row must stay above the tab bar');

    click('.nav-back');
    click('[data-action="tab"][data-id="settings"]');
    check(!!$('[data-action="export"]') && !!$('[data-action="import"]') && $('.screen-body').textContent.includes('ещё не выполнялся'), 'Settings must hold export, import and the last export date');
    $('[data-profile-field="goal"]').value = 'Сила в жиме';
    $('[data-profile-field="goal"]').dispatchEvent(new Event('input', { bubbles: true }));
    check(JSON.parse(localStorage.getItem(gym.KEY)).profile.goal === 'Сила в жиме', 'The goal must be saved while typing');
    check(barAnchored(), 'The tab bar must stay at the bottom on a short page');

    gym.state.workouts = [];
    gym.update();
    gym.go('history', null, false);
    check(barAnchored() && !!$('.empty'), 'An empty history must keep the tab bar anchored');
    click('#nav [data-id="day"]');
    check(!$('.nav-back') && barAnchored(), 'Root tabs must not show a back button');

    // Back from an exercise returns to the same workout and list position.
    gym.uc.startWorkout('A');
    gym.go('A', null, false);
    app.scrollTop = 0;
    $('.wk-card[data-id="a5"]').scrollIntoView();
    await frame();
    const position = app.scrollTop;
    click('.wk-card[data-id="a5"] [data-action="openWorkoutExercise"]');
    await frame();
    check(app.scrollTop === 0 && !!$('.quick-set') && !document.activeElement.matches('input,textarea'), 'Opening exercise details must keep the title at the top and avoid opening the keyboard during the transition');
    await transition();
    check(gym.state.tab === 'A' && gym.exerciseId === 'a5', 'The exercise name must open its screen');
    click('.nav-back');
    await transition();
    check(gym.state.tab === 'A' && !gym.exerciseId && position > 0 && Math.abs(app.scrollTop - position) < 2, 'Back must return to the same workout at the same scroll position');
    click('.nav-back');
    await transition();
    check(gym.state.tab === 'workouts', 'Back from a workout must return to the home screen');

    // Saved routes of removed tabs land on the matching new screens.
    const moved = tab => gym.normalize({ ...structuredClone(gym.state), tab }).tab;
    check(moved('weights') === 'exercises' && moved('more') === 'profile' && moved('data') === 'settings' && moved('B') === 'workouts', 'Old routes must map to new screens');
    check(gym.aiContext().includes('Цель: Сила в жиме'), 'The AI context must include the goal from the profile');
    return { passed: !failures.length, failures };
  } finally {
    gym.state = originalState;
    Object.assign(gym.view, { modal: null, draft: null });
    gym.render();
    document.getElementById('app').scrollTop = originalTop;
    if (saved === null) localStorage.removeItem(gym.KEY); else localStorage.setItem(gym.KEY, saved);
  }
})()
