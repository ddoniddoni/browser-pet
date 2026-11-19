import { clamp, type Clay } from './clay';
import type { Rig } from './pose';

// 두 화면에서 같은 깊이 비교와 조명을 사용한다. 작은 페이지 펫은 완성한 프레임을 캐시한다.
export function createRaster(model: Clay) {
  const {vertices,faces}=model, projected=new Float32Array(vertices.length*6);
  let depth=new Float32Array(0);
  return (buffer: ImageData, yaw:number, rig?:Rig) => {
    const {width,height}=buffer;
    if(depth.length!==width*height) depth=new Float32Array(width*height);
    const pixels=buffer.data, rad=yaw*Math.PI/180,s=Math.sin(rad),c=Math.cos(rad);
    const tilt=.13, a=Math.sin(tilt),b=Math.cos(tilt),scale=height*.338, ground=height*.924;
    pixels.fill(0); depth.fill(-Infinity);
    for(const section of model.sections){
      const mat=rig?.[section.part] ?? (section.part==='earL'||section.part==='earR' ? rig?.head : undefined);
      // 값은 관절마다 한 번만 읽는다. 정적인 팝업에는 항등 변환을 사용한다.
      const xx=mat?.m11??1,xy=mat?.m21??0,xz=mat?.m31??0,tx=mat?.m41??0;
      const yx=mat?.m12??0,yy=mat?.m22??1,yz=mat?.m32??0,ty=mat?.m42??0;
      const zx=mat?.m13??0,zy=mat?.m23??0,zz=mat?.m33??1,tz=mat?.m43??0;
      for(let i=section.start;i<section.end;i++){
        const [vx,vy,vz,ax,ay,az,r,g,blue]=vertices[i]!, j=6*i;
        const x=xx*vx+xy*vy+xz*vz+tx,y=yx*vx+yy*vy+yz*vz+ty,z=zx*vx+zy*vy+zz*vz+tz;
        const nx=xx*ax+xy*ay+xz*az,ny=yx*ax+yy*ay+yz*az,nz=zx*ax+zy*ay+zz*az;
        const forward=z*c-x*s, lightZ=nz*c-nx*s, up=ny*b-lightZ*a;
        projected[j]=width*.5+(x*c+z*s)*scale; projected[j+1]=ground-(y*b-forward*a)*scale;
        projected[j+2]=y*a+forward*b;
        const light=clamp(-(nx*c+nz*s)*.48+up*.75+(lightZ*b+ny*a)*.46,-1,1);
        const shade=.79+.22*light+.058*Math.max(light,0)**6, bounce=.045*clamp(-up);
        projected[j+3]=r*(shade+bounce)+6; projected[j+4]=g*(shade+bounce*.82)+4; projected[j+5]=blue*(shade+.025)+6;
      }
    }
    // 무게중심 좌표로 깊이와 조명을 보간한다. 꼬리가 뒤에 있을 때 몸을 뚫고 보이지 않는다.
    const p=projected;
    for(let i=0;i<faces.length;i+=3){
      const A=faces[i]!*6,B=faces[i+1]!*6,C=faces[i+2]!*6;
      const x=p[A]!,y=p[A+1]!,bx=p[B]!-x,by=p[B+1]!-y,cx=p[C]!-x,cy=p[C+1]!-y,det=bx*cy-by*cx;
      if(Math.abs(det)<.00001)continue;
      const x0=Math.max(0,Math.ceil(Math.min(x,x+bx,x+cx)-.5)), x1=Math.min(width-1,Math.floor(Math.max(x,x+bx,x+cx)-.5));
      const y0=Math.max(0,Math.ceil(Math.min(y,y+by,y+cy)-.5)), y1=Math.min(height-1,Math.floor(Math.max(y,y+by,y+cy)-.5));
      const du=cy/det,dv=-by/det,zu=p[B+2]!-p[A+2]!,zv=p[C+2]!-p[A+2]!;
      for(let row=y0;row<=y1;row++){
        let u=((x0+.5-x)*cy-(row+.5-y)*cx)/det, v=(bx*(row+.5-y)-by*(x0+.5-x))/det;
        for(let col=x0;col<=x1;col++,u+=du,v+=dv){
          if(u<-.00001||v<-.00001||u+v>1.00001) continue;
          const idx=row*width+col,z=p[A+2]!+u*zu+v*zv;
          if(z<=depth[idx]!)continue;
          depth[idx]=z;
          for(let k=0;k<3;k++)pixels[idx*4+k]=p[A+3+k]!*(1-u-v)+p[B+3+k]!*u+p[C+3+k]!*v;
          pixels[idx*4+3]=255;
        }
      }
    }
  };
}
