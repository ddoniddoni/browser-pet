import { createRoamRoute } from './roam-route';
import type { Point } from './interaction';
import type { SharedScene } from '../../../shared/contracts/state';
import { patrolDelay, type StudyTimer } from '../../../shared/contracts/timer';
import { t } from '../../../shared/i18n';
import { durationMs, type Action, type Facing } from './patrol';

interface PatrolCycle {
  phases: { action: Action; endMs: number; walkedBefore: number; habitSeat?: number }[];
  durationMs: number;
  walkingMs: number;
  route: ReturnType<typeof createRoamRoute>;
}

const routine: Action[] = [
  'WALK', 'IDLE', 'WALK', 'IDLE', 'SIT', 'IDLE',
  'WALK', 'IDLE', 'WALK', 'IDLE', 'SLEEP', 'IDLE',
  'WALK', 'IDLE', 'SIT', 'IDLE', 'WALK', 'IDLE',
];

// 같은 친구는 어느 탭에서나 같은 산책을 한다. 기본 친구와 이미지 펫의 경로를 제한된 수만큼 보관한다.
const cached = new Map<string, PatrolCycle>();
function cycleFor(petId: string): PatrolCycle {
  const existing = cached.get(petId);
  if (existing) return existing;
  let seed = 2166136261;
  for (let i = 0; i < petId.length; i++) seed = Math.imul(seed ^ petId.charCodeAt(i), 16777619);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const phases: PatrolCycle['phases'] = [];
  let duration = 0, walked = 0;
  let seat = 0;
  for (const action of routine) {
    const ms = Math.round(durationMs(action, random));
    duration += ms;
    phases.push({ action, endMs: duration, walkedBefore: walked,
      ...(action === 'SIT' && {habitSeat:seat++}) });
    if (action === 'WALK') walked += ms;
  }
  const cycle = { phases, durationMs: duration, walkingMs: walked, route: createRoamRoute(random) };
  if (cached.size >= 8) cached.delete(cached.keys().next().value!);
  cached.set(petId, cycle);
  return cycle;
}

export interface PatrolSample extends Point { dx: number; dy: number; facing: Facing; action: Action; nextAt: number; habitAt?: number }

// nextAt은 다음 행동이 시작되는 절대 시각이다. 숨겨진 탭은 아무것도 예약하지 않아도 된다.
export function samplePatrol(petId: string, anchor: Point & { at: number }, now: number,
  speed: 'slow' | 'normal'): PatrolSample {
  const cycle = cycleFor(petId);
  const elapsed = Math.max(0, now - anchor.at);
  const rounds = Math.floor(elapsed / cycle.durationMs);
  const remaining = elapsed % cycle.durationMs;
  let startMs = 0;
  for (const phase of cycle.phases) {
    if (remaining >= phase.endMs) {
      startMs = phase.endMs;
      continue;
    }
    const walking = rounds * cycle.walkingMs + phase.walkedBefore +
      (phase.action === 'WALK' ? remaining - startMs : 0);
    const distance = walking * (speed === 'slow' ? 18 : 30) / 1000;
    return {
      ...cycle.route(anchor, distance),
      ...(phase.habitSeat === rounds%2 && {habitAt:anchor.at + rounds*cycle.durationMs + startMs + 500}),
      action: phase.action, nextAt: anchor.at + rounds * cycle.durationMs + phase.endMs,
    };
  }
  throw new RangeError(t('invalidWalkTime'));
}

// 기준점까지 실제로 걸린 시간과 그 뒤의 시각을 분리해 메뉴와 공부 시간이 겹쳐도 두 번 빼지 않는다.
type Anchor = SharedScene['anchor'];
export function patrolElapsed(anchor:Anchor, now:number, timer?:StudyTimer) {
  return (anchor.clock?.elapsed ?? 0) + (anchor.clock?.hold ? 0 :
    Math.max(0,now-anchor.at-patrolDelay(timer,anchor.at,now)));
}

export function sampleScenePatrol(petId:string, anchor:Anchor, now:number, speed:'slow'|'normal', timer?:StudyTimer) {
  const elapsed=patrolElapsed(anchor,now,timer);
  // 샘플의 종료/버릇 시각도 현재 페이지에서 예약할 실제 시각으로 돌려놓는다.
  return samplePatrol(petId,{x:anchor.x,y:anchor.y,at:now-elapsed},now,speed);
}
