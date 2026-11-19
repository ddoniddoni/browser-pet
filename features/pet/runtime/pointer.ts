import { crossedDragThreshold, type Point } from '../core/interaction';

interface Handlers {
  press(pointer: Point): Point;
  drag(pointer: Point, grab: Point): void;
  end(result: 'click' | 'drop' | 'cancel'): void;
}

// capture 덕분에 문서 전체에 pointermove 리스너를 두지 않는다.
export function bindPetPointer(button: HTMLButtonElement, handlers: Handlers, signal: AbortSignal) {
  let press: { id: number; start: Point; grab: Point; dragging: boolean } | undefined;
  const pointOf = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });

  function move(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const point = pointOf(e);
    press.dragging ||= crossedDragThreshold(press.start, point);
    if (press.dragging) handlers.drag(point, press.grab);
  }

  function finish(result: 'click' | 'drop' | 'cancel') {
    if (!press) return;
    const { id } = press;
    press = undefined;
    if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    handlers.end(result);
  }

  button.addEventListener('pointerdown', e => {
    if (!e.isTrusted || press || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    const start = pointOf(e);
    const origin = handlers.press(start);
    press = { id: e.pointerId, start, grab: { x: start.x - origin.x, y: start.y - origin.y }, dragging: false };
  }, { signal });
  button.addEventListener('pointermove', move, { signal });
  button.addEventListener('pointerup', e => {
    if (!press || e.pointerId !== press.id || e.button !== 0) return;
    move(e);
    finish(press.dragging ? 'drop' : 'click');
  }, { signal });
  const cancelPointer = (e: PointerEvent) => {
    if (e.pointerId === press?.id) finish('cancel');
  };
  button.addEventListener('pointercancel', cancelPointer, { signal });
  button.addEventListener('lostpointercapture', cancelPointer, { signal });
  // 기본 버튼의 Enter/Space 및 보조기술 활성화만 처리한다. 포인터는 pointerup에서 끝난다.
  button.addEventListener('click', e => {
    if (e.isTrusted && e.detail === 0 && !press) handlers.end('click');
  }, { signal });
  return () => finish('cancel');
}
