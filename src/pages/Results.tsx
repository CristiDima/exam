import { Home, RotateCcw, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { QuestionCard } from '../components/QuestionCard';
import { useStarter } from '../components/useStarter';
import { Button, Card, Chip, buttonClass } from '../components/ui';
import { formatDate, formatTime, percent, plural } from '../lib/format';
import { useQuestions } from '../lib/questions';
import { isExam, useLastResult } from '../lib/session';
import { MODE_LABELS, type ChoiceKey, type Question } from '../lib/types';

type Filter = 'wrong' | 'correct' | 'all';

interface Reviewed {
  question: Question;
  selected: ChoiceKey | null;
  order: ChoiceKey[];
  correct: boolean;
}

export default function Results() {
  const result = useLastResult();
  const { byId, bankTitle } = useQuestions();
  const { start, modal } = useStarter();
  const [filter, setFilter] = useState<Filter>('wrong');

  const reviewed = useMemo<Reviewed[]>(() => {
    if (!result) return [];
    const s = result.session;
    return s.items.flatMap((item, i) => {
      const q = byId.get(item.id);
      // Practice sessions finished early only score the checked answers.
      if (!q || (!isExam(s) && !s.checked[i])) return [];
      return [{ question: q, selected: s.selected[i], order: item.order, correct: s.selected[i] === q.answer }];
    });
  }, [result, byId]);

  if (!result) return <Navigate to="/" replace />;

  const { session, correct, total } = result;
  const pct = percent(correct, total);
  const wrong = reviewed.filter(r => !r.correct);
  const shown = filter === 'all' ? reviewed : reviewed.filter(r => (filter === 'wrong' ? !r.correct : r.correct));
  const setName = session.bank === 'mixed' ? session.title : bankTitle(session.bank);
  const again = (questions: Question[], title = session.title) =>
    start({
      mode: session.mode === 'exam' ? 'exam' : 'custom',
      title,
      questions,
      timeLimit: session.mode === 'exam' ? session.timeLimit : null,
    });

  return (
    <div className="space-y-8">
      <Card className="flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
        <ScoreRing value={pct} />
        <div className="flex-1">
          <p className="text-sm font-medium text-muted">
            {MODE_LABELS[session.mode]} · {setName} · {formatDate(result.finishedAt)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {correct} / {total} correct
          </h1>
          <p className="mt-1 text-muted">
            {verdict(pct)} Time: {formatTime(session.elapsed)}
            {session.timeLimit ? ` of ${formatTime(session.timeLimit)}` : ''}.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            {wrong.length > 0 && (
              <Button onClick={() => again(wrong.map(r => r.question), `Retry mistakes · ${setName}`)}>
                <RotateCcw className="size-4" />
                Retry {plural(wrong.length, 'mistake')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => again(reviewed.map(r => r.question))}>
              <Repeat className="size-4" />
              Same questions again
            </Button>
            <Link to="/" className={buttonClass('ghost')}>
              <Home className="size-4" />
              Practice
            </Link>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Review</h2>
          <div className="flex gap-2">
            <Chip active={filter === 'wrong'} onClick={() => setFilter('wrong')}>Wrong ({wrong.length})</Chip>
            <Chip active={filter === 'correct'} onClick={() => setFilter('correct')}>Correct ({reviewed.length - wrong.length})</Chip>
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All ({reviewed.length})</Chip>
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            {filter === 'wrong' ? 'No mistakes. Well done!' : 'Nothing here.'}
          </p>
        ) : (
          <div className="space-y-3">
            {shown.map(r => (
              <QuestionCard
                key={r.question.id}
                question={r.question}
                selected={r.selected}
                order={r.order}
                meta={
                  <span className="font-medium">
                    #{r.question.number} · {bankTitle(r.question.bank)}
                    {r.selected === null && ' · not answered'}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </section>
      {modal}
    </div>
  );
}

function verdict(pct: number): string {
  if (pct >= 90) return 'Excellent!';
  if (pct >= 75) return 'Great job.';
  if (pct >= 50) return 'Good, keep going.';
  return 'Keep practicing.';
}

function ScoreRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = value >= 75 ? 'var(--ok)' : value >= 50 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        {value > 0 && <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
        />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold tabular-nums">
        {Math.round(value)}%
      </span>
    </div>
  );
}
