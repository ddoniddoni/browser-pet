import { beforeEach, expect, it, vi } from 'vitest';
import { createPetState } from '../../shared/contracts/state';
import { toggleFromPopup } from '../../shared/messaging/display-click';

const api = vi.hoisted(() => ({
  getCurrent: vi.fn(), query: vi.fn(), sendMessage: vi.fn(), patchSettings: vi.fn(),
}));
vi.mock('wxt/browser', () => ({
  browser: { windows: { getCurrent: api.getCurrent }, tabs: { query: api.query, sendMessage: api.sendMessage } },
}));
vi.mock('../../shared/messaging/state', () => ({ patchSettings: api.patchSettings }));

beforeEach(() => {
  vi.resetAllMocks();
  api.getCurrent.mockResolvedValue({ id: 17, type: 'normal' });
  api.query.mockResolvedValue([{ id: 23 }]);
  api.sendMessage.mockResolvedValue({ ok: true });
});

it.each([true, false])('저장이 지연돼도 클릭한 탭에 표시 의도 %s를 먼저 전달한다', async enabled => {
  const state = createPetState();
  state.settings.enabled = !enabled;
  const commit = Promise.withResolvers<typeof state>();
  api.patchSettings.mockReturnValue(commit.promise);
  const click = toggleFromPopup(state, enabled);
  await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1));
  const id = api.patchSettings.mock.calls[0]?.[2];
  expect(id).toEqual(expect.any(String));
  expect(api.query).toHaveBeenCalledWith({ active: true, windowId: 17 });
  expect(api.sendMessage).toHaveBeenCalledWith(23, expect.objectContaining({
    phase: 'preview', enabled, petId: state.pet.id, requestId: id,
  }), { frameId: 0 });
  const saved = { ...state, revision: state.revision + 1, settings: { ...state.settings, enabled } };
  commit.resolve(saved);
  expect(await click).toBe(saved);
  await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith(23,
    expect.objectContaining({ type: 'DISPLAY_SAVED', state: saved }), { frameId: 0 }));
});

it('저장 실패 시 같은 탭에 해당 클릭만 취소한다', async () => {
  api.patchSettings.mockRejectedValue(new Error('저장 실패'));
  await expect(toggleFromPopup(createPetState(), true)).rejects.toThrow('저장 실패');
  await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));
  const requestId = api.sendMessage.mock.calls[0]?.[1].requestId;
  expect(requestId).toEqual(expect.any(String));
  expect(api.sendMessage).toHaveBeenLastCalledWith(23, expect.objectContaining({ phase: 'cancel', requestId }), { frameId: 0 });
});
