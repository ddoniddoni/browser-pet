import { isRecord } from './state';

export type AccessorySlot = 'head' | 'neck';
export interface Placement { x: number; y: number; width: number; angle: number }

// 실제 그림과 편집 손잡이가 같은 폭 100의 좌표계를 쓴다.
export const accessoryCatalog = {
  santaHat: { slot: 'head', height: 72, start: { x: 50, y: 23, width: 40, angle: 0 } },
  apricotBow: { slot: 'head', height: 69, start: { x: 65, y: 32, width: 31, angle: 12 } },
  sproutClip: { slot: 'head', height: 82, start: { x: 44, y: 24, width: 29, angle: -8 } },
  starBandana: { slot: 'neck', height: 68, start: { x: 50, y: 66, width: 46, angle: 0 } },
  bellCollar: { slot: 'neck', height: 61, start: { x: 50, y: 67, width: 42, angle: 0 } },
} as const;
export type AccessoryKind = keyof typeof accessoryCatalog;
export const accessoryKinds = Object.keys(accessoryCatalog) as AccessoryKind[];
export const accessorySlots = ['head', 'neck'] as const;
export const widthRange = { min: 18, max: 72 };
export const angleLimit = 75;
export interface PhotoAccessory extends Placement { kind: AccessoryKind }
export type PhotoOutfit = Partial<Record<AccessorySlot, PhotoAccessory>>;
export type OutfitPatch = Partial<Record<AccessorySlot, PhotoAccessory | null>>;

const between = (n: unknown, min: number, max: number) =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
function placementInRange(v: Record<string, unknown>) {
  return between(v.x, 0, 100) && between(v.y, 0, 100) &&
    between(v.width, widthRange.min, widthRange.max) && between(v.angle, -angleLimit, angleLimit);
}
export function validLegacyHat(v: unknown): v is Placement {
  return isRecord(v) && Object.keys(v).length === 4 && placementInRange(v);
}
function validOutfitEntries(v: unknown, allowRemoval: boolean) {
  if (!isRecord(v)) return false;
  const entries = Object.entries(v);
  return entries.length > 0 && entries.every(([slot, piece]) =>
    (slot === 'head' || slot === 'neck') && (piece === null ? allowRemoval :
      isRecord(piece) && Object.keys(piece).length === 5 && placementInRange(piece) &&
      accessoryKinds.some(kind => kind === piece.kind && accessoryCatalog[kind].slot === slot)));
}
export function validPhotoOutfit(v: unknown): v is PhotoOutfit { return validOutfitEntries(v, false); }
export function validOutfitPatch(v: unknown): v is OutfitPatch { return validOutfitEntries(v, true); }

// 첫 옷장에서 저장한 산타 모자는 다른 장식을 편집할 때 새 형식으로 함께 저장한다.
export function photoOutfit(pet?: { accessories?: PhotoOutfit; hat?: Placement }): PhotoOutfit | undefined {
  return pet?.accessories ?? (pet?.hat && { head: { ...pet.hat, kind: 'santaHat' } });
}
export function applyOutfitPatch(current: PhotoOutfit | undefined, patch: OutfitPatch): PhotoOutfit {
  const next = { ...current };
  for (const slot of accessorySlots) {
    const piece = patch[slot];
    if (piece === null) delete next[slot];
    else if (piece) next[slot] = piece;
  }
  return next;
}
export function samePiece(a?: PhotoAccessory, b?: PhotoAccessory) {
  return a === b || (!!a && !!b && a.kind === b.kind && a.x === b.x && a.y === b.y && a.width === b.width && a.angle === b.angle);
}
export function sameOutfit(a?: PhotoOutfit, b?: PhotoOutfit) {
  return a === b || (samePiece(a?.head, b?.head) && samePiece(a?.neck, b?.neck));
}
