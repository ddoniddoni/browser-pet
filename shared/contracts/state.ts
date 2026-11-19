import { validAttic, type Attic } from './attic';
import { validImagePets, type ImagePets } from './image-pet';
import { adoptCompanions, validCompanions, type Companions } from './companions';
import { validAgenda, type Agenda } from './agenda';
import type { HighFive } from './high-five';
import { validRooms, type PetRooms } from './room';
import { validAlbum, validPortrait, type MemoryCard, type Portrait } from './keepsakes';
import { t } from '../i18n';
import { defaultPetName, defaultSpeciesId, getPetDefinition, isLegacySpeciesId, legacyStartingCare } from '../../features/pet/definitions/species';
import { createCare, isCareState, type CareReward, type CareState } from './care';
import { outfits, personalities, scarves, type Outfit, type Personality, type Scarf } from './character';
import { maxHiddenHosts, normalizeHostname } from './hostname';

import { isStudyTimer, type StudyTimer } from './timer';

export const stateKey = 'browserPet.state';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface SharedScene {
  // patrol은 화면 여백 안에서, placed-patrol은 끌어 놓은 위치에서 화면 전체를 산책한다.
  anchor: { clock?: { elapsed: number; hold?: string }; kind: 'pin' | 'patrol' | 'placed-patrol'; x: number; y: number; at: number };
  pettedAt: number;
  five?: HighFive;
  play?: { at: number; x: number; y: number; toy?: 'mouse' };
}

interface Receipt {
  requestId: string;
  fingerprint: string;
  appliedRevision: number;
  careReward?: CareReward;
}

interface ProfileState {
  revision: number;
  // 등록 전의 종 ID도 원본 그대로 보존하고, 화면에서만 기본 펫으로 표시한다.
  pet: { id: string; speciesId: string; name: string; createdAt: number };
  settings: {
    enabled: boolean;
    sizePx: 32 | 64 | 96;
    speed: 'slow' | 'normal';
    reduceMotion: 'system' | 'always';
    hideWhileFormFocused: boolean;
    hideInFullscreen: boolean;
    hiddenHostnames: string[];
    ambientSpeech?: boolean;
    personality?: Personality;
    scarf?: Scarf;
    outfit?: Outfit;
  };
  // 이전 v1에는 이 필드가 없다. 생성 시각을 모든 탭의 기본 산책 기준으로 사용한다.
  scene?: SharedScene;
  recentRequests: Receipt[];
}

type LegacyPetState = ProfileState & (
  { schemaVersion: 1 } | { schemaVersion: 2; care: CareState } |
  { schemaVersion: 3; care: CareState; restingCare: Partial<Record<string, CareState>> }
);

interface RestingPet { name: string; care: CareState }
export interface PetState extends ProfileState {
  awaitingFirstPet?: true;
  attic?: Attic;
  companions?: Companions;
  imagePets?: ImagePets;
  agenda?: Agenda;
  timer?: StudyTimer;
  memories?: MemoryCard[];
  rooms?: PetRooms;
  focusPortrait?: Portrait;
  schemaVersion: 4;
  care: CareState;
  // 선택된 동물의 이름과 돌봄 기록은 pet.name과 care에만 둔다.
  restingPets: Partial<Record<string, RestingPet>>;
}

export function migrateLegacyPetState(legacy: LegacyPetState, now: number): PetState {
  if (legacy.schemaVersion === 3) {
    const { restingCare, ...active } = legacy;
    const restingPets: PetState['restingPets'] = {};
    for (const [id, care] of Object.entries(restingCare)) {
      if (care) restingPets[id] = { name: defaultPetName(id), care };
    }
    return { ...active, schemaVersion: 4, restingPets };
  }
  return { ...legacy, schemaVersion: 4, restingPets: {},
    care: legacy.schemaVersion === 2 ? legacy.care : createCare(now, isLegacySpeciesId(legacy.pet.speciesId)
      ? legacyStartingCare(legacy.pet.speciesId) : getPetDefinition(legacy.pet.speciesId).initialCare) };
}

export function createPetState(now = Date.now()): PetState {
  return adoptCompanions({
    schemaVersion: 4, revision: 0, restingPets: {}, care: createCare(now, getPetDefinition(defaultSpeciesId).initialCare),
    pet: { id: crypto.randomUUID(), speciesId: defaultSpeciesId, name: defaultPetName(defaultSpeciesId), createdAt: now },
    settings: {
      enabled: false, sizePx: 64, speed: 'normal', reduceMotion: 'system',
      hideWhileFormFocused: false, hideInFullscreen: false, hiddenHostnames: [],
    },
    recentRequests: [],
  }, now);
}

