import { validLegacyHat, validOutfitPatch } from './photo-accessories';
import { maxBackupBytes } from './backup';
import { isMovement, isCompanionId, validCompanionPatch, type CompanionId, type CompanionPatch } from './companions';
import { isImagePetId, validPetImage, validAnimation, type NewImagePet, type ImagePetEdit, validImageLook, type ImagePetId } from './image-pet';
import { validAgendaChange, validOccurrence, type Occurrence, type AgendaChange, type Ring } from './agenda';
import { isCushion, isPicture, type RoomChange } from './room';
import { t } from '../i18n';
import { isPetSpeciesId, type PetSpeciesId } from '../../features/pet/definitions/species';
import { isTimerAction, type TimerAction } from './timer';
import type { CareReward } from './care';
import { normalizeHostname } from './hostname';
import { isCounter, isId, isRecord, isStoredSpeciesId, isSettingsPatch, isUnitCoordinate, normalizePetName,
  type PetState, type ResetTarget, type SettingsPatch } from './state';

export const envelope = { scope: 'browser-pet', protocolVersion: 1 } as const;
export const getState = { ...envelope, type: 'GET_STATE' } as const;
type Target = { expectedPetId: string; requestId: string };
export type SceneAction =
  | { type: 'SCENE_FIVE_READY'; payload: { x: number; y: number; facing: -1 | 1; speciesId: string } }
  | { type: 'SCENE_FIVE_HIT' | 'SCENE_FIVE_CANCEL'; payload: { token: string } }
  | { type: 'SCENE_MOUSE'; payload: { x: number; y: number; speciesId: string } }
  | { type: 'SCENE_PLAY'; payload: { x: number; y: number } }
  | { type: 'SCENE_PIN'; payload: { x: number; y: number } }
  | { type: 'SCENE_HOLD'; payload: { anchorAt:number; at:number } }
  | { type: 'SCENE_UNHOLD'; payload: { token:string } }
  | { type: 'SCENE_RESUME'; payload: Record<string, never> }
  | { type: 'SCENE_PET'; payload: Record<string, never> }
  | { type: 'SCENE_HIDE'; payload: Record<string, never> };

export function isSceneActionType(type: unknown): type is SceneAction['type'] {
  return type === 'SCENE_FIVE_READY' || type === 'SCENE_FIVE_HIT' || type === 'SCENE_FIVE_CANCEL' ||
    type === 'SCENE_MOUSE' || type === 'SCENE_PLAY' || type === 'SCENE_PIN' || type === 'SCENE_RESUME' || type === 'SCENE_HOLD' || type === 'SCENE_UNHOLD' || type === 'SCENE_PET' || type === 'SCENE_HIDE';
}

type CareMutation = Target & { type: 'CARE_FEED' | 'CARE_PET'; payload: { speciesId: string }; fromPage?: true };

type AgendaMutation = Target & { type: 'AGENDA_CHANGE'; payload: AgendaChange };

