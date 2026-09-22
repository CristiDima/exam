import { statusOf, type Progress } from './progress';
import type { Question } from './types';

export interface Summary {
  total: number;
  known: number;
  wrong: number;
  fresh: number;
  bookmarked: number;
  /** Across all attempts. */
  attempts: number;
  correctAttempts: number;
}

export function summarize(questions: readonly Question[], progress: Progress): Summary {
  const bookmarks = new Set(progress.bookmarks);
  const s: Summary = { total: questions.length, known: 0, wrong: 0, fresh: 0, bookmarked: 0, attempts: 0, correctAttempts: 0 };
  for (const q of questions) {
    const stat = progress.stats[q.hash];
    const status = statusOf(stat);
    if (status === 'known') s.known++;
    else if (status === 'wrong') s.wrong++;
    else s.fresh++;
    if (bookmarks.has(q.hash)) s.bookmarked++;
    if (stat) {
      s.attempts += stat.times_answered;
      s.correctAttempts += stat.times_answered - stat.times_wrong;
    }
  }
  return s;
}

export function mistakesOf(questions: readonly Question[], progress: Progress): Question[] {
  return questions.filter(q => statusOf(progress.stats[q.hash]) === 'wrong');
}

export function bookmarkedOf(questions: readonly Question[], progress: Progress): Question[] {
  const bookmarks = new Set(progress.bookmarks);
  return questions.filter(q => bookmarks.has(q.hash));
}