export function isCounter(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isUnitCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function getSharedScene(state: PetState): SharedScene {
  return state.scene ?? { anchor: { kind: 'patrol', x: 1, y: 1, at: state.pet.createdAt }, pettedAt: 0 };
}

export function isSharedScene(value: unknown, version: 1 | 2 | 3 | 4): value is SharedScene {
  if (!isRecord(value) || !isCounter(value.pettedAt)) return false;
  const hasPlay = Object.hasOwn(value, 'play');
  const hasFive = Object.hasOwn(value, 'five');
  if (Object.keys(value).length !== 2 + Number(hasPlay) + Number(hasFive)) return false;
  if (hasFive) {
    const five = value.five;
    if (version !== 4 || hasPlay || !isRecord(five) || Object.keys(five).length !== 7 ||
      (five.phase !== 'ready' && five.phase !== 'hit') || !isId(five.token) || !isStoredSpeciesId(five.speciesId) ||
      !isUnitCoordinate(five.x) || !isUnitCoordinate(five.y) || (five.facing !== -1 && five.facing !== 1) || !isCounter(five.at)) return false;
  }
  if (hasPlay) {
    const play = value.play;
    if (version === 1 || !isRecord(play)) return false;
    const mouse = version === 4 && play.toy === 'mouse';
    if (Object.keys(play).length !== (mouse ? 4 : 3) ||
      !isCounter(play.at) || !isUnitCoordinate(play.x) || !isUnitCoordinate(play.y)) return false;
  }
  const anchor = value.anchor;
  if (!isRecord(anchor)) return false;
  const hasClock=Object.hasOwn(anchor,'clock');
  if (hasClock) {
    const c=anchor.clock;
    if (version!==4 || anchor.kind==='pin' || !isRecord(c) || !isCounter(c.elapsed) ||
      (Object.hasOwn(c,'hold') ? Object.keys(c).length!==2 || !isId(c.hold) : Object.keys(c).length!==1)) return false;
  }
  return Object.keys(anchor).length === 4+Number(hasClock) &&
    (anchor.kind === 'pin' || anchor.kind === 'patrol' || (version !== 1 && anchor.kind === 'placed-patrol')) &&
    isUnitCoordinate(anchor.x) && isUnitCoordinate(anchor.y) && isCounter(anchor.at);
}

export function isStoredSpeciesId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

export function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value;
}

export function normalizePetName(value: unknown): string | null {
  // 제어문자는 trim 전에 검사해 이름 양끝의 줄바꿈도 거부한다.
  if (typeof value !== 'string' || /[\p{Cc}\p{Cs}\u2028\u2029]/u.test(value)) return null;
  const name = value.trim();
  return name && Array.from(name).length <= 20 ? name : null;
}

export type SettingsPatch = Partial<Omit<PetState['settings'], 'hiddenHostnames'>>;
const fieldChecks = {
  ambientSpeech: (v: unknown) => typeof v === 'boolean',
  personality: (v: unknown) => personalities.some(choice => choice.value === v),
  outfit: (v: unknown) => outfits.some(choice => choice.value === v),
  scarf: (v: unknown) => scarves.some(choice => choice.value === v),
  enabled: (v: unknown) => typeof v === 'boolean',
  sizePx: (v: unknown) => v === 32 || v === 64 || v === 96,
  speed: (v: unknown) => v === 'slow' || v === 'normal',
  reduceMotion: (v: unknown) => v === 'system' || v === 'always',
  hideWhileFormFocused: (v: unknown) => typeof v === 'boolean',
  hideInFullscreen: (v: unknown) => typeof v === 'boolean',
} satisfies Record<keyof SettingsPatch, (v: unknown) => boolean>;

export function isSettingsPatch(value: unknown): value is SettingsPatch {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(k => Object.hasOwn(fieldChecks, k) &&
    fieldChecks[k as keyof SettingsPatch](value[k]));
}

export interface ResetTarget { expectedPetId: string | null; expectedRevision: number | null }

