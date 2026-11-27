import type { Point } from '../../features/pet/core/interaction';
import { isRecord, isUnitCoordinate } from './state';

export const maxWalkPathPoints = 128;
export const paradeIntervalMs = 850;

export interface WalkParade {
  delayMs: number;
  speed: 'slow' | 'normal';
  glide: boolean;
}

export function isWalkPath(value: unknown): value is Point[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > maxWalkPathPoints) return false;
  let previous: Point | undefined;
  for (const point of value) {
    if (!isRecord(point) || Object.keys(point).length !== 2 ||
        !isUnitCoordinate(point.x) || !isUnitCoordinate(point.y)) return false;
    if (previous && previous.x === point.x && previous.y === point.y) return false;
    previous = { x: point.x, y: point.y };
  }
  return true;
}
