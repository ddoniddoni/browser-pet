import type { Facing } from '../core/patrol';
import { createRaster } from './raster';
import { joint, type Rig } from './pose';
import { axleY, ballCenter, frontX, playBall, rearX, spindle, windupMouse } from './props';

type Toy = 'mouse' | 'ball';
function toyPainter(host: HTMLElement, toy: Toy) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) return;
  const raster = createRaster(toy === 'mouse' ? windupMouse() : playBall());
  canvas.setAttribute('aria-hidden','true');
  host.replaceChildren(canvas);
  host.classList.add('pet-clay-toy');
  const cache = new Map<number, ImageData>(), axis = new DOMMatrix();
  let width = 0, drawn = -1;
  return (size: number, facing: Facing, roll: number) => {
    const pixels = Math.max(1,Math.min(96,Math.round(size*Math.min(2,window.devicePixelRatio || 1))));
    if (pixels !== width) {
      canvas.height = canvas.width = width = pixels;
      drawn = -1; cache.clear();
    }
    const slices = 16, phase = ((Math.round(roll*slices)%slices)+slices)%slices;
    const key = phase+(facing === 1 ? 0 : slices);
    if (drawn === key) return;
    let image = cache.get(key);
    if (!image) {
      const angle = 360*phase/slices;
      const rig: Rig = toy === 'mouse' ? {
        key: joint(axis,spindle,0,angle,0),
        rearWheel: joint(axis,[rearX,axleY,0],0,0,-angle*2),
        frontWheel: joint(axis,[frontX,axleY,0],0,0,-angle*2),
      } : { body: joint(axis,ballCenter,0,0,-angle) };
      image = ctx.createImageData(width,width);
      raster(image,toy === 'ball' ? 0 : facing === 1 ? -17 : 197,rig);
      cache.set(key,image);
    }
    ctx.putImageData(image,0,0); drawn = key;
  };
}

export function createPageToys(hosts: Record<Toy,HTMLElement>) {
  const painters = new Map<Toy, ReturnType<typeof toyPainter>>();
  return (toy: Toy, size: number, facing: Facing, roll: number) => {
    if (!painters.has(toy)) painters.set(toy,toyPainter(hosts[toy],toy));
    const paint = painters.get(toy);
    paint?.(size,facing,roll);
    return !!paint;
  };
}
