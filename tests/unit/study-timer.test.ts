import { expect, it } from 'vitest';
import { changeTimer, isStudyTimer, patrolDelay, timeLeft, type StudyTimer } from '../../shared/contracts/timer';
import { envelope, parseCommand } from '../../shared/contracts/commands';
import { createPetState, isPetState } from '../../shared/contracts/state';
import { createStateWriter } from '../../shared/storage/writer';

it('문제 풀이 중 일시정지는 남은 밀리초를 보존하고 오래된 조작은 거절한다', () => {
  const run = changeTimer(undefined, { action: 'start', mode: 'exam', minutes: 1 }, 1000, 'start')!;
  const pause = changeTimer(run, { action: 'pause', token: 'start' }, 15_500, 'pause')!;
  expect(timeLeft(pause, 200_000)).toBe(45_500);
  expect(changeTimer(pause, { action: 'clear', token: 'start' }, 200_000, 'old')).toBeUndefined();
  const resumed = changeTimer(pause, { action: 'resume', token: 'pause' }, 200_000, 'resume')!;
  expect(timeLeft(resumed, 245_499)).toBe(1);
  expect(timeLeft(resumed, 300_000)).toBe(0);
  expect(changeTimer(resumed, { action: 'pause', token: 'resume' }, 245_500, 'late')).toBeUndefined();
  expect(patrolDelay(resumed, 500, 245_501)).toBe(244_500);
});

it('팝업에서만 유효한 제한시간으로 시작하며 이전 프로필도 그대로 읽는다', () => {
  const msg = { ...envelope, expectedPetId: 'p', requestId: 'r', type: 'STUDY_TIMER', payload: { action: 'start', mode: 'focus', minutes: 25 } };
  for (const source of ['content', 'options'] as const) expect(parseCommand(msg, source)).toMatchObject({ code: 'FORBIDDEN' });
  for (const minutes of [0, 181, 0.5, '3']) expect(parseCommand({ ...msg, payload: { ...msg.payload, minutes } }, 'popup')).toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(isPetState(createPetState())).toBe(true);
  expect(isStudyTimer({ token: 'x', minutes: 1, mode: 'exam', phase: 'paused', remainingMs: 61_000, startedAt: 100 })).toBe(false);
});

it('워커를 다시 만들어도 같은 세션을 복구하고 재전송으로 타이머가 재시작되지 않는다', async () => {
  let state = createPetState();
  const storage = { read: async () => state, write: async (next: typeof state) => { state = next; } };
  const request = { type: 'STUDY_TIMER', expectedPetId: state.pet.id, requestId: 'abc',
    payload: { action: 'start', mode: 'focus', minutes: 25 } } as const;
  await createStateWriter(storage)(request);
  expect(isPetState(state)).toBe(true);
  const original: StudyTimer | undefined = state.timer;
  expect(original?.phase).toBe('running');
  expect(await createStateWriter(storage)(request)).toMatchObject({ ok: true, alreadyApplied: true, state: { timer: original } });
});
