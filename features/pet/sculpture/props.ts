import { Clay, blend, smooth, type Vec } from './clay';

const teal: Vec = [114,177,161], enamel: Vec = [246,224,171], brass: Vec = [229,166,71];
const walnut: Vec = [100,67,55], coral: Vec = [216,108,81];
const tau = Math.PI * 2;
export const axleY = .56, frontX = .52, rearX = -.55;
export const spindle: Vec = [-.30,1.45,0], ballCenter: Vec = [0,1.25,0];

export function windupMouse() {
  const m = new Clay(.78);
  m.tube([[-.77,.85,0],[-1.15,1.02,-.10],[-1.30,1.26,-.23],[-1.23,1.41,-.28]],
    t => .078-.039*t, () => coral, 18, 10);
  m.egg([-.10,.99,0],[.92,.57,.52],(_,y) => blend(enamel,teal,smooth((y+.34)*12)));
  m.egg([.60,1.08,0],[.58,.41,.42],teal);
  m.egg([1.11,1.02,0],[.16,.14,.17],coral);
  for (const s of [-1,1]) {
    m.egg([.38,1.46,s*.25],[.21,.30,.12],enamel,20,16,-.23);
    m.egg([.38,1.46,s*.34],[.15,.22,.065],coral,18,14,-.23);
    m.egg([.77,1.20,s*.356],[.075,.088,.048],walnut);
  }
  for (const [x,part] of [[rearX,'rearWheel'],[frontX,'frontWheel']] as const) {
    m.part = part;
    for (const s of [-1,1]) {
      m.egg([x,axleY,s*.34],[.255,.255,.13],walnut);
      m.egg([x,axleY,s*.452],[.155,.155,.045],brass);
      m.egg([x+.073,axleY+.063,s*.49],[.047,.047,.027],enamel,14,10);
    }
  }
  m.part = 'key';
  const [cx,cy,cz] = spindle;
  m.egg([cx,cy+.21,cz],[.095,.31,.095],brass);
  for (const s of [-1,1]) {
    const loop: Vec[] = Array.from({length:13},(_,i) => {
      const a=i*tau/12;
      return [cx+s*(.205-.199*Math.cos(a)),cy+.53+.157*Math.sin(a),cz];
    });
    m.tube(loop, () => .069, () => brass, 26, 12);
  }
  return m;
}

export function playBall() {
  const m = new Clay();
  m.egg(ballCenter,[1.29,1.29,1.29],(x,y,z) => {
    const stripe = smooth((.26-Math.abs(y+.42*x))*12);
    return blend(blend(coral,enamel,stripe),teal,smooth((z-.83)*9));
  },32,26);
  return m;
}

// 이 두 소품은 펫과 같은 깊이 버퍼를 쓴다. 돌려 보면 먼 발은 그릇이나 책 뒤로 들어간다.
export function supperDish() {
  const m = new Clay(.82), z = .96;
  const rim = .46;
  m.grid(36,8,(u,v)=>{
    const a=tau*u, r=rim+.065*(1-v);
    return [Math.sin(a)*r,.04+.28*v,z+Math.cos(a)*r,Math.sin(a),.20,Math.cos(a),
      ...(v>.70 ? enamel : coral)];
  });
  m.egg([0,.305,z],[rim,.065,rim],enamel);
  m.egg([0,.328,z],[.39,.04,.39],walnut);
  for (const [x,d] of [[-.15,.10],[.12,.11],[-.024,-.12],[.23,-.10]] as const)
    m.egg([x,.372,z+d],[.10,.068,.085],brass,14,10);
  return m;
}

export function openBook() {
  const m = new Clay(.85);
  for (const s of [-1,1]) {
    const leaf = (x: number,z: number) => .22+.18*Math.sin(x*Math.PI*.82)+.15*(1-z);
    for (const cover of [true,false]) {
      m.grid(18,10,(u,v) => {
        const w = cover ? .59 : .55, d = cover ? .66 : .61;
        const ink = u>.20 && u<.81 && v>.2 && v<.77 && Math.cos(v*5*tau)>.75;
        const color = cover ? teal : ink ? [192,164,125] as Vec : enamel;
        return [s*(u*w+.008),leaf(u,v)-(cover?.044:0),.55+v*d,-s*.30*Math.cos(Math.PI*u),.9,.23,...color];
      });
    }
  }
  return m;
}
