import { useEffect, useRef, useState } from 'react';
import { backupFile, maxBackupBytes, readBackup, type PetBackup } from '../../shared/contracts/backup';
import { localDay } from '../../shared/contracts/agenda';
import type { PetState, ResetTarget } from '../../shared/contracts/state';
import { t, formatLocale } from '../../shared/i18n';
import { restoreBackup } from '../../shared/messaging/state';

interface Preview { file: string; backup: PetBackup; target: ResetTarget }

export function BackupPanel({ state, target }: { state: PetState | null; target: ResetTarget }) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);

  function download() {
    if (!state) return;
    setError('');
    const now = new Date();
    const url = URL.createObjectURL(backupFile(state, now.getTime()));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'browser-pet-' + localDay(now) + '.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(t('backupDownloaded'));
  }

  async function choose(file?: File) {
    if (!file || locked.current) return;
    locked.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      if (file.size > maxBackupBytes) throw new Error(t('backupTooLarge'));
      const text = await file.text();
      setPreview({ backup: readBackup(text), file: text, target });
    } catch (e) { setError(e instanceof Error ? e.message : t('backupInvalid')); }
    finally { locked.current = false; setBusy(false); }
  }

  async function restore() {
    if (!preview || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const saved = await restoreBackup(preview.target, preview.file);
      setNotice(t(saved.agenda?.alarms.some(a => a.enabled) ? 'backupDoneAlarms' : 'backupDone'));
    } catch (e) { setError(e instanceof Error ? e.message : t('saveError')); }
    finally { setPreview(undefined); locked.current = false; setBusy(false); }
  }

  const backup = preview?.backup;
  return <section className="backup-panel" aria-labelledby="backup-title">
    <h2 id="backup-title">{t('backupTitle')}</h2>
    <p>{t('backupHint')}</p>
    <div className="backup-actions">
      <button className="secondary" type="button" disabled={!state || busy} onClick={download}>{t('backupExport')}</button>
      <button className="secondary" type="button" disabled={busy} onClick={() => input.current?.click()}>{t('backupImport')}</button>
      <input ref={input} type="file" hidden accept=".json,application/json" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; void choose(file);
      }} />
    </div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <dialog ref={dialog} aria-labelledby="backup-review" aria-describedby="backup-warning"
      onCancel={e => { e.preventDefault(); if (!locked.current) setPreview(undefined); }}>
      {backup && <>
        <h2 id="backup-review">{t('backupReview')}</h2>
        <dl>
          <dt>{t('backupDate')}</dt><dd>{new Date(backup.exportedAt).toLocaleString(formatLocale)}</dd>
          <dt>{t('petName')}</dt><dd><bdi>{backup.state.pet.name}</bdi></dd>
          <dt>{t('customFriends')}</dt><dd>{Object.keys(backup.state.imagePets ?? {}).length}</dd>
          <dt>{t('agendaAlarms')}</dt><dd>{backup.state.agenda?.alarms.length ?? 0}</dd>
        </dl>
        <p id="backup-warning">{t('backupReplace')}</p>
        <div className="dialog-actions">
          <button type="button" className="secondary" autoFocus disabled={busy} onClick={() => setPreview(undefined)}>{t('cancel')}</button>
          <button type="button" className="primary" disabled={busy} onClick={() => void restore()}>{t(busy ? 'saving' : 'backupConfirm')}</button>
        </div>
      </>}
    </dialog>
  </section>;
}
