import { photoOutfit } from '../../shared/contracts/photo-accessories';
import { useCallback, useSyncExternalStore } from 'react';
import { type CompanionId, projectCompanion } from '../../shared/contracts/companions';
import { originalLook, isImagePetId } from '../../shared/contracts/image-pet';
import { ImagePetPreview } from '../../components/ImageLookEditor';
import { PetMiniature } from '../../components/PetMiniature';
import { isMealTime, mealMs } from '../../features/pet/core/meal';
import type { PetState } from '../../shared/contracts/state';
import type { MemoryCard } from '../../shared/contracts/keepsakes';
import type { Cushion as Fabric } from '../../shared/contracts/room';
import { CardboardMark } from './CardboardMark';
import { Cushion } from './Cushion';
import { MemoryPicture } from './MemoryPicture';
import atticPainting from '../../assets/room/stationery-attic.webp';
import '../../features/pet/rendering/character.css';

export function FlowerPrint() {
  return <svg viewBox="0 0 38 46" fill="none" aria-hidden="true">
    <path fill="#f7ecd3" d="M0 0h38v46H0z"/>
    <g stroke="#6c7954" strokeWidth="1.1" strokeLinecap="round"><path d="M12 37q8-17 9-25M15 29q6-4 12-10M17 24q-5-4-7-10"/>
      <path fill="#92a077" d="M15 30q-6-1-6-6 5 0 6 6m4-10q5-1 5-5-4 0-5 5M21 23q6 0 8-4-6-1-8 4"/></g>
    {[[21,10,1],[10,14,.68],[28,17,.72]].map(([x,y,s]) => <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
      <g fill="#c7775c"><ellipse cy="-2.5" rx="1.8" ry="2.7"/><ellipse cx="2.6" cy="-.4" rx="2.6" ry="1.7"/>
        <ellipse cx="1.5" cy="2.2" rx="1.6" ry="2"/><ellipse cx="-2" cy="2" rx="2" ry="1.7"/><ellipse cx="-2.7" cy="-.8" rx="2.4" ry="1.6"/></g>
      <circle r="1.5" fill="#e4b653"/></g>)}
    <path d="M14 40h10" stroke="#bbab8e" strokeWidth=".8"/></svg>;
}

function Resident({ state, action = 'SIT', yaw, still = true, startedAt }: {
  state: PetState; action?: string; yaw: number; still?: boolean; startedAt?: number;
}) {
  const species = state.pet.speciesId;
  if (isImagePetId(species)) {
    const pet = state.imagePets?.[species];
    return pet && <ImagePetPreview image={pet.image} accessories={photoOutfit(pet)} animation={pet.animation} still={state.settings.reduceMotion === 'always'} look={pet.look ?? originalLook} size={192} angle={yaw < 0 ? -18 : 18} />;
  }
  return <PetMiniature {...state.pet} action={action} yaw={yaw} still={still} startedAt={startedAt}
    mode={action === 'EAT' ? 'meal' : action === 'SLEEP' ? 'bedtime' : 'pose'}
    scarf={state.settings.scarf} outfit={state.settings.outfit} />;
}

export function PetWindow({ state, guests, occupied, fabric, card, label, box }: {
  state: PetState; guests: CompanionId[]; occupied: boolean; box: boolean; fabric: Fabric; card?: MemoryCard; label: string }) {
  const fedAt = state.care.lastFedAt;
  const sub = useCallback((notify: () => void) => {
    const now = Date.now();
    if (!isMealTime(fedAt, now)) return () => {};
    const id = window.setTimeout(notify, fedAt + mealMs - now + 1);
    return () => window.clearTimeout(id);
  }, [fedAt]);
  const eating = useSyncExternalStore(sub, () => isMealTime(fedAt, Date.now()), () => false);
  const action=eating?'EAT':box?'BOX':'SLEEP';
  const visitors = guests.map(id => projectCompanion(state, id));
  const residents = occupied ? [state.pet.name, ...visitors.map(friend => friend.pet.name)] : [];
  return <div className="room-scene" data-box={box||undefined} data-group={guests.length || undefined} role="img" aria-label={[...residents, label].join(', ')}>
    <img className="room-painting" src={atticPainting} alt="" draggable={false}/>
    <div className="room-frame"><div className="room-mat">{card ? <MemoryPicture card={card}/> : <FlowerPrint/>}</div></div>
    <div className="room-bed"><Cushion fabric={fabric}/></div>
    {visitors.map((friend, index) => <div key={friend.pet.speciesId} className="room-guest" data-seat={index === 0 ? 'left' : 'right'}>
      <Resident state={friend} yaw={index === 0 ? 28 : -28} />
    </div>)}
    {occupied && <div className="room-resident" data-species={state.pet.speciesId}
      data-still={state.settings.reduceMotion === 'always' || undefined} data-action={action}>
      <Resident state={state} action={action} yaw={box && !eating ? 22 : 32}
        startedAt={eating ? fedAt ?? undefined : undefined} still={state.settings.reduceMotion === 'always'} />
    </div>}
    {box && <span className="room-spare-box" data-meal={eating||undefined}><CardboardMark/></span>}
  </div>;
}
