import { t } from '../shared/i18n';
import { useId, useState, type FormEvent } from 'react';
import { normalizePetName, type PetState } from '../shared/contracts/state';
import { getPetDefinition } from '../features/pet/definitions/species';
import { renamePet } from '../shared/messaging/state';

export function NameEditor({ state }: { state: PetState }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [savedName, setSavedName] = useState('');
  const name = draft ?? state.pet.name;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const valid = normalizePetName(name);
    if (!valid) {
      setError(t('nameValidation'));
      return;
    }
    setPending(true);
    setError('');
    try {
      const saved = await renamePet(state, valid);
      setDraft(null);
      setSavedName(saved.pet.name === valid ? valid : '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('nameSaveError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="name-editor" onSubmit={save}>
      <label htmlFor={id}>{t('speciesName', getPetDefinition(state.pet.speciesId).displayName)}</label>
      <div className="input-row">
        <input id={id} type="text" autoComplete="off" spellCheck={false} value={name}
          aria-invalid={!!error && !normalizePetName(name)} aria-describedby={error ? id + '-error' : undefined}
          disabled={pending} onChange={event => {
            setDraft(event.target.value);
            setError('');
            setSavedName('');
          }} />
        <button className="secondary" type="submit" disabled={pending || name === state.pet.name}>
          {pending ? t('saving') : t('saveName')}
        </button>
      </div>
      {error && <p id={id + '-error'} role="alert">{error}</p>}
      {savedName && savedName === state.pet.name && <p className="notice" role="status">{t('nameSaved')}</p>}
    </form>
  );
}
