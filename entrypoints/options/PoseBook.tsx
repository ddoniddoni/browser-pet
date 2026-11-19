import { t } from '../../shared/i18n';
import { useId, useState } from 'react';
import { Chevron } from '../../components/Chevron';
import { getPetDefinition } from '../../features/pet/definitions/species';
import { habitNames } from '../../features/pet/sculpture/character-acts';
import { PetMiniature } from '../../components/PetMiniature';
import type { PetState } from '../../shared/contracts/state';

const pages = [
  ['IDLE', t('poseStand')], ['WALK', t('poseWalk')], ['SIT', t('poseSit')], ['SLEEP', t('poseNap')],
  ['PETTED', t('posePetted')], ['DRAG', t('poseLift')], ['PINNED', t('poseSettle')], ['EAT', t('poseEat')],
  ['PLAY_LOOK', t('poseSpotBall')], ['BALL', t('poseBall')],
  ['FIVE_HIT', t('highFive')], ['MOUSE', t('windupMouse')], ['HABIT', t('habitTitle')],
] as const;

export function PoseBook({ state }: { state: PetState }) {
  const [page, turn] = useState(3);
  const [take, replay] = useState(0);
  const id = useId();
  const species = getPetDefinition(state.pet.speciesId);
  const fetches = species.play === 'fetch';
  const habit = t(habitNames[species.id]);
  const [key, title] = pages[page] ?? pages[3];
  const action = key === 'BALL' ? (fetches ? 'FETCH' : 'BAT') : key === 'MOUSE' ? (fetches ? 'MOUSE_NUDGE' : 'MOUSE_POUNCE') : key;
  const label = key === 'HABIT' ? habit : key === 'BALL' ? (fetches ? t('poseFetch') : t('poseBat')) : title;
  const props = { name: state.pet.name, speciesId: state.pet.speciesId, scarf: state.settings.scarf, outfit: state.settings.outfit };
  return <details className="pose-book" id="poses" aria-labelledby={id}>
    <summary className="pose-heading"><h2 id={id}>{t('poseBook')}</h2>
      <span className="pose-count">{String(page + 1).padStart(2, '0')} / {pages.length}</span>
      <Chevron />
    </summary>
    <div className="pose-workbench">
    <div key={take} className="pose-spread" data-action={action} data-still={state.settings.reduceMotion === 'always' || undefined}>
      <figure><div className="pose-stage pose-stage-large" aria-hidden="true">
        <PetMiniature {...props} action={action} mode="pose" still={state.settings.reduceMotion === 'always'} /></div>
        <figcaption>{label}<span>96 px</span></figcaption></figure>
      <figure><div className="pose-stage pose-stage-small" aria-hidden="true">
        <PetMiniature {...props} action={action} mode="pose" still={state.settings.reduceMotion === 'always'} /></div>
        <figcaption>{t('smallPreview')}<span>32 px</span></figcaption></figure>
    </div>
    <div className="pose-controls">
    <label className="pose-picker">{t('choosePose')}
      <span className="pose-select">
        <select value={page} onChange={event => turn(Number(event.target.value))}>
          {pages.map(([code, text], index) => <option key={code} value={index}>
            {code === 'HABIT' ? habit : code === 'BALL' ? (fetches ? t('poseFetch') : t('poseBat')) : text}
          </option>)}
        </select>
        <Chevron />
      </span>
    </label>
    {(key === 'HABIT' || key === 'DRAG') && <button className="link" type="button" onClick={()=>replay(n=>n+1)}>
      {key === 'HABIT' ? t('habitReplay') : t('poseReplay')}</button>}
    <p>{t('poseHint')}</p>
    </div></div>
  </details>;
}
