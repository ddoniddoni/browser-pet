import { expect, it } from 'vitest';
import { sampleSpeech, speechText } from '../../features/pet/core/speech';

it('탭이 열린 시각과 무관하게 현재 발화와 종료 시각을 계산한다', () => {
  const created = 4_000, first = sampleSpeech(created, created);
  expect(first.line).toBeNull();
  const start = sampleSpeech(created, first.nextAt);
  expect(start.line?.index).toBe(0);
  expect(sampleSpeech(created, start.nextAt - 1)).toEqual(start);
  const rest = sampleSpeech(created, start.nextAt);
  expect(rest.line).toBeNull();
  expect(sampleSpeech(created, rest.nextAt).line?.index).toBe(1);
});

it('오래 숨겨진 문서는 지나간 말을 다시 보여 주지 않는다', () => {
  const late = 20 * 60_000;
  const current = sampleSpeech(0, late);
  expect(current.line).toBeNull();
  expect(current.nextAt).toBeGreaterThan(late);
  expect(sampleSpeech(0, current.nextAt).line?.at).toBe(current.nextAt);
});

it('현지 시간의 자정과 정오를 구분하고 분을 읽는다', () => {
  const at = (hour: number, minute: number) => new Date(2026, 0, 20, hour, minute).getTime();
  expect(speechText(0, at(9, 0))).toBe('안녕?');
  expect(speechText(1, at(0, 0))).toBe('지금은 오전 12시 정각이야.');
  expect(speechText(3, at(12, 9))).toBe('지금은 오후 12시 9분이야.');
});
