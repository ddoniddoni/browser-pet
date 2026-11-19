import type { ReactNode } from 'react';
import { t } from '../shared/i18n';
import './pet-tiles.css';

export function PetTile({name, portrait, enabled, disabled, editing, toggle, edit}: {
  name: string; portrait: ReactNode; enabled: boolean; disabled: boolean;
  editing?: boolean; toggle: (on: boolean) => void; edit?: () => void;
}) {
  return <div className="pet-tile" data-enabled={enabled}>
    <label className="pet-tile-toggle">
      <input type="checkbox" role="switch" aria-label={t('displayFriend', name)} checked={enabled} disabled={disabled}
        onChange={e => toggle(e.target.checked)} />
      <span className="pet-tile-art" aria-hidden="true">{portrait}</span>
      <span className="pet-tile-caption"><span className="pet-tile-tick" aria-hidden="true" /><bdi>{name}</bdi></span>
    </label>
    {edit && <button className="pet-tile-edit" type="button" aria-label={t('editFriend', name)} title={t('editFriend', name)}
      aria-pressed={editing} disabled={disabled} onClick={edit}>
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m4 12.8 8.8-8.9a1.8 1.8 0 0 1 2.6 2.6l-8.8 8.9-3.4.7.8-3.3ZM11.5 5.3l2.6 2.6"/>
      </svg></button>}
  </div>;
}
