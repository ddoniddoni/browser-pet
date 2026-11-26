import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPetState, isPetState } from '../../shared/contracts/state';
import { decodePetImage, maxPetImageLength, validPetImage, type ImagePetId } from '../../shared/contracts/image-pet';
import { getState, parseCommand, envelope, type Mutation } from '../../shared/contracts/commands';
import { createStateWriter } from '../../shared/storage/writer';
import { announcementCompanion } from '../../shared/contracts/companions';

const image = 'data:image/png;base64,' + readFileSync(new URL('../../public/icon/128.png', import.meta.url)).toString('base64');
const id: ImagePetId = 'image-12345678-1234-1234-1234-123456789abc';
afterEach(() => vi.unstubAllGlobals());
function profile() {
  let state = createPetState();
  const storage = { read: async () => structuredClone(state), write: async (next: typeof state) => {
    expect(isPetState(next)).toBe(true); state = structuredClone(next);
  } };
  const run = createStateWriter(storage);
  const target = () => ({ expectedPetId: state.pet.id, requestId: crypto.randomUUID() });
  const add: Mutation = { ...target(), type: 'IMAGE_PET_ADD', payload: { id, name: '내 친구', image } };
  const send = async (cmd: Mutation) => { const reply = await run(cmd); if (!reply.ok) throw Error(reply.code); return reply; };
  return { storage, run, send, target, add, read: () => state };
}
function decoder() {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 128, height: 128, close })));
  return close;
}

describe('로컬 이미지 펫 등록', () => {
  it('외부 URL과 SVG, 잘못된 PNG 및 용량 초과를 거부한다', async () => {
    expect(validPetImage(image)).toBe(true);
    for (const invalid of ['https://example.com/a.png', 'data:image/svg+xml,<svg/>', 'data:image/png;base64,AAAA', 'x'.repeat(maxPetImageLength+1)])
      expect(validPetImage(invalid)).toBe(false);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw Error('corrupt'); }));
    await expect(decodePetImage(image)).rejects.toThrow();
  });
  it('등록 응답을 재전송해도 한 마리만 저장하고 워커 재시작 뒤 복원한다', async () => {
    const close = decoder(), p = profile(), native = p.read().care;
    await p.send(p.add);
    expect((await p.send(p.add)).alreadyApplied).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(Object.keys(p.read().imagePets!)).toEqual([id]);
    expect(p.read().care).toEqual(native);
    expect(await createStateWriter(p.storage)(getState)).toMatchObject({ok:true,state:{imagePets:{[id]:{name:'내 친구',image}}}});
  });
  it('이미지 펫의 이동과 돌봄을 분리하고 삭제 후 늦은 요청으로 되살리지 않는다', async () => {
    decoder(); const p=profile(); await p.send(p.add);
    const native = p.read().companions;
    await p.send({...p.target(),type:'COMPANION_SCENE',payload:{speciesId:id,action:{type:'SCENE_PIN',payload:{x:.3,y:.6}}}});
    await p.send({...p.target(),type:'CARE_FEED',fromPage:true,payload:{speciesId:id}});
    await p.send({...p.target(),type:'IMAGE_PET_RENAME',payload:{id,name:'우리 친구'}});
    expect(p.read().imagePets![id]).toMatchObject({name:'우리 친구',care:{xp:5},companion:{scene:{anchor:{kind:'pin',x:.3,y:.6}}}});
    expect(p.read().companions).toEqual(native);
    await p.send({...p.target(),type:'IMAGE_PET_REMOVE',payload:{id}});
    expect(await p.run({...p.target(),type:'CARE_FEED',fromPage:true,payload:{speciesId:id}})).toMatchObject({code:'CONFLICT'});
    expect(p.read().imagePets![id]).toBeUndefined();
  });
  it('이미지 펫만 표시할 때 전체 스위치와 알림 담당이 유지된다', async () => {
    decoder(); const p=profile(); await p.send(p.add);
    await p.send({...p.target(),type:'COMPANION_PATCH',payload:{speciesId:'nurung',patch:{enabled:false}}});
    expect(p.read().settings.enabled).toBe(true);
    expect(announcementCompanion(p.read())).toBe(id);
    await p.send({...p.target(),type:'SETTINGS_PATCH',payload:{enabled:false}});
    await p.send({...p.target(),type:'SETTINGS_PATCH',payload:{enabled:true}});
    expect(p.read().companions!.nurung.enabled).toBe(false);
    expect(p.read().imagePets![id]!.companion.enabled).toBe(true);
    await p.send({...p.target(),type:'IMAGE_PET_REMOVE',payload:{id}});
    expect(p.read().settings.enabled).toBe(false);
  });
  it('사진 친구가 그린 길을 걸어도 원본 그림과 기본 친구의 위치는 그대로 보존한다', async () => {
    decoder();
    const p = profile();
    await p.send(p.add);
    await p.send({ ...p.target(), type: 'ATTIC_FOCUS', payload: { id } });
    const original = p.read().companions;
    const points = [{ x: .2, y: .8 }, { x: .5, y: .3 }];
    await p.send({ ...p.target(), type: 'START_DRAWN_WALK', payload: { speciesId: id, points } });
    expect(p.read().imagePets![id]).toMatchObject({ image, companion: { scene: { anchor: { path: points } } } });
    expect(p.read().companions).toEqual(original);
  });
  it('페이지 등록과 이미지에 없는 입체 기능을 명령 경계에서 거부한다', () => {
    const p=profile();
    expect(parseCommand({...envelope,...p.add},'content')).toMatchObject({code:'FORBIDDEN'});
    expect(parseCommand({...envelope,...p.target(),type:'COMPANION_PATCH',payload:{speciesId:id,patch:{outfit:'santa'}}},'options'))
      .toMatchObject({code:'VALIDATION_ERROR'});
    expect(parseCommand({...envelope,...p.target(),type:'COMPANION_SCENE',payload:{speciesId:id,action:{type:'SCENE_PLAY',payload:{x:.2,y:.3}}}},'content'))
      .toMatchObject({code:'VALIDATION_ERROR'});
  });
});
