import { findItem, itemGroup, catalogItems, searchKey, EQUIPMENT } from '../../domain/catalog.js';
import { alternativeGroup } from '../../domain/program.js';
import { activeWorkoutOf } from '../../domain/workout.js';
import { ctx, view, data, applied, rerender } from '../context.js';
import { esc, longDate } from '../format.js';
import { groupOptions, equipmentOptions } from '../catalog-list.js';
import { openCatalog, discardForm } from './catalog.js';

const fields = [['setup', 'Исходное положение'], ['movement', 'Движение'], ['attention', 'На что обратить внимание'], ['mistakes', 'Типичные ошибки']];
const blank = () => ({ setup: '', movement: '', attention: '', mistakes: '', source: 'manual', model: null });
const duplicates = name => catalogItems(data()).filter(i => [i.name, ...i.aliases].some(n => searchKey(n) === searchKey(name)));
const header = title => `<div class="sheet-nav"><div class="nav-side"></div><h2 class="sheet-title">${title}</h2><div class="nav-side end"><button class="nav-action" data-action="close">Закрыть</button></div></div>`;
const errorHtml = m => m.error ? `<p class="notice error" role="alert">${esc(m.error)}</p>` : '';

export function openTechnique(id) {
  if (!findItem(data(), id)) return;
  view.modal = { type: 'technique', id, mode: 'view', busy: false, dirty: false, seq: 0 };
  ctx.render();
}
export function techniqueHtml() {
  const m = view.modal, item = findItem(data(), m.id), saved = item?.technique;
  if (!item) return '';
  let body = '';
  if (m.mode === 'view') {
    body = saved
      ? `<div class="technique-reading">${fields.map(([key, title]) => `<section class="technique-section"><h3>${title}</h3><p class="technique-text">${esc(saved[key])}</p></section>`).join('')}</div><p class="technique-meta">${saved.source === 'manual' ? 'Записано вручную' : saved.source === 'ai' ? 'Создано ИИ' : 'Создано ИИ, отредактировано'} · ${esc(longDate(saved.updatedAt.slice(0, 10)))}${saved.model ? ' · ' + esc(saved.model) : ''}</p><div class="technique-actions"><button class="btn" data-action="techniqueManual">Редактировать</button><button class="btn technique-secondary" data-action="techniqueRequest">Новая версия с ИИ</button></div>`
      : '<p class="technique-intro">Сохраните подсказки по настройке и движению, чтобы возвращаться к ним на тренировке.</p><div class="technique-actions"><button class="btn primary" data-action="techniqueRequest">Создать с ИИ</button><button class="btn technique-secondary" data-action="techniqueManual">Написать вручную</button></div>';
  } else if (m.mode === 'request') {
    const input = m.input;
    body = `<form id="techniqueRequestForm"><p class="technique-intro">Уточните движение и оборудование, чтобы получить памятку для вашего варианта упражнения.</p><label class="field">Движение и вариант<input name="movement" value="${esc(input.movement)}" maxlength="200" required></label><label class="field">Оборудование<select name="equipment">${equipmentOptions(input.equipment)}</select></label>${m.question ? `<p class="technique-intro">${esc(m.question)}</p><label class="field">Уточнение<textarea name="clarification" maxlength="2000">${esc(input.clarification || '')}</textarea></label>` : ''}${errorHtml(m)}<button type="submit" class="btn primary block" ${m.busy ? 'disabled' : ''}>${m.busy ? 'Подготавливаем…' : 'Создать памятку'}</button></form>`;
  } else {
    body = `<form id="techniqueForm"><p class="technique-intro">${m.generated ? 'Черновик ИИ. Проверьте и при необходимости исправьте перед сохранением.' : 'Запишите свои подсказки для этого упражнения.'}</p>${fields.map(([key, title]) => `<label class="field">${title}<textarea name="${key}" rows="3" maxlength="2000" required>${esc(m.form[key])}</textarea></label>`).join('')}${errorHtml(m)}<div class="form-actions"><button class="btn primary" type="submit">${saved && m.generated ? 'Заменить памятку' : 'Сохранить'}</button></div></form>`;
  }
  return `<dialog class="modal technique-modal" aria-labelledby="techniqueTitle"><section class="card catalog-shell technique-shell"><div class="catalog-content technique-content"><h2 class="technique-title" id="techniqueTitle">${esc(item.name)}</h2>${body}</div><footer class="sheet-footer"><button class="btn" data-action="close">Закрыть</button></footer></section></dialog>`;
}

