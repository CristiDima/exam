import { useState } from 'react';
import { useNavigate } from 'react-router';
import { sessionStore, startSession, type StartOptions } from '../lib/session';
import { useSettings } from '../lib/settings';
import { Button, Modal } from './ui';

type Options = Omit<StartOptions, 'shuffleChoices'>;

/** Starts a quiz and opens it, asking first if another quiz is still in progress. */
export function useStarter() {
  const navigate = useNavigate();
  const { shuffleChoices } = useSettings();
  const [pending, setPending] = useState<Options | null>(null);

  const begin = (opts: Options) => {
    startSession({ ...opts, shuffleChoices });
    navigate('/quiz');
  };

  const start = (opts: Options) => {
    if (opts.questions.length === 0) return;
    if (sessionStore.get()) setPending(opts);
    else begin(opts);
  };

  const modal = (
    <Modal
      open={pending !== null}
      onClose={() => setPending(null)}
      title="Replace the quiz in progress?"
      actions={
        <>
          <Button variant="secondary" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const opts = pending;
              setPending(null);
              if (opts) begin(opts);
            }}
          >
            Start new quiz
          </Button>
        </>
      }
    >
      Your unfinished quiz will be discarded. Answers you already checked stay in your stats.
    </Modal>
  );

  return { start, modal };
}