export type Mutation =
  | (Target & { type: 'IMAGE_PET_ADD'; payload: NewImagePet })
  | (Target & { type: 'IMAGE_PET_LOOK'; payload: { id: ImagePetId } & ImagePetEdit })
  | (Target & { type: 'IMAGE_PET_RENAME'; payload: { id: ImagePetId; name: string } })
  | (Target & { type: 'IMAGE_PET_REMOVE'; payload: { id: ImagePetId } })
  | (Target & { type: 'COMPANION_PATCH'; payload: { speciesId: CompanionId; patch: CompanionPatch } })
  | (Target & { type: 'COMPANION_SCENE'; payload: { speciesId: CompanionId; action: SceneAction } })
  | CareMutation
  | AgendaMutation
  | (Target & { type: 'AGENDA_DISMISS'; payload: Occurrence })
  | (Target & { type: 'STUDY_TIMER'; payload: TimerAction })
  | (Target & SceneAction)
  | (Target & { type: 'HOST_HIDE_CURRENT'; payload: { hostname: string } })
  | (Target & { type: 'HOST_UNHIDE'; payload: { hostname: string } })
  | (Target & { type: 'SETTINGS_PATCH'; payload: SettingsPatch })
  | (Target & { type: 'PET_SELECT_SPECIES'; payload: { speciesId: PetSpeciesId } })
  | (Target & { type: 'ATTIC_FOCUS'; payload: { id: CompanionId } })
  | (Target & { type: 'ROOM_DECORATE'; payload: { speciesId: PetSpeciesId } & RoomChange })
  | (Target & { type: 'PET_RENAME'; payload: { speciesId: string; name: string } })
  | { type: 'RESTORE_BACKUP'; requestId: string; expectedPetId: string | null;
      payload: { confirmed: true; expectedRevision: number | null; file: string } }
  | { type: 'RESET_ALL'; requestId: string; expectedPetId: string | null;
      payload: { confirmed: true; expectedRevision: number | null } };
// 숨길 hostname은 송신자가 지정하지 않는다. 승인한 명령에서만 Background가 채운다.
export type WireMutation = Exclude<Mutation, CareMutation | { type: 'HOST_HIDE_CURRENT' }> | Omit<CareMutation, 'fromPage'> |
  (Target & { type: 'HOST_HIDE_CURRENT'; payload: Record<string, never> });
export type StateCommand = typeof getState | Mutation;
export type ErrorCode = 'INVALID_MESSAGE' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' |
  'STORAGE_ERROR' | 'STORAGE_CORRUPT' | 'UNSUPPORTED_SCHEMA' | 'REQUEST_ID_REUSED';
export function failure(code: ErrorCode, message: string) {
  return { ok: false as const, code, message };
}
export type StateReply = { ok: true; state: PetState; rings?: Ring[]; alreadyApplied?: boolean; appliedRevision?: number; careReward?: CareReward } |
  { ok: false; code: ErrorCode; message: string; recovery?: ResetTarget };

interface Sender { id?: string; url?: string; frameId?: number; tab?: { id?: number }; origin?: string }
export function identifySender(sender: Sender, ownId: string) {
  if (sender.id !== ownId || !sender.url) return null;
  try {
    const url = new URL(sender.url);
    if (url.protocol === 'chrome-extension:' && url.host === ownId &&
      (!sender.origin || sender.origin === 'chrome-extension://' + ownId)) {
      if (url.pathname === '/popup.html') return 'popup';
      if (url.pathname === '/options.html') return 'options';
    }
    if ((url.protocol === 'http:' || url.protocol === 'https:') && sender.frameId === 0 &&
      isCounter(sender.tab?.id) && (!sender.origin || sender.origin === url.origin)) return 'content';
  } catch { /* Chrome이 제공한 URL로 분류할 수 없으면 거부한다. */ }
  return null;
}

