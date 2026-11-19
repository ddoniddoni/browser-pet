import { dangleCycle, samplePose } from '../core/action-clock';
import type { Outfit, Scarf } from '../../../shared/contracts/character';
import type { PetSpeciesId } from '../definitions/species';
import { habitMs } from '../core/habit-clock';
import { cardboardBox } from './cardboard';
import { mealMs } from '../core/meal';
import { sculpt } from './model';
import { openBook, playBall, supperDish, windupMouse } from './props';
import { rigFor } from './pose';
import { smooth } from './clay';
import { createRaster } from './raster';

export type Mode = 'still' | 'pose' | 'bedtime' | 'meal';
type Accessory = 'dish' | 'book' | 'ball' | 'mouse' | 'box';
const makers = {dish: supperDish, book: openBook, ball: playBall, mouse: windupMouse, box:cardboardBox};
function propFor(action: string): Accessory | undefined {
  if (action === 'BOX') return 'box';
  if (action === 'EAT') return 'dish';
  if (action === 'READ') return 'book';
  if (action === 'FETCH' || action === 'BAT' || action === 'PLAY_LOOK') return 'ball';
  if (action.startsWith('MOUSE_')) return 'mouse';
}
export interface Miniature {
  id: PetSpeciesId; scarf: Scarf; outfit: Outfit; action: string; yaw: number;
  mode: Mode; still: boolean; startedAt?: number;
}

function exposure(spec: Miniature, age: number, reduced: boolean) {
  let {action, yaw} = spec;
  let index = 0, count = 1, more = false, settle = 1;
  if (!reduced && spec.mode === 'bedtime' && age < 1050) {
    const t = age / 1050;
    if (t < .70) {
      if (spec.id === 'kkogit') { action = 'WALK'; yaw += 360*smooth(t/.70); }
      else if (spec.id === 'nurung') action = 'BAT';
      else action = 'IDLE';
      count = 8; index = Math.floor(t * (spec.id === 'nurung' ? 21 : 12)) % count;
    } else {
      // 자리 잡기 마지막에는 발을 접고 눈을 감는다. 중간 자세도 캐시에 재사용한다.
      settle = Math.floor((t-.70)/.30*4)/4;
    }
    more = true;
  } else if (!reduced && spec.mode === 'pose' && action === 'DRAG') {
    const end = 2 * dangleCycle.frames * dangleCycle.stepMs;
    if (age < end) {
      const frame = samplePose(action,false,age);
      index=frame.index; count=frame.count; more=true;
    }
  } else if (!reduced && (spec.mode === 'pose' || spec.mode === 'meal')) {
    const ms = action === 'HABIT' ? habitMs : action === 'BOX' ? 1600 : action === 'EAT' ? mealMs : action === 'WALK' ? 720 : 1100;
    if (!['IDLE','SIT','SLEEP','PINNED','DRAG','READ'].includes(action) && age < ms) {
      count = action === 'WALK' ? 8 : 14;
      index = Math.min(count-1,Math.floor(age/ms*count)); more = true;
    } else if (action==='HABIT' && age>=ms) {
      action='IDLE';
    }
  }
  // 멈춘 걷기 견본에도 양발의 간격이 보이게 한다.
  if (action === 'WALK' && count === 1) { count = 8; index = 2; }
  return {action, yaw: Math.round(yaw), index, count, more, settle};
}

// 팝업과 설정의 작은 견본끼리만 공유한다. 그림 캐시는 4 MiB, 모형은 최근 세 종류로 제한한다.
const rasters = new Map<string,ReturnType<typeof createRaster>>();
const pictures = new Map<string,ImageData>();
let pictureBytes = 0;
function painter(spec: Miniature, prop: Accessory | undefined, key: string) {
  let draw = rasters.get(key);
  if (draw) rasters.delete(key);
  else {
    const shape = sculpt(spec.id,spec.scarf,spec.outfit,.64);
    draw = createRaster(prop ? shape.withProp(makers[prop]()) : shape);
    if (rasters.size >= 3) rasters.delete(rasters.keys().next().value!);
  }
  rasters.set(key,draw);
  return draw;
}
function paint(ctx: CanvasRenderingContext2D, px: number, spec: Miniature, pose: ReturnType<typeof exposure>) {
  const {action,yaw,index,count,settle} = pose, prop = propFor(spec.action === 'HABIT' ? action : spec.action);
  const shape = [spec.id,spec.outfit,spec.scarf,prop ?? ''].join('/');
  const key = [shape,action,yaw,index,count,settle,px].join(':');
  let image = pictures.get(key);
  if (image) pictures.delete(key);
  else {
    image = ctx.createImageData(px,px);
    const rig = rigFor(spec.id,action,index,count,1,settle);
    if (prop === 'mouse') rig.prop = new DOMMatrix().translate(.32,-.03,1.0).rotate(0,-26,0).scale(.44);
    if (prop === 'ball') rig.prop = new DOMMatrix().translate(.29,action==='FETCH'?1.12:.30,1.0)
      .scale(.21).rotate(0,0,-index*17).translate(0,-1.25,0);
    painter(spec,prop,shape)(image,yaw,rig);
    pictureBytes += image.data.byteLength;
    while (pictureBytes > 4*1024*1024 && pictures.size) {
      const oldest = pictures.keys().next().value!;
      pictureBytes -= pictures.get(oldest)!.data.byteLength; pictures.delete(oldest);
    }
  }
  pictures.set(key,image);
  if (ctx.canvas.width !== px || ctx.canvas.height !== px) ctx.canvas.width = ctx.canvas.height = px;
  ctx.putImageData(image,0,0);
}

// 한 번에 여러 종을 펼쳐도 한 프레임을 모두 미리보기에 쓰지 않는다.
const jobs = new Set<() => void>();
let ticket = 0;
function flush() {
  ticket = 0;
  const start = performance.now();
  while (jobs.size && performance.now()-start < 7) {
    const job = jobs.values().next().value!; jobs.delete(job); job();
  }
  if (jobs.size && !ticket) ticket = requestAnimationFrame(flush);
}
function enqueue(job: () => void) {
  jobs.add(job);
  if (!ticket) ticket = requestAnimationFrame(flush);
}

export function mountMiniature(canvas: HTMLCanvasElement, spec: Miniature, fallback: () => void) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let ctx: CanvasRenderingContext2D | null = null, visible = false, disposed = false;
  let clock: number | undefined, timer: number | undefined;
  function stop() { clearTimeout(timer); jobs.delete(draw); }
  function schedule() {
    stop();
    if (visible && !document.hidden && !disposed) enqueue(draw);
  }
  function draw() {
    if (disposed || !visible || document.hidden || !canvas.clientWidth) return;
    ctx ??= canvas.getContext('2d');
    if (!ctx) { fallback(); return; }
    clock ??= Date.now();
    const pose = exposure(spec,Math.max(0,Date.now()-(spec.startedAt ?? clock)),spec.still || motion.matches);
    const px = Math.max(1,Math.min(256,Math.round(canvas.clientWidth*Math.min(2,devicePixelRatio||1))));
    paint(ctx,px,spec,pose);
    if (pose.more) timer = window.setTimeout(schedule,72);
  }
  const seen = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; schedule(); });
  const resize = new ResizeObserver(schedule);
  seen.observe(canvas); resize.observe(canvas);
  document.addEventListener('visibilitychange',schedule); motion.addEventListener('change',schedule);
  return () => {
    disposed = true; stop(); seen.disconnect(); resize.disconnect();
    document.removeEventListener('visibilitychange',schedule); motion.removeEventListener('change',schedule);
  };
}
