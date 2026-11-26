import type { NewImagePet, ImagePetEdit, ImagePetId } from '../contracts/image-pet';
import type { Point } from '../../features/pet/core/interaction';
import { localSettingsPatch, type CompanionId, type CompanionPatch } from '../contracts/companions';
import { t } from '../i18n';
import type { AgendaChange, Occurrence } from '../contracts/agenda';
import type { RoomChange } from '../contracts/room';
import type { TimerAction } from '../contracts/timer';
import type { PetSpeciesId } from '../../features/pet/definitions/species';
import type { CareAction, CareReward } from '../contracts/care';
import { browser } from 'wxt/browser';
import { envelope, getState, type WireMutation, type SceneAction } from '../contracts/commands';
import { inspectStoredState, isLegacyPetState, isRecord, stateKey, type PetState, type ResetTarget, type SettingsPatch } from '../contracts/state';

// HTTP 페이지의 Content Script에는 randomUUID가 없을 수 있다. 영수증 ID는 UUID 형식이 아닌 불투명한 키다.
function newRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,'0')).join('');
}

export interface StateIssue {
  code: string;
  message: string;
  recovery?: ResetTarget;
}

class StateError extends Error {
  constructor(readonly issue: StateIssue) { super(issue.message); }
}

function replyIssue(reply: unknown): StateIssue {
  if (!isRecord(reply) || reply.ok !== false || typeof reply.code !== 'string' || typeof reply.message !== 'string') {
    return { code: 'INVALID_REPLY', message: t('invalidReply') };
  }
  const issue: StateIssue = { code: reply.code, message: reply.message };
  if (issue.code === 'STORAGE_CORRUPT' && isRecord(reply.recovery)) {
    const { expectedPetId, expectedRevision } = reply.recovery;
    if ((expectedPetId === null || (typeof expectedPetId === 'string' && expectedPetId.length > 0)) &&
        (expectedRevision === null || (typeof expectedRevision === 'number' && Number.isSafeInteger(expectedRevision) && expectedRevision >= 0))) {
      issue.recovery = { expectedPetId, expectedRevision };
    }
  }
  return issue;
}

type WireCommand = typeof getState | (WireMutation & typeof envelope);
async function requestReply(message: WireCommand, retryTransport: boolean) {
  let reply: unknown;
  for (let attempt = 0; ; attempt++) {
    try {
      reply = await browser.runtime.sendMessage(message);
      if (reply !== undefined) break;
      throw new Error();
    } catch {
      // 저장 뒤 응답만 유실된 경우에도 처음 만든 requestId 그대로 한 번만 보낸다.
      if (attempt === 0 && retryTransport) continue;
      throw new StateError({ code: 'TRANSPORT_ERROR', message: t('transportError') });
    }
  }
  if (!isRecord(reply) || reply.ok !== true) throw new StateError(replyIssue(reply));
  const snapshot = inspectStoredState(reply.state);
  if ('ok' in snapshot) throw new StateError(replyIssue(snapshot));
  return { state: snapshot, careReward: reply.careReward };
}

async function requestState(message: WireCommand, retryTransport = false): Promise<PetState> {
  return (await requestReply(message, retryTransport)).state;
}

export async function careForPet(state: PetState, action: CareAction): Promise<{ state: PetState; careReward: CareReward }> {
  const reply = await requestReply({
    ...envelope, type: action === 'feed' ? 'CARE_FEED' : 'CARE_PET',
    requestId: newRequestId(), expectedPetId: state.pet.id, payload: { speciesId: state.pet.speciesId },
  }, true);
  if (reply.careReward !== 'granted' && reply.careReward !== 'waiting')
    throw new StateError(replyIssue(null));
  return { state: reply.state, careReward: reply.careReward };
}

export function focusInAttic(state: PetState, id: CompanionId) {
  return requestState({ ...envelope, type: 'ATTIC_FOCUS', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { id } }, true);
}

export function startDrawnWalk(state: PetState, speciesId: CompanionId, points: Point[]) {
  return requestState({ ...envelope, type: 'START_DRAWN_WALK', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { speciesId, points } }, true);
}

export function decorateRoom(state: PetState, speciesId: PetSpeciesId, change: RoomChange) {
  return requestState({ ...envelope, type: 'ROOM_DECORATE', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { speciesId, ...change } }, true);
}

export function saveAgenda(state: PetState, payload: AgendaChange) {
  return requestState({ ...envelope, type:'AGENDA_CHANGE', expectedPetId:state.pet.id,
    requestId:newRequestId(), payload }, true);
}

export function acknowledgeAlarm(state: PetState, {id,due}: Occurrence) {
  return requestState({ ...envelope, type:'AGENDA_DISMISS', expectedPetId:state.pet.id,
    requestId:newRequestId(), payload:{id,due} }, true);
}

export function sendTimerAction(state: PetState, payload: TimerAction) {
  return requestState({ ...envelope, type: 'STUDY_TIMER', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload }, true);
}

