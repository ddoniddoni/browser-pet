import { t } from '../../shared/i18n';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { ToolRow } from './ToolRow';
import { sendTimerAction } from '../../shared/messaging/state';
import type { PetState } from '../../shared/contracts/state';
import { formatTimerClock, maxMinutes, timeLeft, timerModes, validMinutes, type TimerAction, type TimerMode } from '../../shared/contracts/timer';

function TimerIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="10" cy="11.5" r="6"/><path d="M10 11.5V8.2M8 2.5h4M10 2.5v2.6M15.1 6.4l1.2-1.2"/>
  </svg>;
}

// 팝업이 열려 있고 타이머가 동작할 때만 다음 초의 경계에 화면을 갱신한다.
function useSeconds(endsAt?: number) {
  const read = useCallback(() => endsAt === undefined ? 0 : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)), [endsAt]);
  const subscribe = useCallback((notify: () => void) => {
    if (endsAt === undefined) return () => {};
    let handle: number | undefined;
    function tick() {
      window.clearTimeout(handle);
      notify();
      const left = endsAt! - Date.now();
      if (left > 0 && !document.hidden) handle = window.setTimeout(tick, left % 1000 || 1000);
    }
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearTimeout(handle); document.removeEventListener('visibilitychange', tick); };
  }, [endsAt]);
  return useSyncExternalStore(subscribe, read);
}

export function StudyTimerPanel({ state }: { state: PetState }) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [durations, setDurations] = useState({ focus: String(timerModes.focus.minutes), exam: String(timerModes.exam.minutes) });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const timer = state.timer;
  const remaining = useSeconds(timer?.phase === 'running' ? timer.endsAt : undefined);
  const seconds = timer?.phase === 'paused' ? Math.ceil(timeLeft(timer, 0) / 1000) : remaining;
  const done = !!timer && seconds === 0;
  const minutes = Number(durations[mode]);
  async function send(op: TimerAction) {
    if (locked.current) return;
    locked.current = true;
    setPending(true); setError('');
    try { await sendTimerAction(state, op); }
    catch (e) { setError(e instanceof Error ? e.message : t('timerError')); }
    finally { locked.current = false; setPending(false); }
  }

  return <section className="study-timer" aria-label={t('studyTimer')}>
    {!timer ? <details name="pet-pocket-tools" className="timer-setup">
      <ToolRow kind="timer" title={t('timerToolTitle')}/>
      <form onSubmit={event => {
        event.preventDefault();
        if (validMinutes(minutes)) void send({ action: 'start', mode, minutes });
      }}>
        <fieldset className="timer-modes" disabled={pending} aria-label={t('timerMode')}>
          {(['focus', 'exam'] as const).map(item => <label key={item}>
            <input type="radio" name="timer-mode" checked={item === mode} onChange={() => setMode(item)}/>
            <span>{timerModes[item].title}</span>
          </label>)}
        </fieldset>
        <div className="timer-start">
          <label>{t('timeLimit')} <input type="number" required min={1} max={maxMinutes} step={1} value={durations[mode]}
            onChange={event => setDurations({ ...durations, [mode]: event.target.value })}/> {t('minutesUnit')}</label>
          <button type="submit" className="primary" disabled={pending}>{t('start')}</button>
        </div>
        <p className="hint">{mode === 'focus' ? t('focusHint') : t('examHint')}</p>
      </form>
    </details> : <>
      <div className="timer-readout"><i className="timer-emblem"><TimerIcon/></i><strong>{t('modeTimer', timerModes[timer.mode].title)}</strong>
        <output role="timer" aria-live="off" aria-label={t('timeLeft')}>{formatTimerClock(seconds)}</output></div>
      <div className="timer-controls"><p role="status">{done ? t('timesUp') : timer.phase === 'paused' ? t('paused') : t('sessionMinutes', timer.minutes)}</p>
        {!done && <button className="secondary" disabled={pending}
          onClick={() => void send({ action: timer.phase === 'paused' ? 'resume' : 'pause', token: timer.token })}>
          {timer.phase === 'paused' ? t('resume') : t('pause')}</button>}
        <button className="link" disabled={pending} onClick={() => void send({ action: 'clear', token: timer.token })}>
          {done ? t('ok') : t('end')}</button>
      </div>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
