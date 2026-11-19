import { isAlbumSpeciesId, type AlbumSpeciesId } from '../../features/pet/definitions/species';
import { memoryKinds, type MemoryCard, type MemoryKind } from './keepsakes';

export const cushions = ['moss', 'apricot', 'indigo'] as const;
export type Cushion = typeof cushions[number];
export type PetRoom = { cushion: Cushion; picture: MemoryKind | null; box?: boolean };
export type PetRooms = Partial<Record<AlbumSpeciesId, PetRoom>>;
export type RoomChange = { cushion: Cushion } | { picture: MemoryKind | null } | { box: boolean };
export const defaultRoom: PetRoom = { cushion: 'moss', picture: null };

export const isCushion = (v: unknown): v is Cushion => cushions.some(c => c === v);
export const isPicture = (v: unknown): v is MemoryKind | null => v === null || memoryKinds.some(k => k === v);

export function validRooms(value: unknown, memories: readonly MemoryCard[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, entry]: [string, unknown]) => {
    if (!isAlbumSpeciesId(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const room = entry as Record<string, unknown>;
    return Object.keys(room).every(k => k === 'cushion' || k === 'picture' || k === 'box') &&
      (!Object.hasOwn(room,'box') || typeof room.box === 'boolean') && isCushion(room.cushion) && isPicture(room.picture) &&
      (room.picture === null || memories.some(card => card.speciesId === id && card.kind === room.picture));
  });
}
