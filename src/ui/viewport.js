// iOS viewport handling: only the on-screen keyboard may shrink the app shell; the document never scrolls.
export const viewport = { max: 0 };

// The sticky exercise progress bar covers the top of the scroll area: keep the field clear of it.
// (The dock is hidden while the keyboard is open, see design-system.css.) The whole entry form is revealed, so its buttons stay reachable too.
export function revealFocused(field) {
  const app = field.closest('#app'), target = field.closest('.set-entry') || field;
  if (app) {
    const box = app.getBoundingClientRect(), top = app.querySelector('.sp');
    app.style.scrollPaddingTop = top ? Math.max(0, top.getBoundingClientRect().bottom - box.top) + 'px' : '';
  }
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}

export function syncViewport() {
  const root = document.documentElement, height = window.visualViewport?.height || innerHeight;
  root.classList.toggle('standalone', navigator.standalone === true || matchMedia('(display-mode: standalone)').matches);
  viewport.max = Math.max(viewport.max, height);
  const focused = document.activeElement, editing = focused?.matches('input,textarea,select');
  const keyboard = (editing || document.body.classList.contains('kb')) && viewport.max - height > 120 && (window.visualViewport?.scale || 1) === 1;
  document.body.classList.toggle('kb', keyboard);
  if (keyboard) root.style.setProperty('--keyboard-height', height + 'px');
  else root.style.removeProperty('--keyboard-height');
  if (scrollY) scrollTo(0, 0);
  if (keyboard && editing) requestAnimationFrame(() => {
    if (focused === document.activeElement) revealFocused(focused);
    if (scrollY) scrollTo(0, 0);
  });
}

export function watchViewport() {
  window.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  document.addEventListener('focusin', () => setTimeout(syncViewport, 300));
  // Restore the root viewport after iOS dismisses an editor keyboard.
  document.addEventListener('focusout', ev => { if (ev.target.matches('input,textarea,select')) setTimeout(syncViewport, 100); });
}
