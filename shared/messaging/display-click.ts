import { browser } from 'wxt/browser';
import { displayPacket, savedDisplayPacket, type DisplayClick } from '../contracts/display-click';
import { t } from '../i18n';
import { isPageReport, pageReportRequest } from '../contracts/page-report';
import type { PetState } from '../contracts/state';
import { patchSettings } from './state';

let lastClick = 0;

// '켠다/끈다'는 한 번 결정한다. 같은 클릭 ID가 페이지 표시와 저장 영수증을 연결한다.
export async function toggleFromPopup(state: PetState, enabled: boolean, meet = false) {
  const click: DisplayClick = { requestId: crypto.randomUUID(), at: lastClick = Math.max(Date.now(), lastClick + 1),
    petId: state.pet.id, enabled };
  const delivery = (async () => {
    const win = await browser.windows.getCurrent();
    if (win.type !== 'normal' || win.id === undefined || win.state === 'minimized') return;
    const [tab] = await browser.tabs.query({ active: true, windowId: win.id });
    if (tab?.id === undefined) return;
    const target = tab.id;
    if (meet) {
      const report: unknown = await browser.tabs.sendMessage(target, pageReportRequest, { frameId: 0 });
      if (!isPageReport(report) || (report.status !== 'disabled' && report.status !== 'visible')) return;
    }
    await browser.tabs.sendMessage(target, displayPacket(click, 'preview'), { frameId: 0 });
    return target;
  })().catch(() => undefined);
  try {
    if (meet && await delivery === undefined) throw new Error(t('meetOnWeb'));
    const saved = await patchSettings(state, { enabled }, click.requestId);
    const confirmation = delivery.then(tab => {
      if (tab !== undefined) return browser.tabs.sendMessage(tab, savedDisplayPacket(saved, meet), { frameId: 0 });
    }).catch(() => {});
    if (meet) await confirmation;
    return saved;
  } catch (error) {
    void delivery.then(tab => {
      if (tab !== undefined) return browser.tabs.sendMessage(tab, displayPacket(click, 'cancel'), { frameId: 0 });
    }).catch(() => {});
    throw error;
  }
}
