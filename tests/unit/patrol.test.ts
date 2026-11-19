import { describe, expect, it, vi } from 'vitest';
import { durationMs, fitPosition, floorBounds, nextAction, stepWalk, type Position } from '../../features/pet/core/patrol';
import { createPatrolLoop } from '../../features/pet/runtime/patrol-loop';

const floor = floorBounds(900, 600, 64);

describe('하단 산책', () => {
  it.each([30, 60, 120])('%iHz에서 1초간 같은 거리를 걷는다', hz => {
    let normal: Position = { x: 450, facing: -1 };
    let slow = normal;
    for (let i = 0; i < hz; i++) {
      normal = stepWalk(normal, floor, 1000 / hz, 'normal');
      slow = stepWalk(slow, floor, 1000 / hz, 'slow');
    }
    expect(normal.x).toBeCloseTo(420, 8);
    expect(slow.x).toBeCloseTo(432, 8);
  });
  it('음수 dt는 0, 긴 프레임은 50ms로 제한한다', () => {
    const p: Position = { x: 450, facing: 1 };
    expect(stepWalk(p, floor, -10, 'normal')).toEqual(p);
    expect(stepWalk(p, floor, 60000, 'normal').x).toBe(451.5);
  });
  it('양 끝에 닿으면 안쪽으로 돌아서고 최소 화면에서는 방향이 흔들리지 않는다', () => {
    const right = stepWalk({ x: 819, facing: 1 }, floor, 50, 'normal');
    expect(right).toEqual({ x: 820, facing: -1 });
    expect(stepWalk(right, floor, 50, 'normal').x).toBeLessThan(right.x);
    expect(stepWalk({ x: 16.5, facing: -1 }, floor, 50, 'normal')).toEqual({ x: 16, facing: 1 });
    const tiny = floorBounds(24, 25, 96);
    expect(tiny).toEqual({ minX: 0, maxX: 0, y: 0, size: 24 });
    const p = fitPosition(right, tiny);
    expect(stepWalk(p, tiny, 50, 'normal')).toEqual(p);
  });
  it.each([[0, 'WALK'], [.649, 'WALK'], [.65, 'SIT'], [.899, 'SIT'], [.9, 'SLEEP']] as const)(
    'IDLE 종료 시 난수 %s로 %s를 선택한다', (draw, expected) => {
      expect(nextAction('IDLE', () => draw)).toBe(expected);
      expect(nextAction(expected, () => draw)).toBe('IDLE');
    });
  it('행동별 지속 시간을 주입한 난수로 선택한다', () => {
    expect(durationMs('IDLE', () => .5)).toBe(3500);
    expect(durationMs('WALK', () => .5)).toBe(5500);
    expect(durationMs('SIT', () => .5)).toBe(6500);
    expect(durationMs('SLEEP', () => .5)).toBe(30000);
  });
});

it('루프 하나만 예약하고 숨김 시 모두 해제하며, 복귀 후 첫 프레임의 dt는 0이다', () => {
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, () => void>();
  let id = 0;
  const clock = {
    requestAnimationFrame(fn: FrameRequestCallback) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(key: number) { frames.delete(key); },
    setTimeout(fn: () => void) { timers.set(++id, fn); return id; },
    clearTimeout(key?: number) { if (key !== undefined) timers.delete(key); },
  };
  function runFrame(now: number) {
    expect(frames.size).toBe(1);
    const [key, callback] = frames.entries().next().value!;
    frames.delete(key);
    callback(now);
  }
  const pose = vi.fn();
  const walk = vi.fn();
  const loop = createPatrolLoop(pose, walk, clock, () => .1);
  loop.setActive(true);
  loop.setActive(true);
  expect(timers.size).toBe(1);
  runFrame(100);
  runFrame(116);
  expect(walk.mock.calls).toEqual([[0], [16]]);
  loop.setActive(false);
  expect([frames.size, timers.size]).toEqual([0, 0]);
  loop.setActive(true);
  expect(pose).toHaveBeenLastCalledWith('IDLE');
  expect([frames.size, timers.size]).toEqual([0, 1]);
  timers.values().next().value!();
  expect(pose).toHaveBeenLastCalledWith('WALK');
  runFrame(600_000);
  expect(walk).toHaveBeenLastCalledWith(0);
  loop.stop();
  expect([frames.size, timers.size]).toEqual([0, 0]);
});
