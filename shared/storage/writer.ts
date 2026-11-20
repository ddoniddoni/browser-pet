import { applyOutfitPatch, photoOutfit } from '../contracts/photo-accessories';
import { prepareRestoredState } from './restore-backup';
import { atticFor } from '../contracts/attic';
import { verifyPetPicture, isImagePetId, maxImagePets } from '../contracts/image-pet';
import { adoptCompanions, anyCompanionEnabled, hasCompanion, withCompanion, mapCompanions, type CompanionId, companionFor, projectCompanion, syncCompanion, mergeCompanion, rebaseScene } from '../contracts/companions';
import { adoptSignatureRoster } from './signature-roster';
import { changeAgenda, dismissOccurrence, emptyAgenda, ringDue } from '../contracts/agenda';
import { activeFive } from '../contracts/high-five';
import { defaultRoom } from '../contracts/room';
import { mouseUnlockXp, portraitOf, remember, withFinishedFocus } from '../contracts/keepsakes';
import { t } from '../i18n';
import { changeTimer, patrolDelay } from '../contracts/timer';
import { patrolElapsed } from '../../features/pet/core/shared-patrol';
import { isPetSpeciesId, getPetDefinition } from '../../features/pet/definitions/species';
import { createCare, rewardCare, type CareReward } from '../contracts/care';
import { maxHiddenHosts } from '../contracts/hostname';
import { failure, isSceneActionType, type Mutation, type StateCommand, type StateReply } from '../contracts/commands';
import { createPetState, getSharedScene, inspectStoredState, isLegacyPetState, migrateLegacyPetState,
  type PetState } from '../contracts/state';

interface LocalState {
  read(): Promise<unknown>;
  write(state: PetState): Promise<void>;
}

