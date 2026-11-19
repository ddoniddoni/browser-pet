import { readBackup } from '../contracts/backup';
import { adoptCompanions, mapCompanions } from '../contracts/companions';
import { verifyPetPicture } from '../contracts/image-pet';
import { getSharedScene, isPetState, type SharedScene } from '../contracts/state';
import { t } from '../i18n';
import { adoptSignatureRoster } from './signature-roster';

function releaseHold(scene: SharedScene, now: number): SharedScene {
  const { anchor } = scene;
  if (!anchor.clock?.hold) return scene;
  return { ...scene, anchor: { ...anchor, at: now, clock: { elapsed: anchor.clock.elapsed } } };
}

export async function prepareRestoredState(file: string) {
  const backup = readBackup(file);
  try {
    for (const pet of Object.values(backup.state.imagePets ?? {})) if (pet) await verifyPetPicture(pet);
  } catch { throw new Error(t('imagePetUnreadable')); }
  const now = Date.now();
  const state = adoptCompanions(adoptSignatureRoster(backup.state), now);
  const companions = mapCompanions(state, c => ({ ...c, scene: releaseHold(c.scene, now) }));
  const result = {
    ...companions, scene: releaseHold(getSharedScene(state), now),
    pet: { ...state.pet, id: crypto.randomUUID() }, recentRequests: [], revision: 0,
  };
  delete result.awaitingFirstPet;
  if (!isPetState(result)) throw new Error(t('backupInvalid'));
  return result;
}
