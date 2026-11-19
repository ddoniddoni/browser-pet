export type Action = 'IDLE' | 'WALK' | 'SIT' | 'SLEEP';
export type Facing = -1 | 1;
export interface Position { x: number; facing: Facing }

const durations: Record<Action, [number, number]> = {
  IDLE: [2, 5], WALK: [3, 8], SIT: [4, 9], SLEEP: [20, 40],
};

export function durationMs(action: Action, random: () => number) {
  const [min, max] = durations[action];
  return (min + random() * (max - min)) * 1000;
}

export function nextAction(action: Action, random: () => number): Action {
  if (action !== 'IDLE') return 'IDLE';
  const draw = random();
  if (draw < 0.65) return 'WALK';
  if (draw < 0.9) return 'SIT';
  return 'SLEEP';
}

export function floorBounds(width: number, height: number, preferredSize: number) {
  const size = Math.min(width, height, preferredSize);
  const marginX = Math.min(16, (width - size) / 2);
  const marginY = Math.min(16, height - size);
  return { size, minX: marginX, maxX: width - size - marginX, y: height - size - marginY };
}
export type Floor = ReturnType<typeof floorBounds>;

export function fitPosition(position: Position, floor: Floor): Position {
  const x = Math.max(floor.minX, Math.min(floor.maxX, position.x));
  if (floor.minX === floor.maxX) return { x, facing: position.facing };
  if (x === floor.minX) return { x, facing: 1 };
  if (x === floor.maxX) return { x, facing: -1 };
  return { x, facing: position.facing };
}

export function stepWalk(position: Position, floor: Floor, elapsedMs: number, speed: 'slow' | 'normal'): Position {
  const dt = Math.max(0, Math.min(50, elapsedMs)) / 1000;
  const distance = dt * (speed === 'slow' ? 18 : 30);
  return fitPosition({ x: position.x + position.facing * distance, facing: position.facing }, floor);
}
