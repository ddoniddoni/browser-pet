import { photoOutfit } from '../../shared/contracts/photo-accessories';
import { useId, useRef, useState } from 'react';
import { Chevron } from '../../components/Chevron';
import { ImagePetPreview } from '../../components/ImageLookEditor';
import { PetAvatar } from '../../features/pet/rendering/PetAvatar';
import type { Attic } from '../../shared/contracts/attic';
import { projectCompanion, type CompanionId } from '../../shared/contracts/companions';
import { isImagePetId, originalLook } from '../../shared/contracts/image-pet';
import type { PetState } from '../../shared/contracts/state';
import { t } from '../../shared/i18n';
import { focusInAttic } from '../../shared/messaging/state';

export function AtticRoster({ state, attic, enabled }: { state: PetState; attic: Attic; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLButtonElement>(null);
  const id = useId();
  async function choose(friend: CompanionId) {
    if (pending) return;
    setError(''); setPending(true);
    try {
      if (friend !== attic.center) await focusInAttic(state, friend);
      setOpen(false); summary.current?.focus();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('saveError')); }
    finally { setPending(false); }
  }
  const count = enabled ? attic.order.length : 0;
  if (count === 0) return <p className="attic-empty">{t('atticEmpty')}</p>;
  return <div className="attic-roster">
    <button ref={summary} type="button" className="attic-summary" aria-controls={id} aria-expanded={open}
      onClick={() => setOpen(!open)}>
      <span className="attic-stamps" aria-hidden="true">{attic.order.slice(0, 3).map(friend =>
        <span key={friend}>{isImagePetId(friend)
          ? <img alt="" src={state.imagePets?.[friend]?.image} />
          : <PetAvatar speciesId={friend} name="" />}</span>
      )}</span>
      {t('atticCount', count)}<Chevron />
    </button>
    <div id={id} hidden={!open}>
      {open && <ul className="attic-friends">{attic.order.map(friend => {
        const custom = isImagePetId(friend) ? state.imagePets?.[friend] : undefined;
        const name = projectCompanion(state, friend).pet.name;
        return <li key={friend}><button type="button" className="attic-pick" aria-pressed={friend === attic.center}
          disabled={pending} onClick={() => void choose(friend)}>
          <span className="attic-thumb" aria-hidden="true">{isImagePetId(friend)
            ? custom && <ImagePetPreview image={custom.image} accessories={photoOutfit(custom)} look={custom.look ?? originalLook} size={80} />
            : <PetAvatar speciesId={friend} name="" />}</span>
          <bdi>{name}</bdi>{friend === attic.center && <span className="attic-check" aria-hidden="true" />}
        </button></li>;
      })}</ul>}
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}
