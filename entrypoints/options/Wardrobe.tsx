import { t } from '../../shared/i18n';
import { useId, useState } from 'react';
import { PetMiniature } from '../../components/PetMiniature';
import { outfits, scarves, wornScarf, type Outfit, type Scarf } from '../../shared/contracts/character';
import type { PetState } from '../../shared/contracts/state';
import { patchSettings } from '../../shared/messaging/state';
import { SaveNotice, useSaveFeedback } from './Preferences';
import { atticFor } from '../../shared/contracts/attic';
import { isImagePetId } from '../../shared/contracts/image-pet';
import { Chevron } from '../../components/Chevron';
import { PhotoFittingRoom } from './PhotoFittingRoom';

const rails = ['everyday', 'christmas'] as const;

export function Wardrobe({ state }: { state: PetState }) {
  const heading = useId();
  const [choice, setChoice] = useState<string>();
  const pictures = state.imagePets ?? {};
  const selected = choice ?? atticFor(state).center;
  const id = isImagePetId(selected) && pictures[selected] && !pictures[selected]?.animation ? selected : null;
  const photo = id && pictures[id];
  return <section className="preferences wardrobe" id="wardrobe" aria-labelledby={heading}>
    <h2 id={heading}>{t('wardrobe')}</h2>
    {Object.keys(pictures).length > 0 && <label className="wardrobe-picker">{t('wardrobeFriend')}
      <span className="image-select"><select value={id ?? ''} onChange={e => setChoice(e.target.value)}>
        <option value="">{state.pet.name}</option>
        {Object.entries(pictures).map(([key, pet]) => pet && <option key={key} value={key} disabled={!!pet.animation}>
          {pet.name}{pet.animation ? ' — ' + t('hatStillOnly') : ''}
        </option>)}
      </select><Chevron /></span>
    </label>}
    {id && photo ? <PhotoFittingRoom key={id} state={state} id={id} pet={photo} /> : <SignatureWardrobe state={state} />}
  </section>;
}

function SignatureWardrobe({ state }: { state: PetState }) {
  const group = useId();
  const [angle, setAngle] = useState(24);
  const { feedback, save } = useSaveFeedback();
  const { name, speciesId } = state.pet;
  const worn = state.settings.outfit ?? 'none';
  const neck = wornScarf(speciesId, state.settings.scarf);
  const [draft, setDraft] = useState<{ outfit?: Outfit; scarf?: Scarf }>({});
  const outfit = draft.outfit ?? worn, scarf = draft.scarf ?? neck;
  const outfitName = outfits.find(item => item.value === outfit)!.label;
  const scarfName = scarves.find(item => item.value === scarf)!.label;
  const look = [outfit === 'none' ? '' : outfitName, scarf === 'none' ? '' : t('scarfLook', scarfName)].filter(Boolean).join(' + ') || t('defaultLook');
  const changed = outfit !== worn || scarf !== neck;
  const busy = feedback.kind === 'pending';

  return <>
    <p className="section-note">{t('wardrobeHint')}</p>
    <div className="fitting-room">
      <figure className="fitting-mirror">
        <div className="mirror-stage" aria-hidden="true"><PetMiniature {...{ name, speciesId, outfit, scarf }} yaw={angle}/></div>
        <div className="mirror-angles" role="group" aria-label={t('sculptAngle')}>
          {([[24,'sculptFront'],[90,'sculptSide'],[180,'sculptBack']] as const).map(([yaw, label]) =>
            <button key={yaw} type="button" aria-pressed={angle===yaw} onClick={()=>setAngle(yaw)}>{t(label)}</button>)}
        </div>
        <figcaption><small>{changed ? t('tryingOn') : t('wearingNow')}</small><strong>{look}</strong></figcaption>
      </figure>
      <div className="clothes-rails">
        <fieldset disabled={busy} aria-label={t('outfits')}>
          {rails.map(rail => <div className="clothes-rail" key={rail}>
            <h3>{rail === 'everyday' ? t('railEveryday') : t('railChristmas')}</h3>
            <div className="garment-row">
              {outfits.filter(option => option.rail === rail).map(({ value, label }) => <label className="garment-option" key={value}>
                <input type="radio" name={group + '-outfit'} value={value} checked={outfit === value}
                  onChange={() => setDraft(prev => ({ ...prev, outfit: value }))}/>
                <span className="garment-sample" aria-hidden="true"><PetMiniature name={name} speciesId={speciesId} outfit={value} scarf="none" /></span>
                <span>{label}</span>
              </label>)}
            </div>
          </div>)}
        </fieldset>
        <fieldset disabled={busy} className="scarf-rail">
          <legend>{t('scarf')}</legend>
          <div>{scarves.map(({ value, label }) => <label key={value} className="scarf-option">
            <input type="radio" name={group + '-scarf'} checked={scarf === value}
              onChange={() => setDraft(prev => ({ ...prev, scarf: value }))}/>
            <i data-tone={value} aria-hidden="true"/>{value === 'none' ? t('none') : label}
          </label>)}</div>
        </fieldset>
      </div>
    </div>
    <div className="fitting-actions">
      <button type="button" className="primary" disabled={!changed || busy}
        onClick={() => void save(async () => {
          const result = await patchSettings(state, {
            ...(outfit !== worn && { outfit }), ...(scarf !== neck && { scarf }),
          });
          setDraft({});
          return result;
        }, t('lookSaved'))}>{t('applyLook')}</button>
      {changed && <button type="button" className="link" disabled={busy} onClick={() => setDraft({})}>{t('chooseAgain')}</button>}
    </div>
    <SaveNotice feedback={feedback} />
  </>;
}
