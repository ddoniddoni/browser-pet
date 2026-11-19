import { t, uiLanguage, formatLocale } from '../../../shared/i18n';
// 펫 생성 시각을 기준으로 어느 탭에서나 같은 한마디를 고른다. 놓친 말은 재생하지 않는다.
const firstGreetingMs = 12_000;
const durationMs = 5_000;
const beats = [0, 85_000, 195_000, 289_000] as const;
const cycleMs = 417_000;

export type SpeechBeat = { nextAt: number; line: null | { index: number; at: number } };

export function sampleSpeech(createdAt: number, now: number): SpeechBeat {
  const start = createdAt + firstGreetingMs;
  if (now < start) return { nextAt: start, line: null };
  const round = Math.floor((now - start) / cycleMs);
  const base = start + round * cycleMs;
  for (const [i, offset] of beats.entries()) {
    const at = base + offset;
    if (now < at) return { nextAt: at, line: null };
    if (now < at + durationMs) return { nextAt: at + durationMs, line: { index: round * beats.length + i, at } };
  }
  return { nextAt: base + cycleMs, line: null };
}

let clock: Intl.DateTimeFormat | undefined;

export function speechText(index: number, at: number): string {
  const when = new Date(at), hour = when.getHours(), minute = when.getMinutes();
  if (index % 2 === 1) {
    if (uiLanguage === 'ko') {
      clock ??= new Intl.DateTimeFormat(formatLocale, { hour: 'numeric', hourCycle: 'h12' });
      const hours = clock.format(when);
      return t('speechTime', minute === 0 ? t('hourSharp', hours) : hours + ' ' + minute + t('minutesUnit'));
    }
    clock ??= new Intl.DateTimeFormat(formatLocale, { hour: 'numeric', minute: '2-digit' });
    const formatted = clock.format(when);
    const hourPart = uiLanguage === 'es' && clock.formatToParts(when).find(part => part.type === 'hour')?.value;
    return t(uiLanguage === 'es' && Number(hourPart) === 1 ? 'speechTimeOne' : 'speechTime', formatted);
  }
  const greeting = hour < 6 ? t('speechNight') : hour < 12 ? t('speechMorning') :
    hour < 18 ? t('speechWalk') : t('speechEvening');
  const lines = [t('speechHello'), greeting, t('speechStretch'), t('speechHere')];
  return lines[(index / 2) % lines.length] ?? greeting;
}
