// Evaluate in a disposable preview. Spec §14.4–8, 13: replacing exercises, quick sets, drafts, finishing, volume, storage failure.
(async () => {
  const originalState = gym.state, saved = localStorage.getItem(gym.KEY), originalAlert = window.alert, originalConfirm = ds.confirm, originalSetItem = Storage.prototype.setItem;
  const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
  const $ = selector => (selector.startsWith('#nav') ? document : document.getElementById('app')).querySelector(selector);
  const click = selector => { const el = $(selector); if (!el) throw Error('Missing ' + selector); el.click(); };
  const settle = () => new Promise(r => setTimeout(r, 40));
  const card = slotId => `.wk-card[data-id="${slotId}"]`;
  const type = (field, value) => { const input = $(`.quick-set [data-draft-field="${field}"]`); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const addSet = (slotId, weight, reps) => { click(`${card(slotId)} [data-action="addSet"]`); type('weight', weight); type('reps', reps); $('.quick-set').requestSubmit(); };
  const active = () => gym.state.workouts.find(w => w.status === 'active');
  const slot = id => active().slots.find(s => s.id === id);
  let taps = 0;
  try {
    const alerts = [];
    window.alert = m => alerts.push(m);
    ds.confirm = async () => true;
    gym.state = gym.initial();
    gym.update();
    gym.go('A', null, false);
    click('[data-action="startWorkout"]');

    // Adding an alternative during a workout keeps it in the template and selects it for this workout.
    click(`${card('a1')} [data-action="openVariants"]`);
    click('[data-action="addAlternativeFromSheet"]');
    const search = $('#catalogSearch');
    search.value = 'горизонтальный';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    click('[data-action="catalogPick"][data-id="bench"]');
    const alternative = gym.state.days.A[0].alternatives?.find(a => a.weightId === 'bench');
    check(!!alternative && gym.state.days.A.length === 6, 'A new alternative must be saved in the template without adding a slot');
    check(slot('a1').selectedId === alternative?.id && slot('a1').variants.length === 2, 'During a workout the new alternative must be selected right away');
    check(gym.normalize(JSON.parse(localStorage.getItem(gym.KEY))).workouts.find(w => w.status === 'active').slots[0].selectedId === alternative?.id, 'The chosen alternative must survive a reload');

    // Switching between saved variants takes two taps.
    const tap = selector => { taps++; click(selector); };
    tap(`${card('a1')} [data-action="openVariants"]`);
    tap('[data-action="pickVariant"][data-id="a1"]');
    check(taps === 2 && !gym.modal && slot('a1').selectedId === 'a1', 'Replace → variant must take exactly two taps and close the sheet');

    // Quick sets from the list: prefill, validation and cancel never create sets.
    click(`${card('a2')} [data-action="addSet"]`);
    check($('.quick-set [data-draft-field="weight"]').value === '' && document.activeElement === $('.quick-set [data-draft-field="weight"]'), 'Without history the row must be empty and focus the weight');
    type('weight', '30');
    $('.quick-set').requestSubmit();
    check(alerts.at(-1)?.startsWith('Повторения') && !Object.keys(slot('a2').performed).length && !!$('.quick-set'), 'Invalid reps must not save a set and must keep the row');
    click('[data-action="cancelSet"]');
    check(!$('.quick-set') && !gym.state.drafts[active().id], 'Cancel must drop the draft without a set');
    addSet('a1', '40', '10');
    check(!$('.quick-set') && $(card('a1')).textContent.includes('40×10'), 'Saving must close the row and show the set on the card');
    click(`${card('a1')} [data-action="addSet"]`);
    check($('.quick-set [data-draft-field="weight"]').value === '40' && $('.quick-set [data-draft-field="reps"]').value === '10', 'The next row must be prefilled from the previous set of this workout');
    type('reps', '8');
    $('.quick-set').requestSubmit();

    // Sets of each variant are kept apart; the slot stays one slot.
    tap(`${card('a1')} [data-action="openVariants"]`);
    tap(`[data-action="pickVariant"][data-id="${alternative.id}"]`);
    addSet('a1', '0', '12');
    check($(card('a1')).textContent.includes('Также') && $(card('a1')).textContent.includes('2 подхода'), 'The card must mention sets of the other variant');
    check(active().slots.length === 6 && slot('a1').performed.a1.sets.length === 2 && slot('a1').performed[alternative.id].sets.length === 1, 'Switching variants must not lose or merge sets');
    click(`${card('a1')} [data-action="openVariants"]`);
    click('[data-action="pickVariant"][data-id="a1"]');
    check($(card('a1')).querySelectorAll('.set-chip').length === 2, 'Returning to a variant must show its earlier sets');

    // A non-empty draft blocks finishing and leads to it; nothing is dropped.
    click(`${card('a3')} [data-action="addSet"]`);
    type('weight', '55');
    click('[data-action="cancelSet"]');
    click(`${card('a4')} [data-action="addSet"]`);
    type('weight', '12');
    gym.go('workouts', null, false);
    gym.go('A', null, false);
    check($(`${card('a4')} .quick-set [data-draft-field="weight"]`)?.value === '12', 'The open draft must survive navigation');
    click(`${card('a6')} [data-action="addSet"]`);
    check($(card('a4')).querySelector('.draft-hint')?.textContent.includes('12'), 'Opening another card must keep the first draft visible');
    click('[data-action="cancelSet"]');
    click('[data-action="finishWorkout"]');
    await settle();
    check(alerts.at(-1) === 'Сохраните или удалите черновик подхода.' && active() && $('.quick-set [data-draft-field="weight"]')?.value === '12', 'Finishing with a draft must keep the workout and open the draft');
    click('[data-action="cancelSet"]');

    // Storage failure: nothing looks saved, the typed row stays.
    click(`${card('a5')} [data-action="addSet"]`);
    type('weight', '80');
    type('reps', '9');
    Storage.prototype.setItem = function (key, value) { if (key === gym.KEY) throw new DOMException('Full', 'QuotaExceededError'); return originalSetItem.call(this, key, value); };
    $('.quick-set').requestSubmit();
    check(/Не удалось сохранить/.test(alerts.at(-1)) && !slot('a5').performed.a5 && $('.quick-set [data-draft-field="weight"]')?.value === '80', 'A failed save must not show a set and must keep the input');
    click('[data-action="cancelSet"]');
    check(!!$('.quick-set') && $('.quick-set [data-draft-field="weight"]')?.value === '80', 'A failed cancellation must keep the draft open for retry');
    Storage.prototype.setItem = originalSetItem;
    if (!$('.quick-set')) click(`${card('a5')} [data-action="addSet"]`);
    click('[data-action="cancelSet"]');

    // A draft of a different variant must become visible when it blocks finishing.
    click(`${card('a1')} [data-action="openVariants"]`);
    click(`[data-action="pickVariant"][data-id="${alternative.id}"]`);
    click(`${card('a1')} [data-action="addSet"]`);
    type('weight', '35');
    click(`${card('a1')} [data-action="openVariants"]`);
    click('[data-action="pickVariant"][data-id="a1"]');
    click('[data-action="finishWorkout"]');
    await settle();
    check(slot('a1').selectedId === alternative.id && $('.quick-set [data-draft-field="weight"]')?.value === '35', 'Finishing must reveal a blocking draft even when a different variant is selected');
    if (!$('.quick-set')) {
      click(`${card('a1')} [data-action="openVariants"]`);
      click(`[data-action="pickVariant"][data-id="${alternative.id}"]`);
      click(`${card('a1')} [data-action="addSet"]`);
    }
    click('[data-action="cancelSet"]');

    // Partial finish: slots with sets are done, the rest skipped; the result opens.
    click('[data-action="finishWorkout"]');
    await settle();
    const done = gym.state.workouts.find(w => w.status === 'completed');
    check(done && gym.state.tab === 'result' && gym.exerciseId === done.id, 'Finishing must open the result of that workout');
    check(done?.slots.filter(s => s.status === 'done').length === 1 && done.slots.filter(s => s.status === 'skipped').length === 5, 'Slots without sets must be skipped');
    const stats = $('.stats')?.textContent || '';
    check(stats.includes('1 из 6') && /Подходы\s*3/.test(stats) && stats.includes('720 кг'), 'Result must count 1/6, 3 sets and 720 kg (40×10 + 40×8 + 0×12)');
    click('[data-action="toWorkouts"]');
    check(gym.state.tab === 'workouts' && $('.hero')?.textContent.includes('Тренировка B'), '"To workouts" must show the next workout');

    // The next workout of A starts from the main exercise and keeps the alternative.
    const next = gym.uc.startWorkout('A').value, again = gym.state.workouts.find(w => w.id === next);
    check(again.slots[0].selectedId === 'a1' && again.slots[0].variants.some(v => v.id === alternative.id), 'A new workout must start with the main exercise and keep alternatives');
    // Saving from the exercise screen must not prefill and then silently save a duplicate on completion.
    gym.go('A', null, false);
    click(`${card('a2')} [data-action="openWorkoutExercise"]`);
    type('weight', '30');
    type('reps', '8');
    $('.quick-set').requestSubmit();
    check(!$('.quick-set'), 'Saving a set on the exercise screen must close the entry row');
    click('[data-action="completeAndBack"]');
    check(slot('a2').performed.a2.sets.length === 1, 'Completing after an explicit save must not add a duplicate set');
    return { passed: !failures.length, failures };
  } finally {
    Storage.prototype.setItem = originalSetItem;
    window.alert = originalAlert;
    ds.confirm = originalConfirm;
    gym.state = originalState;
    Object.assign(gym.view, { modal: null, draft: null });
    gym.render();
    if (saved === null) localStorage.removeItem(gym.KEY); else localStorage.setItem(gym.KEY, saved);
  }
})()
