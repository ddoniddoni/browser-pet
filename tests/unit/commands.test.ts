import { describe, expect, it } from 'vitest';
import { envelope, getState, identifySender, parseCommand } from '../../shared/contracts/commands';
import { createPetState, getSharedScene, inspectStoredState, isPetState, normalizePetName } from '../../shared/contracts/state';
import { petDefinitions } from '../../features/pet/definitions/species';
import { normalizeHostname } from '../../shared/contracts/hostname';
import { ping, replyToPing } from '../../shared/contracts/ping';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ext = 'chrome-extension://' + id;
const content = { id, url: 'https://example.com/page', origin: 'https://example.com', frameId: 0, tab: { id: 0 } };
const command = { ...envelope, requestId: 'request', expectedPetId: 'pet' };
const rename = { ...command, type: 'PET_RENAME', payload: { speciesId: 'cat-default', name: '  보리  ' } };
const reset = { ...command, type: 'RESET_ALL', payload: { expectedRevision: 0, confirmed: true } };

describe('메시지 출처와 쓰기 범위', () => {
  it('자체 팝업/옵션과 최상위 웹 문서를 구별한다', () => {
    expect(identifySender({ id, url: ext + '/popup.html', origin: ext }, id)).toBe('popup');
    expect(identifySender({ id, url: ext + '/options.html' }, id)).toBe('options');
    expect(identifySender(content, id)).toBe('content');
    expect(parseCommand(getState, 'content')).toEqual(getState);
  });
  it.each([
    { ...content, id: 'foreign' }, { ...content, tab: undefined }, { ...content, frameId: 1 },
    { ...content, origin: 'null' }, { ...content, url: 'chrome://settings' },
    { id, url: ext + '/unused.html' }, { id, url: ext + '.evil/popup.html' },
    { id, url: 'https://' + id + '/popup.html' }, { id, url: 'invalid' },
  ])('잘못된 출처는 읽기/쓰기 모두 금지한다 (%j)', sender => {
    const source = identifySender(sender, id);
    expect(source).toBeNull();
    expect(parseCommand(getState, source)).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand(rename, source)).toMatchObject({ code: 'FORBIDDEN' });
  });
  it('처리할 수 있는 명령, 버전, envelope와 화면별 권한만 허용한다', () => {
    for (const value of [{ ...rename, protocolVersion: 5 }, { ...rename, scope: 'other' },
      { ...rename, type: 'SET_STATE' }, { ...rename, type: 'OTHER' }])
      expect(parseCommand(value, 'options')).toMatchObject({ code: 'INVALID_MESSAGE' });
    expect(replyToPing({ ...ping, payload: {} }, true)).toMatchObject({ code: 'INVALID_MESSAGE' });
    expect(parseCommand({ ...getState, payload: {} }, 'content')).toMatchObject({ code: 'INVALID_MESSAGE' });
    for (const source of ['popup', 'options'] as const)
      expect(parseCommand(rename, source)).toMatchObject({ type: 'PET_RENAME', payload: { speciesId: 'cat-default', name: '보리' } });
    for (const payload of [{ name: '보리' }, { name: '보리', speciesId: 3 }])
      expect(parseCommand({ ...rename, payload }, 'popup')).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(parseCommand(rename, 'content')).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand(reset, 'popup')).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand({ ...reset, payload: { expectedRevision: 0 } }, 'options')).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(parseCommand(reset, 'options')).toMatchObject({ type: 'RESET_ALL' });
  });
  it('설정은 화면에 허용한 필드와 범위만 받는다', () => {
    const patch = { ...command, type: 'SETTINGS_PATCH' };
    for (const payload of [{}, [], { sizePx: 16 }, { enabled: 1 }, { speed: 'warp' },
      { hideInFullscreen: null }, { reduceMotion: false }, { hiddenHostnames: ['one.test'] },
      { revision: 42 }, { pet: {} }, { constructor: true }])
      expect(parseCommand({ ...patch, payload }, 'options')).toMatchObject({ code: 'VALIDATION_ERROR' });
    const settings = { sizePx: 32, speed: 'slow', hideInFullscreen: false, hideWhileFormFocused: true, reduceMotion: 'always' };
    expect(parseCommand({ ...patch, payload: settings }, 'options')).toMatchObject({ payload: settings });
    expect(parseCommand({ ...patch, payload: settings }, 'popup')).toMatchObject({ code: 'FORBIDDEN' });
  });
});

