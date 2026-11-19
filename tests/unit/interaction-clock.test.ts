import { expect, it, vi } from 'vitest';
import { createPetState, getSharedScene, type PetState } from '../../shared/contracts/state';
import { createStateWriter } from '../../shared/storage/writer';
import { sampleScenePatrol } from '../../features/pet/core/shared-patrol';
import type { SceneAction } from '../../shared/contracts/commands';

it('메뉴에서 보낸 시간은 탭이나 워커가 바뀌어도 산책에 더하지 않는다', async () => {
  const start=20_000, press=start+500, returned=press+90_000;
  const wall=vi.spyOn(Date,'now');
  try {
    let saved:PetState=createPetState(start);
    saved.settings.enabled=true;
    saved.scene={anchor:{kind:'placed-patrol',x:.4,y:.3,at:start},pettedAt:0};
    const storage={read:async()=>structuredClone(saved),write:async(s:PetState)=>{saved=structuredClone(s);}};
    const scene=(at:number)=>sampleScenePatrol(saved.pet.id,getSharedScene(saved).anchor,at,saved.settings.speed,saved.timer);
    const frame=(at:number)=>{const {x,y,facing,action}=scene(at);return {x,y,facing,action};};
    const before=frame(press), next=frame(press+200);
    const send=(op:SceneAction)=>createStateWriter(storage)({...op,requestId:crypto.randomUUID(),expectedPetId:saved.pet.id});
    wall.mockReturnValue(press+4);
    expect(await send({type:'SCENE_HOLD',payload:{anchorAt:start,at:press}})).toMatchObject({ok:true});
    expect(frame(returned)).toEqual(before);
    const token=getSharedScene(saved).anchor.clock!.hold!;
    wall.mockReturnValue(returned);
    expect(await send({type:'SCENE_UNHOLD',payload:{token:'stale'}})).toMatchObject({ok:false});
    expect(await send({type:'SCENE_UNHOLD',payload:{token}})).toMatchObject({ok:true});
    expect(frame(returned)).toEqual(before);
    expect(frame(returned+200)).toEqual(next);
    expect(getSharedScene(saved).anchor).toMatchObject({kind:'placed-patrol',y:.3});
  } finally {wall.mockRestore();}
});

it('공부 타이머와 메뉴가 겹친 시간은 한 번만 제외한다', () => {
  const timer={mode:'focus',token:'study',minutes:1,startedAt:10_500,phase:'running',endsAt:70_500} as const;
  const running={kind:'patrol',x:.8,y:1,at:10_000} as const;
  const atStart=sampleScenePatrol('pet',running,10_500,'normal');
  const held={...running,at:15_000,clock:{elapsed:500,hold:'menu'}};
  const point=({x,y}:{x:number;y:number})=>({x,y});
  expect(point(sampleScenePatrol('pet',held,42_000,'normal',timer))).toEqual(point(atStart));
  const released={...running,at:42_000,clock:{elapsed:500}};
  expect(point(sampleScenePatrol('pet',released,70_500,'normal',timer))).toEqual(point(atStart));
  expect(point(sampleScenePatrol('pet',released,70_900,'normal',timer))).toEqual(point(sampleScenePatrol('pet',running,10_900,'normal')));
});
