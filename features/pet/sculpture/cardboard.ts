import { Clay, blend, type Vec } from './clay';

export function pebble() {
  const m=new Clay(.8);
  m.egg([0,0,0],[.17,.12,.13],(x,y,z)=>blend([82,107,109],[210,202,172],
    Math.max(0,1-Math.abs(y+.28*x-.22*z)*5)),22,16,-.28);
  return m;
}

export function cardboardBox() {
  const m=new Clay(), kraft:Vec=[190,140,90], side:Vec=[171,119,76], edge:Vec=[230,192,141];
  const inside:Vec=[139,94,62], tape:Vec=[225,193,144], stamp:Vec=[127,88,57];
  const w=.83,d=.83,h=1.28, lip=.035;
  // 시작점과 두 변으로 면 한 장을 만든다. 안쪽 벽과 골판지의 얇은 절단면도 따로 그린다.
  function panel(p:Vec,a:Vec,b:Vec,n:Vec, color:Vec|((u:number,v:number)=>Vec), steps=1) {
    m.grid(steps,Math.max(1,Math.round(steps*.55)),(u,v)=>[
      p[0]+u*a[0]+v*b[0],p[1]+u*a[1]+v*b[1],p[2]+u*a[2]+v*b[2],...n,
      ...(typeof color==='function'?color(u,v):color)]);
  }
  const across:Vec=[2*w,0,0], up:Vec=[0,h,0], deep:Vec=[0,0,2*d];
  for(const k of [-1,1]) {
    panel([-w,0,k*d],across,up,[0,0,k], k<0?side:(u,v)=>{
      if(u>.46 && u<.55 && v<.38)return tape;
      const dx=Math.abs(u-.19);
      if(v>.20 && v<.44 && (dx<.012 || (v>.34 && dx<(.45-v)*.60)))return stamp;
      return kraft;
    },k<0?6:44);
    panel([-w,0,k*(d-lip)],across,up,[0,0,-k],inside);
    panel([-w,h,k*d],across,[0,0,-k*lip],[0,1,0],edge);
    panel([k*w,0,-d],deep,up,[k,0,0],side);
    panel([k*(w-lip),0,-d],deep,up,[-k,0,0],inside);
    panel([k*w,h,-d],deep,[-k*lip,0,0],[0,1,0],edge);
    // 측면 덮개가 바깥으로 살짝 접혀 열린 입구가 보인다.
    panel([k*w,h,-d+.04],[0,0,2*d-.08],[k*.19,-.14,0],[k*.59,.81,0],kraft);
  }
  panel([-w,.02,-d],across,deep,[0,1,0],inside);
  return m;
}
