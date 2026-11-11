// Weight and reps entry with two actions. The values are the persisted draft of the exercise (see ui/sets.js),
// so typing survives re-renders, tab switches and closing the app. Submitting adds a set.
import { esc, helpButton } from '../format.js';

// ref: data-attributes naming the exercise {workout, slot, variant}; completeId: slot id for the second button.
export function setEntry({ ref, weight, reps, hint = '', number, completeId, completeFirst = false }) {
  const attrs = `data-workout="${esc(ref.workout)}" data-slot="${esc(ref.slot)}" data-variant="${esc(ref.variant)}"`, uid = esc(ref.slot);
  const field = (name, label, id, value, placeholder, aria, extra) => `<div class="se-field"><label for="${id}">${label}</label>${extra}<input id="${id}" data-draft-field="${name}" autocomplete="off" ${name === 'weight' ? 'inputmode="decimal" enterkeyhint="next"' : 'inputmode="numeric" pattern="[0-9]*" enterkeyhint="done"'} value="${esc(value)}" placeholder="${placeholder}" aria-label="${aria}"></div>`;
  return `<form class="set-entry" ${attrs}><div class="se-fields">
    ${field('weight', 'Вес, кг', 'se-w-' + uid, weight, '0', `Вес подхода ${number}, кг`, helpButton('weightHelp', 'Как вводить вес'))}
    ${field('reps', 'Повторы', 'se-r-' + uid, reps, '8', `Повторения подхода ${number}`, '')}</div>${hint}
    <div class="se-actions"><button type="submit" class="btn${completeFirst ? '' : ' primary'}">Добавить</button><button type="button" class="btn${completeFirst ? ' primary' : ''}" data-action="completeSlot" data-id="${esc(completeId)}">Завершить</button></div></form>`;
}
