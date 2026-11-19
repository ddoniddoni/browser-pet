import { expect, it } from 'vitest';
import { ballFrame, playDuration } from '../../features/pet/core/ball-game';

const view = { width: 600, height: 350, size: 64 };
const start = { at: 1_000, x: .25, y: .6 };
const home = { x: start.x * (view.width - view.size), y: start.y * (view.height - view.size) };
const sample = (ms: number, dog: boolean, calm = false, reduced = false) =>
  ballFrame(start, start.at + ms, view, home, dog, calm ? 'calm' : 'lively', reduced);

it('같은 공을 보고도 차분한 펫은 기다리고 활발한 펫은 먼저 쫓는다', () => {
  expect(sample(450, true, true)?.point).toEqual(home);
  expect(sample(450, true)?.point.x).toBeGreaterThan(home.x);
});
it('강아지는 공과 함께 돌아오고 고양이는 공을 남겨 두고 돌아온다', () => {
  const dog = sample(2500, true)!, cat = sample(2500, false)!;
  expect(dog.point.x).toBeCloseTo(home.x);
  expect(cat.point.x).toBeCloseTo(home.x);
  expect(Math.abs(dog.ball.x - home.x)).toBeLessThan(view.size);
  expect(cat.ball.x - home.x).toBeGreaterThan(view.size);
  expect(sample(playDuration, true)).toBeNull();
});
it('동작 줄이기는 위치가 변하지 않고 지난 장면은 다시 시작하지 않는다', () => {
  expect(sample(500, true, false, true)).toEqual(sample(2000, true, false, true));
  expect(sample(500, true, false, true)?.point).toEqual(home);
  expect(sample(-1, true)).toBeNull();
});
