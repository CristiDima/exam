import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { parseQuestions } from './quiz';
import type { Bank, Question } from './types';

interface BankEntry {
  id: string;
  title: string;
  file: string;
}

export interface QuestionsState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  banks: Bank[];
  byId: Map<string, Question>;
  bankTitle: (id: string) => string;
}

const empty: QuestionsState = {
  status: 'loading',
  banks: [],
  byId: new Map(),
  bankTitle: id => id,
};

const QuestionsContext = createContext<QuestionsState>(empty);

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function loadBanks(): Promise<Bank[]> {
  const entries = (await fetchJson(dataUrl('banks.json'))) as BankEntry[];
  return Promise.all(
    entries.map(async e => ({ ...e, questions: await parseQuestions(e.id, await fetchJson(dataUrl(e.file))) })),
  );
}

export function QuestionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuestionsState>(empty);

  useEffect(() => {
    if (!window.crypto?.subtle) {
      setState({ ...empty, status: 'error', error: 'Open this site over https:// (or localhost) to use it.' });
      return;
    }
    loadBanks()
      .then(banks => {
        const byId = new Map(banks.flatMap(b => b.questions.map(q => [q.id, q] as const)));
        const titles = new Map(banks.map(b => [b.id, b.title]));
        setState({
          status: 'ready',
          banks,
          byId,
          bankTitle: id => (id === 'mixed' ? 'Mixed sets' : titles.get(id) ?? id),
        });
      })
      .catch(e => {
        console.error(e);
        setState({ ...empty, status: 'error', error: 'Could not load the question sets. Check your connection and reload.' });
      });
  }, []);

  return <QuestionsContext.Provider value={state}>{children}</QuestionsContext.Provider>;
}

export const useQuestions = () => useContext(QuestionsContext);
