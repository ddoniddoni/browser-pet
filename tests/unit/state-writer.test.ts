import { adoptCompanions, syncCompanion, companionRoute } from '../../shared/contracts/companions';
import { samplePatrol } from '../../features/pet/core/shared-patrol';
import { describe, expect, it, vi } from 'vitest';
import { envelope, getState, parseCommand, type SceneAction, type Mutation } from '../../shared/contracts/commands';
import { createPetState, isPetState, type PetState } from '../../shared/contracts/state';
import { createStateWriter } from '../../shared/storage/writer';

function localState(initial?: unknown) {
  let stored = isPetState(initial) ? syncCompanion(initial) : initial;
  return {
    read: vi.fn(async () => structuredClone(stored)),
    write: vi.fn(async (state: PetState) => { stored = structuredClone(state); }),
  };
}
function patch(pet: PetState, enabled: boolean): Extract<Mutation, { type: 'SETTINGS_PATCH' }> {
  return { type: 'SETTINGS_PATCH', requestId: crypto.randomUUID(), expectedPetId: pet.pet.id, payload: { enabled } };
}

describe('Background 단일 저장 경로', () => {
  it('동시 첫 요청에서 한 번만 생성하고 기본값을 공유한다', async () => {
    const storage = localState();
    const run = createStateWriter(storage);
    const [first, second] = await Promise.all([run(getState), run(getState)]);
    expect(storage.write).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, state: { revision: 0, awaitingFirstPet: true, pet: { name: '누룽' }, settings: { enabled: false, sizePx: 64 } } });
  });
  it('워커 재시작 뒤에도 저장된 표시 설정을 복원하고 요청 재전송을 구분한다', async () => {
    const state = createPetState();
    const storage = localState(state);
    const enable = patch(state, true);
    await createStateWriter(storage)(enable);
    const afterRestart = createStateWriter(storage);
    const expected = { ok: true, state: { revision: 1, settings: { enabled: true } } };
    expect(await afterRestart(getState)).toMatchObject(expected);
    expect(await afterRestart(enable)).toMatchObject(expected);
    expect(await afterRestart({ ...enable, payload: { enabled: false } })).toMatchObject({ code: 'REQUEST_ID_REUSED' });
    expect(storage.write).toHaveBeenCalledTimes(1);
    expect(await afterRestart(patch(state, false))).toMatchObject({ state: { revision: 2, settings: { enabled: false } } });
  });
  it('저장 실패와 대상 충돌 뒤 다음 요청을 처리한다', async () => {
    const state = createPetState();
    const storage = localState(state);
    storage.write.mockRejectedValueOnce(new Error('write failed'));
    const run = createStateWriter(storage);
    expect(await run(patch(state, true))).toMatchObject({ code: 'STORAGE_ERROR' });
    expect(await run(patch(createPetState(), true))).toMatchObject({ code: 'CONFLICT' });
    expect(await run(getState)).toEqual({ ok: true, state });
    expect(await run(patch(state, true))).toMatchObject({ state: { revision: 1 } });
  });
  it.each([null, {}, { schemaVersion: 7 }])('알 수 없는 저장값을 덮어쓰지 않는다 (%j)', async value => {
    const storage = localState(value);
    expect(await createStateWriter(storage)(getState)).toMatchObject({ ok: false });
    expect(storage.write).not.toHaveBeenCalled();
  });
  it('페이지의 변경 요청과 지원하지 않는 필드를 거부한다', () => {
    const cmd = { ...envelope, ...patch(createPetState(), true) };
    expect(parseCommand(cmd, 'content')).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand({ ...cmd, payload: { enabled: true, name: '변경' } }, 'popup')).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('P4 저장 경쟁과 복구', () => {
  const rename = (pet: PetState, name: string): Mutation =>
    ({ type: 'PET_RENAME', requestId: crypto.randomUUID(), expectedPetId: pet.pet.id, payload: { speciesId: pet.pet.speciesId, name } });
  const reset = (expectedPetId: string | null, expectedRevision: number | null): Extract<Mutation, { type: 'RESET_ALL' }> =>
    ({ type: 'RESET_ALL', requestId: crypto.randomUUID(), expectedPetId, payload: { expectedRevision, confirmed: true } });
  it('두 탭의 이름/설정은 병합하고 같은 필드는 마지막 승인대로 반영한다', async () => {
    const state = createPetState(), storage = localState(state), run = createStateWriter(storage);
    const a = rename(state, '콩이');
    const b = { ...patch(state, true), payload: { sizePx: 32 as const, enabled: true } };
    const c = rename(state, '보리');
    const d = { ...patch(state, false), payload: { speed: 'slow' as const } };
    await Promise.all([run(a), run(b), run(c), run(d)]);
    const expected = { revision: 4, pet: { name: '보리' }, settings: { sizePx: 32, enabled: true, speed: 'slow' } };
    expect(await run(getState)).toMatchObject({ state: expected });
    const restarted = createStateWriter(storage);
    expect(await restarted({ ...b, payload: { enabled: true, sizePx: 32 } })).toMatchObject({
      state: expected, alreadyApplied: true, appliedRevision: 2,
    });
    expect(await restarted({ ...b, payload: { enabled: true, sizePx: 64 } })).toMatchObject({ code: 'REQUEST_ID_REUSED' });
    expect(storage.write).toHaveBeenCalledTimes(4);
  });

  it('오래된 확인은 충돌하고 성공한 초기화는 응답 유실/늦은 요청에도 한 번만 적용된다', async () => {
    const state = createPetState(), storage = localState(state), run = createStateWriter(storage);
    const staleReset = reset(state.pet.id, 0);
    await run(rename(state, '콩이'));
    expect(await run(staleReset)).toMatchObject({ code: 'CONFLICT' });
    const confirmed = reset(state.pet.id, 1);
    const done = await run(confirmed);
    expect(done).toMatchObject({ ok: true, state: { revision: 2, pet: { name: '누룽' }, settings: { enabled: false } } });
    if (!done.ok) throw Error(done.code);
    expect(done.state.pet.id).not.toBe(state.pet.id);
    expect(done.state.recentRequests).toHaveLength(1);
    const restarted = createStateWriter(storage);
    expect(await restarted(confirmed)).toMatchObject({ alreadyApplied: true, appliedRevision: 2, state: done.state });
    expect(await restarted({ ...confirmed, payload: { ...confirmed.payload, expectedRevision: 2 } })).toMatchObject({ code: 'REQUEST_ID_REUSED' });
    expect(await restarted(rename(state, '옛 이름'))).toMatchObject({ code: 'CONFLICT' });
    expect(await restarted(reset(null, null))).toMatchObject({ code: 'CONFLICT' });
    expect(storage.write).toHaveBeenCalledTimes(2);
  });

  it.each([
    { raw: null, expectedId: null, expectedRevision: null },
    { raw: { pet: { id: 'old-pet' }, revision: 13 }, expectedId: 'old-pet', expectedRevision: 13 },
    { raw: { revision: 8 }, expectedId: null, expectedRevision: 8 },
  ])('손상 상태도 읽을 수 있는 정보와 정확히 일치하는 확인만 사용한다 (%j)', async ({ raw, expectedId, expectedRevision }) => {
    const storage = localState(raw), run = createStateWriter(storage);
    expect(await run(getState)).toMatchObject({ code: 'STORAGE_CORRUPT', recovery: { expectedPetId: expectedId, expectedRevision } });
    expect(await run(rename(createPetState(), '보리'))).toMatchObject({ code: 'STORAGE_CORRUPT' });
    expect(await run(reset(expectedId, 101))).toMatchObject({ code: 'CONFLICT' });
    expect(await run(reset('wrong', expectedRevision))).toMatchObject({ code: 'CONFLICT' });
    expect(storage.write).not.toHaveBeenCalled();
    const confirmed = reset(expectedId, expectedRevision);
    expect(await run(confirmed)).toMatchObject({ ok: true, state: { revision: (expectedRevision ?? 0) + 1 } });
    expect(await createStateWriter(storage)(confirmed)).toMatchObject({ ok: true, alreadyApplied: true });
    expect(storage.write).toHaveBeenCalledTimes(1);
  });

  it('미래 형식이면 옵션 초기화로도 원본을 덮어쓰지 않는다', async () => {
    const storage = localState({ schemaVersion: 5, revision: 3, pet: { id: 'next' } }), run = createStateWriter(storage);
    expect(await run(reset('next', 3))).toMatchObject({ code: 'UNSUPPORTED_SCHEMA' });
    expect(await run(reset(null, null))).toMatchObject({ code: 'UNSUPPORTED_SCHEMA' });
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('최근 128개만 보관하고 이전 버전이 저장한 enabled 지문을 계속 인식한다', async () => {
    const state = createPetState(), first = patch(state, true);
    const buffer = new TextEncoder().encode(JSON.stringify(['SETTINGS_PATCH', state.pet.id, true]));
    const sha = await crypto.subtle.digest('SHA-256', buffer);
    const fingerprint = Array.from(new Uint8Array(sha), b => b.toString(16).padStart(2, '0')).join('');
    const storage = localState({ ...state, revision: 1, recentRequests: [{ requestId: first.requestId, fingerprint, appliedRevision: 1 }] });
    const run = createStateWriter(storage);
    expect(await run(first)).toMatchObject({ alreadyApplied: true });
    await Promise.all(Array.from({ length: 128 }, (_, n) => run(patch(state, n % 2 === 0))));
    const latest = await run(getState);
    if (!latest.ok) throw Error(latest.code);
    expect(latest.state.recentRequests).toHaveLength(128);
    expect(latest.state.recentRequests[0]?.appliedRevision).toBe(2);
    expect(latest.state.revision).toBe(129);
  });
});

describe('모든 탭이 공유하는 펫 장면', () => {
  it('위치, 반응과 전체 숨김을 직렬로 적용하고 재전송 시 다시 쓰지 않는다', async () => {
    const state = createPetState(), storage = localState(state), run = createStateWriter(storage);
    const scene = (action: SceneAction): Mutation => ({
      ...action, expectedPetId: state.pet.id, requestId: crypto.randomUUID(),
    });
    const pin = scene({ type: 'SCENE_PIN', payload: { x: 0.75, y: 0.25 } });
    const touch = scene({ type: 'SCENE_PET', payload: {} });
    const hide = scene({ type: 'SCENE_HIDE', payload: {} });
    expect(await run(pin)).toMatchObject({ code: 'CONFLICT' });
    await run(patch(state, true));
    const [pinned, reacted, hidden] = await Promise.all([run(pin), run(touch), run(hide)]);
    if (!pinned.ok || !reacted.ok || !hidden.ok) throw Error('공유 명령 실패');
    expect(pinned.state.scene?.anchor).toMatchObject({ kind: 'pin', x: 0.75, y: 0.25 });
    expect(reacted.state.scene?.anchor).toEqual(pinned.state.scene?.anchor);
    expect(reacted.state.scene?.pettedAt).toBeGreaterThan(0);
    expect(hidden.state.settings.enabled).toBe(false);
    expect(hidden.state.scene).toEqual(reacted.state.scene);
    expect(await createStateWriter(storage)(touch)).toMatchObject({ alreadyApplied: true, state: hidden.state });
    expect(await run(scene({ type: 'SCENE_PET', payload: {} }))).toMatchObject({ code: 'CONFLICT' });
    expect(storage.write).toHaveBeenCalledTimes(4);
    expect(await run(patch(state, true))).toMatchObject({ state: { scene: hidden.state.scene } });
    const resumed = await run(scene({ type: 'SCENE_RESUME', payload: {} }));
    expect(resumed).toMatchObject({ state: { scene: { anchor: { kind: 'placed-patrol', x: 0.75, y: 0.25 }, pettedAt: 0 } } });
    if (!resumed.ok) throw Error('산책 재개 실패');
    expect(await createStateWriter(storage)(getState)).toMatchObject({ state: { scene: resumed.state.scene } });
    expect(await run(scene({ type: 'SCENE_RESUME', payload: {} }))).toMatchObject({ code: 'CONFLICT' });
    const reset = await run({ type: 'RESET_ALL', requestId: crypto.randomUUID(), expectedPetId: state.pet.id,
      payload: { confirmed: true, expectedRevision: resumed.state.revision } });
    if (!reset.ok) throw Error(reset.code);
    expect(reset.state.scene?.anchor).toMatchObject({kind:'patrol',x:1,y:1});
    expect(await run(pin)).toMatchObject({ code: 'CONFLICT' });
  });
});

describe('사이트별 숨김 저장', () => {
  const op = (state: PetState, type: 'HOST_HIDE_CURRENT' | 'HOST_UNHIDE', hostname: string, requestId = crypto.randomUUID()): Extract<Mutation,{type:'HOST_HIDE_CURRENT' | 'HOST_UNHIDE'}> =>
    ({ type, expectedPetId: state.pet.id, requestId, payload: { hostname } });
  it('같은 hostname만 숨기거나 해제하며 재시도 지문에 실제 호스트가 들어간다', async () => {
    const state = createPetState(), storage = localState(state), run = createStateWriter(storage);
    await run(patch(state, true));
    const one = op(state, 'HOST_HIDE_CURRENT', 'a.test');
    await Promise.all([run(one), run(op(state, 'HOST_HIDE_CURRENT', 'sub.a.test'))]);
    expect(await run({ ...one, payload: { hostname: 'b.test' } })).toMatchObject({ code: 'REQUEST_ID_REUSED' });
    expect(await run(op(state, 'HOST_HIDE_CURRENT', 'a.test')))
      .toMatchObject({ state: { settings: { enabled: true, hiddenHostnames: ['a.test', 'sub.a.test'] } } });
    const restored = await run(op(state, 'HOST_UNHIDE', 'a.test'));
    expect(restored).toMatchObject({ state: { settings: { enabled: true, hiddenHostnames: ['sub.a.test'] } } });
    expect(await createStateWriter(storage)(one)).toMatchObject({ alreadyApplied: true, state: { settings: { hiddenHostnames: ['sub.a.test'] } } });
  });
  it('숨긴 사이트가 200개일 때 새 항목은 쓰지 않고, 해제하면 다시 등록할 수 있다', async () => {
    const state = createPetState();
    state.settings.enabled = true;
    state.settings.hiddenHostnames = Array.from({ length: 200 }, (_, i) => i + '.test');
    const storage = localState(state), run = createStateWriter(storage);
    const add = op(state, 'HOST_HIDE_CURRENT', 'extra.test');
    expect(await run(add)).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(storage.write).not.toHaveBeenCalled();
    await run(op(state, 'HOST_UNHIDE', '6.test'));
    const result = await run(add);
    if (!result.ok) throw Error(result.code);
    expect(result.state.settings.hiddenHostnames).toHaveLength(200);
    expect(result.state.settings.hiddenHostnames).toContain('extra.test');
  });
});

it.each(['patrol', 'placed-patrol'] as const)('%s에서 속도 변경은 현재 위치에서 시작하고 고정 및 동작 줄이기 위치를 유지한다', async kind => {
  const state = createPetState();
  state.settings.enabled = true;
  const y = kind === 'patrol' ? 1 : 0.25;
  state.scene = { anchor: { kind, x: 1, y, at: 1000 }, pettedAt: 0 };
  const run = createStateWriter(localState(state));
  const options = (payload: Extract<Mutation, { type: 'SETTINGS_PATCH' }>['payload']): Mutation =>
    ({ ...patch(state, true), payload });
  const clock = vi.spyOn(Date, 'now').mockReturnValue(2800);
  try {
    const {x, y: currentY} = samplePatrol(companionRoute(state), state.scene.anchor, 2800, 'normal');
    const changed = await run(options({ speed: 'slow' }));
    expect(changed).toMatchObject({ state: { scene: { anchor: { kind, x, y: currentY, at: 2800 } } } });
    const freeze = await run(options({ reduceMotion: 'always' }));
    clock.mockReturnValue(9000);
    const paused = await run(options({ speed: 'normal' }));
    if (!freeze.ok || !paused.ok) throw Error('설정 변경 실패');
    expect(paused.state.scene?.anchor).toMatchObject({x:freeze.state.scene?.anchor.x,y:freeze.state.scene?.anchor.y});
    const pin = await run({ type: 'SCENE_PIN', expectedPetId: state.pet.id, requestId: crypto.randomUUID(), payload: { x: .2, y: .6 } });
    if (!pin.ok) throw Error(pin.code);
    expect(await run(options({ speed: 'slow' }))).toMatchObject({ state: { scene: pin.state.scene } });
  } finally {
    clock.mockRestore();
  }
});

describe('펫 모습 선택 저장', () => {
  it('친구별 이름과 고정 위치를 기억하고 사이트 숨김은 공유한다', async () => {
    const state = createPetState();
    state.pet.name = '또또';
    state.settings.hiddenHostnames = ['example.org'];
    state.scene = { anchor: { kind: 'pin', x: 0.21, y: 0.67, at: 42 }, pettedAt: 123 };
    const storage = localState(state);
    const select = (speciesId: 'nurung' | 'kkogit'): Mutation => ({
      type: 'PET_SELECT_SPECIES', requestId: crypto.randomUUID(), expectedPetId: state.pet.id, payload: { speciesId },
    });
    const dog = select('kkogit');
    await createStateWriter(storage)(dog);
    const restarted = createStateWriter(storage);
    expect(await restarted(getState)).toMatchObject({ ok: true, state: {
      schemaVersion: 4, pet: { ...state.pet, speciesId: 'kkogit', name: '꼬깃' }, settings: state.settings, scene: state.companions!.kkogit.scene,
    } });
    expect(await restarted(dog)).toMatchObject({ alreadyApplied: true, appliedRevision: 1 });
    expect(await restarted(select('nurung'))).toMatchObject({ ok: true, state: {
      revision: 2, pet: state.pet, settings: state.settings, scene: state.scene,
    } });
    expect(storage.write).toHaveBeenCalledTimes(2);
  });
  it('알 수 없는 종을 읽거나 다른 필드를 수정할 때 원본 종 ID를 바꾸지 않는다', async () => {
    const s = createPetState();
    const snapshot = { ...s, pet: { ...s.pet, speciesId: 'future-pet' } };
    const storage = localState(snapshot), run = createStateWriter(storage);
    expect(await run(getState)).toEqual({ ok: true, state: snapshot });
    expect(storage.write).not.toHaveBeenCalled();
    await run(patch(s, true));
    expect(await storage.read()).toMatchObject({ pet: snapshot.pet, settings: { enabled: true } });
  });
});

describe('P7-A 돌봄 저장', () => {
  function legacyOf(state: PetState) {
    const { revision, pet, settings, scene, recentRequests } = state;
    return { schemaVersion: 1, revision, pet, settings, ...(scene && { scene }), recentRequests };
  }
  function action(state: PetState, type: 'CARE_FEED' | 'CARE_PET'): Mutation {
    return { type, expectedPetId: state.pet.id, requestId: crypto.randomUUID(), payload: { speciesId: state.pet.speciesId } };
  }

  it('이관은 첫 읽기에 한 번만 수행하고 예전 영수증 재전송, 알 수 없는 종과 고정 위치를 보존한다', async () => {
    const old = createPetState(2000);
    old.pet = { ...old.pet, name: '또또', speciesId: 'future-dog' };
    old.scene = { anchor: { kind: 'pin', x: .21, y: .85, at: 3000 }, pettedAt: 3200 };
    old.settings.hiddenHostnames = ['example.org'];
    const enable = patch(old, true);
    const prepared = await createStateWriter(localState(old))(enable);
    if (!prepared.ok) throw Error(prepared.code);
    const legacy = legacyOf(prepared.state), storage = localState(legacy);
    const run = createStateWriter(storage), now = 100 * 86400000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const [first, second] = await Promise.all([run(getState), run(getState)]);
      expect(first).toEqual(second);
      if (!first.ok) throw Error(first.code);
      expect(first.state).toEqual({ ...adoptCompanions({ ...legacy, schemaVersion: 4, care: createPetState(now).care, restingPets: {} }, now), revision: legacy.revision + 1 });
      clock.mockReturnValue(now + 3 * 86400000);
      const restarted = createStateWriter(storage);
      expect(await restarted(enable)).toMatchObject({ alreadyApplied: true, appliedRevision: 1, state: first.state });
      expect(await restarted(getState)).toEqual(first);
      expect(storage.write).toHaveBeenCalledTimes(1);
    } finally { clock.mockRestore(); }
  });

  it('유효하지 않은 v1 데이터는 자동 이관하지 않고 승인된 초기화만 허용한다', async () => {
    const old = legacyOf(createPetState());
    for (const malformed of [{ ...old, care: {} }, { ...old, scene: null }, { ...old, pet: { ...old.pet, id: '' } },
      { ...old, revision: 1, recentRequests: [{ requestId: 'old', fingerprint: 'a'.repeat(64), appliedRevision: 1, careReward: 'granted' }] }]) {
      const storage = localState(malformed);
      expect(await createStateWriter(storage)(getState)).toMatchObject({ code: 'STORAGE_CORRUPT' });
      expect(storage.write).not.toHaveBeenCalled();
    }
  });

  it('동시에 먹여도 한 번만 보상하고, 나중에 재전송해도 당시의 결과와 최신 상태를 함께 돌려준다', async () => {
    const now = 500000, state = createPetState(now);
    state.scene = { anchor: { kind: 'pin', x: .35, y: .73, at: now - 1000 }, pettedAt: 0 };
    const storage = localState(state), run = createStateWriter(storage);
    const feed = action(state, 'CARE_FEED'), another = action(state, 'CARE_FEED');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const [one, two] = await Promise.all([run(feed), run(another)]);
      expect(one).toMatchObject({ ok: true, careReward: 'granted', state: { care: { xp: 5 }, scene: state.scene } });
      expect(two).toMatchObject({ ok: true, careReward: 'waiting', state: { care: { xp: 5 }, scene: state.scene } });
      const touch = await run(action(state, 'CARE_PET'));
      expect(touch).toMatchObject({ ok: true, careReward: 'granted',
        state: { care: { xp: 7 }, scene: { anchor: state.scene.anchor, pettedAt: now } } });
      clock.mockReturnValue(now + 12 * 60000);
      const restarted = createStateWriter(storage);
      expect(await restarted(another)).toMatchObject({ careReward: 'waiting', alreadyApplied: true, state: { care: { xp: 7 } } });
      expect(await restarted(feed)).toMatchObject({ careReward: 'granted', alreadyApplied: true, state: { care: { xp: 7 } } });
      expect(storage.write).toHaveBeenCalledTimes(3);
      expect(await restarted(action(state, 'CARE_FEED'))).toMatchObject({ careReward: 'granted', state: { care: { xp: 12 } } });
    } finally { clock.mockRestore(); }
  });

  it('페이지의 늦은 요청은 표시가 꺼지면 거부하지만 팝업에서는 돌볼 수 있다', async () => {
    const state = createPetState(), storage = localState(state), run = createStateWriter(storage);
    const page: Mutation = { type: 'CARE_PET', fromPage: true, requestId: crypto.randomUUID(), expectedPetId: state.pet.id, payload: { speciesId: state.pet.speciesId } };
    expect(await run(page)).toMatchObject({ code: 'CONFLICT' });
    expect(storage.write).not.toHaveBeenCalled();
    expect(await run(action(state, 'CARE_PET'))).toMatchObject({ careReward: 'granted', state: { settings: { enabled: false } } });
  });
});

it('공놀이 장면과 스타일을 공유해도 고정 위치와 돌봄 보상은 바뀌지 않는다', async () => {
  const old = createPetState();
  old.settings.enabled = true;
  old.scene = { anchor: { kind: 'pin', x: .35, y: .25, at: old.pet.createdAt }, pettedAt: 0 };
  const storage = localState(old), run = createStateWriter(storage);
  const target = { expectedPetId: old.pet.id, requestId: crypto.randomUUID() };
  const play = { ...target, type: 'SCENE_PLAY' as const, payload: { x: .35, y: .25 } };
  const reply = await run(play);
  if (!reply.ok) throw Error(reply.code);
  expect(reply.state.scene).toMatchObject({ anchor: old.scene.anchor, play: { x: .35, y: .25 } });
  expect(reply.state.care).toEqual(old.care);
  await run({ ...target, requestId: crypto.randomUUID(), type: 'SETTINGS_PATCH',
    payload: { personality: 'lively', scarf: 'berry' } });
  const resumed = await createStateWriter(storage)(play);
  expect(resumed).toMatchObject({ alreadyApplied: true, state: { care: old.care, scene: reply.state.scene,
    settings: { personality: 'lively', scarf: 'berry' } } });
  expect(storage.write).toHaveBeenCalledTimes(2);
});

it('v2의 기록을 선택된 동물에게 보존하고 종별 보상, 재시도와 복원을 분리한다', async () => {
  const now = 100_000;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  try {
    const { revision, settings, pet, recentRequests, care } = createPetState(now);
    const dogCare = { ...care, satiety: 90, mood: 46, xp: 37, lastFedAt: now };
    const storage = localState({ schemaVersion: 2, revision, settings, recentRequests,
      pet: { ...pet, speciesId: 'dog-default' }, care: dogCare });
    const run = createStateWriter(storage);
    const target = () => ({ expectedPetId: pet.id, requestId: crypto.randomUUID() });
    const select = (speciesId: 'kkogit' | 'nurung' | 'pongdang'): Mutation =>
      ({ type: 'PET_SELECT_SPECIES', ...target(), payload: { speciesId } });
    const feed = (speciesId: string): Mutation => ({ type: 'CARE_FEED', ...target(), payload: { speciesId } });
    expect(await run(getState)).toMatchObject({ state: { care: dogCare, restingPets: {} } });
    expect(await run(select('kkogit'))).toMatchObject({ state: { care: { xp: 0, lastFedAt: null } } });
    const catFeed = feed('kkogit');
    const cat = await run(catFeed);
    if (!cat.ok) throw Error(cat.code);
    expect(cat.state.care).toMatchObject({ satiety: 96, xp: 5 });
    const dog = await run(select('nurung'));
    expect(dog).toMatchObject({ state: { care: dogCare, restingPets: { 'kkogit': { name: '꼬깃', care: cat.state.care } } } });
    // 다른 친구를 돌봐도 대표 친구의 기록은 보존되며 각자의 보상 대기 시간이 적용된다.
    expect(await run(feed('kkogit'))).toMatchObject({ careReward: 'waiting', state: {
      care: dogCare, restingPets: { kkogit: { care: cat.state.care } },
    } });
    expect(await run(catFeed)).toMatchObject({ alreadyApplied: true, state: { care: dogCare } });
    expect(await run(feed('nurung'))).toMatchObject({ careReward: 'waiting', state: { care: dogCare } });
    const otter = await run(select('pongdang'));
    expect(otter).toMatchObject({ state: { care: { xp: 0, lastFedAt: null } } });
    const restarted = createStateWriter(storage);
    expect(await restarted(select('kkogit'))).toMatchObject({ state: { care: cat.state.care } });
    expect(await restarted(feed('kkogit'))).toMatchObject({ careReward: 'waiting', state: { care: cat.state.care } });
  } finally { clock.mockRestore(); }
});

it('v3에서 공용 이름은 선택된 종에만 남기고, 다시 선택해도 각자의 이름과 돌봄을 복원한다', async () => {
  const { pet, care, revision, settings, recentRequests } = createPetState(1000);
  const catCare = { ...care, xp: 42 }, dogCare = { ...care, xp: 17 };
  const storage = localState({ schemaVersion: 3, revision, settings, recentRequests, pet: { ...pet, speciesId:'cat-default', name: '또또' },
    care: catCare, restingCare: { 'dog-default': dogCare } });
  const run = createStateWriter(storage);
  const command = () => ({ expectedPetId: pet.id, requestId: crypto.randomUUID() });
  const select = (speciesId: 'nurung' | 'kkogit'): Mutation => ({
    ...command(), type: 'PET_SELECT_SPECIES', payload: { speciesId },
  });
  const rename = (speciesId: string, name: string): Mutation => ({
    ...command(), type: 'PET_RENAME', payload: { speciesId, name },
  });
  expect(await run(getState)).toMatchObject({ state: { pet: { name: '또또' }, care: catCare,
    restingPets: { 'nurung': { name: '누룽', care: dogCare } } } });
  expect(await run(select('nurung'))).toMatchObject({ state: { pet: { name: '누룽' }, care: dogCare } });
  expect(await run(rename('kkogit', '오래된 화면'))).toMatchObject({ code: 'CONFLICT' });
  const nameDog = rename('nurung', '보리');
  expect(await run(nameDog)).toMatchObject({ state: { pet: { name: '보리' } } });
  expect(await run(select('kkogit'))).toMatchObject({ state: { pet: { name: '또또' }, care: catCare } });
  const restarted = createStateWriter(storage);
  expect(await restarted(nameDog)).toMatchObject({ alreadyApplied: true, state: { pet: { name: '또또' } } });
  expect(await restarted(select('nurung'))).toMatchObject({ state: { pet: { name: '보리' }, care: dogCare } });
});

it('겹치는 v4 프로필을 합산하지 않고 현재 친구, 방과 추억을 한 번만 이관한다', async () => {
  const initial = createPetState(1234);
  delete initial.companions;
  const active = { ...initial.care, xp: 41 };
  const dog = { name: '마루', care: { ...initial.care, xp: 9 } };
  const duck = { name: 'アヒル', care: { ...initial.care, xp: 12 } };
  const room = { cushion: 'indigo', picture: 'ball' } as const;
  const card = { speciesId: 'otter', kind: 'ball', name: '물콩', scarf: 'berry', outfit: 'none', day: '2026-11-18' } as const;
  const old = { ...initial, revision: 8, pet: { ...initial.pet, speciesId: 'otter', name: '물콩' },
    care: active, restingPets: { 'dog-default': dog, duck }, rooms: { otter: room }, memories: [card] };
  const store = localState(old);
  const reply = await createStateWriter(store)(getState);
  expect(reply).toMatchObject({ ok: true, state: { revision: 9,
    pet: { id: old.pet.id, name: '물콩', speciesId: 'nurung' }, care: active, settings: old.settings,
    restingPets: { otter: { name: '물콩', care: active }, 'dog-default': dog, duck, pongdang: { name: '퐁당', care: duck.care } },
    rooms: { otter: room, nurung: room }, memories: [card, { ...card, speciesId: 'nurung' }] } });
  expect(await createStateWriter(store)(getState)).toEqual(reply);
  expect(store.write).toHaveBeenCalledTimes(1);
});
