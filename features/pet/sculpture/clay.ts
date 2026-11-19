export type Vec = [number, number, number];
export type Vertex = [...Vec, ...Vec, ...Vec]; // 위치, 표면 법선, 재료색
export type Paint = Vec | ((x: number, y: number, z: number) => Vec);
export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const blend = (a: Vec, b: Vec, t: number): Vec =>
  [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
export const smooth = (x: number) => { const t = clamp(x); return t*t*(3-2*t); };
export const mark = (x: number, y: number, w: number, h: number) => smooth((1-(x/w)**2-(y/h)**2)*4+.5);
function unit(x: number, y: number, z: number): Vec {
  const len = Math.hypot(x,y,z) || 1;
  return [x/len,y/len,z/len];
}
const tau = Math.PI*2;
export type Part = 'body' | 'head' | 'eyes' | 'tail' | 'foreL' | 'foreR' | 'hindL' | 'hindR'
  | 'earL' | 'earR' | 'prop' | 'key' | 'frontWheel' | 'rearWheel';
export class Clay {
  part: Part = 'body';
  readonly sections: { part: Part; start: number; end: number }[] = [];
  constructor(private readonly detail = 1) {}
  vertices: Vertex[] = [];
  faces: number[] = [];
  withProp(prop: Clay) {
    const scene = new Clay(), offset = this.vertices.length;
    scene.vertices = this.vertices.concat(prop.vertices);
    scene.faces = this.faces.concat(prop.faces.map(i => i + offset));
    scene.sections.push(...this.sections, { part: 'prop', start: offset, end: scene.vertices.length });
    return scene;
  }
  grid(m: number, n: number, paint: (u: number, v: number) => Vertex) {
    m=Math.max(6,Math.round(m*this.detail)); n=Math.max(4,Math.round(n*this.detail));
    const offset = this.vertices.length, end=offset+(m+1)*(n+1);
    const last=this.sections.at(-1);
    if(last?.part===this.part) last.end=end;
    else this.sections.push({part:this.part,start:offset,end});
    for (let j=0;j<=n;j++) for(let i=0;i<=m;i++) this.vertices.push(paint(i/m,j/n));
    for (let j=0;j<n;j++) for(let i=0;i<m;i++) {
      const k=offset+j*(m+1)+i;
      this.faces.push(k,k+1,k+m+1,k+1,k+m+2,k+m+1);
    }
  }
  egg(p: Vec, s: Vec, color: Paint, m=24, n=16, tilt=0) {
    const a=Math.cos(tilt), b=Math.sin(tilt);
    this.grid(m,n,(u,v)=>{
      const phi=Math.PI*v, x=Math.sin(phi)*Math.sin(tau*u), y=Math.cos(phi), z=Math.sin(phi)*Math.cos(tau*u);
      const [nx,ny,nz]=unit(x/s[0],y/s[1],z/s[2]);
      return [p[0]+a*x*s[0]-b*y*s[1],p[1]+b*x*s[0]+a*y*s[1],p[2]+z*s[2],a*nx-b*ny,b*nx+a*ny,nz,
        ...(typeof color==='function'?color(x,y,z):color)];
    });
  }
  ear(side: number, color: Vec, inner: Vec) {
    this.grid(38,24,(u,h)=>{
      const a=tau*u, taper=(1-h)**.72+.009, sn=Math.sin(a), cs=Math.cos(a);
      return [side*(.418+.144*h)+.278*taper*sn,1.912+.534*h,.045-.05*h+.186*taper*cs,
        ...unit(sn/.278,.83,cs/.186),...blend(color,inner,smooth((cs-(.27+.38*h))*7)*smooth((h-.105)*14)*smooth((.8-h)*14))];
    });
  }
  // 평면을 돌리지 않고, 경로에 수직인 단면을 이어 꼬리와 수염을 만든다.
  tube(points: Vec[], radius: (t: number)=>number, paint: (t: number)=>Vec, steps=40, sides=15) {
    function curve(t: number): Vec {
      const end=points.length-1, i=Math.min(end-1,Math.floor(t*end)), q=t*end-i;
      const a=points[Math.max(0,i-1)]!, b=points[i]!, c=points[i+1]!, d=points[Math.min(end,i+2)]!;
      const at=(k: number)=>.5*(2*b[k]!+(-a[k]!+c[k]!)*q+(2*a[k]!-5*b[k]!+4*c[k]!-d[k]!)*q*q+(-a[k]!+3*b[k]!-3*c[k]!+d[k]!)*q*q*q);
      return [at(0),at(1),at(2)];
    }
    this.grid(sides,steps,(u,t)=>{
      const p=curve(t),lo=curve(clamp(t-.0001)),hi=curve(clamp(t+.0001));
      const [x,y,z]=unit(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]);
      const [a,b,c]=Math.abs(z)>.98?unit(-z,0,x):unit(y,-x,0);
      const cs=Math.cos(u*tau),sn=Math.sin(u*tau),r=radius(t);
      const n:Vec=[a*cs+(y*c-z*b)*sn,b*cs+(z*a-x*c)*sn,c*cs+(x*b-y*a)*sn];
      return [p[0]+r*n[0],p[1]+r*n[1],p[2]+r*n[2],...n,...paint(t)];
    });
  }
}
