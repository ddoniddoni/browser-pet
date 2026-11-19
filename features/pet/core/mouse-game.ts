import type { Personality } from '../../../shared/contracts/character';
import type { Point, Viewport } from './interaction';
import type { Facing } from './patrol';
import type { PlaySignal } from './ball-game';

export const mouseDuration = 3200;
const between = (x: number, low: number, high: number) => Math.max(low, Math.min(x, high));
function glide(age: number, begin: number, end: number) {
  const n = between((age - begin) / (end - begin), 0, 1);
  return n * n * (3 - 2 * n);
}
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

// 쥐는 놓인 높이에서 달린다. 탭을 옮겨도 같은 시각의 장면을 해당 창 비율로 복원한다.
export function mouseFrame(play: PlaySignal, now: number, view: Viewport, home: Point, nudges: boolean,
  personality: Personality, reduced: boolean) {
  const age = now - play.at;
  if (age < 0 || age >= mouseDuration) return null;
  const { size, width, height } = view;
  const range = Math.max(0, width - size), bottom = Math.max(0, height - size);
  const dir: Facing = play.x <= .5 ? 1 : -1;
  const sx = play.x * range, sy = play.y * bottom;
  const end = between(sx + dir * Math.min(size * 1.8, range * .32), 0, range);
  const nose = (x: number) => x + size * (dir === 1 ? .82 : .18);
  const radius = size * .22;
  const leap = personality === 'calm' ? 960 : 700;
  const hit = leap + 480;
  let facing: Facing = dir;
  let x = sx, y = sy, action = nudges ? 'PLAY_LOOK' : 'MOUSE_CROUCH';
  let mx = mix(nose(sx), nose(end), glide(age, 80, leap));
  let my = sy + size * .83;
  if (reduced) {
    x = home.x; y = home.y; mx = nose(x); my = y + size * .83;
    action = nudges ? 'MOUSE_NUDGE' : 'MOUSE_POUNCE';
  } else if (age >= leap) {
    const p = glide(age, leap, hit);
    x = mix(sx, end, p);
    if (!nudges) y = between(sy - size * .22 * Math.sin(Math.PI * p), 0, bottom);
    action = nudges ? (age < hit ? 'WALK' : 'MOUSE_NUDGE') : 'MOUSE_POUNCE';
    if (nudges) mx += dir * Math.min(size * .64, range * .12) * glide(age, hit + 100, hit + 630);
    if (age >= hit + 680) {
      const back = glide(age, hit + 680, mouseDuration - 100);
      x = mix(end, home.x, back); y = mix(sy, home.y, back);
      facing = home.x < end ? -1 : 1;
      action = back < 1 ? 'WALK' : 'IDLE';
    }
  }
  // 쥐가 구른 거리만큼 감긴 열쇠를 푼다. 멈추거나 동작을 줄이면 회전도 멈춘다.
  const roll = reduced || !size ? 0 : Math.abs(between(mx,radius,width-radius) -
    between(nose(sx),radius,width-radius)) / (size * .80);
  const motion = action === 'MOUSE_POUNCE' ? { at: play.at + leap, ms: hit + 680 - leap } :
    action === 'MOUSE_NUDGE' ? { at: play.at + hit, ms: 680 } :
    action === 'MOUSE_CROUCH' || action === 'PLAY_LOOK' ? { at: play.at, ms: leap } : undefined;
  return { motion, roll, point: { x, y }, facing, action, radius, mouseFacing: dir,
    mouse: { x: between(mx, radius, width - radius), y: between(my, radius, height - radius) } };
}
