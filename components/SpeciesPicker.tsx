import { t } from '../shared/i18n';
import { useId, useRef, useState } from 'react';
import { getPetDefinition, isPetSpeciesId, petDefinitions, type PetSpeciesId } from '../features/pet/definitions/species';
import concept from '../assets/signatures/attic-friends.webp';
import type { PetState } from '../shared/contracts/state';
import { selectSpecies } from '../shared/messaging/state';

const portraits = {
  kkogit: [0, 0, 505, 550], nurung: [500, 60, 595, 490], pongdang: [1104, 0, 430, 550],
} as const;

export function ChoicePortrait({ id, clip }: { id: PetSpeciesId; clip: string }) {
  const crop = portraits[id];
  const [x, y, width, height] = crop;
  return <svg className="choice-portrait" viewBox={crop.join(' ')} aria-hidden="true" focusable="false">
    <defs><clipPath id={clip}><rect {...{ x, y, width, height }} /></clipPath></defs>
    <image href={concept} width="1536" height="1024" clipPath={'url(#' + clip + ')'} />
  </svg>;
}

type Feedback =
  | { kind: 'idle' | 'pending' }
  | { kind: 'saved'; speciesId: PetSpeciesId }
  | { kind: 'error'; message: string };

export function SpeciesPicker({ state }: { state: PetState }) {
  const group = useId();
  const saving = useRef(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const current = getPetDefinition(state.pet.speciesId);

  async function choose(id: PetSpeciesId) {
    if (saving.current || id === state.pet.speciesId) return;
    saving.current = true;
    setFeedback({ kind: 'pending' });
    try {
      await selectSpecies(state, id);
      setFeedback({ kind: 'saved', speciesId: id });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : t('speciesSaveError') });
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="species-picker">
      <fieldset disabled={feedback.kind === 'pending'} aria-describedby={group + '-hint'}>
        <legend>{t('choosePet')}</legend>
        <div className="species-choices">
          {petDefinitions.map(species => (
            <label key={species.id}>
              <input type="radio" name={group} value={species.id} checked={state.pet.speciesId === species.id}
                onChange={() => void choose(species.id)} />
              <ChoicePortrait id={species.id} clip={group + species.id} />
              <span>{species.displayName}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="hint" id={group + '-hint'}>{isPetSpeciesId(state.pet.speciesId)
        ? t('speciesHint')
        : t('unknownPet')}</p>
      <p className="species-status" role="status">{feedback.kind === 'pending' ? t('saving') :
        feedback.kind === 'saved' && feedback.speciesId === state.pet.speciesId ? t('speciesSaved', current.displayName) : ''}</p>
      {feedback.kind === 'error' && <p role="alert">{feedback.message}</p>}
    </div>
  );
}