it('이름을 문자 수로 검사하고 양끝 공백만 제거한다', () => {
  expect(normalizePetName('  🐈보리  ')).toBe('🐈보리');
  expect(normalizePetName('🐱'.repeat(20))).toBe('🐱'.repeat(20));
  expect(normalizePetName('<보리>')).toBe('<보리>');
  for (const bad of ['   ', '🐱'.repeat(21), '나\n비', '\t나비', '나비\r', '\u2028나비', '나\u007f비', null]) {
    expect(normalizePetName(bad)).toBeNull();
    expect(parseCommand({ ...rename, payload: { ...rename.payload, name: bad } }, 'popup')).toMatchObject({ code: 'VALIDATION_ERROR' });
  }
});

it('저장된 설정과 영수증도 검증하고 미래 데이터와 손상을 구별한다', () => {
  const s = createPetState();
  expect(isPetState(s)).toBe(true);
  for (const value of [
    { ...s, pet: { ...s.pet, name: '' } }, { ...s, ok: false },
    { ...s, settings: { ...s.settings, hiddenHostnames: ['example.com/path'] } },
    { ...s, settings: { ...s.settings, hiddenHostnames: ['example.com', 'example.com'] } },
    { ...s, recentRequests: [{ requestId: 'x', fingerprint: 'a'.repeat(64), appliedRevision: 6 }] },
  ]) expect(inspectStoredState(value)).toMatchObject({ code: 'STORAGE_CORRUPT' });
  expect(inspectStoredState({ ...s, schemaVersion: 5 })).toMatchObject({ code: 'UNSUPPORTED_SCHEMA' });
});

