import { expect, it } from 'vitest';
import { crossedDragThreshold, dragPosition, fitToViewport, roamingArea } from '../../features/pet/core/interaction';

it.each([[5.99, 0, false], [6, 0, true], [0, -6, true], [4, 4, false], [-5, 4, true]] as const)(
  '시작점에서 (%s,%s) 이동할 때 드래그 %s', (dx, dy, expected) => {
    expect(crossedDragThreshold({ x: 10, y: 20 }, { x: 10 + dx, y: 20 + dy })).toBe(expected);
  });
it('잡은 위치를 유지하고 화면 가장자리까지 옮길 수 있다', () => {
  const grab = { x: 8, y: 40 };
  expect(dragPosition({ x: 214, y: 141 }, grab, { width: 600, height: 400, size: 64 }))
    .toEqual({ x: 206, y: 101 });
  expect(dragPosition({ x: 214, y: -20 }, grab, { width: 92, height: 75, size: 64 }))
    .toEqual({ x: 28, y: 0 });
});
it('고정 좌표는 화면 안이면 그대로 두고 벗어난 축만 안으로 옮긴다', () => {
  const pin = { x: 330, y: 140 };
  expect(fitToViewport(pin, { width: 700, height: 420, size: 64 })).toEqual(pin);
  expect(fitToViewport(pin, { width: 260, height: 420, size: 64 })).toEqual({ x: 196, y: 140 });
  expect(fitToViewport(pin, { width: 400, height: 160, size: 64 })).toEqual({ x: 330, y: 96 });
});

it('기본 산책은 여백을 두고, 끌어 놓은 자리에서는 모서리까지 쓰며 작은 창에서도 남은 축으로 이동할 수 있다', () => {
  const view = { width: 800, height: 500, size: 64 };
  expect(roamingArea(view, true)).toEqual({x:16,y:16,width:704,height:404});
  expect(roamingArea(view, false)).toEqual({x:0,y:0,width:736,height:436});
  const thin = roamingArea({width:40,height:45,size:40}, true);
  expect(thin.width).toBe(0);
  expect(thin.height).toBeGreaterThan(0);
  expect(thin.y+thin.height+40).toBeLessThanOrEqual(45);
});
