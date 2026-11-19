import type { Part, Vec } from './clay';

export type Rig = Partial<Record<Part, DOMMatrix>>;

export function joint(parent: DOMMatrix, at: Vec, pitch = 0, yaw = 0, roll = 0) {
  return parent.translate(...at).rotate(pitch, yaw, roll).translate(-at[0], -at[1], -at[2]);
}
