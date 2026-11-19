import type { Point } from '../core/interaction';

// 입력 속도만 탭 안에서 잠깐 보관한다. 펫 좌표와 클릭 영역은 기울이지 않는다.
export function createGripSway(layer: HTMLElement) {
  let lastX=0, lastAt=0, angle=0, lastPaint=0;
  function tilt(now:number) {
    const age=Math.max(0,now-lastAt);
    return angle * Math.exp(-age/155) * Math.cos(age/160);
  }
  function begin(pointer:Point, origin:Point, now:number) {
    lastX=pointer.x; lastAt=now; angle=0;
    layer.style.transformOrigin=(pointer.x-origin.x)+'px '+(pointer.y-origin.y)+'px';
  }
  function move(x:number, now:number) {
    const dt=Math.max(8,Math.min(64,now-lastAt));
    const target=Math.max(-16,Math.min(16,(x-lastX)/dt*18));
    const mix=1-Math.exp(-dt/36);
    angle=tilt(now)*(1-mix)+target*mix;
    lastX=x; lastAt=now;
  }
  function paint(now:number, active:boolean) {
    const degrees=active ? Math.round(tilt(now)*2)/2 : 0;
    if (lastPaint!==degrees) {
      layer.style.rotate=degrees ? degrees+'deg' : '';
      lastPaint=degrees;
    }
    return active && now-lastAt<650 && Math.abs(angle)>.25 ? now+40 : undefined;
  }
  function end() {
    angle=0; layer.style.transformOrigin=''; paint(0,false);
  }
  return {begin, move, paint, end};
}
