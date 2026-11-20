import { accessoryCatalog, type AccessoryKind, type PhotoAccessory } from '../contracts/photo-accessories';

// 천, 접힌 끝, 털 챙, 방울을 같은 100 × 72 좌표계에 그린다.
const cloth = 'M8 51 Q13 26 34 11 Q46 1 57 4 Q76 7 90 29 L84 35 Q74 28 62 27 Q57 35 66 50 Z';
const fold = 'M46 12 Q58 4 68 13 Q82 23 89 30 L84 36 Q72 27 59 27 Q52 24 46 12 Z';
const trim = 'M7 49 C23 46 48 44 65 46 Q72 47 73 55 L73 59 Q74 64 68 65 C53 64 26 69 12 70 Q5 70 4 64 L3 57 Q2 52 7 49 Z';
const pom = 'M82 29 C85 24 90 25 93 28 Q100 29 98 35 Q100 40 94 43 Q88 47 84 42 Q78 42 79 36 Q77 32 82 29 Z';
type Layer = readonly [fill: string, path: string, stroke?: string];
const art: Record<AccessoryKind, readonly Layer[]> = {
  santaHat: [
    ['#c74750', cloth, '#713f3c'], ['#a23645', fold, '#713f3c'],
    ['#fff1d7', trim, '#713f3c'], ['#fff5df', pom, '#713f3c'],
  ],
  apricotBow: [
    // 두 갈래로 갈라진 리본 끝과 접힌 천의 음영.
    ['#c06a58', 'M43 32 Q40 51 26 60 L36 59 42 66 Q52 52 53 37Z M51 33 Q58 55 72 62 L73 55 82 55 Q67 45 61 29Z', '#804d46'],
    ['#f3a28c', 'M47 29 Q23 5 12 6 Q7 8 5 19 Q1 37 10 47 Q18 52 45 39Z M54 28 Q79 4 90 6 Q98 13 97 32 Q97 44 89 48 Q75 49 55 38Z', '#804d46'],
    ['#d67d72', 'M13 20 Q29 21 44 31 Q28 27 17 29Z M58 32 Q73 20 89 19 L84 27 Q71 26 58 33Z'],
    ['#f9c382', 'M45 25 Q51 20 58 25 L59 38 Q55 44 46 41 Q41 35 45 25Z', '#804d46'],
  ],
  sproutClip: [
    ['#e5b66a', 'M16 68 L72 52 Q83 49 86 55 Q89 63 79 67 L24 79 Q15 81 13 76 Q11 71 16 68Z', '#69553e'],
    ['#749662', 'M45 62 Q52 44 50 26 L55 24 Q61 42 51 62Z', '#4d6949'],
    ['#97b87c', 'M50 45 C32 46 12 34 8 14 Q7 9 13 10 C33 10 48 19 50 45Z', '#4d6949'],
    ['#accb87', 'M52 33 C52 11 74 2 91 4 Q94 6 91 11 C81 32 67 37 52 33Z', '#4d6949'],
    ['#769c66', 'M18 17 Q39 25 48 42 Q31 26 18 17Z M56 30 Q70 13 83 10 Q70 19 56 30Z'],
  ],
  starBandana: [
    ['#536881', 'M80 13 Q91 7 98 12 L92 22 98 28 Q88 31 79 24Z', '#39495e'],
    ['#607f99', 'M5 9 Q42 22 88 10 Q87 27 69 42 L52 60 Q46 66 40 59 L14 32 Q4 22 5 9Z', '#39495e'],
    ['#9bb5bf', 'M5 8 Q43 20 89 8 L87 18 Q43 30 7 18Z', '#39495e'],
    ['#f6d181', 'M48 29 L51 37 60 37 53 43 55 51 48 46 41 51 43 42 36 37 45 36Z'],
    ['#e9d8ad', 'M23 29 L25 33 23 36 21 32Z M68 25 L70 29 68 32 66 28Z'],
  ],
  bellCollar: [
    ['#55847c', 'M4 5 Q48 22 96 5 L93 16 Q54 36 8 18Z', '#3c5b55'],
    ['#abd2ba', 'M12 11 Q42 21 63 18 Q46 24 14 16Z'],
    ['#eab75c', 'M46 18 Q49 14 54 18 L55 29 47 30Z', '#79603d'],
    ['#eebf64', 'M35 32 Q35 25 46 24 Q62 21 66 34 Q71 48 57 54 Q46 58 38 51 Q28 44 35 32Z', '#79603d'],
    ['#ffe9ac', 'M37 33 Q40 26 49 27 Q51 29 48 31 Q42 32 40 37 Q36 38 37 33Z'],
    ['#745a3f', 'M34 42 Q49 46 65 39 L65 42 Q58 45 53 46 L54 49 Q53 52 50 51 Q48 50 49 46 Q40 47 34 45Z'],
  ],
};
const paths = new Map<AccessoryKind, Path2D[]>();

// 옷장의 견본과 펫에 씌운 장식이 같은 도안을 사용한다.
export function paintAccessory(ctx: CanvasRenderingContext2D, kind: AccessoryKind) {
  const layers = art[kind];
  let shapes = paths.get(kind);
  if (!shapes) {
    shapes = layers.map(([, path]) => new Path2D(path));
    paths.set(kind, shapes);
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.8;
  layers.forEach(([fill, , stroke], i) => {
    const path = shapes[i]!;
    ctx.fillStyle = fill;
    ctx.fill(path);
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(path); }
  });
}

export function drawAccessory(ctx: CanvasRenderingContext2D, piece: PhotoAccessory, size: number, yawScale: number, offsetX: number) {
  ctx.save();
  ctx.translate(size / 2 + offsetX, size / 2);
  ctx.scale(yawScale, 1);
  ctx.translate(size * (piece.x / 100 - .5), size * (piece.y / 100 - .5));
  ctx.rotate(piece.angle * Math.PI / 180);
  const scale = size * piece.width / 10_000;
  ctx.scale(scale, scale);
  ctx.translate(-50, -accessoryCatalog[piece.kind].height / 2);
  paintAccessory(ctx, piece.kind);
  ctx.restore();
}
