// Evaluate in a disposable mobile preview. Models iOS standalone reporting a viewport
// that is shorter than the actual display, then opening and dismissing the keyboard.
(async () => {
  const originalState = gym.state;
  const saved = localStorage.getItem(gym.KEY);
  const originalMax = gym.vvMax;
  const viewport = window.visualViewport;
  const viewportDescriptor = Object.getOwnPropertyDescriptor(viewport, 'height');
  const standaloneDescriptor = Object.getOwnPropertyDescriptor(navigator, 'standalone');
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const bottom = () => document.getElementById('nav').getBoundingClientRect().bottom;
  let reportedHeight = innerHeight - 93;
  try {
    document.activeElement?.blur();
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    Object.defineProperty(viewport, 'height', { configurable: true, get: () => reportedHeight });
    gym.state = gym.initial();
    gym.vvMax = innerHeight;
    gym.onVV();
    for (const tab of ['A', 'profile', 'history', 'settings', 'exercises', 'chat']) {
      gym.state.tab = tab;
      gym.render();
      await frame();
      check(Math.abs(bottom() - innerHeight) < 2, `${tab}: a short visual viewport must not lift the tab bar`);
      check(!document.documentElement.style.getPropertyValue('--keyboard-height'), `${tab}: normal layout must not have a keyboard height override`);
    }
    const input = document.querySelector('#chatForm textarea');
    input.focus();
    reportedHeight = Math.max(260, innerHeight - 350);
    gym.onVV();
    await frame();
    const composer = document.getElementById('chatForm').getBoundingClientRect();
    check(document.body.classList.contains('kb'), 'A focused editor and large viewport reduction must detect the keyboard');
    check(composer.top >= 0 && composer.bottom <= reportedHeight + 1, 'Chat composer must fit above the keyboard');
    input.blur();
    reportedHeight = innerHeight - 93;
    gym.onVV();
    await frame();
    check(!document.body.classList.contains('kb'), 'Keyboard flag must clear after dismissal');
    check(Math.abs(bottom() - innerHeight) < 2, 'Tab bar must return to the display bottom even if visualViewport stays short');
    check(!document.documentElement.style.getPropertyValue('--keyboard-height'), 'Dismissal must remove the keyboard height override');

    // Entering a set at the bottom of a workout: the focused field must stay above the keyboard.
    const id = gym.uc.startWorkout('A').value;
    gym.go('A', null, false);
    document.querySelector('#app .wk-card[data-id="a6"] [data-action="addSet"]').click();
    const weight = document.querySelector('#app .quick-set [data-draft-field="weight"]');
    reportedHeight = Math.max(260, innerHeight - 350);
    gym.onVV();
    await frame();
    weight.scrollIntoView({ block: 'nearest' });
    await frame();
    const field = weight.getBoundingClientRect();
    check(document.activeElement === weight && field.top >= 0 && field.bottom <= reportedHeight + 1, 'The quick set field must be visible above the keyboard');
    check(document.documentElement.scrollWidth <= innerWidth, 'The workout screen must not overflow horizontally');
    weight.blur();
    gym.uc.deleteWorkout(id);
    return { passed: !failures.length, failures };
  } finally {
    if (viewportDescriptor) Object.defineProperty(viewport, 'height', viewportDescriptor);
    else delete viewport.height;
    if (standaloneDescriptor) Object.defineProperty(navigator, 'standalone', standaloneDescriptor);
    else delete navigator.standalone;
    gym.state = originalState;
    gym.vvMax = originalMax;
    gym.onVV();
    gym.render();
    if (saved === null) localStorage.removeItem(gym.KEY);
    else localStorage.setItem(gym.KEY, saved);
  }
})()
