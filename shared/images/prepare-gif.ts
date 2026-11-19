import { maxAnimationLength, maxAnimationPixels, maxGifFrames, maxPetImageLength, type PetPicture } from '../contracts/image-pet';
import { t } from '../i18n';

// 브라우저가 합성한 GIF 프레임만 보관한다. 페이지에서는 원본 디코더나 외부 URL이 필요 없다.
export async function prepareGif(file: File, header: Uint8Array): Promise<PetPicture> {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const width = view.getUint16(6, true), height = view.getUint16(8, true);
  if (!width || !height || width * height > 32_000_000) throw Error(t('imagePetDimensions'));
  if (typeof ImageDecoder === 'undefined') throw Error(t('gifUnavailable'));
  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: 'image/gif', preferAnimation: true });
  try {
    await decoder.completed;
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
    if (!count) throw Error(t('imagePetUnreadable'));
    if (count > maxGifFrames) throw Error(t('gifFrameLimit', maxGifFrames));
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw Error(t('imagePetUnreadable'));
    const initialScale = Math.min(1, 256 / Math.max(width, height), Math.sqrt(maxAnimationPixels / (count * width * height)));
    for (const fraction of [1, 0.7, 0.5]) {
      canvas.width = Math.max(1, Math.floor(width * initialScale * fraction));
      canvas.height = Math.max(1, Math.floor(height * initialScale * fraction));
      const frames: { image: string; ms: number }[] = [];
      let length = 0, firstVisible = -1;
      for (let i = 0; i < count; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          if (firstVisible < 0 && ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((v, j) => j % 4 === 3 && v > 0)) firstVisible = i;
          const png = canvas.toDataURL('image/png');
          length += png.length;
          if (png.length > maxPetImageLength || length > maxAnimationLength) break;
          frames.push({ image: png, ms: Math.max(20, Math.min(655350, Math.round((image.duration || 100000) / 1000))) });
        } finally { image.close(); }
      }
      if (frames.length !== count) continue;
      if (firstVisible < 0) throw Error(t('imagePetEmpty'));
      const [first, ...rest] = [...frames.slice(firstVisible), ...frames.slice(0, firstVisible)];
      return { image: first!.image, ...(rest.length > 0 && { animation: { firstMs: first!.ms, frames: rest } }) };
    }
    throw Error(t('imagePetTooLarge'));
  } finally { decoder.close(); }
}
