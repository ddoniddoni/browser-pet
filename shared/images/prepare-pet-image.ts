import { prepareGif } from './prepare-gif';
import { maxPetImageLength, validPetImage, type PetPicture } from '../contracts/image-pet';
import { t } from '../i18n';

export async function preparePetImage(file: File): Promise<PetPicture> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw Error(t('imagePetFormat'));
  if (file.size > 5 * 1024 * 1024) throw Error(t('imagePetTooLarge'));
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (header.length >= 10 && ['GIF87a','GIF89a'].includes(String.fromCharCode(...header.slice(0, 6)))) return prepareGif(file, header);
  const png = [137,80,78,71,13,10,26,10].every((n,i) => header[i] === n);
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
  const webp = String.fromCharCode(...header.slice(0,4)) === 'RIFF' && String.fromCharCode(...header.slice(8,12)) === 'WEBP';
  if (!png && !jpeg && !webp) throw Error(t('imagePetFormat'));
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw Error(t('imagePetUnreadable')); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 32_000_000) throw Error(t('imagePetDimensions'));
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) throw Error(t('imagePetUnreadable'));
    // 원본 비율과 투명도를 유지하고 파일 메타데이터는 저장하지 않는다.
    for (const limit of [512, 384, 256]) {
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = false;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0) { visible = true; break; }
      if (!visible) throw Error(t('imagePetEmpty'));
      const image = canvas.toDataURL('image/png');
      if (image.length <= maxPetImageLength && validPetImage(image)) return { image };
    }
    throw Error(t('imagePetTooLarge'));
  } finally { bitmap.close(); }
}
