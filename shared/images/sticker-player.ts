import type { ImageLook, PetAnimation } from '../contracts/image-pet';
import { drawSticker, makeSticker, type Sticker } from './sticker';

export type PreviewStatus = Sticker['background'] | 'error';

// React와 웹페이지가 같은 재생기를 쓴다. 모션과 별개로 GIF 원본 프레임의 표시 시간을 따른다.
export function createStickerPlayer(canvas: HTMLCanvasElement, report?: (status: PreviewStatus) => void) {
  const ctx = canvas.getContext('2d');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frames: Sticker[] = [], ends: number[] = [], total = 0;
  let size = canvas.width, angle = 0, drawn = -1, still = false, visible = false;
  let generation = 0, timer: number | undefined;
  function paint() {
    window.clearTimeout(timer);
    if (!ctx || !frames.length || document.hidden) return;
    const playing = frames.length > 1 && visible && !still && !motion.matches;
    const phase = playing ? Date.now() % total : 0;
    const index = playing ? ends.findIndex(end => end > phase) : 0;
    if (index !== drawn) {
      if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
      drawSticker(ctx, frames[index]!, size, angle);
      drawn = index;
    }
    if (playing) timer = window.setTimeout(paint, Math.max(1, ends[index]! - phase));
  }
  const observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; paint(); });
  observer.observe(canvas);
  motion.addEventListener('change', paint);
  document.addEventListener('visibilitychange', paint);
  return {
    load(image: string, look: ImageLook, animation?: PetAnimation) {
      const ticket = ++generation;
      window.clearTimeout(timer); frames = []; ends = []; drawn = -1;
      void (async () => {
        const first = await makeSticker(image, look);
        if (ticket !== generation) return;
        frames = [first]; paint(); report?.(first.background);
        if (!animation) return;
        const prepared: Sticker[] = [first], deadlines = [animation.firstMs];
        let duration = animation.firstMs;
        for (const frame of animation.frames) {
          if (ticket !== generation) return;
          prepared.push(await makeSticker(frame.image, look));
          duration += frame.ms; deadlines.push(duration);
        }
        if (ticket !== generation) return;
        frames = prepared; ends = deadlines; total = duration; drawn = -1; paint();
      })().catch(() => { if (ticket === generation) report?.('error'); });
    },
    configure(nextSize: number, nextAngle: number, reduce: boolean) {
      if (size === nextSize && angle === nextAngle && still === reduce) return;
      size = nextSize; angle = nextAngle; still = reduce; drawn = -1; paint();
    },
    dispose() {
      generation++; window.clearTimeout(timer); frames = []; observer.disconnect();
      document.removeEventListener('visibilitychange', paint); motion.removeEventListener('change', paint);
    },
  };
}
