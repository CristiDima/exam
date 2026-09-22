import { Bookmark, Check, Eye, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { statusOf, toggleBookmark, useProgress } from '../lib/progress';
import { highlightRanges } from '../lib/search';
import { CHOICE_KEYS, type ChoiceKey, type Question } from '../lib/types';
import { Badge, Button, Card, IconButton, cx } from './ui';

export function Highlight({ text, terms }: { text: string; terms: readonly string[] }) {
  const ranges = highlightRanges(text, terms);
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<mark key={i}>{text.slice(start, end)}</mark>);
    at = end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

export function BookmarkButton({ hash, className }: { hash: string; className?: string }) {
  const { bookmarks } = useProgress();
  const on = bookmarks.includes(hash);
  return (
    <IconButton
      label={on ? 'Remove bookmark' : 'Bookmark'}
      aria-pressed={on}
      onClick={() => toggleBookmark(hash)}
      className={cx(on && 'text-warn hover:text-warn', className)}
    >
      <Bookmark className="size-[18px]" fill={on ? 'currentColor' : 'none'} />
    </IconButton>
  );
}

export function StatusBadge({ hash }: { hash: string }) {
  const { stats } = useProgress();
  const stat = stats[hash];
  const status = statusOf(stat);
  if (status === 'new') return <Badge>New</Badge>;
  const detail = `${stat.times_answered - stat.times_wrong}/${stat.times_answered} correct`;
  return status === 'known' ? <Badge tone="ok">Known · {detail}</Badge> : <Badge tone="bad">To review · {detail}</Badge>;
}

/**
 * A question with every choice, the correct one marked, and the explanation.
 * `selected` marks the user's answer (review screens). `hideAnswer` starts it
 * collapsed, flashcard style, until "Show answer" is pressed.
 */
export function QuestionCard({
  question: q,
  meta,
  terms = [],
  selected,
  hideAnswer = false,
  order = CHOICE_KEYS,
}: {
  question: Question;
  meta?: ReactNode;
  terms?: readonly string[];
  selected?: ChoiceKey | null;
  hideAnswer?: boolean;
  order?: readonly ChoiceKey[];
}) {
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !hideAnswer || revealed;

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {meta}
          <StatusBadge hash={q.hash} />
        </div>
        <BookmarkButton hash={q.hash} className="-mt-1.5 -mr-1.5 shrink-0" />
      </div>
      <p className="font-semibold leading-relaxed">
        <Highlight text={q.question} terms={terms} />
      </p>

      <ul className="mt-3 space-y-1.5">
        {order.map((key, i) => {
          const correct = showAnswer && key === q.answer;
          const wrong = showAnswer && selected === key && key !== q.answer;
          return (
            <li
              key={key}
              className={cx(
                'flex gap-2.5 rounded-xl border px-3 py-2 text-sm leading-relaxed',
                correct ? 'border-ok/50 bg-ok-soft' : wrong ? 'border-bad/50 bg-bad-soft' : 'border-transparent',
              )}
            >
              <span
                className={cx(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                  correct ? 'bg-ok text-white dark:text-bg' : wrong ? 'bg-bad text-white dark:text-bg' : 'bg-surface-2 text-muted',
                )}
              >
                {correct ? <Check className="size-3.5" strokeWidth={3} /> : wrong ? <X className="size-3.5" strokeWidth={3} /> : CHOICE_KEYS[i]}
              </span>
              <span className={cx(correct && 'font-medium')}>
                <Highlight text={q.choices[key]} terms={terms} />
                {selected === key && <span className="ml-1.5 text-xs font-semibold text-muted">(your answer)</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {showAnswer ? (
        q.explanation && (
          <p className="mt-3 rounded-xl border-l-[3px] border-accent bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-fg/90">
            <Highlight text={q.explanation} terms={terms} />
          </p>
        )
      ) : (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setRevealed(true)}>
          <Eye className="size-4" /> Show answer
        </Button>
      )}
    </Card>
  );
}
