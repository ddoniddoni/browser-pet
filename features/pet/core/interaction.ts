export interface Point { x: number; y: number }
export interface Viewport { width: number; height: number; size: number }

export function crossedDragThreshold(start: Point, point: Point) {
  return Math.hypot(point.x - start.x, point.y - start.y) >= 6;
}

export function fitToViewport(point: Point, { width, height, size }: Viewport): Point {
  return {
    x: Math.max(0, Math.min(width - size, point.x)),
    y: Math.max(0, Math.min(height - size, point.y)),
  };
}

export function dragPosition(pointer: Point, grab: Point, viewport: Viewport): Point {
  return fitToViewport({ x: pointer.x - grab.x, y: pointer.y - grab.y }, viewport);
}

// 펫의 왼쪽 위가 이동할 수 있는 영역. 고정 해제 직후에는 출발점을 여백 안으로 밀지 않는다.
export function roamingArea(view: Viewport, padded: boolean) {
  const w = Math.max(0, view.width - view.size), h = Math.max(0, view.height - view.size);
  const x = padded ? Math.min(16, w / 4) : 0, y = padded ? Math.min(16, h / 4) : 0;
  return { x, y, width: w - 2*x, height: h - 2*y };
}
