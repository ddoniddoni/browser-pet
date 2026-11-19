import { sameAnimation, type ImageLook, type PetAnimation } from '../../../shared/contracts/image-pet';
import { createStickerPlayer } from '../../../shared/images/sticker-player';

export function createPageImage(parent: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pet-avatar pet-uploaded';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = canvas.height = 192;
  parent.append(canvas);
  const player = createStickerPlayer(canvas);
  let source = '', look: ImageLook | undefined, sequence: PetAnimation | undefined;
  return {
    dress(image: string, nextLook: ImageLook, animation?: PetAnimation) {
      if (source === image && look?.cutout === nextLook.cutout && look.relief === nextLook.relief && sameAnimation(sequence, animation)) return;
      source = image; look = nextLook; sequence = animation;
      player.load(image, nextLook, animation);
    },
    paint(size: number, tilt: number, reduced: boolean) {
      const pixels = Math.max(1, Math.min(192, Math.round(size * Math.min(2, devicePixelRatio || 1))));
      player.configure(pixels, look?.relief ? tilt : 0, reduced);
    },
    dispose() { player.dispose(); canvas.remove(); },
  };
}
