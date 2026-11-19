import { getPetDefinition, type PetSpeciesId } from '../definitions/species';
import type { Scarf, Outfit } from '../../../shared/contracts/character';
import { coatPaint, headwear } from './wardrobe';
import { Clay, blend, mark, smooth, type Vec } from './clay';

const milk:Vec=[255,230,184], buff:Vec=[237,191,130], chestnut:Vec=[184,110,63], ink:Vec=[64,43,35];
const honey:Vec=[226,168,98], toast:Vec=[146,91,56], teal:Vec=[95,139,136], bill:Vec=[238,158,63];
const sole:Vec=[160,97,39], rubber:Vec=[220,156,54], pads:Vec=[196,134,109];
const fabrics:Record<Exclude<Scarf,'none'>,Vec>={leaf:[84,138,114],berry:[171,83,98],sky:[96,147,182]};

function stroke(m:Clay,pts:Vec[],r:number,c:Vec) {
  m.tube(pts,t=>r*(.18+.82*Math.sin(Math.PI*t)**.36),()=>c,16,8);
}
function panel(m:Clay,a:Vec,b:Vec,c:Vec,color:Vec) {
  const u=b.map((x,i)=>x-a[i]!),v=c.map((x,i)=>x-a[i]!);
  const n:Vec=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!];
  const len=Math.hypot(...n)||1;
  // grid는 같은 평면의 두 삼각형을 양면에서 그린다. 앞면 법선은 카메라 쪽이다.
  m.grid(1,1,(s,t)=>[a[0]+u[0]!*s+v[0]!*t*(1-s),a[1]+u[1]!*s+v[1]!*t*(1-s),a[2]+u[2]!*s+v[2]!*t*(1-s),
    n[0]/len,n[1]/len,n[2]/len,...color]);
}
function fanTail(m:Clay) {
  const root:Vec=[-.20,.37,-.48], ribs:Vec[]=[];
  for(let i=0;i<=8;i++){
    const a=(-100+i*16)*Math.PI/180,r=i%2===0?1.12:1.02;
    ribs.push([root[0]+Math.sin(a)*r,root[1]+.35+Math.cos(a)*1.17*r,root[2]+(i%2?.16:-.11)]);
  }
  for(let i=0;i<8;i++){
    const a=ribs[i]!,b=ribs[i+1]!, shade=i%2?buff:[246,207,154] as Vec;
    panel(m,root,a,b,shade);
    if(i%2) stroke(m,[root,[(root[0]+a[0])*.5,(root[1]+a[1])*.5,(root[2]+a[2])*.5+.018],a],.016,buff);
    const back=(p:Vec):Vec=>[p[0],p[1],p[2]-.105];
    panel(m,back(root),back(b),back(a),shade);
    panel(m,a,back(a),b,buff);panel(m,b,back(a),back(b),buff);
  }
}
function envelope(m:Clay) {
  const a:Vec=[-.27,.68,.56],b:Vec=[.26,.70,.56],c:Vec=[.25,1.02,.54],d:Vec=[-.28,1.00,.54];
  panel(m,a,b,c,[249,199,131]);panel(m,a,c,d,[249,199,131]);
  stroke(m,[d,[0,.79,.58],c],.014,[169,109,69]);
}
function bodyPaint(outfit:Outfit,coat:Vec,dog:boolean,bird:boolean){
  return (x:number,y:number,z:number)=>{
    const ground=dog ? blend(coat,toast,mark(x+.1,y-.55,.91,.92)*smooth((.48-z)*4)) :
      blend(coat,milk,mark(x,y+.12,.80,1.07)*smooth((z-.06)*4));
    return coatPaint(outfit,x,y,z,bird?blend(ground,milk,smooth((z-.25)*3)):ground);
  };
}
export function sculpt(stored:PetSpeciesId,scarf:Scarf,outfit:Outfit='none',detail=1) {
  const id=getPetDefinition(stored).id, dog=id==='nurung', bird=id==='pongdang';
  const m=new Clay(detail),coat=dog?honey:bird?teal:chestnut;
  const hy=dog?.91:1.53,hz=dog?.50:.10;
  m.egg([0,dog?.49:.72,dog?-.24:-.10],dog?[.735,.425,.88]:bird?[.56,.68,.50]:[.52,.63,.46],bodyPaint(outfit,coat,dog,bird),40,32);
  m.part='tail';
  if(id==='kkogit') fanTail(m);
  else if(dog) m.egg([.37,.68,-.87],[.17,.17,.21],milk);
  else m.egg([0,.55,-.56],[.22,.15,.25],teal,24,17,-.18);
  for(const k of [-1,1]){
    m.part=k<0?'hindL':'hindR';
    if(bird && k===1){
      // 한쪽 장화: 튀어나온 부리코, 원통형 목, 두꺼운 굽과 접힌 입구.
      m.egg([.48,.175,.34],[.285,.172,.363],rubber);
      m.grid(34,12,(u,v)=>{
        const sn=Math.sin(2*Math.PI*u),cs=Math.cos(2*Math.PI*u),r=.167+.052*v;
        return [.485+r*sn,.14+.40*v,.11+r*cs,sn,0,cs,...(v>.76?blend(rubber,sole,.25):rubber)];
      });
      m.egg([.485,.536,.11],[.227,.043,.219],rubber);
      m.egg([.485,.558,.11],[.166,.020,.161],sole);
      m.egg([.48,.059,.327],[.292,.053,.375],sole);
      m.egg([.465,.565,.10],[.09,.12,.09],bill);
    }else if(bird) m.egg([-.26,.094,.12],[.166,.076,.23],bill);
    else{
      const x=k*(dog?.51:.34),z=dog?-.48:.05;
      m.egg([x,dog?.28:.27,z],[dog?.22:.20,.23,dog?.28:.23],coat);
      m.egg([x,.15,z+.10],[.205,.145,.23],(a,b,c)=>{
        const pad=Math.max(mark(a,c+.16,.47,.42),mark(a-.44,c-.36,.2,.2),mark(a,c-.52,.18,.2),mark(a+.44,c-.36,.2,.2));
        return blend(milk,pads,pad*smooth((-b-.2)*5));
      });
    }
    m.part=k<0?'foreL':'foreR';
    if(bird) {
      m.egg([k*.47,.82,-.06],[.17,.36,.20],teal,28,18,k*.27);
      m.egg([k*.54,.65,.03],[.11,.205,.13],teal,18,14,k*.5);
    }else if(dog) {
      m.egg([k*.32,.23,.57],[.205,.205,.29],honey);
      m.egg([k*.32,.146,.68],[.192,.135,.21],milk);
    }else {
      m.egg([k*.30,.78,.34],[.123,.23,.14],coat,24,18,-k*.45);
      m.egg([k*.24,.83,.544],[.104,.102,.09],buff);
    }
  }
  if(id==='kkogit'){m.part='body';envelope(m);}
  m.part='head';
  m.egg([0,hy,hz],dog?[.69,.49,.54]:bird?[.616,.51,.52]:[.63,.57,.51],(x,y,z)=>{
    const face=bird?smooth((z+.26)*2.8)*smooth((.41-y-.29*Math.abs(x)+.10*x)*6):
      dog?mark(x+.03,y+.36,.71,.72)*smooth(z*4):mark(Math.abs(x)-.29,y+.12,.42,.47)*smooth((z-.12)*5);
    return blend(coat,milk,face);
  },52,36);
  for(const k of [-1,1]){
    if(dog){
      m.part=k<0?'earL':'earR';
      // 한 덩어리의 귀가 이불처럼 옆으로 퍼진다. 겹친 구체의 이음매를 만들지 않는다.
      m.grid(32,33,(u,v)=>{
        const a=u*2*Math.PI, sn=Math.sin(a),cs=Math.cos(a),base=Math.sin(v*Math.PI)**.52;
        const low=smooth((v-.53)/.45), width=(.146+.19*low)*base;
        const x=k*(.55+.34*low)+sn*width, y=1.29-1.17*v, z=.44+.105*low+cs*(.19+.06*low)*base;
        return [x,y,z,sn*.92,.36-.74*v,cs*.91,...blend(honey,toast,.27*(1-v)+.18*low*smooth(-cs*3))];
      });
    }else if(!bird){
      if(k<0)m.egg([-.32,2.048,.025],[.16,.285,.125],coat,26,20,-.33);
      else {m.egg([.24,2.07,.04],[.144,.266,.135],coat,26,20,-.37);m.egg([.363,2.235,.069],[.141,.113,.121],coat,24,18,-.55);}
    }
    const x=k*(dog?.25:.224),y=hy+(dog?.065:.04),z=hz+(dog?.497:.467);
    m.part='eyes';
    m.egg([x,y,z],[dog?.065:.057,dog?.052:.082,.038],ink,22,18,-k*.10);
    m.egg([x-.013,y+.021,z+.034],[.012,.014,.007],milk,10,8);
    m.part='head';
    // 64px에서도 읽히는 비대칭 눈썹. 누룽은 졸린 눈꺼풀이 살짝 내려온다.
    if(dog) m.egg([x,y+.045,z+.029],[.073,.020,.018],honey,18,12,k*-.23);
    stroke(m,[[x-.08,y+(k<0?.165:.12),z-.028],[x,y+(k<0?.175:.147),z+.003],[x+.077,y+(k<0?.14:.175),z-.028]],.024,dog?toast:ink);
  }
  if(bird){
    m.egg([0,hy-.143,hz+.472],[.252,.061,.228],sole,28,16);
    m.egg([0,hy-.113,hz+.496],[.275,.078,.237],bill,32,20);
    for(const side of [-1,1])m.egg([side*.080,hy-.048,hz+.571],[.015,.012,.017],sole,12,8);
    m.egg([-.087,2.045,-.012],[.075,.169,.12],teal,22,16,.68);
    m.egg([.036,2.07,-.034],[.068,.125,.105],teal,20,16,-.34);
  }else{
    for(const k of [-1,1])m.egg([k*.093,hy-.13,hz+.474],[.143,.105,.12],milk);
    m.egg([0,hy-.065,hz+.585],dog?[.105,.070,.063]:[.062,.045,.045],ink);
    stroke(m,[[0,hy-.12,hz+.581],[0,hy-.17,hz+.586],[.044,hy-.195,hz+.572]],.014,ink);
  }
  const start=m.vertices.length;
  headwear(m,outfit);
  if(dog)for(const v of m.vertices.slice(start)){v[1]-=.675;v[2]+=.382;}
  if(scarf!=='none'){
    m.part='body'; const col=fabrics[scarf],cy=dog?.66:1.095,cz=dog?.35:0;
    m.egg([0,cy,cz],[.51,.10,.45],col);
    m.egg([.22,cy-.16,cz+.36],[.088,.21,.053],col,22,16,-.35);
  }
  // 마디와 귀 아래에는 옅은 접촉 음영을, 표면에는 고정된 점토 결을 입힌다.
  for(const section of m.sections) for(let i=section.start;i<section.end;i++){
    const v=m.vertices[i]!,grain=Math.sin(v[0]*241+Math.sin(v[1]*73)*7+v[2]*162);
    const shade=.97+.038*v[4]+.019*grain;
    v[6]*=shade; v[7]*=shade; v[8]*=shade;
  }
  return m;
}
