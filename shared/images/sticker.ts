import { decodePetImage, type ImageLook } from '../contracts/image-pet';
import { drawAccessory } from './photo-accessory-art';
import type { PhotoOutfit } from '../contracts/photo-accessories';

type Background = 'original' | 'transparent' | 'removed' | 'uncertain';
export interface Sticker {
  face: HTMLCanvasElement;
  rim?: HTMLCanvasElement;
  background: Background;
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// 테두리에서 가장 많이 보이는 색을 찾는다. 이미 투명한 스티커의 외곽은 보존한다.
function removeBackdrop({ width, height, data }: ImageData): Background {
  const count = width * height;
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, count - width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const votes = new Map<number, number>();
  let winner = 0, highest = 0, transparent = 0;
  for (const pixel of border) {
    const i = 4 * pixel;
    if (data[i + 3]! < 32) transparent++;
    if (data[i + 3]! < 224) continue;
    const color = (data[i]! >> 4) * 256 + (data[i + 1]! >> 4) * 16 + (data[i + 2]! >> 4);
    const total = (votes.get(color) ?? 0) + 1;
    votes.set(color, total);
    if (total > highest) { highest = total; winner = color; }
  }
  if (transparent > border.length * 0.25) return 'transparent';
  if (highest < border.length * 0.58) return 'uncertain';

  // 바깥에 닿은 영역만 지워 눈이나 무늬 안쪽의 같은 색을 남긴다.
  const red = (winner >> 8) * 16 + 8;
  const green = ((winner >> 4) & 15) * 16 + 8;
  const blue = (winner & 15) * 16 + 8;
  const queue = new Int32Array(count), visited = new Uint8Array(count);
  let front = 0, end = 0;
  function visit(pixel: number) {
    if (visited[pixel]) return;
    visited[pixel] = 1;
    const i = pixel * 4;
    const difference = Math.max(Math.abs(data[i]! - red), Math.abs(data[i + 1]! - green), Math.abs(data[i + 2]! - blue));
    if (data[i + 3]! < 16 || difference <= 34) queue[end++] = pixel;
  }
  border.forEach(visit);
  while (front < end) {
    const pixel = queue[front++]!, x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x + 1 < width) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel + width < count) visit(pixel + width);
  }
  if (end < count * 0.015 || end > count * 0.995) return 'uncertain';
  // 배경색과 섞인 외곽 픽셀은 인접한 실제 윤곽색으로 복원해 밝은 테두리를 줄인다.
  for (let i = 0; i < end; i++) data[queue[i]! * 4 + 3] = 0;
  const source = new Uint8ClampedArray(data);
  const matte = [red, green, blue];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      if (!source[index + 3]) continue;
      for (const direction of [-4, 4, -width * 4, width * 4]) {
        if (source[index + direction + 3] || source[index - direction + 3] !== 255) continue;
        let dot = 0, squared = 0;
        for (let c = 0; c < 3; c++) {
          const delta = source[index - direction + c]! - matte[c]!;
          dot += (source[index + c]! - matte[c]!) * delta;
          squared += delta * delta;
        }
        const coverage = dot / squared;
        if (squared < 900 || coverage <= 0 || coverage >= 0.98) continue;
        let error = 0;
        for (let c = 0; c < 3; c++) {
          const blended = matte[c]! * (1 - coverage) + source[index - direction + c]! * coverage;
          error = Math.max(error, Math.abs(source[index + c]! - blended));
        }
        if (error > 12) continue;
        for (let c = 0; c < 3; c++) data[index + c] = source[index - direction + c]!;
        data[index + 3] = source[index + 3]! * coverage;
        break;
      }
    }
  }
  return 'removed';
}

