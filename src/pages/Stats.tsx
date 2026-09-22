import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QuestionCard } from '../components/QuestionCard';
import { TrendChart } from '../components/TrendChart';
import { Badge, Button, Card, Chip, PageHeader, cx } from '../components/ui';
import { formatDate, formatTime, percent, plural } from '../lib/format';
import { useProgress } from '../lib/progress';
import { useQuestions } from '../lib/questions';
import { summarize } from '../lib/summary';
import { MODE_LABELS, type Question } from '../lib/types';
import { ProgressBar, ProgressLegend } from './Home';

const PER_PAGE = 20;
const TREND_RUNS = 30;

function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Stats() {
  const { banks, bankTitle } = useQuestions();
  const progress = useProgress();
  const [set, setSet] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const scopedBanks = set === 'all' ? banks : banks.filter(b => b.id === set);
  const questions = useMemo(() => scopedBanks.flatMap(b => b.questions), [scopedBanks]);
  const summary = useMemo(() => summarize(questions, progress), [questions, progress]);
  const runs = useMemo(
    () => progress.runs.filter(r => set === 'all' || r.bank === set).sort((a, b) => a.id - b.id),
    [progress.runs, set],
  );

  const mostMissed = useMemo(() => {
    const seen = new Set<string>();
    return questions
      .filter(q => {
        const s = progress.stats[q.hash];
        if (!s || s.times_wrong === 0 || seen.has(q.hash)) return false;
        seen.add(q.hash);
        return true;
      })
      .sort((a, b) => {
        const sa = progress.stats[a.hash];
        const sb = progress.stats[b.hash];
        return sb.times_wrong / sb.times_answered - sa.times_wrong / sa.times_answered || sb.times_wrong - sa.times_wrong;
      })
      .slice(0, 10);
  }, [questions, progress.stats]);

  const seen = summary.known + summary.wrong;
  const totalTime = runs.reduce((t, r) => t + r.time_seconds, 0);
  const avgScore = runs.length ? runs.reduce((t, r) => t + percent(r.correct, r.total), 0) / runs.length : 0;
  const trend = runs.slice(-TREND_RUNS).map(r => ({
    key: r.id,
    date: r.date,
    value: percent(r.correct, r.total),
    detail: `${r.correct}/${r.total} · ${MODE_LABELS[r.mode]} · ${bankTitle(r.bank)}`,
  }));

  const history = runs.slice().reverse();
  const pages = Math.max(1, Math.ceil(history.length / PER_PAGE));
  const current = Math.min(page, pages);
  const pageRuns = history.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader title="Statistics" subtitle="Saved in this browser. Export it from Settings to keep a backup." />

      <div className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={set === 'all'} onClick={() => { setSet('all'); setPage(1); }}>All sets</Chip>
        {banks.map(b => (
          <Chip key={b.id} active={set === b.id} onClick={() => { setSet(b.id); setPage(1); }} className="shrink-0">
            {b.title}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Questions seen" value={seen.toLocaleString()} note={`of ${summary.total.toLocaleString()}`} />
        <StatTile
          label="Accuracy"
          value={summary.attempts ? `${Math.round(percent(summary.correctAttempts, summary.attempts))}%` : '–'}
          note={plural(summary.attempts, 'answer')}
        />
        <StatTile label="Quizzes finished" value={runs.length.toLocaleString()} note={runs.length ? `average ${Math.round(avgScore)}%` : 'none yet'} />
        <StatTile label="Time practiced" value={duration(totalTime)} note="in finished quizzes" />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <h2 className="font-semibold">Score per quiz</h2>
          <p className="mb-4 text-sm text-muted">
            {runs.length > TREND_RUNS ? `Last ${TREND_RUNS} quizzes` : 'All finished quizzes'}
          </p>
          {trend.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">Finish a quiz to see your scores here.</p>
          ) : (
            <TrendChart points={trend} label="Score per quiz" />
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Progress by set</h2>
          <div className="space-y-5">
            {scopedBanks.map(b => {
              const s = summarize(b.questions, progress);
              return (
                <div key={b.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{b.title}</span>
                    <span className="text-xs text-muted">
                      {Math.round(percent(s.known, s.total))}% known
                    </span>
                  </div>
                  <ProgressBar known={s.known} wrong={s.wrong} fresh={s.fresh} />
                  <ProgressLegend known={s.known} wrong={s.wrong} fresh={s.fresh} className="mt-2" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Most missed questions</h2>
        <p className="mb-3 text-sm text-muted">Highest error rate first. Open one to see the answer.</p>
        {mostMissed.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No mistakes yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {mostMissed.map(q => (
              <MissedRow
                key={q.id}
                question={q}
                wrong={progress.stats[q.hash].times_wrong}
                answered={progress.stats[q.hash].times_answered}
                setName={bankTitle(q.bank)}
                open={open === q.id}
                onToggle={() => setOpen(o => (o === q.id ? null : q.id))}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="font-semibold">History</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-5 pb-8 text-center text-sm text-muted">No quizzes yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="border-y border-line bg-surface-2 text-xs text-muted">
                  <tr>
                    {['#', 'Date', 'Set', 'Mode', 'Score', '%', 'Time'].map(h => (
                      <th key={h} scope="col" className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pageRuns.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 text-muted">{r.id}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{bankTitle(r.bank)}</td>
                      <td className="px-4 py-2.5">{MODE_LABELS[r.mode]}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{r.correct} / {r.total}</td>
                      <td className="px-4 py-2.5 font-semibold">{Math.round(percent(r.correct, r.total))}%</td>
                      <td className="px-4 py-2.5">{formatTime(r.time_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
                <Button variant="secondary" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
                <span className="text-muted">Page {current} of {pages}</span>
                <Button variant="secondary" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </Card>
  );
}

function MissedRow({
  question: q,
  wrong,
  answered,
  setName,
  open,
  onToggle,
}: {
  question: Question;
  wrong: number;
  answered: number;
  setName: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2 cursor-pointer"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">#{q.number} · {setName}</span>
          <span className={cx('block text-sm leading-relaxed', !open && 'line-clamp-2')}>{q.question}</span>
        </span>
        <Badge tone="bad" className="shrink-0">wrong {wrong}/{answered}</Badge>
        <ChevronDown className={cx('mt-0.5 size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2">
          <QuestionCard question={q} meta={<span className="font-medium">#{q.number} · {setName}</span>} />
        </div>
      )}
    </li>
  );
}
