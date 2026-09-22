import { Download, Monitor, Moon, Sun, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useToast } from '../components/toast';
import { Button, Card, Modal, PageHeader, cx } from '../components/ui';
import { localTimestamp, plural } from '../lib/format';
import { clearHistory, exportProgress, importProgress, useProgress } from '../lib/progress';
import { storageAvailable } from '../lib/storage';
import { updateSettings, useSettings, type AnswerStyle, type Theme } from '../lib/settings';

export default function SettingsPage() {
  const settings = useSettings();
  const progress = useProgress();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epso-progress-${localTimestamp().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    if (pendingImport === null) return;
    try {
      const p = importProgress(pendingImport);
      toast(`Imported ${plural(p.runs.length, 'quiz', 'quizzes')} and ${plural(Object.keys(p.stats).length, 'question stat')}.`);
    } catch {
      toast('That file is not a valid progress export.', 'error');
    }
    setPendingImport(null);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" />

      <Section title="Appearance">
        <Segmented<Theme>
          label="Theme"
          value={settings.theme}
          onChange={theme => updateSettings({ theme })}
          options={[
            { value: 'system', label: 'System', icon: <Monitor className="size-4" /> },
            { value: 'light', label: 'Light', icon: <Sun className="size-4" /> },
            { value: 'dark', label: 'Dark', icon: <Moon className="size-4" /> },
          ]}
        />
      </Section>

      <Section title="Quiz">
        <Segmented<AnswerStyle>
          label="Answering"
          value={settings.answerStyle}
          onChange={answerStyle => updateSettings({ answerStyle })}
          options={[
            { value: 'instant', label: 'One tap' },
            { value: 'confirm', label: 'Select, then check' },
          ]}
        />
        <p className="mt-2 text-sm text-muted">
          {settings.answerStyle === 'instant'
            ? 'Tapping an answer checks it right away.'
            : 'The classic flow: pick an answer, then press “Check answer” (or Enter).'}
        </p>
        <label className="mt-5 flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium">Shuffle answer order</span>
            <span className="block text-sm text-muted">Show A–D in a different order each time.</span>
          </span>
          <Toggle checked={settings.shuffleChoices} onChange={shuffleChoices => updateSettings({ shuffleChoices })} />
        </label>
      </Section>

      <Section title="Your data">
        <p className="text-sm text-muted">
          Progress is saved only in this browser: {plural(progress.runs.length, 'quiz', 'quizzes')},{' '}
          {plural(Object.keys(progress.stats).length, 'answered question')}, {plural(progress.bookmarks.length, 'bookmark')}.
          Export it to back it up or to move it to another device, then import it there.
        </p>
        {!storageAvailable && (
          <p className="mt-2 text-sm font-medium text-bad">
            This browser isn't saving data (private mode?). Progress will be lost when you close the page.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            <Download className="size-4" /> Export progress
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Import progress
          </Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            <Trash2 className="size-4" /> Clear history
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) setPendingImport(await file.text());
            }}
          />
        </div>
      </Section>

      <Section title="Install as an app">
        <p className="text-sm text-muted">
          After the first visit the app works offline. On a phone, use your browser's <strong className="text-fg">Share</strong> or{' '}
          <strong className="text-fg">⋮</strong> menu and choose <strong className="text-fg">Add to Home Screen</strong>.
        </p>
      </Section>

      <Modal
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Replace your progress?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingImport(null)}>Cancel</Button>
            <Button onClick={doImport}>Import</Button>
          </>
        }
      >
        Importing replaces all progress saved in this browser with the file's contents.
      </Modal>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all history?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              className="bg-bad text-white hover:bg-bad/90"
              onClick={() => {
                clearHistory();
                setConfirmClear(false);
                toast('History cleared.');
              }}
            >
              Clear history
            </Button>
          </>
        }
      >
        This deletes every quiz result and your learning progress. Bookmarks are kept. Consider exporting first.
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl bg-surface-2 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors cursor-pointer',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
