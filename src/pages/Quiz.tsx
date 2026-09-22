import { ArrowLeft, ArrowRight, Check, Clock, LayoutGrid, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { BookmarkButton } from '../components/QuestionCard';
import { useToast } from '../components/toast';
import { Button, IconButton, Kbd, Modal, cx } from '../components/ui';
import { formatTime, plural } from '../lib/format';
import { useProgress } from '../lib/progress';
import { useQuestions } from '../lib/questions';
import {
  checkAnswer,
  discardSession,
  finishSession,
  goTo,
  isExam,
  selectChoice,
  tick,
  useSession,
  type Session,
} from '../lib/session';
import { useSettings } from '../lib/settings';
import { CHOICE_KEYS, MODE_LABELS, type ChoiceKey, type Question } from '../lib/types';

type ChoiceState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';

export default function Quiz() {
  const session = useSession();
  const { byId } = useQuestions();
  const navigate = useNavigate();
  const toast = useToast();
  const finishing = useRef(false);

  const questions = useMemo(
    () =>
      session?.items.map(item => {
        const q = byId.get(item.id);
        return q && q.hash === item.hash ? q : undefined;
      }) ?? [],
    [session?.items, byId],
  );

  const finish = (message?: string) => {
    if (finishing.current) return;
    finishing.current = true;
    const result = finishSession(id => byId.get(id));
    if (message) toast(message);
    if (!result) toast('Nothing was answered, so the quiz was not saved.');
    navigate(result ? '/results' : '/', { replace: true });
  };

  if (!session) return finishing.current ? null : <Navigate to="/" replace />;

  if (questions.some(q => !q)) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-semibold">This quiz can't be resumed</p>
        <p className="mt-2 text-sm text-muted">The question set changed since it was started.</p>
        <Button
          className="mt-6"
          onClick={() => {
            discardSession();
            navigate('/', { replace: true });
          }}
        >
          Back to practice
        </Button>
      </div>
    );
  }

  return <QuizView session={session} questions={questions as Question[]} onFinish={finish} />;
}

