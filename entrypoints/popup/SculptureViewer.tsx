import { useEffect, useRef } from 'react';
import { t } from '../../shared/i18n';
import type { Scarf, Outfit } from '../../shared/contracts/character';
import type { PetSpeciesId } from '../../features/pet/definitions/species';
import { sculpt } from '../../features/pet/sculpture/model';
import { createSculptureView } from '../../features/pet/sculpture/render';

const presets = [[0,'sculptFront'],[90,'sculptSide'],[180,'sculptBack']] as const;
export default function SculptureViewer({id, name, scarf, outfit}: {id: PetSpeciesId; name: string; scarf: Scarf; outfit: Outfit}) {
  const canvas=useRef<HTMLCanvasElement>(null), range=useRef<HTMLInputElement>(null), fallback=useRef<HTMLParagraphElement>(null);
  const view=useRef<ReturnType<typeof createSculptureView>>(undefined), angle=useRef(20);
  const drag=useRef<{id:number; x:number; angle:number} | null>(null);
  useEffect(()=>{
    if(!canvas.current) return;
    const current=createSculptureView(canvas.current,sculpt(id,scarf,outfit));
    view.current=current;
    if(fallback.current)fallback.current.hidden=!!current;
    current?.rotate(angle.current);
    return ()=>{ current?.dispose(); view.current=undefined; drag.current=null; };
  },[id,scarf,outfit]);
  function rotate(value:number){
    angle.current=value;
    if(range.current)range.current.value=String(Math.round(value));
    view.current?.rotate(value);
  }
  return <div className="clay-view">
    <canvas ref={canvas} width="312" height="200" role="img" aria-label={t('sculptModel',name)}
      onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return; e.currentTarget.setPointerCapture(e.pointerId);
        drag.current={id:e.pointerId,x:e.clientX,angle:angle.current};}}
      onPointerMove={e=>{const start=drag.current;if(start?.id!==e.pointerId||!start)return;
        rotate(((start.angle+(e.clientX-start.x)*1.15)%360+360)%360);}}
      onPointerUp={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} />
    <p className="clay-error" ref={fallback} hidden role="status">{t('sculptError')}</p>
    <div className="clay-tools">
      <p>{t('sculptHint')}</p>
      <div className="clay-angles">
        {presets.map(([value,key])=><button key={value} type="button" onClick={()=>rotate(value)}>{t(key)}</button>)}
        <input type="range" ref={range} min="0" max="360" defaultValue="20" aria-label={t('sculptAngle')}
          onChange={e=>rotate(Number(e.currentTarget.value))}/>
      </div>
    </div>
  </div>;
}
