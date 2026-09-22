export const CHOICE_KEYS = ['A', 'B', 'C', 'D'] as const;
export type ChoiceKey = (typeof CHOICE_KEYS)[number];

export interface Question {
  /** `${bank}:${index}`, unique across all sets. */
  id: string;
  bank: string;
  /** 0-based position in the set's file. */
  index: number;
  /** 1-based number shown to the user. */
  number: number;
  question: string;
  choices: Record<ChoiceKey, string>;
  answer: ChoiceKey;
  explanation: string;
  /** SHA-256 of the question text; progress is keyed by it so it survives reordering. */
  hash: string;
  /** Normalized question + choices + explanation, for search. */
  search: string;
}

export interface Bank {
  id: string;
  title: string;
  file: string;
  questions: Question[];
}

/** `random` is the classic mode; the stored name is kept for compatibility with old history. */
export type RunMode = 'random' | 'learning' | 'exam' | 'mistakes' | 'bookmarks' | 'custom';

export const MODE_LABELS: Record<RunMode, string> = {
  random: 'Classic',
  learning: 'Learning',
  exam: 'Exam',
  mistakes: 'Mistakes',
  bookmarks: 'Bookmarks',
  custom: 'Custom',
};
