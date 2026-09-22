// The quiz in progress (saved on every change, so a refresh or closed tab can resume)
// and the result of the last finished quiz.
import { localTimestamp } from './format';
import { recordAnswers, saveRun } from './progress';
import { shuffle } from './quiz';
import { createStore, useStore } from './storage';
import { CHOICE_KEYS, type ChoiceKey, type Question, type RunMode } from './types';

export interface SessionItem {
  id: string;
  hash: string;
  /** Display order of the choices, fixed for the whole session. */
  order: ChoiceKey[];
}

export interface Session {
  key: string;
  mode: RunMode;
  /** Set id, or "mixed". */
  bank: string;
  title: string;
  items: SessionItem[];
  selected: (ChoiceKey | null)[];
  /** Practice modes: the answer was checked and recorded. Unused in exams. */
  checked: boolean[];
  current: number;
  elapsed: number;
  /** Exam time limit in seconds; null for practice. */
  timeLimit: number | null;
  startedAt: string;
}

export interface SessionResult {
  session: Session;
  runId: number;
  correct: number;
  total: number;
  finishedAt: string;
}

function isSession(v: unknown): v is Session {
  const s = v as Session | null;
  return !!s && typeof s === 'object' && Array.isArray(s.items) && s.items.length > 0
    && Array.isArray(s.selected) && Array.isArray(s.checked) && s.selected.length === s.items.length
    && Number.isInteger(s.current) && typeof s.mode === 'string';
}

export const sessionStore = createStore<Session | null>('epso-quiz:session', raw => (isSession(raw) ? raw : null));
export const resultStore = createStore<SessionResult | null>('epso-quiz:last-result', raw => {
  const r = raw as SessionResult | null;
  return r && typeof r === 'object' && isSession(r.session) ? r : null;
});

export const useSession = () => useStore(sessionStore);
export const useLastResult = () => useStore(resultStore);

export const isExam = (s: Session) => s.mode === 'exam';

export interface StartOptions {
  mode: RunMode;
  title: string;
  questions: Question[];
  shuffleChoices: boolean;
  timeLimit?: number | null;
}

export function startSession({ mode, title, questions, shuffleChoices, timeLimit = null }: StartOptions): Session {
  const banks = new Set(questions.map(q => q.bank));
  const session: Session = {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    bank: banks.size === 1 ? [...banks][0] : 'mixed',
    title,
    items: questions.map(q => ({
      id: q.id,
      hash: q.hash,
      order: shuffleChoices ? shuffle(CHOICE_KEYS) : [...CHOICE_KEYS],
    })),
    selected: questions.map(() => null),
    checked: questions.map(() => false),
    current: 0,
    elapsed: 0,
    timeLimit,
    startedAt: localTimestamp(),
  };
  sessionStore.set(session);
  return session;
}

function patch(fn: (s: Session) => Partial<Session>): void {
  const s = sessionStore.get();
  if (s) sessionStore.set({ ...s, ...fn(s) });
}

export function selectChoice(i: number, key: ChoiceKey): void {
  patch(s => {
    if (s.checked[i]) return {};
    const selected = s.selected.slice();
    selected[i] = key;
    return { selected };
  });
}

/** Practice modes: locks the selected answer and records it in the stats. */
export function checkAnswer(i: number, question: Question): void {
  const s = sessionStore.get();
  const key = s?.selected[i];
  if (!s || !key || s.checked[i] || isExam(s)) return;
  const checked = s.checked.slice();
  checked[i] = true;
  sessionStore.set({ ...s, checked });
  recordAnswers([{ hash: question.hash, correct: key === question.answer }]);
}

export function goTo(i: number): void {
  patch(s => ({ current: Math.min(Math.max(0, i), s.items.length - 1) }));
}

export function tick(): void {
  patch(s => ({ elapsed: s.elapsed + 1 }));
}

export function discardSession(): void {
  sessionStore.set(null);
}

/**
 * Ends the session, saves it to the history and stores the result.
 * Practice sessions count only checked answers; exams count every question
 * (unanswered ones score as wrong but aren't added to the stats).
 * Returns null when nothing was answered, in which case nothing is saved.
 */
export function finishSession(resolve: (id: string) => Question | undefined): SessionResult | null {
  const s = sessionStore.get();
  if (!s) return null;
  const exam = isExam(s);

  let correct = 0;
  let total = 0;
  const examAnswers: { hash: string; correct: boolean }[] = [];
  s.items.forEach((item, i) => {
    const q = resolve(item.id);
    const selected = s.selected[i];
    if (!q) return;
    if (exam) {
      total++;
      if (selected === q.answer) correct++;
      if (selected) examAnswers.push({ hash: q.hash, correct: selected === q.answer });
    } else if (s.checked[i]) {
      total++;
      if (selected === q.answer) correct++;
    }
  });

  sessionStore.set(null);
  if (total === 0 || (exam && examAnswers.length === 0)) return null;

  recordAnswers(examAnswers);
  const run = saveRun({
    date: localTimestamp(),
    bank: s.bank,
    mode: s.mode,
    total,
    correct,
    time_seconds: s.elapsed,
  });
  const result: SessionResult = { session: s, runId: run.id, correct, total, finishedAt: run.date };
  resultStore.set(result);
  return result;
}
