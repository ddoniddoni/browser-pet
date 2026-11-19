import { useRef, useState } from 'react';
import { isPetSpeciesId } from '../../features/pet/definitions/species';
import type { PetState } from '../../shared/contracts/state';
import type { RoomChange } from '../../shared/contracts/room';
import { decorateRoom } from '../../shared/messaging/state';
import { t } from '../../shared/i18n';

export function useRoomDecorator(state: PetState | null) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function change(patch: RoomChange) {
    if (!state || lock.current) return;
    const { speciesId } = state.pet;
    if (!isPetSpeciesId(speciesId)) return;
    lock.current = true; setBusy(true); setError('');
    try { await decorateRoom(state, speciesId, patch); }
    catch (e) { setError(e instanceof Error ? e.message : t('saveError')); }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, error, change };
}
export type RoomDecorator = ReturnType<typeof useRoomDecorator>;
