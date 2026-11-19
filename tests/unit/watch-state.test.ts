import { afterEach, expect, it, vi } from 'vitest';
import { createPetState, stateKey } from '../../shared/contracts/state';
import { browser } from 'wxt/browser';
import { renamePet, resetAll, watchState } from '../../shared/messaging/state';

type ChangeListener = Parameters<typeof browser.storage.onChanged.addListener>[0];

const api = vi.hoisted(() => ({
  sendMessage: vi.fn(), addListener: vi.fn<(listener: ChangeListener) => void>(), removeListener: vi.fn(),
}));
vi.mock('wxt/browser', () => ({
  browser: { runtime: { sendMessage: api.sendMessage }, get storage() { return { onChanged: api }; } },
}));
afterEach(() => vi.resetAllMocks());

it('구독 후 초기 응답보다 먼저 도착한 새 상태를 유지하고 켜기와 끄기를 전달한다', async () => {
  const original = createPetState();
  const enabled = { ...original, revision: 1, settings: { ...original.settings, enabled: true } };
  const initial = Promise.withResolvers<unknown>();
  api.sendMessage.mockReturnValue(initial.promise);
  const update = vi.fn();
  const stop = watchState(update);
  const changed = api.addListener.mock.calls[0]?.[0];
  if (!changed) throw new Error('저장소 리스너 누락');
  changed({ [stateKey]: { newValue: enabled } }, 'sync');
  changed({ unrelated: {} }, 'local');
  expect(update).not.toHaveBeenCalled();
  changed({ [stateKey]: { newValue: enabled } }, 'local');
  initial.resolve({ ok: true, state: original });
  await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledOnce());
  await initial.promise;
  changed({ [stateKey]: { newValue: original } }, 'local');
  expect(update.mock.calls).toEqual([[enabled]]);
  changed({ [stateKey]: { newValue: { ...original, revision: 2 } } }, 'local');
  changed({ [stateKey]: { newValue: { ...enabled, revision: 3 } } }, 'local');
  expect(update.mock.calls.map(([s]) => s.settings.enabled)).toEqual([true, false, true]);
  stop();
  expect(api.removeListener).toHaveBeenCalledWith(changed);
});

it('손상 또는 삭제 시 화면을 숨기고 구독 해제 후 늦은 응답을 폐기한다', async () => {
  const initial = Promise.withResolvers<unknown>();
  api.sendMessage.mockReturnValue(initial.promise);
  const update = vi.fn();
  const stop = watchState(update);
  const changed = api.addListener.mock.calls[0]?.[0];
  if (!changed) throw new Error('저장소 리스너 누락');
  changed({ [stateKey]: {} }, 'local');
  expect(update).toHaveBeenCalledWith(null);
  stop();
  initial.resolve({ ok: true, state: createPetState() });
  await initial.promise;
  expect(update).toHaveBeenCalledTimes(1);
});

it('이전 manifest가 활성화되어 저장 권한이 없으면 예외 없이 복구 안내를 반환한다', () => {
  vi.spyOn(browser, 'storage', 'get').mockReturnValue(undefined!);
  try {
    const update = vi.fn();
    const error = vi.fn();
    const stop = watchState(update, error);
    expect(update).toHaveBeenCalledWith(null);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('새로고침'));
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  } finally {
    vi.restoreAllMocks();
  }
});

it('손상 이벤트는 대기 중이던 정상 응답을 무효화하고, 복구 후 낮은 revision도 다시 읽는다', async () => {
  const old = { ...createPetState(), revision: 10 };
  const fresh = { ...createPetState(), revision: 1 };
  const initial = Promise.withResolvers<unknown>();
  api.sendMessage.mockReturnValueOnce(initial.promise).mockResolvedValueOnce({ ok: true, state: fresh });
  const update = vi.fn();
  const errors = vi.fn();
  const stop = watchState(update, errors);
  const changed = api.addListener.mock.calls[0]![0];
  changed({ [stateKey]: { newValue: old } }, 'local');
  changed({ [stateKey]: { newValue: { ...old, pet: null } } }, 'local');
  expect(errors.mock.calls.at(-1)?.[1]).toMatchObject({
    code: 'STORAGE_CORRUPT', recovery: { expectedPetId: null, expectedRevision: 10 },
  });
  initial.resolve({ ok: true, state: old });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(update.mock.calls.map(([s]) => s)).toEqual([old, null]);
  changed({ [stateKey]: { newValue: fresh } }, 'local');
  await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));
  expect(update.mock.calls.map(([s]) => s)).toEqual([old, null, fresh]);
  stop();
});

it('미래 저장 형식에는 초기화 대상을 제공하지 않는다', async () => {
  api.sendMessage.mockResolvedValue({ ok: false, code: 'UNSUPPORTED_SCHEMA', message: '읽을 수 없는 버전' });
  const errors = vi.fn();
  const stop = watchState(vi.fn(), errors);
  await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
  expect(errors.mock.calls[0]?.[1]).toEqual({ code: 'UNSUPPORTED_SCHEMA', message: '읽을 수 없는 버전' });
  stop();
});

it('저장 응답 유실은 같은 ID로 한 번만 재시도하고, 저장 거부는 재전송하지 않는다', async () => {
  const state = createPetState();
  const saved = { ...state, pet: { ...state.pet, name: '보리' }, revision: 1 };
  api.sendMessage.mockRejectedValueOnce(Error('port closed')).mockResolvedValueOnce({ ok: true, state: saved });
  await expect(renamePet(state, '보리')).resolves.toEqual(saved);
  expect(api.sendMessage.mock.calls[0]).toEqual(api.sendMessage.mock.calls[1]);
  api.sendMessage.mockResolvedValueOnce({ ok: false, code: 'CONFLICT', message: '다시 확인해 주세요.' });
  await expect(resetAll({ expectedPetId: state.pet.id, expectedRevision: 0 })).rejects.toThrow('다시 확인');
  expect(api.sendMessage).toHaveBeenCalledTimes(3);
  expect(api.sendMessage.mock.calls[2]?.[0]).toMatchObject({
    type: 'RESET_ALL', expectedPetId: state.pet.id, payload: { expectedRevision: 0, confirmed: true },
  });
});

it('저장 메시지가 두 번 전송 실패하면 멈추고 성공으로 표시하지 않는다', async () => {
  api.sendMessage.mockRejectedValue(Error('no port'));
  await expect(renamePet(createPetState(), '보리')).rejects.toThrow('응답을 받지 못했어요');
  expect(api.sendMessage).toHaveBeenCalledTimes(2);
});
