import type { Point, Viewport } from '../core/interaction';

export type OccupiedSide = { below: boolean; depth: number; oppositeDepth?: number };

// 펫 가운데를 기준으로 위를 먼저 쓰고, 이미 사용 중인 공간만큼 다음 표시를 밀어낸다.
export function headCallout(point: Point, view: Viewport, width: number, height: number,
  margin: number, gap: number, occupied?: OccupiedSide) {
  const above = point.y - gap - height - (occupied && !occupied.below ? occupied.depth : occupied?.oppositeDepth ?? 0);
  const under = point.y + view.size + gap + (occupied?.below ? occupied.depth : occupied?.oppositeDepth ?? 0);
  const fitsAbove = above >= margin;
  const fitsBelow = under + height <= view.height - margin;
  const below = !fitsAbove && (fitsBelow || view.height - under > above + height);
  const top = Math.max(0, Math.min(view.height - height, below ? under : above));
  const center = point.x + view.size / 2;
  const left = Math.max(margin, Math.min(center - width / 2, view.width - width - margin));
  return { left:left-point.x, top:top-point.y, tip:Math.max(10,Math.min(center-left,width-10)),
    below, fits:fitsAbove || fitsBelow };
}

export function placeBubble(node:HTMLElement, layout:ReturnType<typeof headCallout>) {
  node.style.left = layout.left+'px';
  node.style.top = layout.top+'px';
  node.style.setProperty('--tip-x',layout.tip+'px');
  node.toggleAttribute('data-below',layout.below);
}
