import { browser } from 'wxt/browser';
import { isDisplayClick, isSavedDisplay, type DisplayClick } from '../../shared/contracts/display-click';
import { identifySender } from '../../shared/contracts/commands';
import { pageReportRequest, type PageReport } from '../../shared/contracts/page-report';
import { isRecord } from '../../shared/contracts/state';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { mountPagePets } from '../../features/pet/runtime/page-pets';
import { displayReason } from '../../features/pet/runtime/page-visibility';
import characterCss from '../../features/pet/rendering/character.css?inline';
import type { PetState } from '../../shared/contracts/state';
import { watchState } from '../../shared/messaging/state';
import { watchWindowVisibility } from '../../shared/messaging/window-visibility';
import overlayCss from './overlay.css?inline';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  allFrames: false,
  async main(ctx) {
    let current: PetState | null = null;
    let mountedPetId: string | undefined;
    let started = false;
    let windowAllowed = false;
    let stateFailed = false;
    let preview: DisplayClick | undefined;
    let lastClick = 0;
    let previewTimer: number | undefined;
    function clearPreview() {
      window.clearTimeout(previewTimer);
      previewTimer = undefined;
      preview = undefined;
    }
    const ui = await createShadowRootUi(ctx, {
      name: 'browser-pet-overlay', position: 'inline', anchor: () => document.documentElement,
      css: overlayCss + characterCss,
      onMount: container => current ? mountPagePets(container, current) : undefined,
      onRemove: pet => { mountedPetId = undefined; pet?.remove(); },
    });
    if (ctx.isInvalid) return;

    function reason(): PageReport {
      if (!current) return stateFailed ? 'stateError' : 'loading';
      return displayReason(preview?.enabled ?? current.settings.enabled, document.hidden, windowAllowed);
    }

    // 전체화면 요소는 문서의 z-index보다 위에 있다. 그때만 수동 popover로 같은 최상위 레이어에 그린다.
    function fullscreenLayer() {
      const host = ui.shadowHost;
      if (!host.isConnected || !ui.mounted) return;
      if (document.fullscreenElement && typeof host.showPopover === 'function') {
        host.popover = 'manual';
        if (host.matches(':popover-open')) host.hidePopover();
        host.showPopover();
      } else if (host.hasAttribute('popover')) {
        host.hidePopover();
        host.removeAttribute('popover');
      }
    }
    function reconcile() {
      if (!started || ctx.isInvalid) return;
      const state = current;
      const show = reason() === 'visible';
      if (ui.mounted && (!show || !ui.shadowHost.isConnected || mountedPetId !== state?.pet.id)) ui.remove();
      if (!state || !show) return;
      if (ui.mounted) ui.mounted.update(state);
      else {
        mountedPetId = state.pet.id;
        ui.mount();
        fullscreenLayer();
      }
    }

    let stopWatching: (() => void) | undefined;
    let stopWindow: ReturnType<typeof watchWindowVisibility> | undefined;
    function accept(state: PetState | null) {
      if (state && current && state.revision < current.revision) return;
      if (preview && (!state || state.pet.id !== preview.petId ||
        state.recentRequests.some(r => r.requestId === preview?.requestId))) clearPreview();
      const justEnabled = state?.settings.enabled && !current?.settings.enabled;
      current = state;
      stateFailed = false;
      if (justEnabled && !windowAllowed) stopWindow?.refresh();
      reconcile();
    }
    function start() {
      if (started || ctx.isInvalid) return;
      started = true;
      stopWindow = watchWindowVisibility(allowed => { windowAllowed = allowed; reconcile(); });
      stateFailed = false;
      stopWatching = watchState(accept, () => { stateFailed = true; reconcile(); });
    }
    function stop() {
      started = false;
      clearPreview();
      stopWindow?.stop();
      stopWindow = undefined;
      windowAllowed = false;
      stopWatching?.();
      stopWatching = undefined;
      if (ui.mounted) ui.remove();
      current = null;
    }

    const report: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message: unknown, sender, respond) => {
      if (!started || ctx.isInvalid || !isRecord(message) || message.scope !== pageReportRequest.scope ||
        message.protocolVersion !== pageReportRequest.protocolVersion || identifySender(sender, browser.runtime.id) !== 'popup') return;
      if (isSavedDisplay(message)) {
        // 같은 프로필의 단조 증가 revision으로 늦은 저장/응답을 구별한다.
        accept(message.state);
        if (message.meet === true && current?.pet.id === message.state.pet.id && current.settings.enabled) ui.mounted?.greet(current);
        respond({ ok: true });
        return;
      }
      if (isDisplayClick(message)) {
        if (message.phase === 'cancel') {
          if (preview?.requestId === message.requestId) clearPreview();
        } else if (!document.hidden && current?.pet.id === message.petId && message.at > lastClick &&
          Date.now() - message.at < 2500) {
          lastClick = message.at;
          clearPreview();
          if (!current.recentRequests.some(r => r.requestId === message.requestId)) {
            preview = message;
            // 팝업이 저장 도중 닫히거나 실패 응답이 유실돼도 임시 표시를 남기지 않는다.
            previewTimer = window.setTimeout(() => { clearPreview(); reconcile(); }, 2500);
          }
        }
        // 툴바 팝업에서 지정한 탭만 대상이다. 일반 탭으로 연 확장 UI는 창 판정을 우회하지 않는다.
        if (message.phase === 'preview' && message.at === lastClick && !sender.tab && !document.hidden && current?.pet.id === message.petId) {
          stopWindow?.fromToolbar();
        }
        reconcile();
        respond({ ok: true });
        return;
      }
      if (message.type !== pageReportRequest.type) return;
      const status = reason();
      respond({ status: status === 'visible' && (!ui.mounted || !ui.shadowHost.isConnected) ? 'detached' : status });
    };
    browser.runtime.onMessage.addListener(report);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(report));
    ctx.addEventListener(document, 'pointerdown', event => {
      if (event.isTrusted && ui.mounted && !ui.shadowHost.isConnected) reconcile();
    }, { capture: true });
    ctx.addEventListener(document, 'visibilitychange', () => {
      if (document.hidden) windowAllowed = false;
      reconcile();
    });
    ctx.addEventListener(document, 'fullscreenchange', fullscreenLayer);
    ctx.addEventListener(window, 'pagehide', stop);
    ctx.addEventListener(window, 'pageshow', start);
    ctx.onInvalidated(stop);
    start();
  },
});