async function fingerprint(command: Mutation) {
  // P1이 이미 발행한 enabled 단독 영수증은 기존 정규 형식을 유지한다.
  const payload = command.type === 'SETTINGS_PATCH' &&
    Object.keys(command.payload).length === 1 && typeof command.payload.enabled === 'boolean'
    ? command.payload.enabled
    : Object.entries(command.payload).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const bytes = new TextEncoder().encode(JSON.stringify([command.type, command.expectedPetId, payload]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function projectSelected(state: PetState) {
  return isPetSpeciesId(state.pet.speciesId) ? projectCompanion(state, state.pet.speciesId) : state;
}

type WriterCommand = StateCommand | { type: 'AGENDA_TICK' };

export function createStateWriter(storage: LocalState) {
  let queue = Promise.resolve();

  async function process(command: WriterCommand): Promise<StateReply> {
    let raw = await storage.read();
    if (raw === undefined) {
      const initial: PetState = { ...createPetState(), awaitingFirstPet: true };
      await storage.write(initial);
      raw = initial;
    }
    // 한 번만 기록해서 이전 모습과 새 모습이 탭마다 순서 없이 그려지지 않게 한다.
    const legacy = isLegacyPetState(raw) ? raw : undefined;
    let stored = inspectStoredState(legacy ? migrateLegacyPetState(legacy, Date.now()) : raw);
    if (!('ok' in stored)) {
      const signed = adoptCompanions(adoptSignatureRoster(stored));
      if (signed !== stored) {
        const revision = stored.revision + 1;
        if (!Number.isSafeInteger(revision)) return failure('STORAGE_ERROR', t('revisionLimit'));
        stored = { ...signed, revision };
        await storage.write(stored);
      } else if (legacy) {
        await storage.write(stored);
      }
    }
    if (command.type === 'AGENDA_TICK') {
      if ('ok' in stored) return stored;
      const { agenda, events } = ringDue(stored.agenda ?? emptyAgenda, Date.now());
      if (!events.length) return { ok:true, state:stored };
      const revision = stored.revision + 1;
      if (!Number.isSafeInteger(revision)) return failure('STORAGE_ERROR', t('revisionLimit'));
      const state = { ...stored, revision, agenda };
      await storage.write(state);
      return { ok:true, state, rings:events };
    }
    if (command.type === 'GET_STATE') return 'ok' in stored ? stored : { ok: true, state: stored };
    const replacing = command.type === 'RESET_ALL' || command.type === 'RESTORE_BACKUP';
    if ('ok' in stored && (stored.code !== 'STORAGE_CORRUPT' || !replacing)) return stored;

    const digest = await fingerprint(command);
    const conflict = () => failure('CONFLICT', t('conflict'));
    let base: PetState;
    let routedRoot: PetState | undefined;
    let routedId: CompanionId | undefined;
    let careReward: CareReward | undefined;
    if (!('ok' in stored)) {
      // 교체 후 재시도된 요청도 이전 프로필 ID를 검사하기 전에 영수증으로 판별한다.
      const requestId = command.requestId;
      const receipt = stored.recentRequests.find(r => r.requestId === requestId);
      if (receipt) {
        if (receipt.fingerprint !== digest) return failure('REQUEST_ID_REUSED', t('requestReused'));
        return { ok: true, state: stored, alreadyApplied: true, appliedRevision: receipt.appliedRevision,
          ...(receipt.careReward && { careReward: receipt.careReward }) };
      }
      if (stored.pet.id !== command.expectedPetId) return conflict();
    }
    const oldRevision = 'ok' in stored ? stored.recovery.expectedRevision ?? 0 : stored.revision;
    if (command.type === 'RESTORE_BACKUP' || command.type === 'RESET_ALL') {
      const target = 'ok' in stored ? stored.recovery : { expectedPetId: stored.pet.id, expectedRevision: stored.revision };
      if (target.expectedPetId !== command.expectedPetId || target.expectedRevision !== command.payload.expectedRevision)
        return conflict();
      if (command.type === 'RESET_ALL') base = createPetState();
      else {
        try { base = await prepareRestoredState(command.payload.file); }
        catch (e) { return failure('VALIDATION_ERROR', e instanceof Error ? e.message : t('backupInvalid')); }
      }
    } else {
      if ('ok' in stored) return stored;
      const fromPet = (command.type === 'CARE_FEED' || command.type === 'CARE_PET') && command.fromPage;
      if ((command.type === 'COMPANION_SCENE' || isSceneActionType(command.type) || command.type === 'HOST_HIDE_CURRENT' || fromPet) && !stored.settings.enabled)
        return conflict();
      if (command.type === 'COMPANION_SCENE' || command.type === 'CARE_FEED' || command.type === 'CARE_PET') {
        const id = command.payload.speciesId;
        if (!hasCompanion(stored, id) || ((command.type === 'COMPANION_SCENE' || fromPet) && !companionFor(stored, id).enabled)) return conflict();
        routedRoot = stored;
        routedId = id;
        stored = projectCompanion(stored, id);
        if (command.type === 'COMPANION_SCENE') command = {
          ...command.payload.action, expectedPetId: command.expectedPetId, requestId: command.requestId,
        };
      }
      const changesRoster = command.type === 'IMAGE_PET_ADD' || command.type === 'IMAGE_PET_REMOVE' ||
        (command.type === 'COMPANION_PATCH' && command.payload.patch.enabled !== undefined) ||
        (command.type === 'SETTINGS_PATCH' && command.payload.enabled !== undefined);
      const previousAttic = changesRoster ? atticFor(stored) : undefined;
      switch (command.type) {
        case 'CARE_FEED':
        case 'CARE_PET': {
          if (command.payload.speciesId !== stored.pet.speciesId) return conflict();
          const now = Date.now(), petting = command.type === 'CARE_PET';
          const result = rewardCare(stored.care, petting ? 'pet' : 'feed', now);
          careReward = result.rewarded ? 'granted' : 'waiting';
          base = { ...stored, care: result.care };
          if (petting) base.scene = { ...getSharedScene(stored), pettedAt: now };
          break;
        }
        case 'SCENE_FIVE_READY': {
          if (command.payload.speciesId !== stored.pet.speciesId) return conflict();
          const { anchor, pettedAt } = getSharedScene(stored);
          base = { ...stored, scene: { anchor, pettedAt, five: {
            ...command.payload, phase: 'ready', at: Date.now(), token: command.requestId,
          } } };
          break;
        }
        case 'SCENE_FIVE_CANCEL':
        case 'SCENE_FIVE_HIT': {
          const scene = getSharedScene(stored), now = Date.now();
          const five = activeFive(scene.five, stored.pet.speciesId, now);
          if (five?.phase !== 'ready' || five.token !== command.payload.token) return conflict();
          base = command.type === 'SCENE_FIVE_HIT'
            ? remember({ ...stored, scene: { ...scene, five: { ...five, phase: 'hit', at: now } } }, 'highfive', now)
            : { ...stored, scene: { anchor: scene.anchor, pettedAt: scene.pettedAt } };
          break;
        }
        case 'SCENE_MOUSE':
        case 'SCENE_PLAY': {
          const mouse = command.type === 'SCENE_MOUSE';
          if (command.type === 'SCENE_MOUSE') {
            if (command.payload.speciesId !== stored.pet.speciesId) return conflict();
            if (stored.care.xp < mouseUnlockXp) return failure('VALIDATION_ERROR', t('toyUnlockAt', mouseUnlockXp));
          }
          const at = Date.now();
          const scene = getSharedScene(stored);
          const { x, y } = command.payload;
          base = remember({ ...stored, scene: { anchor: scene.anchor, pettedAt: scene.pettedAt, play: { x, y, at, ...(mouse && { toy: 'mouse' as const }) } } },
            mouse ? 'mouse' : 'ball', at);
          break;
        }
        case 'SCENE_PIN':
          base = { ...stored, scene: { anchor: { kind: 'pin', ...command.payload, at: Date.now() }, pettedAt: 0 } };
          break;
        case 'SCENE_RESUME': {
          const pin = getSharedScene(stored).anchor;
          if (pin.kind !== 'pin') return conflict();
          base = { ...stored, scene: { anchor: { ...pin, kind: 'placed-patrol', at: Date.now() }, pettedAt: 0 } };
          break;
        }
        case 'SCENE_HOLD': {
          const scene=getSharedScene(stored), a=scene.anchor;
          if (a.kind==='pin' || a.clock?.hold || a.at!==command.payload.anchorAt) return conflict();
          const now=Date.now(), at=Math.min(now,command.payload.at);
          base={...stored,scene:{...scene,anchor:{...a,at:now,clock:{
            elapsed:patrolElapsed(a,at,stored.timer),hold:command.requestId,
          }}}};
          break;
        }
        case 'SCENE_UNHOLD': {
          const scene=getSharedScene(stored), a=scene.anchor;
          if (!a.clock || a.clock.hold!==command.payload.token) return conflict();
          base={...stored,scene:{...scene,anchor:{...a,at:Date.now(),clock:{elapsed:a.clock.elapsed}}}};
          break;
        }
        case 'SCENE_PET':
          base = { ...stored, scene: { ...getSharedScene(stored), pettedAt: Date.now() } };
          break;
        case 'HOST_HIDE_CURRENT': {
          const hosts = stored.settings.hiddenHostnames;
          const { hostname } = command.payload;
          if (!hosts.includes(hostname)) {
            if (hosts.length >= maxHiddenHosts)
              return failure('VALIDATION_ERROR', t('hiddenLimit'));
            base = { ...stored, settings: { ...stored.settings, hiddenHostnames: [...hosts, hostname] } };
          } else base = stored;
          break;
        }
        case 'HOST_UNHIDE': {
          const { hostname } = command.payload;
          base = { ...stored, settings: { ...stored.settings,
            hiddenHostnames: stored.settings.hiddenHostnames.filter(host => host !== hostname) } };
          break;
        }
        case 'SCENE_HIDE':
          base = { ...stored, settings: { ...stored.settings, enabled: false } };
          break;
        case 'IMAGE_PET_ADD': {
          const { id, name, image } = command.payload;
          if (stored.imagePets?.[id]) return conflict();
          if (Object.keys(stored.imagePets ?? {}).length >= maxImagePets) return failure('VALIDATION_ERROR', t('imagePetLimit'));
          try {
            await verifyPetPicture(command.payload);
          }
          catch { return failure('VALIDATION_ERROR', t('imagePetUnreadable')); }
          const now = Date.now();
          base = { ...stored, settings: { ...stored.settings, enabled: true }, imagePets: { ...stored.imagePets, [id]: {
            name, image, ...(command.payload.animation && { animation: command.payload.animation }), ...(command.payload.look && {look:command.payload.look}), createdAt: now, care: createCare(now, { satiety: 70, mood: 70 }),
            companion: { enabled: true, movement: command.payload.movement ?? 'walk', settings: { sizePx: 96, speed: 'normal' },
              scene: { anchor: { kind: 'patrol', x: .5, y: .7, at: now }, pettedAt: 0 } },
          } } };
          break;
        }
        case 'IMAGE_PET_LOOK': {
          const { id, look, movement, name, sizePx, accessories } = command.payload, pet = stored.imagePets?.[id];
          if (!pet) return conflict();
          if (accessories && pet.animation) return failure('VALIDATION_ERROR', t('hatStillOnly'));
          const updated = {
            ...pet, name: name ?? pet.name, ...(look && { look }),
            companion: { ...pet.companion, movement: movement ?? pet.companion.movement,
              settings: { ...pet.companion.settings, ...(sizePx && { sizePx }) } },
          };
          if (accessories) {
            const next = applyOutfitPatch(photoOutfit(pet), accessories);
            delete updated.hat;
            if (next.head || next.neck) updated.accessories = next;
            else delete updated.accessories;
          }
          base = { ...stored, imagePets: { ...stored.imagePets, [id]: updated } };
          break;
        }
        case 'IMAGE_PET_RENAME': {
          const { id, name } = command.payload, pet = stored.imagePets?.[id];
          if (!pet) return conflict();
          base = { ...stored, imagePets: { ...stored.imagePets, [id]: { ...pet, name } } };
          break;
        }
        case 'IMAGE_PET_REMOVE': {
          const { id } = command.payload;
          if (!stored.imagePets?.[id]) return conflict();
          const imagePets = { ...stored.imagePets }; delete imagePets[id];
          base = { ...stored, imagePets };
          if (!anyCompanionEnabled(base)) base.settings = { ...base.settings, enabled: false };
          break;
        }
        case 'COMPANION_PATCH': {
          const { speciesId: id, patch } = command.payload;
          if (!hasCompanion(stored, id)) return conflict();
          const { enabled, movement, ...settings } = patch;
          const c = companionFor(stored, id);
          base = withCompanion(stored, id, { ...c,
            ...(enabled !== undefined && { enabled }), ...(movement && { movement }),
            settings: { ...c.settings, ...settings },
            ...(settings.speed && settings.speed !== c.settings.speed && {
              scene: rebaseScene(projectCompanion(stored, id), Date.now()),
            }),
          });
          base = projectSelected({ ...base, settings: { ...base.settings,
            enabled: anyCompanionEnabled(base) && (enabled === true || stored.settings.enabled),
          } });
          if (settings.outfit === 'santa' && c.settings.outfit !== 'santa' && !isImagePetId(id)) {
            base = mergeCompanion(base, remember(projectCompanion(base, id), 'santa', Date.now()), id);
          }
          break;
        }
        case 'PET_SELECT_SPECIES':
          base = projectCompanion(stored, command.payload.speciesId);
          break;
        case 'ATTIC_FOCUS': {
          const attic = atticFor(stored);
          if (!stored.settings.enabled || !attic.order.includes(command.payload.id)) return conflict();
          base = { ...stored, attic: { ...attic, center: command.payload.id } };
          break;
        }
        case 'ROOM_DECORATE': {
          const { speciesId } = command.payload;
          if (stored.pet.speciesId !== speciesId && atticFor(stored).center !== speciesId) return conflict();
          const room = stored.rooms?.[speciesId] ?? defaultRoom;
          base = stored;
          let next;
          if ('picture' in command.payload) {
            const { picture } = command.payload;
            base = withFinishedFocus(stored, Date.now());
            if (picture !== null && !base.memories?.some(c => c.speciesId === speciesId && c.kind === picture)) return conflict();
            next = { ...room, picture };
          } else if ('box' in command.payload) next = { ...room, box: command.payload.box };
          else next = { ...room, cushion: command.payload.cushion };
          base = { ...base, rooms: { ...base.rooms, [speciesId]: next } };
          break;
        }
        case 'PET_RENAME':
          if (command.payload.speciesId !== stored.pet.speciesId) return conflict();
          base = { ...stored, pet: { ...stored.pet, name: command.payload.name } };
          break;
        case 'AGENDA_DISMISS': {
          if (!stored.agenda) return {ok:true,state:stored};
          const agenda=dismissOccurrence(stored.agenda,command.payload);
          if (agenda===stored.agenda) return {ok:true,state:stored};
          base={...stored,agenda};
          break;
        }
        case 'AGENDA_CHANGE':
          try { base = { ...stored, agenda:changeAgenda(stored.agenda ?? emptyAgenda,command.payload,Date.now()) }; }
          catch (err) { return failure('VALIDATION_ERROR',err instanceof Error ? err.message : t('badSave')); }
          break;
        case 'STUDY_TIMER': {
          const now = Date.now();
          const timer = changeTimer(stored.timer, command.payload, now, command.requestId);
          if (timer === undefined) return conflict();
          base = { ...withFinishedFocus(stored, now) };
          if (command.payload.action === 'start' && timer?.mode === 'focus' && timer.minutes >= 25) {
            const portrait = portraitOf(stored);
            if (portrait) base.focusPortrait = portrait;
          }
          if (timer === null) {
            delete base.focusPortrait;
            delete base.timer;
            const previousTimer = stored.timer;
            base = projectSelected(mapCompanions(base, c => {
              const anchor = c.scene.anchor;
              const delay = patrolDelay(previousTimer, anchor.at, now);
              return delay && anchor.kind !== 'pin' && !anchor.clock?.hold ? {
                ...c, scene: { ...c.scene, anchor: { ...anchor, at: anchor.at + delay } },
              } : c;
            }));
          } else base.timer = timer;
          break;
        }
        case 'SETTINGS_PATCH':
          base = { ...stored, settings: { ...stored.settings, ...command.payload } };
          if (command.payload.outfit === 'santa' && stored.settings.outfit !== 'santa')
            base = remember(base, 'santa', Date.now());
          if (stored.settings.speed !== base.settings.speed || stored.settings.reduceMotion !== base.settings.reduceMotion) {
            const now = Date.now();
            base.scene = rebaseScene(stored, now);
            if (stored.settings.reduceMotion !== base.settings.reduceMotion) {
              const previous = stored;
              base = mapCompanions(base, (c, id) => ({
                ...c, scene: rebaseScene(projectCompanion(previous, id), now),
              }));
            }
          }
          if (command.payload.enabled && !anyCompanionEnabled(base)) {
            const id = getPetDefinition(base.pet.speciesId).id;
            base.companions = { ...base.companions!, [id]: { ...base.companions![id], enabled: true } };
          }
          break;
      }
      if (previousAttic) base = { ...base, attic: atticFor(base, previousAttic) };
    }
    if (base.scene?.five && (!base.settings.enabled || command.type === 'CARE_PET' || command.type === 'CARE_FEED' || command.type === 'SCENE_PET')) {
      base = { ...base, scene: { anchor: base.scene.anchor, pettedAt: base.scene.pettedAt } };
    }
    base = routedRoot && routedId ? mergeCompanion(routedRoot, base, routedId) : syncCompanion(adoptCompanions(base));
    if (!base.settings.enabled && base.companions) {
      base = projectSelected(mapCompanions(base, c => c.scene.five ? {
        ...c, scene: { anchor: c.scene.anchor, pettedAt: c.scene.pettedAt },
      } : c));
    }
    const revision = oldRevision + 1;
    if (!Number.isSafeInteger(revision)) return failure('STORAGE_ERROR', t('revisionLimit'));
    const receipt = { requestId: command.requestId, fingerprint: digest, appliedRevision: revision,
      ...(careReward && { careReward }) };
    const state: PetState = {
      ...base, revision, recentRequests: [...base.recentRequests.slice(-127), receipt],
    };
    if (state.settings.enabled) delete state.awaitingFirstPet;
    await storage.write(state);
    return { ok: true, state, appliedRevision: revision, ...(careReward && { careReward }) };
  }

  return (command: WriterCommand) => {
    const reply = queue.then(() => process(command)).catch(() =>
      failure('STORAGE_ERROR', t('storageError')));
    queue = reply.then(() => {});
    return reply;
  };
}