export function parseCommand(message: Record<string, unknown>, source: ReturnType<typeof identifySender>,
  senderUrl?: string): StateCommand | ReturnType<typeof failure> {
  if (message.scope !== envelope.scope || message.protocolVersion !== envelope.protocolVersion)
    return failure('INVALID_MESSAGE', t('badFormat'));
  if (!source) return failure('FORBIDDEN', t('internalOnly'));
  if (message.type === 'GET_STATE') {
    if (Object.keys(message).length !== 3) return failure('INVALID_MESSAGE', t('badRead'));
    return getState;
  }
  const { type } = message;
  const isCare = type === 'CARE_FEED' || type === 'CARE_PET';
  if (type !== 'IMAGE_PET_LOOK' && type !== 'IMAGE_PET_ADD' && type !== 'IMAGE_PET_RENAME' && type !== 'IMAGE_PET_REMOVE' && type !== 'COMPANION_PATCH' && type !== 'COMPANION_SCENE' && type !== 'AGENDA_DISMISS' && type !== 'AGENDA_CHANGE' && type !== 'ATTIC_FOCUS' && type !== 'ROOM_DECORATE' && type !== 'STUDY_TIMER' && !isCare && !isSceneActionType(type) && type !== 'PET_RENAME' && type !== 'SETTINGS_PATCH' && type !== 'RESET_ALL' && type !== 'RESTORE_BACKUP' &&
    type !== 'HOST_HIDE_CURRENT' && type !== 'HOST_UNHIDE' && type !== 'PET_SELECT_SPECIES')
    return failure('INVALID_MESSAGE', t('badRequest'));
  const contentOnly = type === 'COMPANION_SCENE' || isSceneActionType(type) || type === 'HOST_HIDE_CURRENT';
  if (((isCare || type === 'AGENDA_DISMISS') ? source === 'options' : contentOnly !== (source === 'content')) ||
      ((type === 'RESET_ALL' || type === 'RESTORE_BACKUP' || type === 'HOST_UNHIDE') && source !== 'options'))
    return failure('FORBIDDEN', t('wrongScreen'));
  const { payload, requestId, expectedPetId } = message;
  const invalid = () => failure('VALIDATION_ERROR', t('badSave'));
  if (Object.keys(message).length !== 6 || !isRecord(payload) || !isId(requestId)) return invalid();
  if (type === 'RESET_ALL' || type === 'RESTORE_BACKUP') {
    const { confirmed, expectedRevision } = payload;
    if (confirmed !== true ||
      (expectedRevision !== null && !isCounter(expectedRevision)) ||
      (expectedPetId !== null && !isId(expectedPetId))) return invalid();
    if (type === 'RESTORE_BACKUP') {
      if (Object.keys(payload).length !== 3 || typeof payload.file !== 'string' || payload.file.length > maxBackupBytes) return invalid();
      return { type, expectedPetId, requestId, payload: { confirmed, expectedRevision, file: payload.file } };
    }
    if (Object.keys(payload).length !== 2) return invalid();
    return { type, expectedPetId, requestId, payload: { confirmed, expectedRevision } };
  }
  if (!isId(expectedPetId)) return invalid();
  if (type === 'IMAGE_PET_LOOK') {
    const { id, look, movement, name, sizePx, hat, accessories } = payload;
    if (!isImagePetId(id) || Object.keys(payload).length < 2 ||
        Object.keys(payload).some(k => !['id','look','movement','name','sizePx','hat','accessories'].includes(k))) return invalid();
    const edit: ImagePetEdit = {};
    if ('accessories' in payload) {
      if ('hat' in payload || !validOutfitPatch(accessories)) return invalid();
      edit.accessories = accessories;
    } else if ('hat' in payload) {
      if (hat !== null && !validLegacyHat(hat)) return invalid();
      edit.accessories = { head: hat && { ...hat, kind: 'santaHat' } };
    }
    if ('look' in payload) { if (!validImageLook(look)) return invalid(); edit.look = look; }
    if ('movement' in payload) { if (!isMovement(movement)) return invalid(); edit.movement = movement; }
    if ('name' in payload) { const valid = normalizePetName(name); if (!valid) return invalid(); edit.name = valid; }
    if ('sizePx' in payload) { if (sizePx !== 32 && sizePx !== 64 && sizePx !== 96) return invalid(); edit.sizePx = sizePx; }
    return { type, expectedPetId, requestId, payload: { id, ...edit } };
  }
  if (type === 'IMAGE_PET_ADD' || type === 'IMAGE_PET_RENAME' || type === 'IMAGE_PET_REMOVE') {
    const { id } = payload;
    if (!isImagePetId(id)) return invalid();
    if (type === 'IMAGE_PET_REMOVE') return Object.keys(payload).length === 1 ? { type, expectedPetId, requestId, payload: { id } } : invalid();
    const name = normalizePetName(payload.name);
    if (!name) return invalid();
    if (type === 'IMAGE_PET_RENAME') return Object.keys(payload).length === 2 ? { type, expectedPetId, requestId, payload: { id, name } } : invalid();
    const { image, look, animation, movement } = payload;
    if (!validPetImage(image) || Object.keys(payload).some(key => !['id','name','image','look','animation','movement'].includes(key))) return invalid();
    const result: NewImagePet = { id, name, image };
    if (Object.hasOwn(payload, 'look')) { if (!validImageLook(look)) return invalid(); result.look = look; }
    if (Object.hasOwn(payload, 'animation')) { if (!validAnimation(animation, image)) return invalid(); result.animation = animation; }
    if (Object.hasOwn(payload, 'movement')) { if (!isMovement(movement)) return invalid(); result.movement = movement; }
    return { type, expectedPetId, requestId, payload: result };
  }
  if (type === 'COMPANION_PATCH') {
    if (Object.keys(payload).length !== 2 || !isCompanionId(payload.speciesId) || !validCompanionPatch(payload.patch)) return invalid();
    if (isImagePetId(payload.speciesId) && Object.keys(payload.patch).some(k => !['enabled','sizePx','movement','speed'].includes(k))) return invalid();
    return { type, expectedPetId, requestId, payload: { speciesId: payload.speciesId, patch: payload.patch } };
  }
  if (type === 'COMPANION_SCENE') {
    const { action, speciesId } = payload;
    if (Object.keys(payload).length !== 2 || !isCompanionId(speciesId) || !isRecord(action) ||
      Object.keys(action).length !== 2 || !isSceneActionType(action.type) || action.type === 'SCENE_HIDE') return invalid();
    if (isImagePetId(speciesId) && ['SCENE_PLAY','SCENE_MOUSE','SCENE_FIVE_READY','SCENE_FIVE_HIT','SCENE_FIVE_CANCEL'].includes(action.type)) return invalid();
    const parsed = parseCommand({ ...envelope, ...action, expectedPetId, requestId }, source, senderUrl);
    if ('ok' in parsed) return parsed;
    if (!isSceneActionType(parsed.type)) return invalid();
    return { type, expectedPetId, requestId, payload: { speciesId, action: action as SceneAction } };
  }
  if (type === 'AGENDA_DISMISS') {
    return validOccurrence(payload) ? { type, expectedPetId, requestId, payload } : invalid();
  }
  if (type === 'AGENDA_CHANGE') {
    if (source !== 'popup') return failure('FORBIDDEN', t('wrongScreen'));
    if (!validAgendaChange(payload)) return invalid();
    return { type, expectedPetId, requestId, payload };
  }
  if (type === 'ATTIC_FOCUS') {
    if (source !== 'popup') return failure('FORBIDDEN', t('wrongScreen'));
    if (!isCompanionId(payload.id) || Object.keys(payload).length !== 1) return invalid();
    return { type, expectedPetId, requestId, payload: { id: payload.id } };
  }
  if (type === 'ROOM_DECORATE') {
    if (source !== 'popup') return failure('FORBIDDEN', t('wrongScreen'));
    const { speciesId } = payload;
    if (!isPetSpeciesId(speciesId) || Object.keys(payload).length !== 2) return invalid();
    if (typeof payload.box === 'boolean') return { type, requestId, expectedPetId, payload: { speciesId, box: payload.box } };
    if (isCushion(payload.cushion)) return { type, requestId, expectedPetId, payload: { speciesId, cushion: payload.cushion } };
    if (isPicture(payload.picture)) return { type, requestId, expectedPetId, payload: { speciesId, picture: payload.picture } };
    return invalid();
  }
  if (type === 'STUDY_TIMER') {
    if (source !== 'popup') return failure('FORBIDDEN', t('timerInPopup'));
    if (!isTimerAction(payload)) return invalid();
    return { type, expectedPetId, requestId, payload };
  }
  if (isCare) {
    if (Object.keys(payload).length !== 1 || !isStoredSpeciesId(payload.speciesId)) return invalid();
    return { type, expectedPetId, requestId, payload: { speciesId: payload.speciesId }, ...(source === 'content' ? { fromPage: true as const } : {}) };
  }
  if (type === 'HOST_HIDE_CURRENT') {
    if (Object.keys(payload).length !== 0) return invalid();
    try {
      const url = new URL(senderUrl ?? '');
      const hostname = normalizeHostname(url.hostname);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && hostname)
        return { type, expectedPetId, requestId, payload: { hostname } };
    } catch { /* senderUrl은 Chrome이 전달한 값만 사용한다. */ }
    return failure('FORBIDDEN', t('cannotHideSite'));
  }
  if (type === 'HOST_UNHIDE') {
    const hostname = normalizeHostname(payload.hostname);
    if (Object.keys(payload).length !== 1 || !hostname) return invalid();
    return { type, expectedPetId, requestId, payload: { hostname } };
  }
  if (isSceneActionType(type)) {
    const fields = Object.keys(payload).length;
    switch (type) {
      case 'SCENE_FIVE_READY': {
        const { x, y, facing, speciesId } = payload;
        if (fields !== 4 || !isUnitCoordinate(x) || !isUnitCoordinate(y) || (facing !== -1 && facing !== 1) ||
          !isPetSpeciesId(speciesId)) return invalid();
        return { type, expectedPetId, requestId, payload: { x, y, facing, speciesId } };
      }
      case 'SCENE_HOLD':
        if (fields!==2 || !isCounter(payload.anchorAt) || !isCounter(payload.at)) return invalid();
        return {type,expectedPetId,requestId,payload:{anchorAt:payload.anchorAt,at:payload.at}};
      case 'SCENE_UNHOLD':
      case 'SCENE_FIVE_HIT':
      case 'SCENE_FIVE_CANCEL':
        if (fields !== 1 || !isId(payload.token)) return invalid();
        return { type, expectedPetId, requestId, payload: { token: payload.token } };
      case 'SCENE_MOUSE':
        if (fields !== 3 || !isPetSpeciesId(payload.speciesId) || !isUnitCoordinate(payload.x) || !isUnitCoordinate(payload.y)) return invalid();
        return { type, expectedPetId, requestId, payload: { x: payload.x, y: payload.y, speciesId: payload.speciesId } };
      case 'SCENE_PLAY':
      case 'SCENE_PIN':
        if (fields !== 2 || !isUnitCoordinate(payload.x) || !isUnitCoordinate(payload.y)) return invalid();
        return { type, expectedPetId, requestId, payload: { x: payload.x, y: payload.y } };
      default:
        if (fields !== 0) return invalid();
        return { type, expectedPetId, requestId, payload: {} };
    }
  }
  if (type === 'PET_SELECT_SPECIES') {
    if (Object.keys(payload).length !== 1 || !isPetSpeciesId(payload.speciesId))
      return failure('VALIDATION_ERROR', t('chooseValidPet'));
    return { type, expectedPetId, requestId, payload: { speciesId: payload.speciesId } };
  }
  if (type === 'PET_RENAME') {
    const name = normalizePetName(payload.name);
    if (Object.keys(payload).length !== 2 || !isStoredSpeciesId(payload.speciesId)) return invalid();
    if (!name)
      return failure('VALIDATION_ERROR', t('invalidName'));
    return { type, expectedPetId, requestId, payload: { speciesId: payload.speciesId, name } };
  }
  if (!isSettingsPatch(payload)) return invalid();
  if (source === 'popup' && Object.keys(payload).some(k => k !== 'enabled'))
    return failure('FORBIDDEN', t('onlyOptions'));
  return { type, expectedPetId, requestId, payload };
}
