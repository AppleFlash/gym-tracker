// Evaluate in a disposable preview. Spec §11, §14.13: AI entry points, user-sent questions, facts in the prompt, offline safety.
(async () => {
  const originalState = gym.state, saved = localStorage.getItem(gym.KEY), originalFetch = window.fetch, originalConfirm = ds.confirm;
  const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
  const $ = selector => (selector.startsWith('#nav') ? document : document.getElementById('app')).querySelector(selector);
  const click = selector => { const el = $(selector); if (!el) throw Error('Missing ' + selector); el.click(); };
  const settle = () => new Promise(r => setTimeout(r, 60));
  const requests = [];
  try {
    window.fetch = async (url, options) => { requests.push(JSON.parse(options.body)); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Хорошо' }] } }], modelVersion: 'test' })); };
    ds.confirm = async () => true;
    gym.state = gym.initial();
    gym.update();
    const workout = (day, weight) => { const id = gym.uc.startWorkout(day).value; gym.uc.saveSet(id, 'a1', 'a1', { weight, reps: '8' }); gym.uc.finishWorkout(id); return id; };
    workout('A', '40');
    for (const day of ['B', 'C']) { const id = gym.uc.startWorkout(day).value; gym.uc.saveSet(id, day.toLowerCase() + '1', day.toLowerCase() + '1', { weight: '10', reps: '10' }); gym.uc.finishWorkout(id); }
    const last = workout('A', '42,5');

    // From the result: chat opens with a visible context and a prefilled question; nothing is sent yet.
    gym.view.resultFrom = 'profile';
    gym.go('result', last, false);
    click('[data-action="discussWorkout"]');
    check(gym.state.tab === 'chat' && $('.chat-context')?.textContent.includes('Тренировка A') && $('#chatForm textarea').value.startsWith('Разбери'), 'Discussing a workout must open the chat with context and a prefilled question');
    check(!requests.length, 'Nothing may be sent automatically');
    $('#chatForm').requestSubmit();
    await settle();
    const system = requests[0]?.systemInstruction.parts[0].text || '';
    check(system.includes('42,5×8') && system.includes('Предыдущее завершённое занятие того же шаблона') && system.includes('40×8'), 'The workout context must hold this workout and the previous one of the same template');
    check(system.includes('объём с отягощением 340 кг'), 'Volume must come from the app, not from the model');
    check(system.includes('Цель: не задана') && !system.includes('набирать мышечную массу'), 'Without a goal the prompt must not assume one');
    check(system.includes('Не назначай разгрузку'), 'The prompt must forbid automatic deloads');

    // From an exercise: the last runs of that catalog exercise.
    gym.go('item', 'incline', false);
    click('[data-action="discussExercise"]');
    $('#chatForm').requestSubmit();
    await settle();
    const exercise = requests[1]?.systemInstruction.parts[0].text || '';
    check(exercise.includes('Последние завершённые выполнения') && exercise.includes('40×8') && exercise.includes('42,5×8') && !exercise.includes('10×10'), 'The exercise context must hold only runs of that exercise');

    // A network failure is reported in the chat and leaves the diary untouched.
    const stored = localStorage.getItem(gym.KEY);
    window.fetch = async () => { throw new TypeError('Failed to fetch'); };
    click('[data-action="newChat"]');
    $('#chatForm textarea').value = 'Как дела?';
    $('#chatForm').requestSubmit();
    await settle();
    check(/Нет связи с прокси/.test(gym.view.chat.at(-1)?.text) && localStorage.getItem(gym.KEY) === stored, 'An AI error must be shown without touching saved data');
    check(gym.aiContext().includes('Последние завершённые занятия') && gym.aiContext().includes('Программа'), 'The general chat must get the program and recent workouts');
    return { passed: !failures.length, failures };
  } finally {
    window.fetch = originalFetch;
    ds.confirm = originalConfirm;
    gym.state = originalState;
    Object.assign(gym.view, { modal: null, draft: null, chat: [], chatContext: null });
    gym.render();
    if (saved === null) localStorage.removeItem(gym.KEY); else localStorage.setItem(gym.KEY, saved);
  }
})()
