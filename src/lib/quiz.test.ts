import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseQuestions, pickLearning, pickRandom } from './quiz';
import type { Question } from './types';

const banks = JSON.parse(readFileSync('public/data/banks.json', 'utf8')) as { id: string; file: string }[];
const load = (id: string, file: string) =>
  parseQuestions(id, JSON.parse(readFileSync(`public/data/${file}`, 'utf8')));

describe('question files', () => {
  it.each(banks)('$id: every question is valid', async ({ id, file }) => {
    const raw = JSON.parse(readFileSync(`public/data/${file}`, 'utf8')) as unknown[];
    const questions = await load(id, file);
    expect(questions).toHaveLength(raw.length);
  });

  it('hashes match the Python app (SHA-256 of the question text)', async () => {
    const [q] = await load('data-management', 'data-management.json');
    expect(q.hash).toBe(createHash('sha256').update(q.question, 'utf8').digest('hex'));
  });

  it('skips malformed entries but keeps numbering', async () => {
    const good = { question: 'Q', choices: { A: 'a', B: 'b', C: 'c', D: 'd' }, answer: 'B', explanation: '' };
    const qs = await parseQuestions('t', [good, { ...good, answer: 'E' }, { ...good, question: 'Q3' }]);
    expect(qs.map(q => q.number)).toEqual([1, 3]);
  });
});

describe('selection', async () => {
  const dm: Question[] = await load('data-management', 'data-management.json');
  const numbers = (qs: Question[]) => qs.map(q => q.number);

  it('classic: unique questions', () => {
    const r = pickRandom(dm, { count: 10 });
    expect(new Set(numbers(r)).size).toBe(10);
  });

  it('classic: range in file order', () => {
    expect(numbers(pickRandom(dm, { count: 5, from: 100, to: 120, randomize: false }))).toEqual([100, 101, 102, 103, 104]);
  });

  it('classic: clamps to the range size', () => {
    const r = pickRandom(dm, { count: 50, from: 100, to: 120 });
    expect(r).toHaveLength(21);
    expect(r.every(q => q.number >= 100 && q.number <= 120)).toBe(true);
  });

  it('classic: rejects bad ranges', () => {
    expect(() => pickRandom(dm, { count: 5, from: 50, to: 10 })).toThrow();
    expect(() => pickRandom(dm, { count: 5, from: 1, to: 9999 })).toThrow();
  });

  it('learning: unanswered first, no duplicates when topping up', () => {
    const stats = Object.fromEntries(dm.slice(10).map(q => [q.hash, { times_answered: 1, times_wrong: 0 }]));
    expect(pickLearning(dm, 10, stats).every(q => q.index < 10)).toBe(true);
    const r = pickLearning(dm, 30, stats);
    expect(new Set(numbers(r)).size).toBe(30);
  });

  it('learning: favours questions with a high error rate', () => {
    const stats = Object.fromEntries(dm.map(q => [q.hash, { times_answered: 4, times_wrong: 0 }]));
    stats[dm[0].hash] = { times_answered: 4, times_wrong: 4 };
    let hard = 0;
    let easy = 0;
    for (let i = 0; i < 3000; i++) {
      const r = pickLearning(dm, 5, stats);
      if (r.some(q => q.index === 0)) hard++;
      if (r.some(q => q.index === 1)) easy++;
    }
    // Weight 1.0 vs the 0.05 floor: about 20x more likely.
    expect(hard).toBeGreaterThan(8 * easy);
  });
});
