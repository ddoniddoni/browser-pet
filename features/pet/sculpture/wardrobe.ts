import type { Outfit } from '../../../shared/contracts/character';
import { Clay, mark, type Vec } from './clay';

const fleece: Vec=[255,235,200], berry: Vec=[181,63,70], pine: Vec=[65,114,82], gold: Vec=[238,186,85];
// 몸통의 법선 좌표를 옷감의 좌표로 쓴다. 뒷면까지 한 벌로 이어진다.
export function coatPaint(outfit: Outfit, x:number, y:number, z:number, fur:Vec):Vec {
  if (outfit==='none' || y<-.64 || y>.82) return fur;
  if (outfit==='denim') {
    if (y>.27 && !(Math.abs(Math.abs(x)-.46)<.13 && y<.78)) return fur;
    if (z>.5 && mark(Math.abs(x)-.46,y-.2,.1,.1)>.45) return gold;
    if (z>.6 && Math.abs(x)<.33 && y<.05 && y>-.30) return [112,147,161];
    return [82,116,139];
  }
  if (outfit==='santa') {
    if(y<-.47 || (z>.6 && Math.abs(x)<.095)) return fleece;
    if(y>-.21 && y<-.035) return z>.6 && Math.abs(x)<.16?gold:[86,62,57];
    return berry;
  }
  if (outfit==='elf') return y>.32+.12*Math.cos(9*Math.atan2(x,z))?[154,177,116]:pine;
  return Math.abs(y-(.14+.3*Math.abs(x)))<.10?fleece:[169,116,77];
}
export function headwear(m: Clay, outfit: Outfit) {
  if(outfit==='none'||outfit==='denim')return;
  if(outfit==='reindeer'){
    for(const s of [-1,1]) {
      m.tube([[s*.26,2.04,.16],[s*.33,2.25,.13],[s*.32,2.48,.10]],t=>.043*(1-.70*t),()=>[167,116,73],15,10);
      m.tube([[s*.33,2.27,.12],[s*.45,2.34,.10],[s*.49,2.43,.12]],t=>.032*(1-.78*t),()=>[167,116,73],12,10);
    }
    m.egg([0,2.032,.12],[.4,.085,.31],berry); return;
  }
  const santa=outfit==='santa', sign=santa?1:-1;
  m.grid(32,18,(u,v)=>{
    const a=u*Math.PI*2, r=(1-v)**.85, dx=sign*.30*v*v;
    return [dx+.36*r*Math.sin(a),2.045+.39*v-.13*v**4,.10+.30*r*Math.cos(a),
      .86*Math.sin(a),.48,.86*Math.cos(a),...(santa?berry:pine)];
  });
  m.egg([0,2.042,.1],[.38,.085,.322],santa?fleece:berry);
  m.egg([sign*.30,2.31,.10],[.077,.085,.078],santa?fleece:gold);
}
