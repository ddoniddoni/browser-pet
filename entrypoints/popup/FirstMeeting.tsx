import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n';
import { readPage } from './CurrentPageStatus';
import { PetAvatar } from '../../features/pet/rendering/PetAvatar';

export function FirstMeeting({ name, speciesId, busy, onMeet }: {
  name: string; speciesId: string; busy: boolean; onMeet: () => void;
}) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof readPage>>>('checking');
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function check(retries: number) {
      const result = await readPage();
      if (!active) return;
      if (retries && (result === 'loading' || result === 'noReceiver')) {
        timer = window.setTimeout(() => void check(retries - 1), 180);
      } else setStatus(result);
    }
    void check(3);
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  const ready = status === 'disabled' || status === 'visible';
  return <section className="first-meeting" aria-labelledby="first-friend">
    <PetAvatar speciesId={speciesId} name="" />
    <h2 id="first-friend" dir="auto">{name}</h2>
    {ready ? <button type="button" className="primary" disabled={busy} onClick={onMeet}>{t('meetPet', name)}</button>
      : <p role="status">{status === 'checking' ? t('checkingPage') : t('meetOnWeb')}</p>}
  </section>;
}
