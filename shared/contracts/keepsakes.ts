import { isPetSpeciesId, isAlbumSpeciesId, legacyIds, petDefinitions, type AlbumSpeciesId } from '../../features/pet/definitions/species';
import { outfits, scarves, wornScarf, type Outfit, type Scarf } from './character';
import type { PetState } from './state';

export const mouseUnlockXp = 7;
export const memoryKinds = ['ball', 'mouse', 'santa', 'focus', 'highfive'] as const;
export type MemoryKind = typeof memoryKinds[number];
export interface Portrait { speciesId: AlbumSpeciesId; name: string; scarf: Scarf; outfit: Outfit }
export interface MemoryCard extends Portrait { kind: MemoryKind; day: string }

export function portraitOf(state: PetState): Portrait | undefined {
  const { speciesId, name } = state.pet;
  if (!isPetSpeciesId(speciesId)) return;
  return { speciesId, name, scarf: wornScarf(speciesId, state.settings.scarf), outfit: state.settings.outfit ?? 'none' };
}

function localDay(at: number) {
  const date = new Date(at);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

// 종과 사건 하나당 한 장. 이름이나 옷이 나중에 바뀌어도 그림은 바뀌지 않는다.
export function remember(state: PetState, kind: MemoryKind, at: number, portrait = portraitOf(state)): PetState {
  if (!portrait || state.memories?.some(card => card.kind === kind && card.speciesId === portrait.speciesId)) return state;
  return { ...state, memories: [...(state.memories ?? []), { ...portrait, kind, day: localDay(at) }] };
}

// 자연 만료된 세션은 팝업을 닫았어도 마감 시각으로 복원한다. 확인하기 전에는 읽기만 한다.
export function withFinishedFocus(state: PetState, now: number) {
  const timer = state.timer;
  return state.focusPortrait && timer?.phase === 'running' && timer.mode === 'focus' && timer.minutes >= 25 && now >= timer.endsAt
    ? remember(state, 'focus', timer.endsAt, state.focusPortrait) : state;
}

export function validPortrait(value: unknown, card = false): value is Portrait {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return Object.keys(p).length === (card ? 6 : 4) && isAlbumSpeciesId(p.speciesId) &&
    typeof p.name === 'string' && !!p.name && p.name.trim() === p.name && Array.from(p.name).length <= 20 &&
    !/[\p{Cc}\p{Cs}\u2028\u2029]/u.test(p.name) &&
    outfits.some(item => item.value === p.outfit) && scarves.some(item => item.value === p.scarf);
}

export function validAlbum(value: unknown): value is MemoryCard[] {
  if (!Array.isArray(value) || value.length > (petDefinitions.length + legacyIds.length) * memoryKinds.length) return false;
  const seen = new Set<string>();
  return value.every((c: unknown) => {
    if (!validPortrait(c, true) || !('kind' in c) || typeof c.kind !== 'string' || !('day' in c) ||
      !memoryKinds.some(k => k === c.kind) || typeof c.day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(c.day)) return false;
    const date = new Date(c.day + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== c.day) return false;
    const key = c.speciesId + ':' + c.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
