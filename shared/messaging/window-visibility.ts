import { browser } from 'wxt/browser';
import { envelope } from '../contracts/commands';
import { isRecord } from '../contracts/state';

export const windowVisibilityRequest = { ...envelope, type: 'GET_WINDOW_VISIBILITY' } as const;
const changed = 'WINDOW_VISIBILITY_CHANGED';
const checkDocumentFocus = 'CHECK_DOCUMENT_FOCUS' as const;

// 창 이동 중일 수 있으므로 최초 메시지에 붙은 windowId 대신 현재 탭과 창을 조회한다.
export async function mayDisplayInTab(tabId: number): Promise<boolean | typeof checkDocumentFocus | null> {
  try {
    // 마지막 창이 아직 포커스된 일반 창인지 먼저 확인한다. 다른 앱이나 별도 팝업이면 복원하지 않는다.
    const win = await browser.windows.getLastFocused();
    if (win.type !== 'normal' || win.state === 'minimized' || win.id === undefined) return false;
    const [selected] = await browser.tabs.query({ windowId: win.id, active: true });
    if (selected?.id !== tabId) return false;
    // 같은 일반 창의 선택된 탭까지 확인한 경우에만 실제 문서 포커스로 보완할 수 있다.
    if (win.focused) return true;
    // 툴바의 전체 표시 버튼을 누르는 동안에도 그 팝업이 속한 일반 창을 유지한다.
    if (browser.runtime.getContexts) {
      const popups = await browser.runtime.getContexts({ contextTypes: ['POPUP'], windowIds: [win.id] }).catch(() => []);
      if (popups.length > 0) return true;
    }
    return checkDocumentFocus;
  } catch {
    return null;
  }
}

// 워커가 다시 시작돼도 직전 창이나 문서 목록을 복원할 필요가 없다.
// 알림은 재조회 신호일 뿐이다. 늦게 배달된 알림 자체가 펫을 켜지는 않는다.
export function registerWindowChanges() {
  function notifyTab(tabId: number) {
    void browser.tabs.sendMessage(tabId, { ...envelope, type: changed }, { frameId: 0 }).catch(() => {});
  }
  function notifyWindows() {
    void browser.tabs.query({ active: true }).then(tabs => {
      for (const tab of tabs) if (tab.id !== undefined) notifyTab(tab.id);
    }).catch(() => {});
  }
  browser.windows.onFocusChanged.addListener(() => notifyWindows());
  browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
    notifyTab(tabId);
    // 분할 보기에서는 활성 상태가 바뀌어도 이전 탭의 문서가 계속 보일 수 있다.
    void browser.tabs.get(tabId).then(async activeTab => {
      if (activeTab.splitViewId === undefined || activeTab.splitViewId < 0) return;
      const tabs = await browser.tabs.query({ windowId, splitViewId: activeTab.splitViewId, active: false });
      for (const tab of tabs) if (tab.id !== undefined) notifyTab(tab.id);
    }).catch(() => {});
  });
  browser.tabs.onAttached.addListener(tabId => notifyTab(tabId));
}

// 처음에는 숨기고, 숨김/복귀/다음 조회 이후에 온 예전 응답은 무시한다.
export function watchWindowVisibility(onChange: (allowed: boolean) => void) {
  let generation = 0;
  let active = true;
  let allowed = false;
  let timer: number | undefined;
  function clearTimer() { window.clearTimeout(timer); timer = undefined; }
  function refresh() {
    clearTimer();
    const attempt = ++generation;
    if (!active) return;
    if (document.hidden) { allowed = false; onChange(false); return; }
    async function check(retry: number) {
      let reply: unknown;
      try { reply = await browser.runtime.sendMessage(windowVisibilityRequest); }
      catch { /* 재시작 중인 워커나 일시적으로 닫힌 메시지 채널 */ }
      if (!active || attempt !== generation || document.hidden) return;
      allowed = reply === true || (reply === checkDocumentFocus && document.hasFocus());
      onChange(allowed);
      // 유효한 비활성 판정은 존중한다. 포커스 전환 중 화면과 Chrome 판정이 엇갈릴 때만 짧게 재확인한다.
      if (!allowed && ((reply !== false && reply !== checkDocumentFocus) || document.hasFocus()) && retry < 2) {
        timer = window.setTimeout(() => void check(retry + 1), retry === 0 ? 180 : 650);
      }
    }
    void check(0);
  }
  function recoverOnClick(event: PointerEvent) {
    if (event.isTrusted && !allowed && !document.hidden) refresh();
  }
  const onMessage: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message: unknown, sender) => {
    if (sender.id === browser.runtime.id && !sender.tab && isRecord(message) &&
      message.scope === envelope.scope && message.protocolVersion === envelope.protocolVersion &&
      message.type === changed) refresh();
  };
  browser.runtime.onMessage.addListener(onMessage);
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('pointerdown', recoverOnClick, true);
  // 일부 포커스 전환에는 Page Visibility 변화가 없다. 문서 포커스 자체를 창 종류로 쓰지는 않는다.
  window.addEventListener('focus', refresh);
  window.addEventListener('blur', refresh);
  refresh();
  function stop() {
    active = false;
    clearTimer();
    generation++;
    browser.runtime.onMessage.removeListener(onMessage);
    document.removeEventListener('visibilitychange', refresh);
    document.removeEventListener('pointerdown', recoverOnClick, true);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('blur', refresh);
  }
  function fromToolbar() {
    // 지금 이 일반 창의 활성 탭으로 보낸 클릭이다. 클릭 전 시작한 조회가 이 사실을 덮지 않게 한다.
    if (!active || document.hidden) return;
    generation++;
    clearTimer();
    allowed = true;
    onChange(true);
  }
  return { refresh, stop, fromToolbar };
}
