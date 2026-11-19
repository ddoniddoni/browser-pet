import type { Outfit, Scarf } from '../../../shared/contracts/character';
import type { Facing } from '../core/patrol';
import type { PetSpeciesId } from '../definitions/species';
import { sculpt } from './model';
import { rigFor } from './pose';
import { samplePose, type MotionSpan } from '../core/action-clock';
import { openBook, supperDish } from './props';
import { createRaster } from './raster';

const wrap=(n:number)=>((n%360)+360)%360;
const turnMs=420;
function heading(action:string,facing:Facing) {
  if(action==='WALK'||action==='HOP'||action==='FLOAT'||action==='FETCH'||action==='MOUSE_POUNCE')return facing*68;
  if(action==='MOUSE_CROUCH'||action==='PLAY_LOOK')return facing*54;
  if(action==='FIVE_READY'||action==='FIVE_HIT')return facing*14;
  if(action==='SLEEP')return facing*52;
  if(action==='BAT'||action==='MOUSE_NUDGE'||action==='EAT')return facing*42;
  return facing*23;
}
export function createPageFigure(facingNode:HTMLElement) {
  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  if(!ctx)return;
  canvas.setAttribute('aria-hidden','true');
  const skin=document.createElement('span');
  skin.className='pet-avatar pet-clay';
  skin.append(canvas); facingNode.append(skin);
  let shape='', species:PetSpeciesId='nurung', raster:ReturnType<typeof createRaster> | undefined;
  let model: ReturnType<typeof sculpt> | undefined;
  let accessory: { action: string; raster: ReturnType<typeof createRaster> } | undefined;
  let start=0, from=0, delta=0, target:number|undefined, lastFacing:Facing|undefined;
  let drawn='', width=0, liftedAt:number|undefined;
  const frames=new Map<string,ImageData>();
  function angleAt(now:number){
    const t=Math.min(1,Math.max(0,(now-start)/turnMs));
    return from+delta*t*t*(3-2*t);
  }
  return {
    dress(id:PetSpeciesId, scarf:Scarf, outfit:Outfit){
      const key=id+':'+scarf+':'+outfit;
      if(key===shape)return;
      species=id; shape=key;
      model=sculpt(id,scarf,outfit,.52); raster=createRaster(model); accessory=undefined; frames.clear(); drawn='';
    },
    paint(action:string,facing:Facing,reduced:boolean,now:number,size:number,inspect?:number,span?:MotionSpan,walkYaw?:number) {
      if(!raster || !model || size<=0)return;
      const pathHeading=(action==='WALK'||action==='HOP'||action==='FLOAT') ? walkYaw : undefined;
      const aim=inspect??pathHeading??heading(action,facing), manual=inspect!==undefined;
      if(target===undefined||reduced||manual){
        from=aim; delta=0; start=now; target=aim;
      }else if(aim!==target){
        from=angleAt(now);
        const shortest=wrap(aim-from+180)-180;
        const reverse=pathHeading===undefined && lastFacing!==facing && action==='WALK' && Math.abs(shortest)>85;
        // 자유 산책은 진행 방향으로 짧게 돌고, 장난감을 따라 수평으로 돌아설 때는 등을 보인다.
        delta=reverse?shortest-Math.sign(shortest)*360:shortest;
        target=aim; start=now;
      }
      lastFacing=facing;
      const yaw=wrap(Math.round(angleAt(now)/6)*6);
      const pixels=Math.max(1,Math.min(160,Math.round(size*Math.min(2,window.devicePixelRatio||1))));
      if(pixels!==width){width=pixels;canvas.width=canvas.height=width;frames.clear();drawn='';}
      liftedAt=action==='DRAG' ? liftedAt ?? now : undefined;
      const {count,index:phase,nextAt}=samplePose(action,reduced,now,span,liftedAt);
      const key=action+':'+count+':'+phase+':'+yaw+':'+facing;
      if(drawn!==key){
        let image=frames.get(key);
        if(!image){
          image=ctx.createImageData(width,width);
          let draw=raster;
          if(action==='EAT'||action==='READ'){
            if(accessory?.action!==action) {
              const prop=action==='EAT'?supperDish():openBook();
              accessory={action,raster:createRaster(model.withProp(prop))};
            }
            draw=accessory.raster;
          }
          draw(image,yaw,rigFor(species,action,phase,count,facing));
          if(frames.size>=36)frames.delete(frames.keys().next().value!);
        }else frames.delete(key);
        frames.set(key,image); ctx.putImageData(image,0,0); drawn=key;
      }
      // 흔들리지 않는 자세는 다음 행동 전까지 깨우지 않는다.
      const turnWake=!reduced && !manual && delta!==0 && now<start+turnMs?Math.min(now+40,start+turnMs):Infinity;
      const wake=Math.min(turnWake,nextAt);
      return Number.isFinite(wake)?wake:undefined;
    },
    dispose(){frames.clear();raster=undefined;model=undefined;accessory=undefined;skin.remove();}
  };
}
