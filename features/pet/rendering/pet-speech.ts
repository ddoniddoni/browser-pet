import { headCallout, placeBubble, type OccupiedSide } from './head-callout';
import { uiLanguage } from '../../../shared/i18n';
import type { Point, Viewport } from '../core/interaction';
import { sampleSpeech, speechText, type SpeechBeat } from '../core/speech';

export function createPetSpeech(container: HTMLElement, button: HTMLButtonElement, createdAt: number, suffix = '') {
  const bubble = document.createElement('span');
  bubble.id = 'pet-speech' + suffix;
  bubble.className = 'pet-speech pet-callout';
  bubble.lang = uiLanguage;
  bubble.hidden = true;
  container.append(bubble);

  let beat: SpeechBeat | undefined;
  let lastSampleAt = -Infinity;
  let skipped: number | string | undefined;
  let shown: number | string | undefined;
  let width = 0, height = 0, measuredFor = 0;

  function hide() {
    if (shown === undefined) return;
    shown = undefined;
    bubble.hidden = true;
    button.removeAttribute('aria-describedby');
  }

  function sync(now: number, enabled: boolean, quiet: boolean, point: Point, view: Viewport,
    completion?: { key: string; text: string; until: number }, occupied?: OccupiedSide) {
    if (!enabled) { hide(); return; }
    if (!completion && (!beat || now < lastSampleAt || now >= beat.nextAt)) beat = sampleSpeech(createdAt, now);
    lastSampleAt = now;
    const line = completion ? null : beat?.line;
    const key = completion?.key ?? line?.index;
    const nextAt = completion?.until ?? beat?.nextAt;
    if (key !== undefined && quiet) skipped = key;
    if (key === undefined || skipped === key) {
      hide();
      return nextAt;
    }
    const opening = shown !== key;
    if (opening) {
      shown = key;
      bubble.textContent = completion?.text ?? speechText(line!.index, line!.at);
      bubble.hidden = false;
      // 포커스를 옮기거나 읽고 있던 내용을 끊지 않는다.
      button.setAttribute('aria-describedby', bubble.id);
    }
    // 산책 중에는 크기를 다시 읽지 않고 좌표만 사용한다.
    if (opening || measuredFor !== view.width) {
      width = bubble.offsetWidth;
      height = bubble.offsetHeight;
      measuredFor = view.width;
    }
    const layout=headCallout(point,view,width,height,6,7,occupied);
    if (!layout.fits) {
      // 하이파이브가 끝나면 공간이 생기는지 다시 본다.
      if (!occupied) skipped=key;
      hide();
      return nextAt;
    }
    placeBubble(bubble,layout);
    return nextAt;
  }
  return { sync, hide };
}