function validState(value: unknown, version: 1 | 2 | 3 | 4) {
  if (!isRecord(value) || value.schemaVersion !== version || !isCounter(value.revision)) return false;
  const firstPet = Object.hasOwn(value, 'awaitingFirstPet');
  if (firstPet && (version !== 4 || value.awaitingFirstPet !== true)) return false;
  const hasAttic = Object.hasOwn(value, 'attic');
  if (hasAttic && (version !== 4 || !validAttic(value.attic))) return false;
  const hasImagePets = Object.hasOwn(value, 'imagePets');
  if (hasImagePets && (version !== 4 || !validImagePets(value.imagePets))) return false;
  const hasCompanions = Object.hasOwn(value, 'companions');
  if (hasCompanions && (version !== 4 || !validCompanions(value.companions))) return false;
  const hasScene = Object.hasOwn(value, 'scene');
  const hasTimer = Object.hasOwn(value, 'timer');
  if (hasTimer && (version !== 4 || !isStudyTimer(value.timer))) return false;
  const hasAlbum = Object.hasOwn(value, 'memories'), hasPortrait = Object.hasOwn(value, 'focusPortrait');
  const memories = hasAlbum ? value.memories : [];
  if ((hasAlbum && version !== 4) || !validAlbum(memories)) return false;
  const hasAgenda = Object.hasOwn(value, 'agenda');
  if (hasAgenda && (version !== 4 || !validAgenda(value.agenda))) return false;
  const hasRooms = Object.hasOwn(value, 'rooms');
  if (hasRooms && (version !== 4 || !validRooms(value.rooms, memories))) return false;
  if (hasPortrait && (version !== 4 || !isStudyTimer(value.timer) || value.timer.mode !== 'focus' ||
      value.timer.minutes < 25 || !validPortrait(value.focusPortrait))) return false;
  if (Object.keys(value).length !== 5 + Number(firstPet) + Number(hasAttic) + Number(hasImagePets) + Number(hasCompanions) + Number(hasAgenda) + Number(hasRooms) + Number(hasAlbum) + Number(hasPortrait) + Number(hasTimer) + Number(hasScene) + Number(version !== 1) + Number(version >= 3) ||
    (hasScene && !isSharedScene(value.scene, version)) || (version !== 1 && !isCareState(value.care))) return false;
  const { pet, settings, recentRequests, revision } = value;
  if (!isRecord(pet) || Object.keys(pet).length !== 4 || !isId(pet.id) ||
    !isStoredSpeciesId(pet.speciesId) ||
    typeof pet.name !== 'string' || normalizePetName(pet.name) !== pet.name || !isCounter(pet.createdAt) ||
    !isRecord(settings)) return false;
  if (version === 3 && (!isRecord(value.restingCare) ||
    Object.entries(value.restingCare).some(([id, care]) => !isStoredSpeciesId(id) || id === pet.speciesId || !isCareState(care)))) return false;
  if (version === 4 && (!isRecord(value.restingPets) || Object.entries(value.restingPets).some(([id, petRecord]) =>
    !isStoredSpeciesId(id) || id === pet.speciesId || !isRecord(petRecord) || Object.keys(petRecord).length !== 2 ||
    typeof petRecord.name !== 'string' || normalizePetName(petRecord.name) !== petRecord.name || !isCareState(petRecord.care)))) return false;
  const { hiddenHostnames, ...fields } = settings;
  const required = ['enabled', 'sizePx', 'speed', 'reduceMotion', 'hideWhileFormFocused', 'hideInFullscreen'];
  if (!isSettingsPatch(fields) || !required.every(key => Object.hasOwn(fields, key)) ||
    (version === 1 && Object.keys(fields).length !== required.length) ||
    !Array.isArray(hiddenHostnames) || hiddenHostnames.length > maxHiddenHosts ||
    !hiddenHostnames.every(host => typeof host === 'string' && normalizeHostname(host) === host) ||
    new Set(hiddenHostnames).size !== hiddenHostnames.length) return false;
  if (!Array.isArray(recentRequests) || recentRequests.length > 128) return false;
  const ids = new Set<string>();
  let lastRevision = 0;
  return recentRequests.every(r => {
    if (!isRecord(r)) return false;
    const hasReward = Object.hasOwn(r, 'careReward');
    if ((hasReward && (version === 1 || (r.careReward !== 'granted' && r.careReward !== 'waiting'))) ||
      Object.keys(r).length !== 3 + Number(hasReward) || !isId(r.requestId) || ids.has(r.requestId) ||
      typeof r.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(r.fingerprint) ||
      !isCounter(r.appliedRevision) || r.appliedRevision <= lastRevision || r.appliedRevision > revision) return false;
    ids.add(r.requestId);
    lastRevision = r.appliedRevision;
    return true;
  });
}

export function isPetState(value: unknown): value is PetState {
  return validState(value, 4);
}

export function isLegacyPetState(value: unknown): value is LegacyPetState {
  return validState(value, 1) || validState(value, 2) || validState(value, 3);
}

// 이전 형식은 Background에서만 이관한다.
export function inspectStoredState(value: unknown) {
  if (isPetState(value)) return value;
  if (isRecord(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > 4)
    return { ok: false, code: 'UNSUPPORTED_SCHEMA', message: t('newerSchema') } as const;
  const pet = isRecord(value) ? value.pet : null;
  const recovery: ResetTarget = {
    expectedPetId: isRecord(pet) && isId(pet.id) ? pet.id : null,
    expectedRevision: isRecord(value) && isCounter(value.revision) ? value.revision : null,
  };
  return { ok: false, code: 'STORAGE_CORRUPT', message: t('corruptState'), recovery } as const;
}
