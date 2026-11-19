import { describe, expect, it } from 'vitest';
import { adoptCompanions, projectCompanion } from '../../shared/contracts/companions';
import { createPetState, isPetState } from '../../shared/contracts/state';
import { envelope, getState, parseCommand, type Mutation, type SceneAction } from '../../shared/contracts/commands';
import { createStateWriter } from '../../shared/storage/writer';
import type { PetSpeciesId } from '../../features/pet/definitions/species';

function profile() {
  let state = createPetState();
  const run = createStateWriter({ read: async () => structuredClone(state), write: async next => {
    expect(isPetState(next)).toBe(true);
    state = structuredClone(next);
  } });
  const send = async (command: Mutation) => {
    const reply = await run(command);
    if (!reply.ok) throw Error(reply.code);
    return reply;
  };
  const target = () => ({ expectedPetId: state.pet.id, requestId: crypto.randomUUID() });
  const patch = (id: PetSpeciesId, patch: Extract<Mutation, {type:'COMPANION_PATCH'}>['payload']['patch']) =>
    send({ ...target(), type: 'COMPANION_PATCH', payload: { speciesId: id, patch } });
  const scene = (id: PetSpeciesId, action: SceneAction) =>
    send({ ...target(), type: 'COMPANION_SCENE', payload: { speciesId: id, action } });
  return { run, send, target, patch, scene, read: () => state };
}

describe('웹페이지의 세 친구', () => {
  it('한 친구의 기존 위치와 옷을 가져오고 보관한 이름과 돌봄을 보존한다', () => {
    const old = createPetState(1000);
    delete old.companions;
    old.scene = { anchor: { kind: 'pin', x: .34, y: .56, at: 2000 }, pettedAt: 1000 };
    old.settings.outfit = 'santa';
    old.restingPets.kkogit = { name: '종이', care: { ...old.care, xp: 19 } };
    const migrated = adoptCompanions(old, 3000);
    expect(migrated.companions?.nurung).toMatchObject({ enabled: true, settings: { outfit: 'santa' }, scene: old.scene });
    expect(migrated.companions?.kkogit.enabled).toBe(false);
    expect(projectCompanion(migrated, 'kkogit')).toMatchObject({ pet: { name: '종이' }, care: { xp: 19 } });
    expect(adoptCompanions(migrated, 4000)).toBe(migrated);
  });
  it('다른 친구를 켜고 크기를 바꿔도 편집 대상이나 기존 친구의 설정은 바꾸지 않는다', async () => {
    const p = profile(), before = p.read().companions!.nurung;
    await p.patch('kkogit', { enabled: true, sizePx: 96, movement: 'bounce' });
    expect(p.read()).toMatchObject({pet:{speciesId:'nurung'},settings:{enabled:true,sizePx:64}});
    expect(p.read().companions!.nurung).toEqual(before);
    expect(p.read().companions!.kkogit).toMatchObject({enabled:true,movement:'bounce',settings:{sizePx:96}});
  });
  it('각자 끌어 놓은 위치와 먹이 보상이 섞이지 않고 재전송은 중복 적용하지 않는다', async () => {
    const p = profile();
    await p.patch('kkogit', {enabled:true});
    const other = p.read().companions!.nurung.scene, care = p.read().care;
    await p.scene('kkogit', {type:'SCENE_PIN',payload:{x:.2,y:.4}});
    const feed:Mutation={...p.target(),type:'CARE_FEED',fromPage:true,payload:{speciesId:'kkogit'}};
    await p.send(feed);
    const xp=p.read().restingPets.kkogit!.care.xp;
    expect((await p.send(feed)).alreadyApplied).toBe(true);
    expect(p.read().restingPets.kkogit!.care.xp).toBe(xp);
    expect(p.read().care).toEqual(care);
    expect(p.read().companions!.nurung.scene).toEqual(other);
    expect(p.read().companions!.kkogit.scene.anchor).toMatchObject({kind:'pin',x:.2,y:.4});
  });
  it('편집할 친구를 바꿔도 표시 목록과 각 친구의 옷은 유지한다', async () => {
    const p=profile();
    await p.patch('kkogit',{enabled:true,outfit:'santa'});
    await p.send({...p.target(),type:'PET_SELECT_SPECIES',payload:{speciesId:'kkogit'}});
    expect(p.read()).toMatchObject({pet:{speciesId:'kkogit'},settings:{outfit:'santa'}});
    await p.send({...p.target(),type:'PET_SELECT_SPECIES',payload:{speciesId:'nurung'}});
    expect(p.read().settings.outfit).toBeUndefined();
    expect(p.read().companions!.kkogit.enabled).toBe(true);
    expect(p.read().companions!.nurung.enabled).toBe(true);
  });
  it('전체 스위치는 친구 목록을 기억하고 마지막 친구를 끄면 전체도 꺼진다', async () => {
    const p=profile();
    await p.patch('kkogit',{enabled:true});
    await p.send({...p.target(),type:'SETTINGS_PATCH',payload:{enabled:false}});
    expect(p.read().companions!.kkogit.enabled).toBe(true);
    await p.send({...p.target(),type:'SETTINGS_PATCH',payload:{enabled:true}});
    expect(p.read().companions!.kkogit.enabled).toBe(true);
    await p.patch('kkogit',{enabled:false});
    await p.patch('nurung',{enabled:false});
    expect(p.read().settings.enabled).toBe(false);
    await p.send({...p.target(),type:'SETTINGS_PATCH',payload:{enabled:true}});
    expect(p.read().companions!.nurung.enabled).toBe(true);
    expect(p.read().companions!.kkogit.enabled).toBe(false);
    expect(await p.run(getState)).toMatchObject({ok:true,state:{settings:{enabled:true}}});
  });
  it('숨겨진 친구에 대한 페이지 조작과 중첩된 임의 명령은 거부한다', async () => {
    const p=profile();
    await p.send({...p.target(),type:'SETTINGS_PATCH',payload:{enabled:true}});
    expect(await p.run({...p.target(),type:'COMPANION_SCENE',payload:{speciesId:'kkogit',action:{type:'SCENE_PET',payload:{}}}}))
      .toMatchObject({code:'CONFLICT'});
    const wire={...envelope,...p.target(),type:'COMPANION_SCENE',payload:{speciesId:'nurung',action:{type:'RESET_ALL',payload:{}}}};
    expect(parseCommand(wire,'content')).toMatchObject({code:'VALIDATION_ERROR'});
    expect(parseCommand({...wire,payload:{speciesId:'nurung',action:{type:'SCENE_PET',payload:{}}}},'popup')).toMatchObject({code:'FORBIDDEN'});
  });
});
