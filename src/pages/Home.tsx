import {
  Bookmark,
  Brain,
  ChevronDown,
  Library,
  Play,
  RotateCcw,
  Shuffle,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Badge, Button, Card, Chip, LegendItem, NumberInput, SegmentBar, Stepper, buttonClass, cx } from '../components/ui';
import { useToast } from '../components/toast';
import { useStarter } from '../components/useStarter';
import { formatTime, plural } from '../lib/format';
import { useProgress } from '../lib/progress';
import { pickLearning, pickRandom, shuffle } from '../lib/quiz';
import { useQuestions } from '../lib/questions';
import { discardSession, isExam, useSession } from '../lib/session';
import { updateSettings, useSettings } from '../lib/settings';
import { bookmarkedOf, mistakesOf, summarize } from '../lib/summary';
import { MODE_LABELS } from '../lib/types';

const PRESETS = [10, 20, 30, 50];

export default function Home() {
  const { banks, bankTitle } = useQuestions();
  const progress = useProgress();
  const settings = useSettings();
  const toast = useToast();
  const { start, modal } = useStarter();

  const bank = banks.find(b => b.id === settings.bank) ?? banks[0];

  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [randomize, setRandomize] = useState(true);
  const [showOptions, setShowOptions] = useState(false);

  const summaries = useMemo(() => new Map(banks.map(b => [b.id, summarize(b.questions, progress)])), [banks, progress]);
  const mistakes = useMemo(() => (bank ? mistakesOf(bank.questions, progress) : []), [bank, progress]);
  const bookmarked = useMemo(() => (bank ? bookmarkedOf(bank.questions, progress) : []), [bank, progress]);
  // Every question from every set, once (a few appear in two sets).
  const allQuestions = useMemo(() => {
    const seen = new Set<string>();
    return banks.flatMap(b => b.questions).filter(q => !seen.has(q.hash) && !!seen.add(q.hash));
  }, [banks]);

  if (!bank) return <p className="text-muted">No question sets found.</p>;
  const title = bank.title;
  // The saved size is shared by all sets; a smaller set simply uses all its questions.
  const count = Math.min(settings.sessionSize, bank.questions.length);

  const examPool = settings.examScope === 'all' ? allQuestions : bank.questions;
  const examCount = Math.min(settings.examSize, examPool.length);
  const examMinutes = settings.examMinutes ?? examCount;

  const startClassic = () => {
    try {
      start({ mode: 'random', title, questions: pickRandom(bank.questions, { count, from, to, randomize }) });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <ContinueBanner bankTitle={bankTitle} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Question set</h2>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 no-scrollbar overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
          {banks.map(b => {
            const s = summaries.get(b.id)!;
            const active = b.id === bank.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => updateSettings({ bank: b.id })}
                className={cx(
                  'w-[78%] shrink-0 snap-start rounded-2xl border bg-surface p-4 text-left transition-colors cursor-pointer sm:w-auto',
                  active ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-snug">{b.title}</span>
                  {active && <Badge tone="accent">Selected</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">{plural(s.total, 'question')}</p>
                <ProgressBar known={s.known} wrong={s.wrong} fresh={s.fresh} className="mt-3" />
                <ProgressLegend known={s.known} wrong={s.wrong} fresh={s.fresh} className="mt-2" />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Practice {title}</h2>
        <SessionSizePicker value={count} max={bank.questions.length} onChange={n => updateSettings({ sessionSize: n })} />

        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            icon={Shuffle}
            title="Classic"
            text="Random questions from the set, with instant feedback. Optionally limit to a range or keep file order."
            action={<Button onClick={startClassic}><Play className="size-4" />Start {count} questions</Button>}
          >
            <button
              type="button"
              onClick={() => setShowOptions(o => !o)}
              className="flex items-center gap-1 text-sm font-medium text-accent cursor-pointer"
              aria-expanded={showOptions}
            >
              Options
              <ChevronDown className={cx('size-4 transition-transform', showOptions && 'rotate-180')} />
            </button>
            {showOptions && (
              <div className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted">Questions</span>
                  <NumberInput label="From question" value={from} onChange={setFrom} placeholder="1" max={bank.questions.length} className="bg-surface" />
                  <span className="text-muted">to</span>
                  <NumberInput label="To question" value={to} onChange={setTo} placeholder={String(bank.questions.length)} max={bank.questions.length} className="bg-surface" />
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                  Randomize order
                </label>
              </div>
            )}
          </ModeCard>

          <ModeCard
            icon={Brain}
            title="Learning"
            text="Questions you haven't seen come first, then the ones you miss most often."
            action={
              <Button onClick={() => start({ mode: 'learning', title, questions: pickLearning(bank.questions, count, progress.stats) })}>
                <Play className="size-4" />Start {count} questions
              </Button>
            }
          />

          <ModeCard
            icon={Timer}
            title="Exam simulation"
            text="Timed, and no answers until you submit, like the real test. You can move between questions and change answers."
            action={
              <Button
                onClick={() =>
                  start({
                    mode: 'exam',
                    title: settings.examScope === 'all' ? 'All sets' : title,
                    questions: shuffle(examPool).slice(0, examCount),
                    timeLimit: examMinutes * 60,
                  })
                }
              >
                <Play className="size-4" />Start {examCount}-question exam
              </Button>
            }
          >
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">Questions from</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={settings.examScope === 'all'} onClick={() => updateSettings({ examScope: 'all' })}>
                    All sets
                  </Chip>
                  <Chip active={settings.examScope === 'set'} onClick={() => updateSettings({ examScope: 'set' })}>
                    {title}
                  </Chip>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">Questions</span>
                <Stepper
                  label="exam questions"
                  value={examCount}
                  max={examPool.length}
                  onChange={n => updateSettings({ examSize: n })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">Time limit (minutes)</span>
                <Stepper
                  label="exam time limit in minutes"
                  value={examMinutes}
                  max={2000}
                  onChange={m => updateSettings({ examMinutes: m })}
                />
              </div>
              <p className="text-xs text-muted">
                {perQuestion(examMinutes, examCount)} per question
                {settings.examMinutes === null ? ' (follows the number of questions).' : '. '}
                {settings.examMinutes !== null && (
                  <button
                    type="button"
                    onClick={() => updateSettings({ examMinutes: null })}
                    className="font-medium text-fg underline underline-offset-2 cursor-pointer"
                  >
                    Reset to 1 min per question
                  </button>
                )}
              </p>
            </div>
          </ModeCard>

          <ModeCard
            icon={RotateCcw}
            title="My mistakes"
            text={
              mistakes.length
                ? `${plural(mistakes.length, 'question')} you got wrong the last time you answered. Answer correctly to clear them.`
                : 'Questions you get wrong show up here until you answer them correctly.'
            }
            action={
              <Button
                disabled={mistakes.length === 0}
                onClick={() => start({ mode: 'mistakes', title, questions: shuffle(mistakes).slice(0, count) })}
              >
                <Play className="size-4" />Practice {mistakes.length ? Math.min(count, mistakes.length) : ''}
              </Button>
            }
          />

          <ModeCard
            icon={Bookmark}
            title="Bookmarks"
            text={
              bookmarked.length
                ? `${plural(bookmarked.length, 'bookmarked question')}.`
                : 'Bookmark questions during a quiz or in the question list to practice them here.'
            }
            action={
              <Button
                disabled={bookmarked.length === 0}
                onClick={() => start({ mode: 'bookmarks', title, questions: shuffle(bookmarked).slice(0, count) })}
              >
                <Play className="size-4" />Practice {bookmarked.length ? Math.min(count, bookmarked.length) : ''}
              </Button>
            }
          />

          <ModeCard
            icon={Library}
            title="Browse all questions"
            text={`Search ${plural(banks.reduce((n, b) => n + b.questions.length, 0), 'question')} with their answers and explanations.`}
            action={
              <Link to={`/questions?set=${bank.id}`} className={buttonClass('secondary')}>
                Open list
              </Link>
            }
          />
        </div>
      </section>
      {modal}
    </div>
  );
}

/** How many questions a practice session has: a stepper plus quick presets. */
function SessionSizePicker({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(Math.max(1, n), max));
  return (
    <Card className="mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Questions per session</p>
        <p className="text-sm text-muted">For Classic, Learning, My mistakes and Bookmarks. The exam has its own setting below.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Stepper label="questions per session" value={value} max={max} onChange={set} />
        {PRESETS.filter(n => n < max).map(n => (
          <Chip key={n} active={value === n} onClick={() => set(n)}>
            {n}
          </Chip>
        ))}
        <Chip active={value === max} onClick={() => set(max)}>
          All
        </Chip>
      </div>
    </Card>
  );
}

function perQuestion(minutes: number, questions: number): string {
  const seconds = (minutes * 60) / Math.max(1, questions);
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

export function ProgressBar({ known, wrong, fresh, className }: { known: number; wrong: number; fresh: number; className?: string }) {
  return (
    <SegmentBar
      className={className}
      segments={[
        { label: 'Known', value: known, className: 'bg-known' },
        { label: 'To review', value: wrong, className: 'bg-review' },
        { label: 'New', value: fresh, className: 'bg-line' },
      ]}
    />
  );
}

export function ProgressLegend({ known, wrong, fresh, className }: { known: number; wrong: number; fresh: number; className?: string }) {
  return (
    <p className={cx('flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted', className)}>
      <LegendItem swatch="bg-known">{known} known</LegendItem>
      <LegendItem swatch="bg-review">{wrong} to review</LegendItem>
      <LegendItem swatch="bg-line">{fresh} new</LegendItem>
    </p>
  );
}

function ModeCard({
  icon: Icon,
  title,
  text,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-5" />
        </span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-auto pt-4">{action}</div>
    </Card>
  );
}

function ContinueBanner({ bankTitle }: { bankTitle: (id: string) => string }) {
  const session = useSession();
  const navigate = useNavigate();
  if (!session) return null;

  const done = isExam(session) ? session.selected.filter(Boolean).length : session.checked.filter(Boolean).length;
  const time = isExam(session) && session.timeLimit
    ? `${formatTime(session.timeLimit - session.elapsed)} left`
    : formatTime(session.elapsed);

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 border-accent/40 bg-accent-soft p-4 sm:p-5">
      <div>
        <p className="font-semibold">Quiz in progress</p>
        <p className="text-sm text-muted">
          {MODE_LABELS[session.mode]} · {session.bank === 'mixed' ? session.title : bankTitle(session.bank)} ·{' '}
          {done} of {session.items.length} answered · {time}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={discardSession}>Discard</Button>
        <Button onClick={() => navigate('/quiz')}><Play className="size-4" />Continue</Button>
      </div>
    </Card>
  );
}
