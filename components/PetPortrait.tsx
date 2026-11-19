import { t } from '../shared/i18n';
import { useCallback, useSyncExternalStore } from 'react';
import { isMealTime, mealMs } from '../features/pet/core/meal';
import { getPetDefinition } from '../features/pet/definitions/species';
import type { Outfit, Scarf } from '../shared/contracts/character';
import '../features/pet/rendering/character.css';
import { PetMiniature } from './PetMiniature';

export function PetPortrait({ name, speciesId, scarf, outfit, fedAt = null, still = false }: {
  name: string; speciesId: string; scarf?: Scarf; outfit?: Outfit; fedAt?: number | null; still?: boolean;
}) {
  const subscribe = useCallback((notify: () => void) => {
    const now = Date.now();
    if (!isMealTime(fedAt, now)) return () => {};
    const end = window.setTimeout(notify, fedAt + mealMs - now);
    return () => window.clearTimeout(end);
  }, [fedAt]);
  const eating = useSyncExternalStore(subscribe, () => isMealTime(fedAt, Date.now()));
  const species = getPetDefinition(speciesId);
  return (
    <div className="pet-profile">
      <div className="portrait" data-action={eating ? 'EAT' : undefined} data-still={still || undefined} aria-hidden="true"><PetMiniature action={eating ? 'EAT' : 'IDLE'}
        mode={eating ? 'meal' : 'still'} startedAt={fedAt ?? undefined} still={still} name={name} speciesId={species.id} scarf={scarf} outfit={outfit} /></div>
      <div className="pet-caption"><span>{t('mySpecies', species.displayName)}</span><h2>{name}</h2></div>
    </div>
  );
}
