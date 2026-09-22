import { createStore, useStore } from './storage';

export type Theme = 'system' | 'light' | 'dark';
/** instant: one tap answers. confirm: the classic flow, select then check. */
export type AnswerStyle = 'instant' | 'confirm';
/** Where exam questions come from: every set, or only the selected one. */
export type ExamScope = 'all' | 'set';

export interface Settings {
  theme: Theme;
  answerStyle: AnswerStyle;
  shuffleChoices: boolean;
  sessionSize: number;
  examSize: number;
  /** Exam time limit in minutes; null follows the question count (1 minute each). */
  examMinutes: number | null;
  examScope: ExamScope;
  /** Selected question set on the home page. */
  bank: string | null;
}

const DEFAULTS: Settings = {
  theme: 'system',
  answerStyle: 'instant',
  shuffleChoices: true,
  sessionSize: 20,
  examSize: 20,
  examMinutes: null,
  examScope: 'all',
  bank: null,
};

const positiveInt = (v: unknown): number | null => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);

// The first static version stored the selected set as a plain string under this key.
function readOldBank(): string | null {
  try {
    return localStorage.getItem('epso-quiz:bank');
  } catch {
    return null;
  }
}

export const settingsStore = createStore<Settings>('epso-quiz:settings', raw => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const oldBank = readOldBank();
  return {
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
    answerStyle: r.answerStyle === 'confirm' ? 'confirm' : 'instant',
    shuffleChoices: r.shuffleChoices !== false,
    sessionSize: positiveInt(r.sessionSize) ?? DEFAULTS.sessionSize,
    examSize: positiveInt(r.examSize) ?? DEFAULTS.examSize,
    examMinutes: positiveInt(r.examMinutes),
    examScope: r.examScope === 'set' ? 'set' : 'all',
    bank: typeof r.bank === 'string' ? r.bank : oldBank,
  };
});

export const useSettings = () => useStore(settingsStore);

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set({ ...settingsStore.get(), ...patch });
}

const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function applyTheme(): void {
  const { theme } = settingsStore.get();
  const dark = theme === 'dark' || (theme === 'system' && !!darkQuery?.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0a' : '#fafafa');
}

export function watchTheme(): void {
  applyTheme();
  settingsStore.subscribe(applyTheme);
  darkQuery?.addEventListener('change', applyTheme);
}
