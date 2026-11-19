import type { Point } from './interaction';
import type { Facing } from './patrol';

// 창 크기가 달라도 같은 경로다. 속도와 구간 길이는 900 × 600 기준 화면의 px로 계산한다.
const referenceView = { width: 900, height: 600 } as const;
const bearings = [-142, -94, 154, -43, -116, 173, -66, -161, 106, -130, -32, -103];

export function createRoamRoute(random: () => number) {
  let length = 0, lapX = 0, lapY = 0;
  const legs = bearings.map(bearing => {
    const angle = (bearing + (random() - .5) * 18) * Math.PI / 180;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const stride = 105 + random() * 120;
    const leg = { start: length, end: length + stride, dx: lapX, dy: lapY, ux, uy };
    lapX += ux * stride;
    lapY += uy * stride;
    length += stride;
    return leg;
  });

  // 양 축을 독립적으로 접는다. 가장자리를 넘은 만큼 되돌아가므로 모서리에서도 멈추지 않는다.
  function phase(value: number) {
    const r = value % 2;
    return r < 0 ? r + 2 : r;
  }
  const fold = (p: number) => p <= 1 ? p : 2 - p;

  function tangent(p: number, velocity: number) {
    if (p === 0) return Math.abs(velocity);
    if (p === 1) return -Math.abs(velocity);
    return p < 1 ? velocity : -velocity;
  }

  return (origin: Point, distance: number) => {
    const laps = Math.floor(distance / length), rest = distance % length;
    const leg = legs.find(part => rest < part.end)!;
    const along = rest - leg.start;
    const px = phase(origin.x + (laps * lapX + leg.dx + along * leg.ux) / referenceView.width);
    const py = phase(origin.y + (laps * lapY + leg.dy + along * leg.uy) / referenceView.height);
    const dx = tangent(px, leg.ux) / referenceView.width;
    const dy = tangent(py, leg.uy) / referenceView.height;
    const facing: Facing = dx >= 0 ? 1 : -1;
    return { x: fold(px), y: fold(py), dx, dy, facing };
  };
}
