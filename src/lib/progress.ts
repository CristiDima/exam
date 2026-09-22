// Run history, per-question stats and bookmarks. Same localStorage key and JSON
// shape as the first static version, so existing progress and exports keep working.
import { createStore, useStore } from './storage';
import type { RunMode } from './types';

const KEY = 'epso-quiz:progress:v1';
const MODES: RunMode[] = ['random', 'learning', 'exam', 'mistakes', 'bookmarks', 'custom'];

export interface QuestionStat {
  times_answered: number;
  times_wrong: number;
  /** Result of the most recent answer; missing in history from older versions. */
  last_correct?: boolean;
}

export interface RunRecord {
  id: number;
  date: string;
  /** Set id, or "mixed" for sessions built from several sets. */
  bank: string;
  mode: RunMode;
  total: number;
  correct: number;
  time_seconds: number;
}

export interface Progress {
  version: 1;
  next_run_id: number;
  stats: Record<string, QuestionStat>;
  runs: RunRecord[];
  /** Question hashes. */
  bookmarks: string[];
}

export type QuestionStatus = 'new' | 'wrong' | 'known';

const toInt = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

/** Validates and cleans a progress object (from storage or an imported file). Throws if it isn't one. */
export function normalizeProgress(data: unknown): Progress {
  const d = data as Partial<Record<keyof Progress, unknown>> | null;
  if (!d || typeof d !== 'object' || !d.stats || typeof d.stats !== 'object' || !Array.isArray(d.runs)) {
    throw new Error('Not a progress file.');
  }

  const stats: Record<string, QuestionStat> = {};
  for (const [hash, s] of Object.entries(d.stats as Record<string, unknown>)) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const stat: QuestionStat = { times_answered: toInt(r.times_answered), times_wrong: toInt(r.times_wrong) };
    if (typeof r.last_correct === 'boolean') stat.last_correct = r.last_correct;
    stats[hash] = stat;
  }

  const runs: RunRecord[] = (d.runs as unknown[])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map(r => ({
      id: toInt(r.id),
      date: String(r.date ?? ''),
      bank: String(r.bank ?? ''),
      mode: MODES.includes(r.mode as RunMode) ? (r.mode as RunMode) : 'random',
      total: toInt(r.total),
      correct: toInt(r.correct),
      time_seconds: toInt(r.time_seconds),
    }));

  const bookmarks = Array.isArray(d.bookmarks)
    ? [...new Set(d.bookmarks.filter((b): b is string => typeof b === 'string'))]
    : [];

  const maxId = runs.reduce((m, r) => Math.max(m, r.id), 0);
  return { version: 1, next_run_id: Math.max(toInt(d.next_run_id), maxId + 1), stats, runs, bookmarks };
}

function emptyProgress(): Progress {
  return { version: 1, next_run_id: 1, stats: {}, runs: [], bookmarks: [] };
}

export const progressStore = createStore<Progress>(KEY, raw => {
  if (raw === null) return emptyProgress();
  try {
    return normalizeProgress(raw);
  } catch (e) {
    console.warn('Ignoring unreadable saved progress', e);
    return emptyProgress();
  }
});

export const useProgress = () => useStore(progressStore);

const update = (fn: (p: Progress) => Progress) => progressStore.set(fn(progressStore.get()));

export function statusOf(stat: QuestionStat | undefined): QuestionStatus {
  if (!stat || stat.times_answered === 0) return 'new';
  // Older history has no last_correct: treat any past mistake as still to review.
  const lastCorrect = stat.last_correct ?? stat.times_wrong === 0;
  return lastCorrect ? 'known' : 'wrong';
}

export function recordAnswers(results: { hash: string; correct: boolean }[]): void {
  if (results.length === 0) return;
  update(p => {
    const stats = { ...p.stats };
    for (const { hash, correct } of results) {
      const s = stats[hash] ?? { times_answered: 0, times_wrong: 0 };
      stats[hash] = {
        times_answered: s.times_answered + 1,
        times_wrong: s.times_wrong + (correct ? 0 : 1),
        last_correct: correct,
      };
    }
    return { ...p, stats };
  });
}

export function saveRun(run: Omit<RunRecord, 'id'>): RunRecord {
  const p = progressStore.get();
  const saved = { id: p.next_run_id, ...run };
  progressStore.set({ ...p, next_run_id: p.next_run_id + 1, runs: [...p.runs, saved] });
  return saved;
}

export function toggleBookmark(hash: string): void {
  update(p => ({
    ...p,
    bookmarks: p.bookmarks.includes(hash) ? p.bookmarks.filter(h => h !== hash) : [...p.bookmarks, hash],
  }));
}

/** Deletes run history and question stats. Bookmarks are kept. */
export function clearHistory(): void {
  update(p => ({ ...emptyProgress(), bookmarks: p.bookmarks }));
}

export function exportProgress(): string {
  return JSON.stringify(progressStore.get(), null, 2);
}

/** Replaces all progress with an exported file. Throws if the file is invalid. */
export function importProgress(text: string): Progress {
  const next = normalizeProgress(JSON.parse(text));
  progressStore.set(next);
  return next;
}
