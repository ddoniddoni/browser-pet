import type { Point } from './interaction';
import type { Action, Facing } from './patrol';
import { referenceView } from './roam-route';

type Speed = 'slow' | 'normal';

function measurePath(points: Point[], speed: Speed, glide: boolean) {
  const pixelsPerSecond = speed === 'slow' ? 60 : 100;
  const legs = [];
  let duration = 0;
  let previous: Point | undefined;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!, to = points[i]!;
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx * referenceView.width, dy * referenceView.height);
    const heading = { x: dx * referenceView.width / length, y: dy * referenceView.height / length };
    // 꼬깃은 크게 꺾이는 곳에 잠시 착지한 뒤 다음 방향으로 활공한다.
    const corner = previous && previous.x * heading.x + previous.y * heading.y < 0.5;
    const start = duration + (glide && corner ? 220 : 0);
    duration = start + length * 1000 / pixelsPerSecond;
    legs.push({ from, dx, dy, start, end: duration });
    previous = heading;
  }
  return { legs, duration, speed, glide };
}

// 저장 상태가 바뀔 때만 구간을 측정한다. 이전 경로는 참조가 사라지면 함께 회수된다.
const measured = new WeakMap<Point[], ReturnType<typeof measurePath>>();

export function drawnWalk(points: Point[], speed: Speed, glide: boolean) {
  let track = measured.get(points);
  if (!track || track.speed !== speed || track.glide !== glide) {
    track = measurePath(points, speed, glide);
    measured.set(points, track);
  }
  return track;
}

export function sampleDrawnWalk(track: ReturnType<typeof drawnWalk>, elapsed: number) {
  if (elapsed >= track.duration) return;
  const index = track.legs.findIndex(leg => elapsed < leg.end);
  if (index === -1) return;
  const { from, dx, dy, start, end } = track.legs[index]!;
  const progress = Math.max(0, (elapsed - start) / (end - start));
  const resting = elapsed < start;
  const action: Action = elapsed < 0 ? 'SIT' : resting ? 'IDLE' : 'WALK';
  const facing: Facing = dx < 0 ? -1 : 1;
  return {
    x: from.x + dx * progress, y: from.y + dy * progress, dx, dy, facing, index,
    action, nextElapsed: resting ? start : end,
  };
}

// 속도 또는 동작 줄이기를 변경하면 현재 지점부터 아직 걷지 않은 부분만 다시 시작한다.
export function remainingDrawnPath(points: Point[], elapsed: number, speed: Speed, speciesId?: string) {
  const sample = sampleDrawnWalk(drawnWalk(points, speed, speciesId === 'kkogit'), elapsed);
  if (!sample) return;
  const next = points[sample.index + 1]!;
  const remaining = points.slice(sample.index + 1);
  if (sample.x !== next.x || sample.y !== next.y) remaining.unshift({ x: sample.x, y: sample.y });
  return remaining.length >= 2 ? remaining : undefined;
}
