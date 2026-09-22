import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearHistory,
  importProgress,
  normalizeProgress,
  progressStore,
  recordAnswers,
  statusOf,
  toggleBookmark,
} from './progress';
import { finishSession, sessionStore, startSession, selectChoice, checkAnswer } from './session';
import type { Question } from './types';

// An export from the first static version (no bookmarks, no last_correct).
const OLD_EXPORT = {
  version: 1,
  next_run_id: 12,
  stats: { abc: { times_answered: 2, times_wrong: 1 }, def: { times_answered: 3, times_wrong: 0 } },
  runs: [{ id: 7, date: '2026-04-11T10:01:20', bank: 'data-management', mode: 'random', total: 20, correct: 19, time_seconds: 367 }],
};

const q = (i: number, answer: 'A' | 'B' = 'A'): Question => ({
  id: `t:${i}`,
  bank: 't',
  index: i,
  number: i + 1,
  question: `Question ${i}`,
  choices: { A: 'a', B: 'b', C: 'c', D: 'd' },
  answer,
  explanation: '',
  hash: `h${i}`,
  search: '',
});

beforeEach(() => {
  progressStore.set(normalizeProgress({ stats: {}, runs: [] }));
  sessionStore.set(null);
});

describe('progress', () => {
  it('imports exports from the first version', () => {
    const p = importProgress(JSON.stringify(OLD_EXPORT));
    expect(p.runs).toHaveLength(1);
    expect(p.bookmarks).toEqual([]);
    expect(p.next_run_id).toBe(12);
    // Without last_correct, a past mistake still counts as "to review".
    expect(statusOf(p.stats.abc)).toBe('wrong');
    expect(statusOf(p.stats.def)).toBe('known');
    expect(statusOf(undefined)).toBe('new');
  });

  it('rejects files that are not progress exports', () => {
    expect(() => importProgress('{"nope":1}')).toThrow();
    expect(() => importProgress('not json')).toThrow();
  });

  it('a correct answer clears a mistake', () => {
    recordAnswers([{ hash: 'x', correct: false }]);
    expect(statusOf(progressStore.get().stats.x)).toBe('wrong');
    recordAnswers([{ hash: 'x', correct: true }]);
    expect(progressStore.get().stats.x).toEqual({ times_answered: 2, times_wrong: 1, last_correct: true });
    expect(statusOf(progressStore.get().stats.x)).toBe('known');
  });

  it('clearing history keeps bookmarks', () => {
    toggleBookmark('x');
    recordAnswers([{ hash: 'x', correct: true }]);
    clearHistory();
    expect(progressStore.get().stats).toEqual({});
    expect(progressStore.get().bookmarks).toEqual(['x']);
    toggleBookmark('x');
    expect(progressStore.get().bookmarks).toEqual([]);
  });
});

describe('sessions', () => {
  const questions = [q(0), q(1, 'B'), q(2)];
  const resolve = (id: string) => questions.find(x => x.id === id);

  it('practice: records answers when checked and scores only checked ones', () => {
    startSession({ mode: 'random', title: 'T', questions, shuffleChoices: false });
    selectChoice(0, 'A');
    checkAnswer(0, questions[0]);
    selectChoice(1, 'A');
    checkAnswer(1, questions[1]);
    expect(progressStore.get().stats.h0.last_correct).toBe(true);
    expect(progressStore.get().stats.h1.last_correct).toBe(false);

    const result = finishSession(resolve)!;
    expect(result).toMatchObject({ correct: 1, total: 2 });
    expect(progressStore.get().runs.at(-1)).toMatchObject({ mode: 'random', bank: 't', correct: 1, total: 2 });
    expect(sessionStore.get()).toBeNull();
  });

  it('exam: nothing is recorded until the end, unanswered count as wrong', () => {
    startSession({ mode: 'exam', title: 'T', questions, shuffleChoices: true, timeLimit: 60 });
    selectChoice(0, 'A');
    selectChoice(1, 'B');
    checkAnswer(0, questions[0]); // no-op in exams
    expect(progressStore.get().stats).toEqual({});

    const result = finishSession(resolve)!;
    expect(result).toMatchObject({ correct: 2, total: 3 });
    expect(Object.keys(progressStore.get().stats).sort()).toEqual(['h0', 'h1']);
  });

  it('a session with nothing answered is not saved', () => {
    startSession({ mode: 'learning', title: 'T', questions, shuffleChoices: true });
    expect(finishSession(resolve)).toBeNull();
    expect(progressStore.get().runs).toHaveLength(0);
  });
});
