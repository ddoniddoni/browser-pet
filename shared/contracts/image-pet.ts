import { isCareState, type CareState } from './care';
import { validCompanion, type Companion, type Movement } from './companions';
import { isCounter, isRecord, normalizePetName } from './state';

export const maxImagePets = 5;
export const maxPetImageLength = 400_000;
export type ImagePetId = `image-${string}`;
export interface ImageLook { cutout: boolean; relief: boolean; faces?: 'left' | 'right' }
export interface PetAnimation { firstMs: number; frames: { image: string; ms: number }[] }
export function sameAnimation(a?: PetAnimation, b?: PetAnimation) {
  return a === b || (!!a && !!b && a.firstMs === b.firstMs && a.frames.length === b.frames.length &&
    a.frames.every((frame, i) => frame.ms === b.frames[i]!.ms && frame.image === b.frames[i]!.image));
}
export interface ImagePetEdit { look?: ImageLook; movement?: Movement; name?: string; sizePx?: 32 | 64 | 96 }
export interface PetPicture { image: string; animation?: PetAnimation }
export interface NewImagePet extends PetPicture { id: ImagePetId; name: string; look?: ImageLook; movement?: Movement }
export const maxGifFrames = 120;
export const maxAnimationLength = 1_000_000;
export const maxAnimationPixels = 512 * 512;
export const originalLook: ImageLook = { cutout: false, relief: false };
export const newImagePetLook: ImageLook = { cutout: true, relief: false };
export function validImageLook(value: unknown): value is ImageLook {
  return isRecord(value) && Object.keys(value).length === 2 + Number(Object.hasOwn(value, 'faces')) &&
    (!Object.hasOwn(value, 'faces') || value.faces === 'left' || value.faces === 'right') && typeof value.cutout === 'boolean' && typeof value.relief === 'boolean';
}
export interface ImagePet extends PetPicture { look?: ImageLook; name: string; care: CareState; createdAt: number; companion: Companion }
export type ImagePets = Partial<Record<ImagePetId, ImagePet>>;
export function isImagePetId(value: unknown): value is ImagePetId {
  return typeof value === 'string' && /^image-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}
// 저장 형식은 외부 URL, SVG나 원본 파일 대신 크기가 제한된 PNG만 허용한다.
function pngDimensions(value: unknown) {
  if (typeof value !== 'string' || value.length > maxPetImageLength || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    const header = Uint8Array.from(atob(value.slice(22, 66)), c => c.charCodeAt(0));
    if (header.length < 33 || [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82].some((byte,i) => header[i] !== byte)) return false;
    const view = new DataView(header.buffer), width = view.getUint32(16), height = view.getUint32(20);
    return width > 0 && height > 0 && width <= 512 && height <= 512 && { width, height };
  } catch { return false; }
}
export const validPetImage = (value: unknown): value is string => !!pngDimensions(value);
const validDelay = (ms: unknown) => isCounter(ms) && ms >= 20 && ms <= 655350;
export function validAnimation(value: unknown, poster: string): value is PetAnimation {
  if (!isRecord(value) || Object.keys(value).length !== 2 || !validDelay(value.firstMs) ||
      !Array.isArray(value.frames) || !value.frames.length || value.frames.length >= maxGifFrames) return false;
  const size = pngDimensions(poster);
  if (!size || size.width * size.height * (value.frames.length + 1) > maxAnimationPixels) return false;
  let length = poster.length;
  return value.frames.every(frame => {
    if (!isRecord(frame) || Object.keys(frame).length !== 2 || !validDelay(frame.ms) || typeof frame.image !== 'string') return false;
    length += frame.image.length;
    if (length > maxAnimationLength) return false;
    const next = pngDimensions(frame.image);
    return next && next.width === size.width && next.height === size.height;
  });
}
export function validImagePets(value: unknown): value is ImagePets {
  return isRecord(value) && Object.keys(value).length <= maxImagePets && Object.entries(value).every(([id, pet]) =>
    isImagePetId(id) && isRecord(pet) && Object.keys(pet).length === 5 + Number(Object.hasOwn(pet, 'look')) + Number(Object.hasOwn(pet, 'animation')) &&
    (!Object.hasOwn(pet, 'look') || validImageLook(pet.look)) && normalizePetName(pet.name) === pet.name &&
    typeof pet.name === 'string' && validPetImage(pet.image) && (!Object.hasOwn(pet, 'animation') || validAnimation(pet.animation, pet.image)) && isCareState(pet.care) && isCounter(pet.createdAt) &&
    validCompanion(pet.companion) && !pet.companion.scene.five && !pet.companion.scene.play);
}
export function petImageBlob(image: string) {
  const bytes = Uint8Array.from(atob(image.slice(22)), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}
export async function decodePetImage(image: string) {
  if (!validPetImage(image)) throw new Error('Invalid pet image');
  const bitmap = await createImageBitmap(petImageBlob(image));
  if (bitmap.width > 512 || bitmap.height > 512) { bitmap.close(); throw new Error('Invalid pet dimensions'); }
  return bitmap;
}

export async function verifyPetPicture(picture: PetPicture) {
  for (const frame of [picture.image, ...(picture.animation?.frames.map(f => f.image) ?? [])]) {
    const bitmap = await decodePetImage(frame);
    bitmap.close();
  }
}
