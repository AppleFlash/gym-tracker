// Evaluate in a disposable preview. Spec §14.12: importing version-1 JSON keeps everything; export/import round-trips.
(async () => {
  const originalState = gym.state, saved = localStorage.getItem(gym.KEY), originalAlert = window.alert, originalConfirm = window.confirm, originalDsConfirm = ds.confirm;
  const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
  const $ = selector => (selector.startsWith('#nav') ? document : document.getElementById('app')).querySelector(selector);
  const click = selector => { const el = $(selector); if (!el) throw Error('Missing ' + selector); el.click(); };
  const settle = () => new Promise(r => setTimeout(r, 60));
  const importText = async text => {
    const input = document.getElementById('importFile'), files = new DataTransfer();
    files.items.add(new File([text], 'backup.json', { type: 'application/json' }));
    input.files = files.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  };
  try {
    const alerts = [];
    window.alert = m => alerts.push(m);
    window.confirm = () => true;
    ds.confirm = async () => true;
    // A version-1 backup: per-day marks and sessions, history snapshots, an AI profile text.
    const v1 = gym.initial();
    for (const key of ['workouts', 'drafts', 'profile']) delete v1[key];
    Object.assign(v1, {
      version: 1, tab: 'weights', today: 'A', lastDay: 'B', ai: { profile: 'Колено: без глубоких приседов' },
      done: { A: ['a1', 'a3'], B: [], C: ['c1'], star: [] },
      sessions: { A: {
        a1: { startedAt: '2026-11-01T10:00:00.000Z', completedAt: '2026-11-01T10:20:00.000Z', sets: [{ id: 's1', weight: 40, reps: 10 }], recordIds: ['r1'] },
        a2: { startedAt: '2026-11-01T10:30:00.000Z', completedAt: null, sets: [{ id: 'd1', weight: '22,5', reps: '8' }, { id: 'd2', weight: '', reps: '' }] },
      } },
      history: [{ id: 'h1', day: 'B', date: '2026-10-30', completedAt: '2026-10-30T12:00:00.000Z', exercises: [
        { id: 'b1', name: 'Подтягивания / верхний блок', completed: true, startedAt: null, completedAt: '2026-10-30T11:00:00.000Z', sets: [{ id: 'q1', weight: 0, reps: 8 }] },
        { id: 'b2', name: 'Тяга в упоре', completed: true },
        { id: 'b3', name: 'Румынская тяга', completed: false },
      ] }],
    });
    v1.days.A[0].selectedId = 'a1';
    const journal = JSON.stringify(v1.groups.find(g => g.id === 'chest').items.find(i => i.id === 'incline').records);

    gym.state = gym.initial();
    gym.update();
    gym.go('settings', null, false);
    await importText(JSON.stringify(v1));
    check(gym.state.version === 2 && !alerts.length, 'A version-1 backup must import without errors');
    check(gym.state.profile.context === 'Колено: без глубоких приседов' && !('ai' in gym.state) && !('done' in gym.state), 'The AI profile must move into the profile, old fields must go');
    check(JSON.stringify(gym.state.groups.find(g => g.id === 'chest').items.find(i => i.id === 'incline').records) === journal, 'The weight journal must be kept untouched');
    check(!gym.state.days.A[0].selectedId, 'A selected alternative must no longer live in the template');

    // Two unfinished days become two workouts to resolve before a new one can start.
    gym.go('workouts', null, false);
    check($('.hero').textContent.includes('Незавершённые из предыдущей версии') && document.querySelectorAll('#app .legacy-row').length === 2 && !$('[data-action="startWorkout"]'), 'Several unfinished days must be listed for resolution');
    check(gym.uc.startWorkout('B').error?.includes('Уже идёт'), 'No new workout may start before they are resolved');
    const a = gym.state.workouts.find(w => w.status === 'active' && w.day === 'A'), c = gym.state.workouts.find(w => w.status === 'active' && w.day === 'C');
    check(a.slots[0].performed.a1.sets[0].weight === 40 && a.slots[2].legacyDone && gym.state.drafts[a.id]['a2:a2'][0].weight === '22,5', 'Saved sets, old marks and unsaved rows must all survive');
    click(`[data-action="deleteWorkout"][data-id="${c.id}"]`);
    await settle();
    check($('.hero').textContent.includes('Сейчас') && $('.hero').textContent.includes('Тренировка A'), 'After resolving one, the other continues as the running workout');

    // Old history: marks without sets stay marks, linked sets reach the chart, the queue follows it.
    gym.go('history', null, false);
    click('[data-action="openResult"][data-id="h1"]');
    check(document.getElementById('app').textContent.includes('Отмечены выполненными без подходов: Тяга в упоре') && document.getElementById('app').textContent.includes('Пропущено: Румынская тяга'), 'An old workout must show marks and skipped exercises honestly');
    gym.go('item', 'lat', false);
    check([...document.querySelectorAll('#app .trend-chart text')].some(t => t.textContent === '×8'), 'Old sets linked by program id must reach the chart');
    gym.go('item', 'incline', false);
    check(document.getElementById('app').textContent.includes('Ранее сохранённые записи'), 'Journal records must stay visible apart from the chart');

    // Export → import restores the same data.
    const exported = gym.uc.exportBackup(), before = JSON.parse(exported);
    gym.state = gym.initial();
    gym.update();
    await importText(exported);
    check(JSON.stringify(gym.state) === JSON.stringify({ ...before, tab: gym.state.tab }), 'Export of the new format must import back without losses');
    await importText('{"days":{}}');
    check(alerts.at(-1)?.startsWith('Импорт не удался'), 'A malformed backup must be refused before replacing data');
    // Invalid imports must not admit ambiguous identities or unsupported schemas.
    const corruptions = [
      ['future schema', d => { d.version = 999; }],
      ['missing template', d => { delete d.days.A; }],
      ['duplicate slot', d => { d.workouts[0].slots.push(structuredClone(d.workouts[0].slots[0])); }],
      ['duplicate variant', d => { const s = d.workouts[0].slots[0]; s.variants.push(structuredClone(s.variants[0])); }],
      ['unknown draft variant', d => { const w = d.workouts.find(w => w.status === 'active'); d.drafts[w.id]['missing:missing'] = [{ weight: '20', reps: '8' }]; }],
    ];
    for (const [label, corrupt] of corruptions) {
      const bad = JSON.parse(exported); corrupt(bad);
      let rejected = false;
      try { gym.uc.readBackup(JSON.stringify(bad)); } catch { rejected = true; }
      check(rejected, 'Import must reject ' + label);
    }
    return { passed: !failures.length, failures };
  } finally {
    window.alert = originalAlert;
    window.confirm = originalConfirm;
    ds.confirm = originalDsConfirm;
    gym.state = originalState;
    Object.assign(gym.view, { modal: null, draft: null });
    gym.render();
    if (saved === null) localStorage.removeItem(gym.KEY); else localStorage.setItem(gym.KEY, saved);
  }
})()
