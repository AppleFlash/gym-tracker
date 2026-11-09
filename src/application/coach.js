// AI coach prompt. The app computes every number (sets, volume, representative sets); the model only explains facts.
import { variantsOf } from '../domain/program.js';
import { findItem } from '../domain/catalog.js';
import { completedWorkouts, findWorkout, workoutSummary, performancesOf, representativeSet } from '../domain/workout.js';

// Compact evidence summary: ACSM position stand 2026; Pelland et al. 2024 (volume/frequency dose-response);
// Refalo et al. 2023, Robinson et al. 2024 (proximity to failure); Schoenfeld et al. 2017 (load); Singer et al. 2024 (rest).
const EVIDENCE = `- Регулярность важнее деталей. Тренировка каждой крупной группы мышц хотя бы 2 раза в неделю — достаточная база; тип оборудования и сложная периодизация стабильного преимущества не дают.
- Объём: прирост мышц и силы растёт с числом рабочих подходов на группу мышц в неделю, с убывающей отдачей. Ориентир для роста мышц — около 10 и больше подходов на группу в неделю. Частота при равном объёме важна в основном для силы.
- Усилие: для роста мышц подходы стоит заканчивать близко к отказу (0–3 повторения в запасе); отказ не обязателен, для силы близость к отказу почти не влияет.
- Диапазон: рост мышц сопоставим примерно в диапазоне 5–30 повторений при достаточном усилии; сила лучше растёт с тяжёлыми весами (около 1–6 повторений).
- Отдых: дольше 60–90 секунд между подходами немного лучше для роста мышц; тяжёлым базовым упражнениям обычно нужно 2–3 минуты.
- Прогрессия (двойная): сначала довести все рабочие подходы до верхней границы диапазона повторений, затем добавить минимальный шаг веса; после повышения нормально вернуться к нижней границе.`;

const RULES = `Ты — тренер по силовым тренировкам в личном дневнике пользователя.
1. Только чтение: ты не меняешь программу, подходы и историю. Если нужно изменение — скажи, что поменять вручную.
2. Опирайся только на факты ниже. Все числа (подходы, объём, основные подходы, сравнения) уже посчитаны приложением — не пересчитывай и не выдумывай данные. Если данных мало для вывода, прямо так и скажи.
3. Не утверждай, что знаешь технику, усталость, сон или причины изменения результата; можешь спросить о них.
4. Цель пользователя бери только из профиля. Если цель не задана, не придумывай её (например, набор массы) и опирайся на общие принципы.
5. Не назначай разгрузку или снижение веса только потому, что несколько занятий подряд нет роста.
6. Вес в данных — суммарный внешний вес (две гантели по 20 кг = 40 кг). Старые записи могли содержать вес одной гантели.
7. Формат: по-русски, кратко. Сначала вывод, затем 2–5 пунктов с конкретными упражнениями и цифрами. До 120 слов, при просьбе о подробном разборе — до 250.
8. Темы: тренировки, техника, прогрессия, восстановление, питание в контексте тренировок. На другие темы вежливо откажись. При боли или травме посоветуй прекратить упражнение и обратиться к врачу.`;

const dayName = day => day === 'star' ? 'Дополнительная ★' : day;
const dateRu = date => new Date(date + 'T12:00:00').toLocaleDateString('ru-RU');
const kg = n => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const setList = sets => sets.map(s => `${kg(s.weight)}×${s.reps}`).join(', ');

function describeWorkout(workout) {
  const s = workoutSummary(workout);
  const lines = s.exercises.map(e => `- ${e.variant.name}${e.instead ? ` (вместо: ${e.instead})` : ''}: ${setList(e.sets)}; основной подход ${setList([representativeSet(e.sets)])}`);
  const skipped = workout.slots.filter(slot => slot.status === 'skipped').map(slot => slot.name);
  return `Тренировка ${dayName(workout.day)}, ${dateRu(workout.date)}: выполнено ${s.done} из ${s.total} упражнений, подходов ${s.setCount}, объём с отягощением ${kg(s.volume)} кг.`
    + (lines.length ? '\n' + lines.join('\n') : '\n- Подходы не записаны (старая отметка выполнения)')
    + (skipped.length ? `\n- Пропущено: ${skipped.join(', ')}` : '');
}

const programText = data => Object.entries(data.days).map(([day, slots]) => `${dayName(day)}: ` + (slots.map(e => {
  const alternatives = variantsOf(e).slice(1).map(v => v.name);
  return `${e.name} ${e.sets}×${e.range}${alternatives.length ? ` (альтернативы: ${alternatives.join(', ')})` : ''}`;
}).join('; ') || 'пусто')).join('\n');

function contextFacts(data, context) {
  if (context?.kind === 'workout') {
    const workout = findWorkout(data, context.id);
    if (!workout) return null;
    const previous = completedWorkouts(data).filter(w => w.day === workout.day && w.id !== workout.id && w.completedAt < (workout.completedAt || '9')).at(-1);
    return `Пользователь просит разобрать это занятие:\n${describeWorkout(workout)}\n\nПредыдущее завершённое занятие того же шаблона:\n${previous ? describeWorkout(previous) : 'нет данных'}`;
  }
  if (context?.kind === 'exercise') {
    const runs = performancesOf(data, context.weightId).slice(-6), name = findItem(data, context.weightId)?.name || 'упражнение';
    return `Пользователь спрашивает о прогрессе в упражнении «${name}». Последние завершённые выполнения (от старых к новым):\n`
      + (runs.map(r => `- ${dateRu(r.workout.date)}, тренировка ${dayName(r.workout.day)}: ${setList(r.sets)}; основной подход ${setList([representativeSet(r.sets)])}`).join('\n') || 'нет завершённых выполнений');
  }
  return null;
}

export function coachPrompt(data, now, context = null) {
  const profile = `Цель: ${data.profile.goal.trim() || 'не задана'}\nДополнительный контекст: ${data.profile.context.trim() || 'нет'}`;
  const facts = contextFacts(data, context)
    ?? `Программа (буквы не привязаны к дням недели, очередь A → B → C):\n${programText(data)}\n\nПоследние завершённые занятия (от старых к новым):\n${completedWorkouts(data).slice(-6).map(describeWorkout).join('\n\n') || 'пока нет'}`;
  return `${RULES}\n\nСправка по научным данным (применяй с учётом цели пользователя, не как жёсткие требования):\n${EVIDENCE}\n\nСегодня: ${now.toLocaleDateString('ru-RU')}\n\nПрофиль пользователя:\n${profile}\n\n${facts}`;
}
