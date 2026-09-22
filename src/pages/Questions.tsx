import { Play, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { QuestionCard } from '../components/QuestionCard';
import { useStarter } from '../components/useStarter';
import { Button, Chip, PageHeader } from '../components/ui';
import { plural } from '../lib/format';
import { statusOf, useProgress, type QuestionStatus } from '../lib/progress';
import { shuffle } from '../lib/quiz';
import { useQuestions } from '../lib/questions';
import { matchesAll, searchTerms } from '../lib/search';

type StatusFilter = 'all' | QuestionStatus | 'bookmarked';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'wrong', label: 'To review' },
  { id: 'known', label: 'Known' },
  { id: 'bookmarked', label: 'Bookmarked' },
];

const PAGE = 30;
const MAX_PRACTICE = 50;

export default function Questions() {
  const { banks, bankTitle } = useQuestions();
  const progress = useProgress();
  const { start, modal } = useStarter();
  const [params, setParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const query = params.get('q') ?? '';
  const set = params.get('set') ?? 'all';
  const status = (params.get('status') ?? 'all') as StatusFilter;
  const hideAnswers = params.get('hide') === '1';

  const setParam = (key: string, value: string | null) =>
    setParams(
      p => {
        const next = new URLSearchParams(p);
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(() => searchTerms(deferredQuery), [deferredQuery]);

  const results = useMemo(() => {
    const bookmarks = new Set(progress.bookmarks);
    return banks
      .filter(b => set === 'all' || b.id === set)
      .flatMap(b => b.questions)
      .filter(q => {
        if (status === 'bookmarked' && !bookmarks.has(q.hash)) return false;
        if (status !== 'all' && status !== 'bookmarked' && statusOf(progress.stats[q.hash]) !== status) return false;
        return matchesAll(q.search, terms);
      });
  }, [banks, set, status, terms, progress]);

  // Render in pages as the user scrolls.
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    setLimit(PAGE);
  }, [terms, set, status]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setLimit(l => l + PAGE);
    }, { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
    // Recreated after each page so it fires again if the sentinel is still in view.
  }, [limit, results.length]);

  // "/" focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const total = banks.reduce((n, b) => n + b.questions.length, 0);
  const practiceCount = Math.min(results.length, MAX_PRACTICE);

  return (
    <div>
      <PageHeader title="Questions" subtitle={`All ${plural(total, 'question')} with answers and explanations.`} />

      <div className="sticky top-14 z-20 -mx-4 space-y-3 border-b border-line bg-bg/90 px-4 pt-1 pb-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setParam('q', e.target.value)}
            placeholder="Search questions, answers and explanations…"
            aria-label="Search questions"
            className="h-12 w-full rounded-2xl border border-line bg-surface pr-11 pl-11 text-[15px] shadow-sm placeholder:text-muted/80 focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setParam('q', null);
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={set === 'all'} onClick={() => setParam('set', null)}>All sets</Chip>
          {banks.map(b => (
            <Chip key={b.id} active={set === b.id} onClick={() => setParam('set', b.id)} className="shrink-0">
              {b.title}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
          {STATUS_FILTERS.map(f => (
            <Chip key={f.id} active={status === f.id} onClick={() => setParam('status', f.id)} className="shrink-0">
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {plural(results.length, 'result')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideAnswers}
              onChange={e => setParam('hide', e.target.checked ? '1' : null)}
              className="size-4 accent-[var(--accent)]"
            />
            Hide answers (flashcards)
          </label>
          <Button
            size="sm"
            disabled={results.length === 0}
            onClick={() =>
              start({
                mode: 'custom',
                title: query ? `Search: “${query}”` : 'Question list',
                questions: shuffle(results).slice(0, MAX_PRACTICE),
              })
            }
          >
            <Play className="size-3.5" />
            Practice {results.length > MAX_PRACTICE ? `${practiceCount} of these` : 'these'}
          </Button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No questions match</p>
          <p className="mt-1 text-sm text-muted">Try fewer words or another filter.</p>
        </div>
      ) : (
        <div className="space-y-3" key={hideAnswers ? 'hidden' : 'shown'}>
          {results.slice(0, limit).map(q => (
            <QuestionCard
              key={q.id}
              question={q}
              terms={terms}
              hideAnswer={hideAnswers}
              meta={
                <span className="font-medium">
                  #{q.number} · {bankTitle(q.bank)}
                </span>
              }
            />
          ))}
          {results.length > limit && <div ref={sentinel} className="h-10" />}
        </div>
      )}
      {modal}
    </div>
  );
}
