import { isImagePetId, type ImagePetId } from './image-pet';
import type { Point } from '../../features/pet/core/interaction';
import { isWalkPath } from './walk-path';
import { petDefinitions, isPetSpeciesId, defaultPetName, getPetDefinition, type PetSpeciesId } from '../../features/pet/definitions/species';
import { patrolElapsed, sampleScenePatrol } from '../../features/pet/core/shared-patrol';
import { remainingDrawnPath } from '../../features/pet/core/drawn-path';
import { createCare } from './care';
import { getSharedScene, isRecord, isSettingsPatch, isSharedScene, type PetState, type SharedScene } from './state';

export const movements = ['walk', 'bounce', 'crawl', 'float', 'spin'] as const;
export type Movement = typeof movements[number];
export const movementLabel = { walk: 'moveWalk', bounce: 'moveBounce', crawl: 'moveCrawl', float: 'moveFloat', spin: 'moveSpin' } as const satisfies Record<Movement, string>;
type Appearance = Pick<PetState['settings'], 'sizePx' | 'speed' | 'personality' | 'scarf' | 'outfit'>;
export interface Companion {
  enabled: boolean;
  movement: Movement;
  settings: Appearance;
  scene: SharedScene;
  savedPath?: Point[];
}
export type CompanionId = PetSpeciesId | ImagePetId;
export const isCompanionId = (id: unknown): id is CompanionId => isPetSpeciesId(id) || isImagePetId(id);
export const companionIds = (state: PetState): CompanionId[] => [...petDefinitions.map(p => p.id), ...Object.keys(state.imagePets ?? {}).filter(isImagePetId)];
export const hasCompanion = (state: PetState, id: unknown): id is CompanionId => isPetSpeciesId(id) || (isImagePetId(id) && !!state.imagePets?.[id]);
export type Companions = Record<PetSpeciesId, Companion>;
export type CompanionPatch = Partial<Pick<Companion, 'enabled' | 'movement'>> & Partial<Appearance>;
const localKeys = ['sizePx', 'speed', 'personality', 'scarf', 'outfit'] as const;
export const isMovement = (v: unknown): v is Movement => movements.some(m => m === v);
export function validCompanionPatch(v: unknown): v is CompanionPatch {
  return isRecord(v) && Object.keys(v).length > 0 && Object.entries(v).every(([key, value]) =>
    key === 'enabled' ? typeof value === 'boolean' : key === 'movement' ? isMovement(value) :
      localKeys.some(k => k === key) && isSettingsPatch({ [key]: value }));
}
export function localSettingsPatch(value: unknown): value is Partial<Appearance> {
  return isSettingsPatch(value) && Object.keys(value).every(key => localKeys.some(k => k === key));
}
export function validCompanion(c: unknown): c is Companion {
  if (!isRecord(c)) return false;
  const hasPath = Object.hasOwn(c, 'savedPath');
  return Object.keys(c).length === 4 + Number(hasPath) && (!hasPath || isWalkPath(c.savedPath)) &&
    typeof c.enabled === 'boolean' && isMovement(c.movement) &&
    isRecord(c.settings) && isSettingsPatch(c.settings) && Object.hasOwn(c.settings, 'sizePx') && Object.hasOwn(c.settings, 'speed') &&
    Object.keys(c.settings).every(k => localKeys.some(key => key === k)) && isSharedScene(c.scene, 4);
}
export function validCompanions(v: unknown): v is Companions {
  return isRecord(v) && Object.keys(v).length === petDefinitions.length && petDefinitions.every(({id}) => validCompanion(v[id]));
}