export function sendSceneAction(state: PetState, action: SceneAction) {
  return requestState({
    ...envelope, ...(state.companions && action.type !== 'SCENE_HIDE' ? { type: 'COMPANION_SCENE' as const,
      payload: { speciesId: state.pet.speciesId as CompanionId, action } } : action),
    expectedPetId: state.pet.id, requestId: newRequestId(),
  }, true);
}

export function patchCompanion(state: PetState, speciesId: CompanionId, patch: CompanionPatch) {
  return requestState({ ...envelope, type: 'COMPANION_PATCH', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { speciesId, patch } }, true);
}

export function patchSettings(state: PetState, patch: SettingsPatch, requestId: string = newRequestId()) {
  if (state.companions && localSettingsPatch(patch)) return requestState({
    ...envelope, type: 'COMPANION_PATCH', expectedPetId: state.pet.id, requestId,
    payload: { speciesId: state.pet.speciesId as PetSpeciesId, patch },
  }, true);
  return requestState({
    ...envelope, type: 'SETTINGS_PATCH', expectedPetId: state.pet.id,
    requestId, payload: patch,
  }, true);
}

export function hideCurrentHost(state: PetState) {
  return requestState({
    ...envelope, type: 'HOST_HIDE_CURRENT', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: {},
  }, true);
}

export function unhideHost(state: PetState, hostname: string) {
  return requestState({
    ...envelope, type: 'HOST_UNHIDE', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { hostname },
  }, true);
}

export function selectSpecies(state: PetState, speciesId: PetSpeciesId) {
  return requestState({
    ...envelope, type: 'PET_SELECT_SPECIES', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { speciesId },
  }, true);
}

export function renamePet(state: PetState, name: string) {
  return requestState({
    ...envelope, type: 'PET_RENAME', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { speciesId: state.pet.speciesId, name },
  }, true);
}

export function restoreBackup({ expectedPetId, expectedRevision }: ResetTarget, file: string) {
  return requestState({
    ...envelope, type: 'RESTORE_BACKUP', expectedPetId, requestId: newRequestId(),
    payload: { expectedRevision, confirmed: true, file },
  }, true);
}

export function resetAll({ expectedPetId, expectedRevision }: ResetTarget) {
  return requestState({
    ...envelope, type: 'RESET_ALL', expectedPetId, requestId: newRequestId(),
    payload: { expectedRevision, confirmed: true },
  }, true);
}

export function watchState(onState: (state: PetState | null) => void, onError?: (message: string, issue?: StateIssue) => void) {
  const changesEvent = browser.storage?.onChanged;
  if (!changesEvent) {
    onState(null);
    onError?.(t('reloadExtension'));
    return () => {};
  }
  let active = true;
  let observedChanges = 0;
  let revision = -1;
  let needsRecoveryRead = false;
  let generation = 0;

  function fail(issue: StateIssue) {
    generation++;
    revision = -1;
    needsRecoveryRead = true;
    onState(null);
    onError?.(issue.message, issue);
  }

  function accept(state: PetState) {
    if (state.revision <= revision) return;
    revision = state.revision;
    onState(state);
  }

  function refresh() {
    const startedAt = observedChanges;
    const readGeneration = generation;
    void requestState(getState, true).then(state => {
      if (active && readGeneration === generation) accept(state);
    }, (err: unknown) => {
      if (active && readGeneration === generation && startedAt === observedChanges) {
        fail(err instanceof StateError ? err.issue : replyIssue(null));
      }
    });
  }

  const changed: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
    const change = changes[stateKey];
    if (!active || area !== 'local' || !change) return;
    observedChanges++;
    if (isLegacyPetState(change.newValue)) {
      // 이전 저장본은 단일 writer에서 이관한다. 이전 응답이 새 스냅샷을 덮지 않게 한다.
      generation++;
      revision = -1;
      refresh();
      return;
    }
    const snapshot = inspectStoredState(change.newValue);
    if ('ok' in snapshot) return fail(replyIssue(snapshot));
    accept(snapshot);
    if (needsRecoveryRead) {
      needsRecoveryRead = false;
      refresh();
    }
  };
  changesEvent.addListener(changed);
  refresh();
  return () => {
    active = false;
    changesEvent.removeListener(changed);
  };
}

export function addImagePet(state: PetState, payload: NewImagePet) {
  return requestState({ ...envelope, type: 'IMAGE_PET_ADD', expectedPetId: state.pet.id, requestId: newRequestId(), payload }, true);
}
export function editImagePet(state: PetState, id: ImagePetId, edit: ImagePetEdit) {
  return requestState({ ...envelope, type: 'IMAGE_PET_LOOK', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { id, ...edit } }, true);
}
export function renameImagePet(state: PetState, id: ImagePetId, name: string) {
  return requestState({ ...envelope, type: 'IMAGE_PET_RENAME', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { id, name } }, true);
}
export function removeImagePet(state: PetState, id: ImagePetId) {
  return requestState({ ...envelope, type: 'IMAGE_PET_REMOVE', expectedPetId: state.pet.id,
    requestId: newRequestId(), payload: { id } }, true);
}
