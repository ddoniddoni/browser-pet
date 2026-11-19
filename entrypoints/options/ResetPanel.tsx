import { Chevron } from '../../components/Chevron';
import { t } from '../../shared/i18n';
import { useRef, useState } from 'react';
import { BackupPanel } from './BackupPanel';
import type { PetState, ResetTarget } from '../../shared/contracts/state';
import { resetAll } from '../../shared/messaging/state';

export function ResetPanel({ target, state }: { target: ResetTarget; state: PetState | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmedTarget = useRef<ResetTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function confirm() {
    confirmedTarget.current = target;
    setError('');
    setDone(false);
    dialog.current?.showModal();
  }

  async function reset() {
    const captured = confirmedTarget.current;
    if (!captured || pending) return;
    setPending(true);
    try {
      await resetAll(captured);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('resetError'));
    } finally {
      setPending(false);
      dialog.current?.close();
    }
  }

  return (
    <details className="reset-panel" id="data" aria-labelledby="storage-title">
      <summary id="storage-title">{t('storedData')}<Chevron /></summary>
      <p>{t('storageHint')}</p>
      <BackupPanel state={state} target={target} />
      <button className="danger" type="button" onClick={confirm}>{t('resetData')}</button>
      {error && <p role="alert">{error}</p>}
      {done && <p className="notice" role="status">{t('resetDone')}</p>}
      <dialog ref={dialog} aria-labelledby="reset-title" aria-describedby="reset-description"
        onCancel={event => { if (pending) event.preventDefault(); }}
        onClose={() => { confirmedTarget.current = null; }}>
        <h2 id="reset-title">{t('resetQuestion')}</h2>
        <p id="reset-description">{t('resetWarning')}</p>
        <div className="dialog-actions">
          <button className="secondary" type="button" disabled={pending} onClick={() => dialog.current?.close()}>{t('cancel')}</button>
          <button className="confirm-reset" type="button" disabled={pending} onClick={reset}>
            {pending ? t('resetting') : t('confirmReset')}
          </button>
        </div>
      </dialog>
    </details>
  );
}