describe('공유 펫 명령과 기존 저장본', () => {
  it('최상위 콘텐츠에서만 장면 변경을 허용하고 프로필 변경 권한과 분리한다', () => {
    for (const action of [
      { type: 'SCENE_PIN', payload: { x: 0, y: 1 } },
      { type: 'SCENE_RESUME', payload: {} },
      { type: 'SCENE_PET', payload: {} }, { type: 'SCENE_HIDE', payload: {} },
    ]) {
      const wire = { ...command, ...action };
      expect(parseCommand(wire, 'content')).toMatchObject(action);
      for (const source of ['popup', 'options', null] as const)
        expect(parseCommand(wire, source)).toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(parseCommand({ ...command, type: 'SETTINGS_PATCH', payload: { enabled: false } }, 'content'))
      .toMatchObject({ code: 'FORBIDDEN' });
  });
  it('비율 좌표만 받고 클라이언트가 시각, 다른 설정이나 페이지 정보를 보낼 수 없다', () => {
    for (const action of [
      { type: 'SCENE_PIN', payload: { x: -0.1, y: 0 } },
      { type: 'SCENE_PIN', payload: { x: 0, y: Infinity } },
      { type: 'SCENE_PIN', payload: { x: 1, y: 1, url: 'site' } },
      { type: 'SCENE_RESUME', payload: { x: 1.001 } },
      { type: 'SCENE_RESUME', payload: { x: 0.5, y: 0.3 } },
      { type: 'SCENE_PET', payload: { at: 5 } },
      { type: 'SCENE_HIDE', payload: { enabled: true } },
    ]) expect(parseCommand({ ...command, ...action }, 'content')).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('장면 없는 프로필은 변경 없이 공유 출발점을 얻고 잘못된 좌표는 손상으로 처리한다', () => {
    const legacy = createPetState();
    delete legacy.scene;
    delete legacy.companions;
    expect(isPetState(legacy)).toBe(true);
    const anchor = { kind: 'patrol', x: 1, y: 1, at: legacy.pet.createdAt };
    expect(getSharedScene(legacy)).toEqual({ anchor, pettedAt: 0 });
    expect(Object.hasOwn(legacy, 'scene')).toBe(false);
    expect(isPetState({ ...legacy, scene: { anchor, pettedAt: 0 } })).toBe(true);
    for (const scene of [null, {}, { anchor: { ...anchor, y: 2 }, pettedAt: 0 },
      { anchor, pettedAt: -1 }, { anchor: { ...anchor, at: NaN }, pettedAt: 0 },
      { anchor: { ...anchor, kind: 'other' }, pettedAt: 0 }])
      expect(inspectStoredState({ ...legacy, scene })).toMatchObject({ code: 'STORAGE_CORRUPT' });
  });
});

describe('사이트별 표시 명령', () => {
  const hide = { ...command, type: 'HOST_HIDE_CURRENT', payload: {} };
  const unhide = { ...command, type: 'HOST_UNHIDE', payload: { hostname: 'WWW.Example.Com.' } };
  it('Chrome이 전달한 최상위 페이지의 hostname만 정규화한다', () => {
    expect(parseCommand(hide, identifySender(content, id), 'https://EXAMPLE.COM:8443/private?q=x'))
      .toEqual({ type: hide.type, requestId: 'request', expectedPetId: 'pet', payload: { hostname: 'example.com' } });
    expect(parseCommand(unhide, 'options')).toMatchObject({ payload: { hostname: 'www.example.com' } });
    expect(parseCommand({ ...hide, payload: { hostname: 'other.example' } }, 'content', content.url))
      .toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(parseCommand(hide, 'content', 'file:///example')).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand(hide, 'popup', content.url)).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand(hide, 'options', content.url)).toMatchObject({ code: 'FORBIDDEN' });
    for (const source of ['popup', 'content', null] as const)
      expect(parseCommand(unhide, source)).toMatchObject({ code: 'FORBIDDEN' });
  });
  it('국제 도메인과 IP를 포함한 호스트만 허용한다', () => {
    expect(normalizeHostname('BÜCHER.example')).toBe('xn--bcher-kva.example');
    expect(normalizeHostname('[0:0:0:0:0:0:0:1]')).toBe('[::1]');
    expect(normalizeHostname('127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeHostname('localhost')).toBe('localhost');
    for (const bad of ['', 'user@site.test', 'site.test/p', 'site.test:443', '*.site.test', 'https://site',
      'site.test?q', 'site.test#id', 'site..test', '%65xample.org', 'a'.repeat(64) + '.test'])
      expect(normalizeHostname(bad)).toBeNull();
  });
});

describe('펫 모습 선택', () => {
  const select = { ...command, type: 'PET_SELECT_SPECIES' };
  it('팝업과 옵션에서만 등록된 종 하나를 선택할 수 있다', () => {
    for (const { id: speciesId } of petDefinitions) {
      const payload = { speciesId };
      for (const source of ['popup', 'options'] as const)
        expect(parseCommand({ ...select, payload }, source)).toMatchObject({ type: select.type, payload });
      expect(parseCommand({ ...select, payload }, 'content')).toMatchObject({ code: 'FORBIDDEN' });
    }
    for (const payload of [{}, { speciesId: 'dog-default' }, { speciesId: 'future-pet' }, { speciesId: 1 }, { speciesId: 'constructor' },
      { speciesId: 'dog-default', name: '새 펫' }])
      expect(parseCommand({ ...select, payload }, 'popup')).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('쉬는 동물 목록에는 정상 돌봄 기록만 두고 현재 동물의 중복 기록은 받지 않는다', () => {
    const state = createPetState();
    const dog = { name: '보리', care: state.care };
    for (const restingPets of [null, { 'dog-default': { ...dog, care: { ...state.care, mood: -1 } } },
      { 'dog-default': { ...dog, name: '' } }, { nurung: dog }])
      expect(inspectStoredState({ ...state, restingPets })).toMatchObject({ code: 'STORAGE_CORRUPT' });
  });
  it('저장된 알 수 없는 종 식별자와 손상된 값을 구분한다', () => {
    const s = createPetState();
    for (const speciesId of ['cat-default', 'dog-default', 'future-pet']) {
      const snapshot = { ...s, pet: { ...s.pet, speciesId } };
      expect(inspectStoredState(snapshot)).toBe(snapshot);
    }
    for (const speciesId of [null, 5, '', 'cat/dog', 'a'.repeat(65)])
      expect(inspectStoredState({ ...s, pet: { ...s.pet, speciesId } })).toMatchObject({ code: 'STORAGE_CORRUPT' });
  });
});

describe('돌봄 명령', () => {
  it.each(['CARE_FEED', 'CARE_PET'])('팝업과 최상위 펫 메뉴에서만 %s를 요청한다', type => {
    const payload = { speciesId: 'dog-default' };
    const message = { ...command, type, payload };
    const parsed = { type, expectedPetId: command.expectedPetId, requestId: command.requestId, payload };
    expect(parseCommand(message, identifySender(content, id))).toEqual({ ...parsed, fromPage: true });
    expect(parseCommand(message, 'popup')).toEqual(parsed);
    for (const source of ['options', null, identifySender({ ...content, frameId: 2 }, id)] as const)
      expect(parseCommand(message, source)).toMatchObject({ code: 'FORBIDDEN' });
    for (const request of [
      { ...message, payload: {} }, { ...message, payload: { speciesId: 1 } }, { ...message, payload: { xp: 5 } }, { ...message, payload: { at: 0 } },
      { ...message, requestId: '' }, { ...message, fromPage: false },
    ]) expect(parseCommand(request, 'content')).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
