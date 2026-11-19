import { useId, useRef, useState } from 'react';
import { t } from '../shared/i18n';
import { petDefinitions, type PetSpeciesId } from '../features/pet/definitions/species';
import { movementLabel, movements, companionFor, projectCompanion, type CompanionPatch, type Movement } from '../shared/contracts/companions';
import type { PetState } from '../shared/contracts/state';
import { patchCompanion, selectSpecies } from '../shared/messaging/state';
import { PetAvatar } from '../features/pet/rendering/PetAvatar';
import './friend-roster.css';
import { NameEditor } from './NameEditor';
import { PetTile } from './PetTile';
import { Chevron } from './Chevron';

export function FriendRoster({ state, compact = false }: { state: PetState; compact?: boolean }) {
  const group = useId(), busy = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function save(operation: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await operation(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('saveError')); }
    finally { busy.current = false; setPending(false); }
  }
  function change(id: PetSpeciesId, patch: CompanionPatch) { void save(() => patchCompanion(state, id, patch)); }
  const selected = petDefinitions.find(pet => pet.id === state.pet.speciesId)?.id;
  const friend = selected && companionFor(state, selected);

  function edit(id: PetSpeciesId) {
    if (selected === id) {
      setEditorOpen(open => !open);
      return;
    }
    void save(async () => {
      await selectSpecies(state, id);
      setEditorOpen(true);
    });
  }
  return <section className={'friend-roster' + (compact ? ' friend-roster-compact' : '')} aria-labelledby={group + '-title'} aria-busy={pending}>
    <h2 id={group + '-title'}>{t('builtInFriends')}</h2>
    <div className="pet-tile-grid">
      {petDefinitions.map(({ id }) => {
        const friend = companionFor(state, id), pet = projectCompanion(state, id).pet;
        return <PetTile key={id} name={pet.name} enabled={friend.enabled} disabled={pending} editing={editorOpen && id === selected}
          portrait={<PetAvatar name="" speciesId={id} />}
          toggle={enabled => change(id, { enabled })}
          edit={() => edit(id)} />;
      })}
    </div>
    {editorOpen && selected && friend && <div className="friend-record">
      <NameEditor key={selected} state={state} />
      <fieldset disabled={pending} aria-label={t('editFriend', state.pet.name)}>
        <div className="friend-fields">
            <label><span>{t('friendSize')}</span><span className="friend-select-field"><select value={friend.settings.sizePx}
              onChange={e => change(selected, { sizePx: Number(e.target.value) as 32 | 64 | 96 })}>
              <option value={32}>{t('sizeSmall')}</option><option value={64}>{t('sizeMedium')}</option><option value={96}>{t('sizeLarge')}</option>
            </select><Chevron /></span></label>
            <label><span>{t('friendMovement')}</span><span className="friend-select-field"><select value={friend.movement}
              onChange={e => change(selected, { movement: e.target.value as Movement })}>
              {movements.map(value => <option key={value} value={value}>{t(movementLabel[value])}</option>)}
            </select><Chevron /></span></label>
        </div>
      </fieldset>
    </div>}
    {!state.settings.enabled && <p className="roster-hidden">{t('friendsMasterOff')}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