// 투명한 외곽선까지의 거리로 둥근 높이 지도를 만들고 왼쪽 위에서 빛을 비춘다.
function lightRelief({ width, height, data }: ImageData) {
  const stride = width + 2;
  const depth = new Float32Array(stride * (height + 2));
  const diagonal = Math.SQRT2;
  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      const i = y * stride + x;
      if (data[((y - 1) * width + x - 1) * 4 + 3]! > 80) {
        depth[i] = Math.min(depth[i - 1]! + 1, depth[i - stride]! + 1,
          depth[i - stride - 1]! + diagonal, depth[i - stride + 1]! + diagonal);
      }
    }
  }
  for (let y = height; y > 0; y--) {
    for (let x = width; x > 0; x--) {
      const i = y * stride + x;
      depth[i] = Math.min(depth[i]!, depth[i + 1]! + 1, depth[i + stride]! + 1,
        depth[i + stride + 1]! + diagonal, depth[i + stride - 1]! + diagonal);
    }
  }

  const radius = Math.max(2, Math.min(width, height) * 0.15);
  const step = Math.max(1, Math.round(radius * 0.13));
  for (let i = 0; i < depth.length; i++) {
    const d = Math.min(1, depth[i]! / radius);
    depth[i] = radius * Math.sqrt(d * (2 - d));
  }
  for (let y = 1; y <= height; y++) {
    const row = y * stride;
    const above = Math.max(0, y - step) * stride, below = Math.min(height + 1, y + step) * stride;
    for (let x = 1; x <= width; x++) {
      const i = ((y - 1) * width + x - 1) * 4;
      if (!data[i + 3]) continue;
      const nx = (depth[row + Math.max(0, x - step)]! - depth[row + Math.min(width + 1, x + step)]!) / (2 * step);
      const ny = (depth[above + x]! - depth[below + x]!) / (2 * step);
      const normal = Math.hypot(nx, ny, 1);
      const diffuse = Math.max(0, (0.72 - 0.46 * nx - 0.52 * ny) / normal);
      const shine = Math.pow(Math.max(0, (0.94 - 0.20 * nx - 0.25 * ny) / normal), 14) * 0.14;
      for (let channel = 0; channel < 3; channel++) {
        const color = data[i + channel]!;
        data[i + channel] = color * (0.64 + 0.46 * diffuse + 0.07 * (1 - y / height)) + (255 - color) * shine;
      }
    }
  }
}

export async function makeSticker(image: string, look: ImageLook): Promise<Sticker> {
  const bitmap = await decodePetImage(image);
  const face = makeCanvas(bitmap.width, bitmap.height);
  const ctx = face.getContext('2d', { willReadFrequently: true });
  try {
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(bitmap, 0, 0);
  } finally { bitmap.close(); }
  if (!look.cutout && !look.relief) return { face, background: 'original' };
  const pixels = ctx.getImageData(0, 0, face.width, face.height);
  const background = look.cutout ? removeBackdrop(pixels) : 'original';
  if (look.relief) lightRelief(pixels);
  ctx.putImageData(pixels, 0, 0);
  if (!look.relief) return { face, background };
  const rim = makeCanvas(face.width, face.height);
  const side = rim.getContext('2d');
  if (!side) return { face, background };
  side.drawImage(face, 0, 0);
  // 단면은 그림의 평균색을 섞은 한 가지 재질로 만들어 얇은 윤곽이 반복되어 보이지 않게 한다.
  let red = 0, green = 0, blue = 0, samples = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i + 3]! < 200) continue;
    red += pixels.data[i]!; green += pixels.data[i + 1]!; blue += pixels.data[i + 2]!; samples++;
  }
  const tone = (sum: number) => Math.round(23 + 0.53 * sum / Math.max(1, samples));
  side.globalCompositeOperation = 'source-in';
  side.fillStyle = `rgb(${tone(red)} ${tone(green)} ${tone(blue)})`;
  side.fillRect(0, 0, rim.width, rim.height);
  return { face, rim, background };
}

export function drawSticker(ctx: CanvasRenderingContext2D, {face, rim}: Sticker, size: number, angle: number, outfit?: PhotoOutfit) {
  ctx.clearRect(0, 0, size, size);
  // 세로로 꽉 찬 사진에도 모자를 씌울 여백을 남긴다.
  const dressed = !!(outfit?.head || outfit?.neck);
  const scale = (dressed ? 0.74 : 0.88) * size / Math.max(face.width, face.height);
  const radians = rim ? angle * Math.PI / 180 : 0;
  const width = face.width * scale * Math.cos(radians), height = face.height * scale;
  const dx = rim ? size * 0.12 * Math.sin(radians) : 0, dy = rim ? size * 0.021 : 0;
  const x = (size - width - dx) / 2;
  const y = (size - height - dy) / 2 + (dressed ? size * 0.08 : 0);
  if (rim) {
    const layers = Math.ceil(Math.max(Math.abs(dx), dy));
    for (let i = layers; i >= 1; i--) ctx.drawImage(rim, x + dx * i / layers, y + dy * i / layers, width, height);
  }
  ctx.drawImage(face, x, y, width, height);
  if (outfit?.neck) drawAccessory(ctx, outfit.neck, size, Math.cos(radians), -dx / 2);
  if (outfit?.head) drawAccessory(ctx, outfit.head, size, Math.cos(radians), -dx / 2);
}
