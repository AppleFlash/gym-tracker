// Evaluate in a disposable preview. Spec §14.1–3: workout queue, explicit start, one active workout, restore.
(async () => {
  const originalState = gym.state, saved = localStorage.getItem(gym.KEY), originalAlert = window.alert, originalConfirm = ds.confirm;
  const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
  // Push transitions keep a snapshot of the previous screen for a moment: look in the live screen first.
  const $ = selector => (selector.startsWith('#nav') ? document : document.getElementById('app')).querySelector(selector);
  const click = selector => { const el = $(selector); if (!el) throw Error('Missing ' + selector); el.click(); };
  const settle = () => new Promise(r => setTimeout(r, 40));
  const heroText = () => $('.hero').textContent;
  // Runs one whole workout of a day through the UI: start, one set from the list, finish.
  const runWorkout = async day => {
    gym.go(day, null, false);
    click('[data-action="startWorkout"]');
    click('.wk-card [data-action="addSet"]');
    const form = $('.quick-set');
    form.querySelector('[data-draft-field="weight"]').value = '10';
    form.querySelector('[data-draft-field="reps"]').value = '5';
    form.requestSubmit();
    click('[data-action="finishWorkout"]');
    await settle();
  };
  try {
    const alerts = [];
    window.alert = m => alerts.push(m);
    ds.confirm = async () => true;
    gym.state = gym.initial();
    gym.update();
    gym.go('workouts', null, false);
    check(/Следующая тренировка\s*Тренировка A/.test(heroText()) && heroText().includes('Начните с тренировки A'), 'Without history the next workout must be A');

    gym.go('B', null, false);
    check(!gym.state.workouts.length && !!document.querySelector('[data-action="startWorkout"][data-day="B"]'), 'Opening a template must not start a workout');
    click('[data-action="openVariants"]');
    click('[data-action="close"]');
    check(!gym.state.workouts.length, 'Browsing alternatives of a template must not start a workout');

    await runWorkout('A');
    gym.go('workouts', null, false);
    check(heroText().includes('Тренировка B') && heroText().includes('Последняя завершённая: A'), 'After A the next workout must be B');
    gym.state.days.star.push({ id: 's1', name: gym.findExercise('hammer').name, weightId: 'hammer', sets: 2, range: '10–12' });
    gym.update();
    await runWorkout('star');
    gym.go('workouts', null, false);
    check(heroText().includes('Тренировка B'), '★ must not move the queue');
    await runWorkout('C');
    gym.go('workouts', null, false);
    check(heroText().includes('Тренировка A'), 'Finishing C out of order must make A next');
    await runWorkout('B');
    gym.go('workouts', null, false);
    check(heroText().includes('Тренировка C'), 'Finishing B must make C next');

    // One active workout: another template offers "Continue" instead of a second start.
    click('[data-action="startWorkout"]');
    const active = gym.state.workouts.find(w => w.status === 'active');
    check(active?.day === 'C' && gym.state.tab === 'C', 'Start on home must start the named workout and open it');
    click('.wk-card [data-action="addSet"]');
    $('.quick-set [data-draft-field="weight"]').value = '22,5';
    $('.quick-set [data-draft-field="weight"]').dispatchEvent(new Event('input', { bubbles: true }));
    gym.go('A', null, false);
    check(!$('[data-action="startWorkout"]') && $('[data-action="openWorkout"][data-day="C"]')?.textContent.includes('Продолжить тренировку C'), 'Another template must link to the active workout instead of starting');
    check(gym.uc.startWorkout('A').error?.includes('Уже идёт'), 'A second workout must be refused');
    gym.go('workouts', null, false);
    check(heroText().includes('Сейчас') && heroText().includes('Продолжить C') && heroText().includes('После неё — A'), 'Home must show the running workout and what comes after');

    // Restore after reload: storage alone must bring back the workout and the draft.
    const restored = gym.normalize(JSON.parse(localStorage.getItem(gym.KEY)));
    const restoredActive = restored.workouts.find(w => w.status === 'active');
    check(restoredActive?.id === active.id, 'The active workout must survive a reload');
    check(Object.values(restored.drafts[active.id] || {}).some(rows => rows[0].weight === '22,5'), 'A typed draft must survive a reload');
    return { passed: !failures.length, failures, alerts };
  } finally {
    window.alert = originalAlert;
    ds.confirm = originalConfirm;
    gym.state = originalState;
    Object.assign(gym.view, { modal: null, draft: null });
    gym.render();
    if (saved === null) localStorage.removeItem(gym.KEY); else localStorage.setItem(gym.KEY, saved);
  }
})()
