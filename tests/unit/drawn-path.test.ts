import { describe, expect, it } from 'vitest';
import { remainingDrawnPath } from '../../features/pet/core/drawn-path';
import { samplePatrol, sampleScenePatrol } from '../../features/pet/core/shared-patrol';
import type { SharedScene } from '../../shared/contracts/state';

const at = 1_700_000_000_000;
const path = [{ x: 0.125, y: 0.25 }, { x: 0.375, y: 0.25 }, { x: 0.375, y: 0.75 }];
const anchor: SharedScene['anchor'] = { kind: 'placed-patrol', ...path[0]!, path, at };

describe('다락방에서 그린 산책길', () => {
  it('입력점의 개수와 관계없이 실제 구간 길이에 비례해 걸으며 모서리에서 방향을 바꾼다', () => {
    const sampled = { ...anchor, path: [path[0]!, { x: 0.25, y: 0.25 }, ...path.slice(1)] };
    for (const route of [anchor, sampled]) {
      const walk = (elapsed: number) => sampleScenePatrol('nurung', route, at + elapsed, 'normal');
      expect(walk(1125)).toMatchObject({ x: 0.25, y: 0.25, action: 'WALK', drawnWalk: true });
      expect(walk(2250)).toMatchObject({ x: 0.375, y: 0.25, dx: 0 });
      expect(walk(3750)).toMatchObject({ x: 0.375, y: 0.5, nextAt: at + 5250 });
    }
    expect(sampleScenePatrol('nurung', anchor, at + 1875, 'slow').x).toBe(0.25);
  });

  it('꼬깃은 급한 모서리에 잠시 착지하고 같은 지점에서 다음 구간을 시작한다', () => {
    const kkogit = (elapsed: number) => sampleScenePatrol('kkogit', anchor, at + elapsed, 'normal', undefined, 'kkogit');
    expect(kkogit(2250)).toMatchObject({ ...path[1], action: 'IDLE', nextAt: at + 2470 });
    expect(kkogit(2470)).toMatchObject({ ...path[1], action: 'WALK' });
    expect(kkogit(3970).y).toBe(0.5);
  });

  it('다른 탭을 나중에 열어도 완주 시점부터 끝점에서 시작한 자유 산책과 일치한다', () => {
    const finish = at + 5250;
    const end = { ...path[2]!, at: finish };
    for (const now of [finish, finish + 1, finish + 3_600_000]) {
      expect(sampleScenePatrol('nurung', anchor, now, 'normal')).toEqual(samplePatrol('nurung', end, now, 'normal'));
    }
  });

  it('집중과 메뉴가 겹친 동안에는 공유 산책 시계를 멈추고 남은 구간에서 이어간다', () => {
    const timer = { token: 'study', mode: 'focus', phase: 'running', minutes: 1, startedAt: at + 1125,
      endsAt: at + 61_125 } as const;
    expect(sampleScenePatrol('nurung', anchor, at + 40_000, 'normal', timer)).toMatchObject({ x: 0.25, y: 0.25 });
    const held = { ...anchor, at: at + 2000, clock: { elapsed: 1125, hold: 'menu' } };
    expect(sampleScenePatrol('nurung', held, at + 80_000, 'normal', timer)).toMatchObject({ x: 0.25, y: 0.25 });
    const resumed = { ...anchor, at: at + 80_000, clock: { elapsed: 1125 } };
    expect(sampleScenePatrol('nurung', resumed, at + 81_125, 'normal', timer)).toMatchObject(path[1]!);
  });

  it('속도를 바꿀 때 지난 구간은 잘라내고 꼭짓점과 끝점을 중복하지 않는다', () => {
    expect(remainingDrawnPath(path, 1125, 'normal')).toEqual([{ x: 0.25, y: 0.25 }, ...path.slice(1)]);
    expect(remainingDrawnPath(path, 2250, 'normal')).toEqual(path.slice(1));
    expect(remainingDrawnPath(path, 5250, 'normal')).toBeUndefined();
  });
});
