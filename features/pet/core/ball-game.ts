import type { Personality } from '../../../shared/contracts/character';
import type { Point, Viewport } from './interaction';
import type { Facing } from './patrol';

export const playDuration = 2600;
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const progress = (n: number, a: number, b: number) => {
  const t = clamp((n - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export type PlaySignal = Point & { at: number };

// 펫의 왼쪽 위는 CSS px, 공유된 시작점은 화면 안에서의 비율, 공 위치는 중심점이다.
export function ballFrame(play: PlaySignal, now: number, view: Viewport, home: Point, dog: boolean,
  personality: Personality, reduced: boolean) {
  const age = now - play.at;
  if (age < 0 || age >= playDuration) return null;
  const { size, width, height } = view;
  const room = Math.max(0, width - size);
  const start = { x: play.x * room, y: play.y * Math.max(0, height - size) };
  const dir: Facing = play.x <= .5 ? 1 : -1;
  const radius = size * .11;
  const flight = Math.min(room * .38, size * 2.45);
  const aim = start.x + dir * flight;
  const lip = (x: number, face: Facing) => x + size * (face === 1 ? .9 : .1);
  const wait = personality === 'calm' ? 760 : 170;
  const contact = personality === 'calm' ? 1460 : 940;
  let facing = dir;
  let action: string;
  let x: number, y = start.y;
  let bx: number, by: number;
  if (reduced) {
    x = home.x; y = home.y;
    bx = lip(x, dir); by = y + size * (dog ? .47 : .84);
    action = dog ? 'FETCH' : 'BAT';
  } else if (age < contact) {
    const toss = progress(age, 0, 500);
    const chase = progress(age, wait, contact);
    x = mix(start.x, aim, chase);
    action = age < wait ? 'PLAY_LOOK' : 'WALK';
    bx = mix(lip(start.x, dir), lip(aim, dir), toss);
    by = start.y + size * .83 - Math.sin(toss * Math.PI) * size * .62;
  } else {
    const back = progress(age, contact + 360, playDuration - 120);
    x = mix(aim, home.x, back); y = mix(start.y, home.y, back);
    if (age >= contact + 360) facing = dir === 1 ? -1 : 1;
    if (dog) {
      action = back > 0 && back < 1 ? 'WALK' : 'FETCH';
      // 돌아서는 동안 공도 앞발에서 입으로 옮겨진다.
      bx = mix(lip(aim, dir), lip(x, facing), progress(age, contact + 330, contact + 550));
      by = mix(start.y + size * .83, y + size * .47, progress(age, contact, contact + 240));
    } else {
      action = back > 0 && back < 1 ? 'WALK' : back === 1 ? 'IDLE' : 'BAT';
      const roll = progress(age, contact, contact + 780);
      bx = lip(aim, dir) + dir * size * .95 * roll;
      by = start.y + size * (.83 - .12 * Math.sin(roll * Math.PI));
    }
  }
  const motion = action === 'PLAY_LOOK' ? { at: play.at, ms: wait } :
    action === 'BAT' || action === 'FETCH' ? { at: play.at + contact, ms: 360 } : undefined;
  const roll = reduced || !radius ? 0 : dir * (flight * progress(age, 0, 500) +
    (dog ? 0 : size * .95 * progress(age, contact, contact + 780))) / (2 * Math.PI * radius);
  return { motion, roll, point: { x, y }, facing, action, radius,
    ball: { x: clamp(bx, radius, width - radius), y: clamp(by, radius, height - radius) } };
}