function appearance(state: PetState): Appearance {
  const { sizePx, speed, personality, scarf, outfit } = state.settings;
  return { sizePx, speed, ...(personality && { personality }), ...(scarf && { scarf }), ...(outfit && { outfit }) };
}
export const companionRoute = (state: PetState) => state.companions ? state.pet.id + ':' + state.pet.speciesId : state.pet.id;
export function rebaseScene(state: PetState, now: number): SharedScene {
  const scene = getSharedScene(state), a = scene.anchor;
  if (a.kind === 'pin') return scene;
  const { path, parade, ...anchor } = a;
  const { speed, reduceMotion } = state.settings;
  const sampleAt = reduceMotion === 'always' ? a.at : now;
  const elapsed = patrolElapsed(a, sampleAt, state.timer);
  const sample = sampleScenePatrol(companionRoute(state), a, sampleAt, speed, state.timer, state.pet.speciesId);
  // 대기 순번과 모서리의 휴식까지 보존하도록 단체 산책의 공통 경로와 누적 시각을 함께 유지한다.
  if (parade && sample.drawnWalk) {
    return { ...scene, anchor: { ...a, at: now, clock: { ...a.clock, elapsed } } };
  }
  const remaining = path && !parade
    ? (reduceMotion === 'always' ? path : remainingDrawnPath(path, elapsed, speed, state.pet.speciesId))
    : undefined;
  const { x, y } = remaining?.[0] ?? (reduceMotion === 'always' && !parade ? a : sample);
  return { ...scene, anchor: { ...anchor, x, y, at: now, ...(remaining && { path: remaining }),
    ...(a.clock && { clock: { ...a.clock, elapsed: 0 } }) } };
}
export function adoptCompanions(state: PetState, now = Date.now()): PetState {
  if (state.companions) return state;
  const scene = rebaseScene(state, now);
  const active = getPetDefinition(state.pet.speciesId).id;
  const restingPets = { ...state.restingPets };
  for (const { id, initialCare } of petDefinitions) if (id !== state.pet.speciesId && !restingPets[id]) {
    restingPets[id] = { name: defaultPetName(id), care: createCare(now, initialCare) };
  }
  const companions = Object.fromEntries(petDefinitions.map(({ id }, i) => [id, {
    enabled: id === active, movement: 'walk',
    settings: id === active ? appearance(state) : { sizePx: 64, speed: 'normal' },
    scene: id === active ? scene : { anchor: { kind: 'patrol', x: .2 + i * .3, y: .8, at: now }, pettedAt: 0 },
  }])) as Companions;
  return { ...state, scene, companions, restingPets };
}
export function companionFor(state: PetState, id: CompanionId): Companion {
  if (isImagePetId(id)) {
    const pet = state.imagePets?.[id];
    if (!pet) throw new RangeError('Missing image pet');
    return pet.companion;
  }
  return state.companions?.[id] ?? {
    enabled: id === state.pet.speciesId, movement: 'walk', settings: appearance(state), scene: getSharedScene(state),
  };
}
// 기존 한 친구 UI와 조작 코드는 이 뷰를 사용한다. 저장은 항상 원본 프로필로 합친다.
export function projectCompanion(state: PetState, id: CompanionId): PetState {
  const c = companionFor(state, id);
  const custom = isImagePetId(id) ? state.imagePets?.[id] : undefined;
  const record = custom ?? (state.pet.speciesId === id ? { name: state.pet.name, care: state.care } :
    state.restingPets[id] ?? { name: defaultPetName(id), care: createCare(state.pet.createdAt, getPetDefinition(id).initialCare) });
  const restingPets = { ...state.restingPets, [state.pet.speciesId]: { name: state.pet.name, care: state.care } };
  delete restingPets[id];
  const settings = { ...state.settings };
  delete settings.personality;
  delete settings.scarf;
  delete settings.outfit;
  return { ...state, pet: { ...state.pet, speciesId: id, name: record.name }, care: record.care, restingPets,
    settings: { ...settings, ...c.settings }, scene: c.scene };
}
export function syncCompanion(state: PetState): PetState {
  if (isImagePetId(state.pet.speciesId) && state.imagePets?.[state.pet.speciesId]) {
    const id = state.pet.speciesId, pet = state.imagePets[id]!;
    return { ...state, imagePets: { ...state.imagePets, [id]: { ...pet, name: state.pet.name, care: state.care,
      companion: { ...pet.companion, scene: getSharedScene(state) } } } };
  }
  if (!state.companions || !isPetSpeciesId(state.pet.speciesId)) return state;
  const id = state.pet.speciesId;
  return { ...state, companions: { ...state.companions, [id]: {
    ...state.companions[id], settings: appearance(state), scene: getSharedScene(state),
  } } };
}
export function mergeCompanion(root: PetState, view: PetState, id: CompanionId): PetState {
  if (root.pet.speciesId === id) return syncCompanion(view);
  const synced = syncCompanion(view);
  if (isImagePetId(id)) return { ...root, imagePets: { ...root.imagePets, [id]: synced.imagePets![id] } };
  return { ...root, companions: synced.companions,
    ...(view.memories && { memories: view.memories }),
    restingPets: { ...root.restingPets, [id]: { name: view.pet.name, care: view.care } } };
}
export function announcementCompanion(state: PetState) {
  const active = companionIds(state).filter(id => companionFor(state, id).enabled);
  return active.find(id => id === state.pet.speciesId) ?? active[0];
}

export function withCompanion(state: PetState, id: CompanionId, companion: Companion): PetState {
  if (isImagePetId(id)) return { ...state, imagePets: { ...state.imagePets, [id]: { ...state.imagePets![id]!, companion } } };
  return { ...state, companions: { ...state.companions!, [id]: companion } };
}
export function mapCompanions(state: PetState, update: (companion: Companion, id: CompanionId) => Companion): PetState {
  let next = state;
  for (const id of companionIds(state)) next = withCompanion(next, id, update(companionFor(state, id), id));
  return next;
}
export const anyCompanionEnabled = (state: PetState) => companionIds(state).some(id => companionFor(state, id).enabled);