const duplicateHtml = (matches, index) => matches.map(i => `<p class="note">Уже есть: ${esc(i.name)}${i.archived ? ' (в архиве)' : ''}</p>${i.archived || itemGroup(data(), i.id)?.id !== alternativeGroup(data(), view.modal.day, view.modal.slotId)?.id ? '' : `<button type="button" class="btn small" data-action="acceptExistingSuggestion" data-index="${index}" data-id="${esc(i.id)}">Выбрать существующее</button>`}`).join('');

export function alternativeHtml() {
  const m = view.modal;
  const suggestions = m.result ? m.result.length ? m.result.map((s, index) => {
    const item = s.kind === 'existing' ? findItem(data(), s.itemId) : null, form = m.forms[index];
    const matches = s.kind === 'new' ? duplicates(form.name) : [];
    return `<section class="card suggestion"><h3>${esc(item?.name || form.name)}</h3><p class="note">${EQUIPMENT[item?.equipment || s.equipment] || 'Оборудование не уточнено'}</p><p>${esc(s.reason)}</p><p class="note">Отличие: ${esc(s.difference)}</p>${s.kind === 'new' ? `<form class="suggestion-form" data-index="${index}"><label class="field">Название<input name="name" value="${esc(form.name)}" maxlength="200" required></label><div class="form-grid"><label class="field">Группа<select name="groupId">${groupOptions(form.groupId, alternativeGroup(data(), m.day, m.slotId)?.id)}</select></label><label class="field">Оборудование<select name="equipment">${equipmentOptions(form.equipment)}</select></label></div><div class="suggestion-duplicates">${duplicateHtml(matches, index)}</div><button class="btn primary block" type="submit" ${matches.length ? 'disabled' : ''}>${activeWorkoutOf(data(), m.day) ? 'Создать и выбрать' : 'Создать и добавить альтернативу'}</button></form>` : `<button class="btn primary block" data-action="acceptSuggestion" data-index="${index}">${activeWorkoutOf(data(), m.day) ? 'Добавить и выбрать' : 'Добавить альтернативу'}</button>`}</section>`;
  }).join('') : '<p class="empty">Подходящих замен не найдено. Попробуйте ручной поиск.</p>' : '';
  return `<dialog class="modal catalog-modal" aria-label="Подбор замены"><section class="card catalog-shell">${header('Подбор замены')}<div class="catalog-content"><form id="alternativeRequestForm"><label class="field">Причина<select name="reason">${[['busy', 'Тренажёр занят'], ['equipment', 'Нет нужного оборудования'], ['variety', 'Хочу другой вариант']].map(([id, name]) => `<option value="${id}" ${m.input.reason === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label><fieldset class="equipment-choices"><legend>Доступное оборудование (необязательно)</legend>${Object.entries(EQUIPMENT).map(([id, title]) => `<label><input type="checkbox" name="equipment" value="${id}" ${m.input.equipment.includes(id) ? 'checked' : ''}>${title}</label>`).join('')}</fieldset><button class="btn primary block" type="submit" ${m.busy ? 'disabled' : ''}>${m.busy ? 'Подбираем…' : 'Подобрать'}</button></form>${errorHtml(m)}${suggestions}<button class="btn block" data-action="manualAlternatives">Найти в каталоге</button><p class="note">ИИ предлагает варианты, но не гарантирует равноценность замены.</p></div></section></dialog>`;
}

// A late response can only update the exact open form and the state it was requested for.
async function request(m, task) {
  const seq = ++m.seq, state = data();
  m.busy = true; m.error = '';
  if (m.type === 'alternative-ai') { m.result = null; m.forms = []; }
  ctx.render();
  try {
    const result = await task();
    if (view.modal !== m || m.seq !== seq) return;
    if (data() !== state) throw Error('Данные изменились. Повторите запрос.');
    if (m.type === 'alternative-ai') { m.result = result; m.forms = result.map(s => ({ name: s.name || '', groupId: s.groupId || '', equipment: s.equipment || '' })); }
    else if (result.status === 'clarify') m.question = result.question;
    else { m.form = result; m.mode = 'edit'; m.generated = true; m.edited = false; m.dirty = true; }
  } catch (e) { if (view.modal === m && m.seq === seq) m.error = e.message; }
  finally { if (view.modal === m && m.seq === seq) { m.busy = false; ctx.render(); } }
}
function accept(m, suggestion, properties = null) {
  const result = ctx.uc.acceptAlternative(m.day, m.slotId, m.input, suggestion, properties);
  if (!applied(result)) return;
  view.modal = null; rerender();
}
export const actions = {
  openTechnique: ({ id }) => openTechnique(id),
  techniqueManual: () => { const m = view.modal; m.mode = 'edit'; m.form = { ...(findItem(data(), m.id).technique || blank()) }; m.generated = false; m.edited = false; m.dirty = false; ctx.render(); },
  techniqueRequest: () => { const m = view.modal, item = findItem(data(), m.id); Object.assign(m, { mode: 'request', input: { movement: item.name, equipment: item.equipment || '', clarification: '' }, question: '', error: '' }); ctx.render(); },
  suggestAlternatives: ({ day, id }) => { view.modal = { type: 'alternative-ai', day, slotId: id, input: { reason: 'busy', equipment: [] }, seq: 0, busy: false, result: null, dirty: false }; ctx.render(); },
  manualAlternatives: async () => { const m = view.modal; if (await discardForm(m)) openCatalog(m.day, m.slotId); },
  acceptSuggestion: ({ index }) => { const m = view.modal; accept(m, m.result[Number(index)]); },
  acceptExistingSuggestion: ({ index, id }) => { const m = view.modal, s = m.result[Number(index)]; accept(m, { kind: 'existing', itemId: id, reason: s.reason, difference: s.difference }); },
};
function inputChanged(ev) {
  const m = view.modal;
  if (!m || !['technique', 'alternative-ai'].includes(m.type)) return;
  if (ev.target.closest('#techniqueForm')) { m.form[ev.target.name] = ev.target.value; m.edited = true; m.dirty = true; }
  const form = ev.target.closest('#techniqueRequestForm,#alternativeRequestForm');
  if (form) {
    const values = new FormData(form);
    m.input = form.id === 'alternativeRequestForm' ? { reason: values.get('reason'), equipment: values.getAll('equipment') } : { movement: values.get('movement'), equipment: values.get('equipment'), clarification: values.get('clarification') || '' };
    m.seq++; m.busy = false; m.result = null; m.dirty = true;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = false; submit.textContent = m.type === 'technique' ? 'Создать памятку' : 'Подобрать';
    document.querySelectorAll('.suggestion').forEach(e => e.remove());
  }
  const suggestion = ev.target.closest('.suggestion-form');
  if (suggestion) {
    const index = Number(suggestion.dataset.index);
    m.forms[index][ev.target.name] = ev.target.value; m.dirty = true;
    const matches = duplicates(m.forms[index].name);
    suggestion.querySelector('.suggestion-duplicates').innerHTML = duplicateHtml(matches, index);
    suggestion.querySelector('[type="submit"]').disabled = matches.length > 0;
  }
}
export const listeners = [
  ['input', inputChanged], ['change', inputChanged],
  ['submit', ev => {
    const form = ev.target, m = view.modal;
    if (!form.matches('#techniqueRequestForm,#alternativeRequestForm,#techniqueForm,.suggestion-form')) return;
    ev.preventDefault();
    if (form.id === 'techniqueForm') {
      const input = { ...m.form, ...Object.fromEntries(new FormData(form)) };
      delete input.status;
      if (m.edited && input.source !== 'manual') input.source = 'ai-edited';
      if (applied(ctx.uc.saveTechnique(m.id, input))) { m.mode = 'view'; m.dirty = false; ctx.render(); }
    } else if (form.matches('.suggestion-form')) {
      const index = Number(form.dataset.index), properties = { ...Object.fromEntries(new FormData(form)), aliases: [], note: '' };
      const s = { ...m.result[index], ...properties, equipment: properties.equipment || null };
      accept(m, s, properties);
    } else if (!m.busy) {
      if (m.type === 'technique') {
        const input = Object.fromEntries(new FormData(form)); m.input = input;
        if (input.movement.includes('/')) return alert('Укажите одно конкретное движение вместо нескольких вариантов через слеш.');
        request(m, () => ctx.uc.generateTechnique(m.id, { ...input, equipment: input.equipment || null }));
      } else {
        const values = new FormData(form); m.input = { reason: values.get('reason'), equipment: values.getAll('equipment') };
        request(m, () => ctx.uc.suggestAlternatives(m.day, m.slotId, m.input));
      }
    }
  }],
];
