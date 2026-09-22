// Pure quiz logic: question validation and session selection. No DOM, no storage.
import { CHOICE_KEYS, type ChoiceKey, type Question } from './types';
import { normalize } from './search';

// Minimum learning-mode weight, so questions never missed can still come up.
const MIN_WEIGHT = 0.05;

interface RawQuestion {
  question: string;
  choices: Record<ChoiceKey, string>;
  answer: ChoiceKey;
  explanation?: unknown;
}

export function isValidQuestion(q: unknown): q is RawQuestion {
  if (!q || typeof q !== 'object') return false;
  const r = q as Record<string, unknown>;
  if (typeof r.question !== 'string' || !r.question.trim()) return false;
  if (!('explanation' in r)) return false;
  if (!r.choices || typeof r.choices !== 'object') return false;
  if (Object.keys(r.choices).sort().join() !== CHOICE_KEYS.join()) return false;
  return CHOICE_KEYS.includes(r.answer as ChoiceKey);
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// Parses a question file. Malformed entries are skipped but keep their slot,
// so question numbers always match the position in the file.
export async function parseQuestions(bank: string, raw: unknown): Promise<Question[]> {
  if (!Array.isArray(raw)) throw new Error('Question file must be a JSON array.');
  const questions: Question[] = [];
  for (const [i, q] of raw.entries()) {
    if (!isValidQuestion(q)) {
      console.warn(`[${bank}] skipping malformed question #${i + 1}`, q);
      continue;
    }
    const explanation = typeof q.explanation === 'string' ? q.explanation : '';
    const choices = { A: String(q.choices.A), B: String(q.choices.B), C: String(q.choices.C), D: String(q.choices.D) };
    questions.push({
      id: `${bank}:${i}`,
      bank,
      index: i,
      number: i + 1,
      question: q.question,
      choices,
      answer: q.answer,
      explanation,
      hash: await sha256(q.question),
      search: normalize([q.question, ...Object.values(choices), explanation].join('\n')),
    });
  }
  return questions;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Numbered {
  number: number;
  hash: string;
}

export interface RandomOptions {
  count: number;
  /** 1-based question numbers, inclusive. */
  from?: number | null;
  to?: number | null;
  randomize?: boolean;
}

/** Classic mode: N questions from an optional range, shuffled or in file order. */
export function pickRandom<T extends Numbered>(questions: readonly T[], opts: RandomOptions): T[] {
  const { count, from = null, to = null, randomize = true } = opts;
  const last = questions.length ? questions[questions.length - 1].number : 0;
  const rf = from ?? 1;
  const rt = to ?? last;
  if (rf < 1 || rt > last || rf > rt) {
    throw new Error(`Range must be between 1 and ${last}, with "from" not greater than "to".`);
  }
  const pool = questions.filter(q => q.number >= rf && q.number <= rt);
  const n = Math.min(count, pool.length);
  return randomize ? shuffle(pool).slice(0, n) : pool.slice(0, n);
}

export interface StatLike {
  times_answered: number;
  times_wrong: number;
}

/** Learning mode: never-answered questions first, then weighted by error rate. */
export function pickLearning<T extends Numbered>(
  questions: readonly T[],
  count: number,
  stats: Readonly<Record<string, StatLike>>,
): T[] {
  const n = Math.min(count, questions.length);
  const unanswered: T[] = [];
  const answered: T[] = [];
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

/** Weighted sampling without replacement, so a session never repeats a question. */
export function weightedSample<T>(items: readonly T[], weights: readonly number[], k: number): T[] {
  const pool = items.slice();
  const w = weights.slice();
  const out: T[] = [];
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
