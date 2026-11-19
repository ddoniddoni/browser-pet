import type { Clay } from './clay';
import { createRaster } from './raster';

// 팝업이 열려 있고 각도 또는 크기가 바뀔 때만 그린다. WebGL 사용 여부에 의존하지 않는다.
export function createSculptureView(canvas: HTMLCanvasElement, model: Clay) {
  const ctx=canvas.getContext('2d');
  if (!ctx) return;
  const raster=createRaster(model);
  let buffer: ImageData | undefined;
  function draw(yaw: number) {
    if (!ctx) return;
    const width=Math.max(1,Math.min(540,Math.round(canvas.clientWidth*Math.min(window.devicePixelRatio,1.6))));
    const height=Math.max(1,Math.round(width/1.56));
    if (!buffer || buffer.width!==width) {
      canvas.width=width; canvas.height=height;
      buffer=ctx.createImageData(width,height);
    }
    raster(buffer,yaw);
    ctx.putImageData(buffer,0,0);
  }
  let angle=20, frame=0;
  function invalidate(next=angle) {
    angle=next;
    if(!frame) frame=requestAnimationFrame(()=>{frame=0; draw(angle);});
  }
  const observer=new ResizeObserver(()=>invalidate());
  observer.observe(canvas);
  invalidate();
  return { rotate:invalidate, dispose(){ observer.disconnect(); cancelAnimationFrame(frame); } };
}
