import { t } from '../../../shared/i18n';
export type AnimationName = 'idle' | 'walk' | 'sit' | 'sleep' | 'petted';
export interface SpriteClip {
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  frameCount: number;
  framesPerSecond: number;
  loop: boolean;
}
export interface PetDefinition {
  id: string;
  displayName: string;
  defaultFacing: 'right';
  renderer: 'placeholder' | 'vector' | 'sprite';
  clips: Partial<Record<AnimationName, SpriteClip>>;
  fallbackAnimation: 'idle';
}
type SheetSize = { width: number; height: number };

export function validateDefinition(pet: PetDefinition, bundledSheets: ReadonlyMap<string, SheetSize>) {
  if (pet.renderer === 'sprite' && (!pet.clips.idle || !pet.clips.walk)) return false;
  return Object.values(pet.clips).every(clip => {
    if (!/^\/?pets\/(?:[\w-]+\/)*[\w-]+\.png$/i.test(clip.path)) return false;
    const sheet = bundledSheets.get(clip.path);
    if (!sheet || ![clip.frameWidth, clip.frameHeight, clip.columns, clip.frameCount, sheet.width, sheet.height]
      .every(n => Number.isSafeInteger(n) && n > 0)) return false;
    return sheet.width === clip.columns * clip.frameWidth && sheet.height % clip.frameHeight === 0 &&
      clip.frameCount <= clip.columns * (sheet.height / clip.frameHeight) &&
      Number.isFinite(clip.framesPerSecond) && clip.framesPerSecond > 0 && typeof clip.loop === 'boolean';
  });
}

export function spriteFrame(clip: SpriteClip, index: number, scale: number) {
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isFinite(scale) || scale <= 0)
    throw new RangeError(t('invalidFrame'));
  const frame = clip.loop ? index % clip.frameCount : Math.min(index, clip.frameCount - 1);
  return { x: -(frame % clip.columns) * clip.frameWidth * scale, y: -Math.floor(frame / clip.columns) * clip.frameHeight * scale };
}