function QuizView({
  session,
  questions,
  onFinish,
}: {
  session: Session;
  questions: Question[];
  onFinish: (message?: string) => void;
}) {
  const navigate = useNavigate();
  const { bankTitle } = useQuestions();
  const { answerStyle } = useSettings();
  const { bookmarks } = useProgress();
  const [leaving, setLeaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [overview, setOverview] = useState(false);

  const exam = isExam(session);
  const n = session.items.length;
  const i = session.current;
  const item = session.items[i];
  const q = questions[i];
  const selected = session.selected[i];
  const checked = session.checked[i];
  const last = i === n - 1;
  const answeredCount = (exam ? session.selected : session.checked).filter(Boolean).length;
  const unanswered = n - session.selected.filter(Boolean).length;
  const remaining = session.timeLimit !== null ? session.timeLimit - session.elapsed : null;

  // Timer: counts while the page is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) tick();
    }, 1000);
    return () => clearInterval(id);
  }, [session.key]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0) onFinish("Time's up! Your exam was submitted.");
  }, [remaining, onFinish]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [i]);

  const choose = (key: ChoiceKey) => {
    if (checked) return;
    selectChoice(i, key);
    if (!exam && answerStyle === 'instant') checkAnswer(i, q);
  };

  const next = () => (last ? (exam ? setSubmitting(true) : onFinish()) : goTo(i + 1));

  const primary = () => {
    if (exam) next();
    else if (checked) next();
    else if (selected) checkAnswer(i, q);
  };

  // Keyboard: 1-4 or A-D choose, Enter continues, arrows move (exams).
  // Re-registered on every render so the handler always sees the current state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (leaving || submitting || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, dialog')) return;
      const k = e.key.toLowerCase();
      const pos = k.length === 1 ? Math.max('1234'.indexOf(k), 'abcd'.indexOf(k)) : -1;
      if (pos !== -1) {
        e.preventDefault();
        choose(item.order[pos]);
      } else if (e.key === 'Enter') {
        // Other focused buttons (leave, bookmark…) keep their own Enter; on answers and
        // the main action button, Enter means check / continue.
        if (target.closest('button:not([data-choice]):not([data-primary])')) return;
        e.preventDefault();
        primary();
      } else if (e.key === 'ArrowRight' && (exam || checked)) {
        if (!last) goTo(i + 1);
      } else if (e.key === 'ArrowLeft' && exam) {
        goTo(i - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const stateOf = (key: ChoiceKey): ChoiceState => {
    if (!exam && checked) {
      if (key === q.answer) return 'correct';
      if (key === selected) return 'wrong';
      return 'dim';
    }
    return key === selected ? 'selected' : 'idle';
  };

  const correctLetter = CHOICE_KEYS[item.order.indexOf(q.answer)];
  const setName = session.bank === 'mixed' ? session.title : bankTitle(session.bank);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3 sm:px-4">
          <IconButton label="Leave quiz" onClick={() => setLeaving(true)}>
            <X className="size-5" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {MODE_LABELS[session.mode]} · {setName}
            </p>
            <p className="text-xs text-muted tabular-nums">
              Question {i + 1} of {n}
            </p>
          </div>
          <span
            className={cx(
              'flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums',
              remaining !== null && remaining <= 60 ? 'bg-bad-soft text-bad' : 'text-muted',
            )}
            aria-label={remaining !== null ? 'Time left' : 'Time elapsed'}
          >
            <Clock className="size-4" />
            {formatTime(remaining ?? session.elapsed)}
          </span>
          {exam && (
            <Button size="sm" onClick={() => setSubmitting(true)}>
              <Send className="size-3.5" />
              Submit
            </Button>
          )}
        </div>
        <div className="h-1 bg-surface-2">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(answeredCount / n) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">
            #{q.number} in {bankTitle(q.bank)}
          </span>
          <BookmarkButton hash={q.hash} className="-mr-2" />
        </div>

        <h1 className="text-lg font-semibold leading-relaxed sm:text-xl">{q.question}</h1>

        <div className="mt-5 space-y-2.5" role="group" aria-label="Answers">
          {item.order.map((key, pos) => (
            <ChoiceButton
              key={key}
              letter={CHOICE_KEYS[pos]}
              text={q.choices[key]}
              state={stateOf(key)}
              disabled={!exam && checked}
              onClick={() => choose(key)}
            />
          ))}
        </div>

        {!exam && checked && (
          <div
            role="status"
            className={cx('mt-5 rounded-2xl border p-4', selected === q.answer ? 'border-ok/40 bg-ok-soft' : 'border-bad/40 bg-bad-soft')}
          >
            <p className={cx('font-semibold', selected === q.answer ? 'text-ok' : 'text-bad')}>
              {selected === q.answer ? 'Correct!' : `Not quite. The answer is ${correctLetter}.`}
            </p>
            {q.explanation && <p className="mt-1.5 text-sm leading-relaxed">{q.explanation}</p>}
          </div>
        )}

        {exam && overview && (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 text-sm text-muted">
              {n - unanswered} of {n} answered · tap a number to jump
            </p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {session.items.map((it, j) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => goTo(j)}
                  aria-label={`Question ${j + 1}${session.selected[j] ? ', answered' : ''}`}
                  className={cx(
                    'relative h-9 rounded-lg text-sm font-semibold tabular-nums transition-colors cursor-pointer',
                    session.selected[j] ? 'bg-accent text-accent-fg' : 'border border-line text-muted hover:text-fg',
                    j === i && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                  )}
                >
                  {j + 1}
                  {bookmarks.includes(it.hash) && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-warn" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          {exam ? (
            <>
              <Button variant="secondary" disabled={i === 0} onClick={() => goTo(i - 1)} aria-label="Previous question">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button variant="ghost" onClick={() => setOverview(o => !o)} aria-expanded={overview}>
                <LayoutGrid className="size-4" />
                {n - unanswered}/{n}
              </Button>
              <div className="flex-1" />
              <Button onClick={next} data-primary>
                {last ? 'Submit exam' : 'Next'}
                {last ? <Send className="size-4" /> : <ArrowRight className="size-4" />}
              </Button>
            </>
          ) : (
            <>
              <p className="hidden flex-1 items-center gap-1.5 text-xs text-muted sm:flex">
                <Kbd>1</Kbd>–<Kbd>4</Kbd> answer · <Kbd>Enter</Kbd> {checked ? 'continue' : answerStyle === 'confirm' ? 'check' : ''}
              </p>
              <div className="flex-1 sm:hidden" />
              {checked ? (
                <Button size="lg" onClick={next} autoFocus data-primary>
                  {last ? 'See results' : 'Next question'}
                  <ArrowRight className="size-4" />
                </Button>
              ) : answerStyle === 'confirm' ? (
                <Button size="lg" disabled={!selected} onClick={() => checkAnswer(i, q)} data-primary>
                  <Check className="size-4" />
                  Check answer
                </Button>
              ) : (
                <p className="py-3 text-sm text-muted">Tap an answer</p>
              )}
            </>
          )}
        </div>
      </footer>

      <Modal
        open={leaving}
        onClose={() => setLeaving(false)}
        title="Leave this quiz?"
        actions={
          <>
            <Button
              variant="danger"
              onClick={() => {
                discardSession();
                navigate('/', { replace: true });
              }}
            >
              Discard
            </Button>
            <Button variant="secondary" onClick={() => onFinish()}>
              Finish now
            </Button>
            <Button onClick={() => navigate('/')}>Keep for later</Button>
          </>
        }
      >
        It's saved, so you can continue it later from the Practice page. “Finish now” scores what you've answered so far.
      </Modal>

      <Modal
        open={submitting}
        onClose={() => setSubmitting(false)}
        title="Submit your exam?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setSubmitting(false)}>
              Keep working
            </Button>
            <Button onClick={() => onFinish()}>Submit</Button>
          </>
        }
      >
        {unanswered > 0
          ? `${plural(unanswered, 'question is', 'questions are')} still unanswered and will count as wrong.`
          : 'All questions are answered.'}
      </Modal>
    </div>
  );
}

function ChoiceButton({
  letter,
  text,
  state,
  disabled,
  onClick,
}: {
  letter: string;
  text: string;
  state: ChoiceState;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-choice
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'selected'}
      className={cx(
        'flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left leading-relaxed transition-colors duration-150 sm:p-4',
        'disabled:cursor-default cursor-pointer',
        state === 'idle' && 'border-line bg-surface hover:border-accent/60 hover:bg-surface-2',
        state === 'selected' && 'border-accent bg-accent-soft',
        state === 'correct' && 'border-ok bg-ok-soft',
        state === 'wrong' && 'border-bad bg-bad-soft',
        state === 'dim' && 'border-line bg-surface opacity-55',
      )}
    >
      <span
        className={cx(
          'flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
          state === 'correct' ? 'bg-ok text-white dark:text-bg'
            : state === 'wrong' ? 'bg-bad text-white dark:text-bg'
            : state === 'selected' ? 'bg-accent text-accent-fg'
            : 'bg-surface-2 text-muted',
        )}
      >
        {state === 'correct' ? <Check className="size-4" strokeWidth={3} /> : state === 'wrong' ? <X className="size-4" strokeWidth={3} /> : letter}
      </span>
      <span className="pt-0.5 text-[15px] sm:text-base">{text}</span>
    </button>
  );
}
