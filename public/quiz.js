// Pure quiz logic: question validation and run selection. No DOM, no storage.

export const CHOICE_KEYS = ['A', 'B', 'C', 'D'];

// Minimum learning-mode weight, so questions never missed can still come up.
const MIN_WEIGHT = 0.05;

export function isValidQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.question !== 'string' || !q.question.trim()) return false;
  if (!('explanation' in q)) return false;
  if (!q.choices || typeof q.choices !== 'object') return false;
  if (Object.keys(q.choices).sort().join() !== CHOICE_KEYS.join()) return false;
  return CHOICE_KEYS.includes(q.answer);
}

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// Parses a question file into validated questions. Malformed entries are skipped,
// but keep their slot so question numbers match the position in the file.
export async function parseQuestions(raw) {
  if (!Array.isArray(raw)) throw new Error('Question file must be a JSON array.');
  const questions = [];
  for (const [i, q] of raw.entries()) {
    if (!isValidQuestion(q)) {
      console.warn(`Skipping malformed question #${i + 1}`, q);
      continue;
    }
    questions.push({
      index: i,
      number: i + 1,
      question: q.question,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation || '',
      hash: await sha256(q.question),
    });
  }
  return questions;
}

export function shuffle(items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Random mode. `from`/`to` are 1-based question numbers, inclusive; either may be null.
export function pickRandom(questions, { count, from = null, to = null, randomize = true }) {
  const total = questions.length;
  const rf = from ?? 1;
  const rt = to ?? total;
  if (rf < 1 || rt > total || rf > rt) {
    throw new Error(`Range must be between 1 and ${total}, with "from" not greater than "to".`);
  }
  const pool = questions.filter(q => q.number >= rf && q.number <= rt);
  const n = Math.min(count, pool.length);
  return randomize ? shuffle(pool).slice(0, n) : pool.slice(0, n);
}

// Learning mode: never-answered questions first, then weighted by error rate.
export function pickLearning(questions, count, stats) {
  const n = Math.min(count, questions.length);
  const unanswered = [];
  const answered = [];
  for (const q of questions) {
    const s = stats[q.hash];
    (s && s.times_answered > 0 ? answered : unanswered).push(q);
  }

  let selected = shuffle(unanswered).slice(0, n);
  const remaining = n - selected.length;
  if (remaining > 0) {
    const weights = answered.map(q => {
      const s = stats[q.hash];
      return Math.max(MIN_WEIGHT, s.times_wrong / s.times_answered);
    });
    selected = selected.concat(weightedSample(answered, weights, remaining));
  }
  return shuffle(selected);
}

// Weighted sampling without replacement, so a run never repeats a question.
export function weightedSample(items, weights, k) {
  const pool = items.slice();
  const w = weights.slice();
  const out = [];
  while (out.length < k && pool.length > 0) {
    const sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let i = 0;
    while (i < w.length - 1 && r >= w[i]) {
      r -= w[i];
      i++;
    }
    out.push(pool[i]);
    pool.splice(i, 1);
    w.splice(i, 1);
  }
  return out;
}
