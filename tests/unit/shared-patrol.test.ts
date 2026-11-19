import { describe, expect, it } from 'vitest';
import { createRoamRoute } from '../../features/pet/core/roam-route';
import { samplePatrol } from '../../features/pet/core/shared-patrol';

const origin = { x: 1, y: 1, at: 1_700_000_000_000 };
const pet = 'same-profile-cat';

describe('여러 탭이 같은 시각에서 읽는 산책', () => {
  it('오른쪽 아래에서 대각선으로 출발하고, 속도는 두 축을 합친 이동 거리에 적용한다', () => {
    const at = origin.at;
    expect(samplePatrol(pet, origin, at, 'normal')).toMatchObject({ x: 1, y: 1, facing: -1, action: 'WALK' });
    for (const [speed, pixels] of [['normal',30],['slow',18]] as const) {
      const step = samplePatrol(pet, origin, at + 1000, speed);
      expect(step.x).toBeLessThan(origin.x);
      expect(step.y).toBeLessThan(origin.y);
      expect(Math.hypot((1-step.x)*900,(1-step.y)*600)).toBeCloseTo(pixels);
    }
  });

  it('왼쪽이나 위쪽 벽에 닿으면 그 축만 꺾여 모서리에서도 화면 안으로 걸어간다', () => {
    const at=origin.at;
    const interior=samplePatrol(pet,{x:.5,y:.5,at},at+1000,'normal');
    const from=(x:number,y:number)=>samplePatrol(pet,{x,y,at},at+1000,'normal');
    const near=.005;
    const left=from(near,.5), top=from(.5,near), corner=from(near,near);
    expect(left.x).toBeCloseTo(.5-interior.x-near);
    expect(left.y).toBeCloseTo(interior.y);
    expect(left.facing).toBe(1);
    expect(top.x).toBeCloseTo(interior.x);
    expect(top.y).toBeCloseTo(.5-interior.y-near);
    expect(top.facing).toBe(-1);
    expect(corner.x).toBeCloseTo(left.x);
    expect(corner.y).toBeCloseTo(top.y);
    expect(corner.dy).toBeGreaterThan(0);
  });

  it('한 대각선만 왕복하지 않고 방향을 바꾸며 네 구역을 모두 지난다', () => {
    const route=createRoamRoute(()=>.5), start={x:.24,y:.67}, quadrants=new Set<string>();
    const headings=new Set<number>();
    for(let d=0;d<40_000;d+=35) {
      const {x,y,dx,dy}=route(start,d);
      expect(x>=0 && x<=1 && y>=0 && y<=1).toBe(true);
      quadrants.add(String(x>.5)+String(y>.5));
      headings.add(Math.round(Math.abs(Math.atan(dy/dx))*180/Math.PI));
    }
    expect(quadrants.size).toBe(4);
    expect(headings.size).toBeGreaterThan(2);
  });

  it('행동 주기가 반복되어도 위치가 이어지고, 쉬거나 자는 구간에는 움직이지 않는다', () => {
    let now = origin.at;
    const actions = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const start = samplePatrol(pet, origin, now, 'normal');
      const end = samplePatrol(pet, origin, start.nextAt - 1, 'normal');
      const next = samplePatrol(pet, origin, start.nextAt, 'normal');
      actions.add(start.action);
      expect(start.nextAt).toBeGreaterThan(now);
      expect(end.action).toBe(start.action);
      if (start.action !== 'WALK') expect([start.x,start.y]).toEqual([end.x,end.y]);
      expect(Math.hypot((next.x-end.x)*900,(next.y-end.y)*600)).toBeLessThan(0.031);
      now = start.nextAt;
    }
    expect(actions).toEqual(new Set(['WALK', 'IDLE', 'SIT', 'SLEEP']));
  });

  it('오랫동안 열리지 않은 탭도 이전 프레임 없이 같은 위치와 자세를 복원한다', () => {
    const now = origin.at + 10 * 365 * 86_400_000 + 6789;
    const a = samplePatrol(pet, origin, now, 'slow');
    samplePatrol('another-cat', { ...origin, x: 0.2 }, now, 'normal');
    const b = samplePatrol(pet, origin, now, 'slow');
    expect(b).toEqual(a);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeLessThanOrEqual(1);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeLessThanOrEqual(1);
    expect(b.nextAt).toBeGreaterThan(now);
  });
});
