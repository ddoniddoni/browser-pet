import { expect, it } from 'vitest';
import { createCare, isCareState, rewardCare, settleCare } from '../../shared/contracts/care';

const hour = 3_600_000;

it('긴 공백은 8시간만 정산하고 같은 시각, 시계 역행으로 다시 감소하지 않는다', () => {
  const start = createCare(100);
  const elapsed = 100 + 72 * hour;
  const next = settleCare(start, elapsed);
  expect(next).toMatchObject({ satiety: 38, mood: 54, xp: 0, lastSettledAt: elapsed });
  expect(settleCare(next, elapsed)).toEqual(next);
  expect(settleCare(next, 100)).toEqual(next);
  expect(settleCare(next, elapsed + hour)).toMatchObject({ satiety: 34, mood: 52 });
  expect(start.satiety).toBe(70);
});

it('짧은 간격의 정산도 시간 감소분을 잃지 않는다', () => {
  let sliced = createCare(0);
  for (let at = 1; at <= 60; at++) sliced = settleCare(sliced, at * 60_000);
  expect(sliced.satiety).toBeCloseTo(66, 8);
  expect(sliced.mood).toBeCloseTo(68, 8);
});

it('서로 독립된 보상 시각, 경계 직전과 직후, 상한과 하한', () => {
  const first = rewardCare({ ...createCare(0), satiety: 99, mood: 99 }, 'feed', 0).care;
  const both = rewardCare(first, 'pet', 0).care;
  expect(both).toMatchObject({ satiety: 100, mood: 100, xp: 7 });
  expect(rewardCare(both, 'feed', 599_999).rewarded).toBe(false);
  expect(rewardCare(both, 'pet', 59_999).rewarded).toBe(false);
  expect(rewardCare(both, 'feed', 600_000).care.xp).toBe(12);
  expect(rewardCare(both, 'pet', 60_000).care.xp).toBe(9);
  expect(settleCare({ ...both, satiety: 1, mood: 1 }, 8 * hour)).toMatchObject({ satiety: 0, mood: 0 });
  expect(isCareState({ ...both, satiety: NaN })).toBe(false);
  expect(isCareState({ ...both, lastFedAt: 1 })).toBe(false);
});
