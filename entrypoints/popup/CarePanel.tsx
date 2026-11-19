import { t, formatLocale } from '../../shared/i18n';
import { useEffect, useRef, useState } from 'react';
import type { PetState } from '../../shared/contracts/state';
import { settleCare, type CareAction } from '../../shared/contracts/care';
import { CareIcon } from './CareIcon';
import { careForPet } from '../../shared/messaging/state';

type Feedback =
  | { kind: 'idle' }
  | { kind: 'pending'; action: CareAction }
  | { kind: 'done' | 'error'; text: string };

function Gauge({ label, value }: { label: string; value: number }) {
  const shown = Math.round(value);
  return (
    <div className="care-gauge">
      <span aria-hidden="true">{label}</span>
      <meter aria-label={label} min={0} max={100} value={shown}>{shown}/100</meter>
      <span className="reading" aria-hidden="true"><b>{shown}</b><small> / 100</small></span>
    </div>
  );
}

export function CarePanel({ state }: { state: PetState }) {
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const sending = useRef(false);
  // 팝업이 열린 동안만 시간에 따른 표시를 갱신한다. 저장은 행동을 누를 때만 요청한다.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const care = settleCare(state.care, now);

  async function act(action: CareAction) {
    if (sending.current) return;
    sending.current = true;
    setFeedback({ kind: 'pending', action });
    try {
      const reply = await careForPet(state, action);
      const fed = action === 'feed';
      const text = reply.careReward === 'granted'
        ? fed ? t('fed') : t('petted')
        : fed ? t('feedCooldown')
          : t('petCooldown');
      setFeedback({ kind: 'done', text });
      setNow(Date.now());
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : t('careError') });
    } finally {
      sending.current = false;
    }
  }

  return (
    <section className="care-panel" aria-labelledby="care-title">
      <div className="care-heading">
        <h2 id="care-title">{t('speciesCare', state.pet.name)}</h2>
        <span>{t('totalXp')} <b>{care.xp.toLocaleString(formatLocale)} XP</b></span>
      </div>
      <div className="care-pair">
        <Gauge label={t('fullness')} value={care.satiety} />
        <Gauge label={t('mood')} value={care.mood} />
      </div>
      <div className="care-actions">
        <button type="button" className="secondary" disabled={feedback.kind === 'pending'}
          onClick={() => void act('feed')}><CareIcon kind="food"/>{t('feed')}</button>
        <button type="button" className="secondary" disabled={feedback.kind === 'pending'}
          onClick={() => void act('pet')}><CareIcon kind="pet"/>{t('petAction')}</button>
      </div>
      <p className="care-feedback" role="status">{feedback.kind === 'pending'
        ? feedback.action === 'feed' ? t('feeding') : t('petting')
        : feedback.kind === 'done' ? feedback.text : ''}</p>
      {feedback.kind === 'error' && <p role="alert">{feedback.text}</p>}
    </section>
  );
}
