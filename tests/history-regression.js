// Evaluate in a disposable preview. Spec §14.9–11: chart points, correcting past sets, template edits vs. history.
(async () => {
  const originalState = gym.state, saved = localStorage.getItem(gym.KEY), originalAlert = window.alert, originalConfirm = ds.confirm;
  const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
  const $ = selector => (selector.startsWith('#nav') ? document : document.getElementById('app')).querySelector(selector);
  const click = selector => { const el = $(selector); if (!el) throw Error('Missing ' + selector); el.click(); };
  const settle = () => new Promise(r => setTimeout(r, 40));
  const chartText = () => [...document.querySelectorAll('#app .trend-chart text')].map(t => t.textContent);
  // Completed workout through the use cases: the UI paths for entering sets are covered by session-regression.
  const workout = (day, sets) => {
    const id = gym.uc.startWorkout(day).value;
    for (const [slotId, weight, reps] of sets) gym.uc.saveSet(id, slotId, slotId, { weight, reps });
    gym.uc.finishWorkout(id);
    return id;
  };
  try {
    const alerts = [];
    window.alert = m => alerts.push(m);
    ds.confirm = async () => true;
    gym.state = gym.initial();
    gym.update();
    const first = workout('A', [['a1', '60', '10'], ['a1', '65', '5'], ['a1', '65', '6']]);

    gym.go('profile', null, false);
    click('[data-action="tab"][data-id="progress"]');
    click('[data-action="openItem"][data-id="incline"]');
    let text = chartText();
    check(text.includes('65') && text.includes('×6') && !text.includes('×5') && !text.includes('60'), 'One point per workout: the heaviest set, then most reps (65 kg × 6)');
    check(text.includes('Вес, кг') && text.includes('Повторения'), 'Both panels must be titled');
    check(!$('.trend-chart .ic-line') && document.querySelectorAll('#app .trend-chart .ic-dot').length === 2, 'A single workout must be one labelled point per panel, without a line');

    workout('B', [['b1', '50', '8']]);
    const second = workout('C', [['c2', '70', '4']]);
    gym.go('item', 'incline', false);
    text = chartText();
    check(text.includes('70') && text.includes('×4') && document.querySelectorAll('#app .trend-chart .ic-line').length === 2, 'Runs from any template must share one chart for the catalog exercise');

    // Correcting a past set updates the result, the chart and the AI context; the queue does not move.
    gym.go('history', null, false);
    click(`[data-action="openResult"][data-id="${first}"]`);
    const chip = [...document.querySelectorAll('#app .set-chip')].find(c => c.textContent === '65×6');
    chip.click();
    document.querySelector('#editForm [name="reps"]').value = '7';
    document.getElementById('editForm').requestSubmit();
    check($('.stats').textContent.includes(`${(600 + 325 + 455).toLocaleString('ru-RU')} кг`), 'The result must recount volume after a correction');
    gym.go('item', 'incline', false);
    check(chartText().includes('×7'), 'The chart must follow the corrected set');
    check(gym.aiContext({ kind: 'workout', id: first }).includes('65×7'), 'The AI context must follow the corrected set');
    gym.go('progress', null, false);
    check($('.progress-row[data-id="incline"]').textContent.includes('70 кг × 4 ← 65 кг × 7'), 'Progress must compare the last and previous representative sets');
    gym.go('workouts', null, false);
    check($('.hero').textContent.includes('Тренировка A'), 'Editing an old workout must not move the queue');

    // The only set of a completed workout cannot be deleted.
    gym.go('history', null, false);
    click(`[data-action="openResult"][data-id="${second}"]`);
    click('.set-chip');
    click('[data-action="removeModal"]');
    await settle();
    check(alerts.at(-1)?.includes('последний подход') && gym.state.workouts.find(w => w.id === second).slots.some(s => s.performed.c2?.sets.length === 1), 'Deleting the last set of a completed workout must be refused without changes');
    gym.view.modal = null;

    // Renaming or removing a program exercise keeps past snapshots, the catalog item and its history.
    const pastName = gym.state.workouts.find(w => w.id === first).slots[0].variants[0].name;
    gym.openCatalog();
    click('[data-action="catalogGroup"][data-id="chest"]');
    click('[data-action="catalogEditExercise"][data-id="incline"]');
    document.querySelector('#catalogForm [name="name"]').value = 'Жим под углом 30°';
    document.getElementById('catalogForm').requestSubmit();
    gym.view.modal = null;
    gym.go('A', 'a1', false);
    click('[data-action="editDayExercise"]');
    click('[data-action="removeModal"]');
    await settle();
    const past = gym.state.workouts.find(w => w.id === first);
    check(!gym.state.days.A.some(e => e.id === 'a1') && gym.state.tab === 'A', 'Removing must take the exercise out of the program');
    check(past.slots[0].name === pastName && past.slots[0].variants[0].name === pastName && past.slots[0].performed.a1.sets.length === 3, 'A finished workout must keep its snapshot');
    gym.go('item', 'incline', false);
    check(gym.findExercise('incline')?.name === 'Жим под углом 30°' && document.querySelectorAll('#app .trend-chart .ic-dot.w').length === 2, 'The catalog item and its history must stay');
    return { passed: !failures.length, failures };
  } finally {
    window.alert = originalAlert;
    ds.confirm = originalConfirm;
    gym.state = originalState;
    Object.assign(gym.view, { modal: null, draft: null });
    gym.render();
    if (saved === null) localStorage.removeItem(gym.KEY); else localStorage.setItem(gym.KEY, saved);
  }
})()
