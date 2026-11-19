import { headCallout, type OccupiedSide } from './head-callout';
import { t, uiLanguage } from '../../../shared/i18n';
import { formatTimerClock, timeLeft, timerModes, type StudyTimer } from '../../../shared/contracts/timer';
import type { Point, Viewport } from '../core/interaction';

export function createPetTimer(container: HTMLElement) {
  const badge = document.createElement('span');
  badge.className = 'pet-timer';
  badge.lang = uiLanguage;
  badge.dir = 'ltr';
  badge.hidden = true;
  badge.setAttribute('role', 'timer');
  badge.setAttribute('aria-live', 'off');
  const label = document.createElement('span');
  const digits = document.createElement('b');
  badge.append(label, document.createTextNode(' '), digits);
  container.append(badge);

  let lastSeconds = -1, lastLabel = '', lastViewWidth = 0;
  let width = 0, height = 0;
  let lastLeft = NaN, lastTop = NaN;

  function sync(session: StudyTimer | undefined, now: number, point: Point, view: Viewport, occupied?: OccupiedSide) {
    const seconds = session ? Math.ceil(timeLeft(session, now) / 1000) : 0;
    if (!session || seconds === 0) {
      if (!badge.hidden) badge.hidden = true;
      return;
    }

    const paused = session.phase === 'paused';
    const name = paused ? t('modePaused', timerModes[session.mode].title) : timerModes[session.mode].title;
    const measure = badge.hidden || name !== lastLabel || lastViewWidth !== view.width ||
      (seconds >= 6000) !== (lastSeconds >= 6000); // 100분부터 분 자릿수가 늘어난다.
    if (badge.hidden) badge.hidden = false;
    if (lastLabel !== name) {
      label.textContent = name;
      badge.toggleAttribute('data-paused-timer', paused);
      lastLabel = name;
    }
    if (lastSeconds !== seconds) {
      digits.textContent = formatTimerClock(seconds);
      lastSeconds = seconds;
    }
    if (measure) {
      width = badge.offsetWidth;
      height = badge.offsetHeight;
      lastViewWidth = view.width;
    }
    const layout=headCallout(point,view,width,height,4,4,occupied);
    if (occupied && !layout.fits) { badge.hidden=true; return; }
    const left=Math.round(layout.left), top=Math.round(layout.top);
    if (left !== lastLeft) { badge.style.left = left + 'px'; lastLeft = left; }
    if (top !== lastTop) { badge.style.top = top + 'px'; lastTop = top; }

    // 일시정지 중에는 타이머 표시를 위해 페이지를 깨우지 않는다.
    return session.phase === 'running' ? session.endsAt - (seconds - 1) * 1000 : undefined;
  }
  return { badge, sync };
}
