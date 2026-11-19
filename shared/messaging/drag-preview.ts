import { browser } from 'wxt/browser';
import type { Point } from '../../features/pet/core/interaction';
import { isCounter, isRecord, isUnitCoordinate } from '../contracts/state';

export const dragChannel = 'browser-pet:drag-preview:v1';
const intervalMs = 80;
const staleMs = 4000;

export function isDragPoint(value: unknown): value is Point {
  return isRecord(value) && Object.keys(value).length === 2 && isUnitCoordinate(value.x) && isUnitCoordinate(value.y);
}

export function createDragPreview(petId: string, onRemote: (point: Point | null) => void, speciesId?: string) {
  let port: ReturnType<typeof browser.runtime.connect> | undefined;
  let sendTimer: number | undefined;
  let expiry: number | undefined;
  let queued: Point | undefined;
  let lastSent = -Infinity;
  let received = { gesture: -1, seq: -1 };
  let showing = false;
  let disposed = false;

  function clearRemote() {
    window.clearTimeout(expiry);
    expiry = undefined;
    if (!showing) return;
    showing = false;
    onRemote(null);
  }

  const receivedMessage: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (packet: unknown, sender) => {
    if (disposed || sender.id !== browser.runtime.id || sender.tab || !isRecord(packet) ||
      packet.channel !== dragChannel || packet.petId !== petId || packet.speciesId !== speciesId || !isCounter(packet.gesture) || !isCounter(packet.seq) ||
      !isCounter(packet.sentAt) || (packet.point !== null && !isDragPoint(packet.point))) return;
    if (packet.gesture < received.gesture || (packet.gesture === received.gesture && packet.seq <= received.seq)) return;
    received = { gesture: packet.gesture, seq: packet.seq };
    const age = Date.now() - packet.sentAt;
    if (document.hidden || port || packet.point === null || age < -staleMs || age >= staleMs) return clearRemote();
    showing = true;
    onRemote(packet.point);
    window.clearTimeout(expiry);
    expiry = window.setTimeout(clearRemote, staleMs - Math.max(0, age));
  };

  function end() {
    window.clearTimeout(sendTimer);
    sendTimer = undefined;
    queued = undefined;
    lastSent = -Infinity;
    const releasing = port;
    port = undefined;
    try { releasing?.disconnect(); } catch { /* 확장이 이미 종료됐을 수 있다. */ }
  }

  function flush() {
    sendTimer = undefined;
    const point = queued;
    queued = undefined;
    if (!point || disposed || document.hidden) return;
    lastSent = performance.now();
    try {
      if (!port) {
        const next = browser.runtime.connect({ name: dragChannel });
        port = next;
        next.onDisconnect.addListener(() => {
          void browser.runtime.lastError;
          if (port === next) port = undefined;
        });
      }
      port.postMessage({ petId, point, ...(speciesId && { speciesId }) });
    } catch {
      end();
    }
  }

  function move(point: Point) {
    if (disposed || document.hidden || !isDragPoint(point)) return;
    clearRemote();
    queued = point;
    if (sendTimer !== undefined) return;
    const delay = intervalMs - (performance.now() - lastSent);
    if (delay <= 0) flush();
    else sendTimer = window.setTimeout(flush, delay);
  }

  function onVisibility() {
    if (!document.hidden) return;
    end();
    clearRemote();
  }
  browser.runtime.onMessage.addListener(receivedMessage);
  document.addEventListener('visibilitychange', onVisibility);
  return {
    move, end,
    dispose() {
      disposed = true;
      end();
      window.clearTimeout(expiry);
      document.removeEventListener('visibilitychange', onVisibility);
      browser.runtime.onMessage.removeListener(receivedMessage);
    },
  };
}
