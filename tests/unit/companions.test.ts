import { afterEach, describe, expect, it, vi } from 'vitest';
import { adoptCompanions, projectCompanion } from '../../shared/contracts/companions';
import { createPetState, isPetState, isSharedScene } from '../../shared/contracts/state';
import { envelope, getState, parseCommand, type Mutation, type SceneAction } from '../../shared/contracts/commands';
import { backupFile, readBackup } from '../../shared/contracts/backup';
import { maxWalkPathPoints } from '../../shared/contracts/walk-path';
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

describe('다락방에서 시작한 산책길', () => {
  const points = [{ x: 0, y: .2 }, { x: 1, y: .2 }, { x: 1, y: .8 }];
  afterEach(() => vi.restoreAllMocks());

  it('팝업에서만 시작하며 경로와 백업 좌표를 같은 기준으로 검사한다', () => {
    const payload = { speciesId: 'kkogit', points };
    const message = { ...envelope, type: 'START_DRAWN_WALK', requestId: 'draw', expectedPetId: 'pet', payload };
    expect(parseCommand(message, 'popup')).toMatchObject({ payload });
    for (const sender of ['content', 'options'] as const)
      expect(parseCommand(message, sender)).toMatchObject({ code: 'FORBIDDEN' });
    const anchor = { kind: 'placed-patrol', ...points[0], at: 123, path: points };
    expect(isSharedScene({ anchor, pettedAt: 0 }, 4)).toBe(true);
    expect(isSharedScene({ anchor: { ...anchor, x: .7 }, pettedAt: 0 }, 4)).toBe(false);
    for (const bad of [[], [points[0]], [points[0], points[0]], [points[0], { x: 2, y: .1 }],
      [points[0], { x: 0, y: NaN }], [points[0], { x: .3, y: .2, z: 1 }],
      Array.from({ length: maxWalkPathPoints + 1 }, (_, i) => ({ x: i % 2, y: 0 }))]) {
      expect(parseCommand({ ...message, payload: { ...payload, points: bad } }, 'popup')).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(isSharedScene({ anchor: { ...anchor, path: bad }, pettedAt: 0 }, 4)).toBe(false);
    }
  });

  it('가운데 친구의 고정 위치를 산책길로 바꾸고 재전송과 백업에서도 출발 시각을 유지한다', async () => {
    const p = profile();
    await p.patch('kkogit', { enabled: true });
    await p.scene('kkogit', { type: 'SCENE_PIN', payload: { x: .1, y: .1 } });
    const walk: Mutation = { ...p.target(), type: 'START_DRAWN_WALK', payload: { speciesId: 'kkogit', points } };
    expect(await p.run(walk)).toMatchObject({ code: 'CONFLICT' });
    await p.send({ ...p.target(), type: 'ATTIC_FOCUS', payload: { id: 'kkogit' } });
    const other = p.read().companions!.nurung;
    await p.send(walk);
    const scene = p.read().companions!.kkogit.scene;
    expect(scene.anchor).toMatchObject({ kind: 'placed-patrol', ...points[0], path: points });
    expect((await p.send(walk)).alreadyApplied).toBe(true);
    expect(p.read().companions!.kkogit.scene).toEqual(scene);
    expect(p.read().companions!.nurung).toEqual(other);
    const backup = readBackup(await backupFile(p.read(), Date.now()).text());
    expect(backup.state.companions!.kkogit.scene).toEqual(scene);
    await p.scene('kkogit', { type: 'SCENE_PIN', payload: { x: .6, y: .2 } });
    expect(p.read().companions!.kkogit.scene.anchor.path).toBeUndefined();
  });

  it('길을 걷다가 속도를 바꾸면 남은 길을 이어가고 동작 줄이기 동안에는 위치를 유지한다', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const p = profile();
    await p.patch('nurung', { enabled: true });
    await p.send({ ...p.target(), type: 'START_DRAWN_WALK', payload: { speciesId: 'nurung', points } });
    clock.mockReturnValue(101_000);
    await p.patch('nurung', { speed: 'slow' });
    const afterSpeed = p.read().scene!.anchor;
    expect(afterSpeed.x).toBeGreaterThan(0);
    expect(afterSpeed.path).toEqual([{ x: afterSpeed.x, y: .2 }, ...points.slice(1)]);
    clock.mockReturnValue(101_500);
    await p.send({ ...p.target(), type: 'SETTINGS_PATCH', payload: { reduceMotion: 'always' } });
    const stopped = p.read().scene!.anchor;
    expect(stopped.x).toBeGreaterThan(afterSpeed.x);
    clock.mockReturnValue(200_000);
    await p.send({ ...p.target(), type: 'SETTINGS_PATCH', payload: { reduceMotion: 'system' } });
    expect(p.read().scene!.anchor).toMatchObject({ x: stopped.x, y: stopped.y, path: stopped.path, at: 200_000 });
  });

  it('제출 직전 공부를 시작하거나 표시를 끈 경우 산책 요청을 다시 적용하지 않는다', async () => {
    const p = profile();
    await p.patch('nurung', { enabled: true });
    const walk: Mutation = { ...p.target(), type: 'START_DRAWN_WALK', payload: { speciesId: 'nurung', points } };
    const original = p.read().scene;
    const start = { ...p.target(), type: 'STUDY_TIMER', payload: { action: 'start', mode: 'focus', minutes: 1 } } as const;
    await p.send(start);
    expect(await p.run(walk)).toMatchObject({ code: 'CONFLICT' });
    const pause = { ...p.target(), type: 'STUDY_TIMER', payload: { action: 'pause', token: start.requestId } } as const;
    await p.send(pause);
    expect(await p.run(walk)).toMatchObject({ code: 'CONFLICT' });
    expect(p.read().scene).toEqual(original);
    await p.send({ ...p.target(), type: 'STUDY_TIMER', payload: { action: 'clear', token: pause.requestId } });
    await p.send({ ...p.target(), type: 'SETTINGS_PATCH', payload: { enabled: false } });
    expect(await p.run(walk)).toMatchObject({ code: 'CONFLICT' });
  });
});
