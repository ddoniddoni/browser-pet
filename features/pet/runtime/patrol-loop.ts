import { durationMs, nextAction, type Action } from '../core/patrol';

type Clock = Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame' | 'setTimeout' | 'clearTimeout'>;

export function createPatrolLoop(
  pose: (action: Action) => void,
  walk: (elapsedMs: number) => void,
  clock: Clock = window,
  random: () => number = Math.random,
) {
  let action: Action = 'IDLE';
  let active: boolean | undefined;
  let frame: number | undefined;
  let timer: number | undefined;
  let previousTime: number | undefined;

  function cancel() {
    if (frame !== undefined) clock.cancelAnimationFrame(frame);
    if (timer !== undefined) clock.clearTimeout(timer);
    frame = timer = previousTime = undefined;
  }

  function tick(now: number) {
    walk(previousTime === undefined ? 0 : now - previousTime);
    previousTime = now;
    frame = clock.requestAnimationFrame(tick);
  }

  function enter(next: Action) {
    cancel();
    action = next;
    pose(action);
    if (!active) return;
    timer = clock.setTimeout(() => enter(nextAction(action, random)), durationMs(action, random));
    if (action === 'WALK') frame = clock.requestAnimationFrame(tick);
  }

  return {
    setActive(value: boolean) {
      if (active === value) return;
      const firstWalk = active === undefined && value;
      active = value;
      enter(firstWalk ? 'WALK' : 'IDLE');
    },
    stop() {
      active = false;
      cancel();
    },
  };
}
