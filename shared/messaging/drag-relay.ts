import { isCompanionId } from '../contracts/companions';
import { browser } from 'wxt/browser';
import { identifySender } from '../contracts/commands';
import { isId, isRecord } from '../contracts/state';
import type { Point } from '../../features/pet/core/interaction';
import { dragChannel, isDragPoint } from './drag-preview';

// 제스처가 끝나면 포트와 수신 탭 목록을 버린다. 포인터의 경로는 저장하지 않는다.
export function registerDragRelay() {
  let lastGesture = 0;
  let current: { gesture: number; finish: () => void } | undefined;
  browser.runtime.onConnect.addListener(port => {
    if (port.name !== dragChannel) return;
    const source = port.sender?.tab?.id;
    if (source === undefined || !port.sender || identifySender(port.sender, browser.runtime.id) !== 'content') {
      port.disconnect();
      return;
    }
    const gesture = lastGesture = Math.max(Date.now(), lastGesture + 1);
    let petId: string | undefined;
    let speciesId: string | undefined;
    let recipients: number[] | undefined;
    let point: Point | null = null;
    let seq = 0;
    let closed = false;

    function broadcast() {
      if (!recipients) return;
      const packet = { channel: dragChannel, petId, ...(speciesId && { speciesId }), gesture, seq: ++seq, sentAt: Date.now(), point };
      for (const tabId of recipients) {
        // 새 탭, 제한된 사이트, 닫힌 창 등은 수신자가 없을 수 있다.
        void browser.tabs.sendMessage(tabId, packet, { frameId: 0 }).catch(() => {});
      }
    }
    function finish() {
      if (closed) return;
      closed = true;
      if (current?.gesture !== gesture) return;
      point = null;
      broadcast();
      current = undefined;
    }

    port.onMessage.addListener((message: unknown) => {
      if (closed || !isRecord(message) || Object.keys(message).length !== (Object.hasOwn(message, 'speciesId') ? 3 : 2) ||
        (Object.hasOwn(message, 'speciesId') && !isCompanionId(message.speciesId)) || !isId(message.petId) ||
        !isDragPoint(message.point) || (petId && (message.petId !== petId || message.speciesId !== speciesId))) return;
      point = message.point;
      if (petId) return broadcast();
      if (gesture !== lastGesture) return;
      petId = message.petId;
      speciesId = typeof message.speciesId === 'string' ? message.speciesId : undefined;
      current?.finish();
      current = { gesture, finish };
      // 창마다 현재 선택된 탭의 ID만 사용한다. URL, 제목, 페이지 값은 읽지 않는다.
      void browser.tabs.query({ active: true }).then(tabs => {
        if (closed) return;
        recipients = tabs.flatMap(tab => tab.id !== undefined && tab.id !== source ? [tab.id] : []);
        broadcast();
      }).catch(() => { /* 진행 중 미리보기만 생략하며 최종 위치는 저장으로 전달된다. */ });
    });
    port.onDisconnect.addListener(finish);
  });
}
