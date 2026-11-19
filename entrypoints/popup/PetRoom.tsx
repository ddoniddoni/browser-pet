import type { CompanionId } from '../../shared/contracts/companions';
import { lazy, Suspense, useId, useRef, useState, type ReactNode } from 'react';
import { getPetDefinition, isPetSpeciesId } from '../../features/pet/definitions/species';
import type { MemoryCard } from '../../shared/contracts/keepsakes';
import { cushions, defaultRoom } from '../../shared/contracts/room';
import type { PetState } from '../../shared/contracts/state';
import { t } from '../../shared/i18n';
import type { RoomDecorator } from './useRoomDecorator';
import { CardboardMark } from './CardboardMark';
import { Cushion } from './Cushion';
import { MemoryPicture, memoryTitles } from './MemoryPicture';
import { PetWindow, FlowerPrint } from './PetWindow';
import { wornScarf } from '../../shared/contracts/character';
import './room.css';

const SculptureViewer = lazy(() => import('./SculptureViewer'));

const boxScenes={kkogit:'boxKkogit',nurung:'boxNurung',pongdang:'boxPongdang'} as const;
const swatches = { moss: 'roomMoss', apricot: 'roomApricot', indigo: 'roomIndigo' } as const;

function StudioIcon() {
  return <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.45"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5.6 11 7.2-8a1.35 1.35 0 0 1 2 1.8l-7.5 7.7M5.6 10.9l2 1.7M6.2 11.4c-1.9-.5-2.7.6-2.7 2.1 0 1-.6 1.7-1.3 2 2.3.5 5 .2 5.3-2.9"/></svg>;
}

export function PetRoom({ state, guests, occupied, cards, decor, children }: { state: PetState; guests: CompanionId[]; occupied: boolean; cards: MemoryCard[]; decor: RoomDecorator; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [boxTurn,replay] = useState(0);
  const [viewing, setViewing] = useState(false);
  const viewToggle = useRef<HTMLButtonElement>(null);
  const { busy, change } = decor;
  const id = useId();
  const { name, speciesId } = state.pet;
  const room = (isPetSpeciesId(speciesId) && state.rooms?.[speciesId]) || defaultRoom;
  const boxNote = t(boxScenes[getPetDefinition(speciesId).id]);
  const framed = cards.find(c => c.kind === room.picture);
  return <section className="pet-room" aria-label={occupied ? t('roomOf', name) : t('roomAttic')}>
    <div className="room-turntable" onKeyDown={e=>{
      if(viewing && e.key==='Escape'){e.stopPropagation(); e.preventDefault(); setViewing(false); viewToggle.current?.focus();}
    }}>
      {occupied && !viewing && <span className="room-location">{t('roomAttic')}</span>}
      {occupied && isPetSpeciesId(speciesId) && <button ref={viewToggle} type="button" className="clay-toggle" aria-expanded={viewing}
        aria-controls={id+'-display'} onClick={()=>setViewing(!viewing)}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.55"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m7.2 4.8 3-1.6 3 1.6v3.5l-3 1.8-3-1.8Z M7.2 4.8l3 1.8 3-1.8 M10.2 6.6v3.3"/>
          <path d="M15.1 9.7c1.8.6 2.9 1.5 2.9 2.5 0 1.9-3.6 3.3-8 3.3s-8-1.4-8-3.3c0-1 .9-1.8 2.6-2.4m6.8 3.5-2.2 2.2 2.2 2"/>
        </svg>{t(viewing?'sculptRoom':'sculptOpen')}</button>}
      <div id={id+'-display'}>{occupied && viewing && isPetSpeciesId(speciesId)
        ? <Suspense fallback={<p className="clay-loading" role="status">{t('sculptLoading')}</p>}>
            <SculptureViewer key={speciesId} id={speciesId} name={name} outfit={state.settings.outfit??'none'} scarf={wornScarf(speciesId,state.settings.scarf)}/>
          </Suspense>
        : <PetWindow key={boxTurn} state={state} guests={guests} occupied={occupied} box={occupied && room.box === true} fabric={room.cushion} card={framed}
      label={t('roomCushion') + ': ' + t(swatches[room.cushion]) + '. ' + t('roomWall') + ': ' +
        (framed ? t(memoryTitles[framed.kind]) : t('roomFlowers')) + (room.box ? '. ' + t('roomBox') : '')}/>}</div>
    </div>
    <div className="room-label">
      <h2 dir="auto">{occupied ? name : t('roomAttic')}</h2>
      {isPetSpeciesId(speciesId) && <button className="room-edit" type="button" aria-expanded={editing} aria-controls={id}
        onClick={() => setEditing(!editing)}><StudioIcon/>{t(editing ? 'roomClose' : 'roomEdit')}</button>}
      <div className="room-status">{children}</div>
    </div>
    <div id={id} className="room-studio" hidden={!editing} aria-busy={busy}>
      <fieldset disabled={busy}><legend>{t('roomCushion')}</legend>
        <div className="room-fabrics">{cushions.map(c => <label key={c}>
          <input type="radio" name={id+'-cushion'} checked={room.cushion === c} onChange={() => void change({ cushion: c })}/>
          <span className="fabric-sample"><Cushion fabric={c}/></span><span>{t(swatches[c])}</span>
        </label>)}</div>
      </fieldset>
      <fieldset disabled={busy} className="box-shelf"><legend>{t('roomToy')}</legend>
        <button className="box-choice" type="button" aria-pressed={room.box===true}
          aria-describedby={id+'-box-note'} onClick={()=>{setViewing(false); void change({box:!room.box});}}>
          <CardboardMark/><span>{t('roomBox')}</span><span className="box-check" aria-hidden="true"/>
        </button>
        <p id={id+'-box-note'}>{boxNote}</p>
        {room.box && !viewing && <button type="button" className="link" onClick={()=>replay(n=>n+1)}>{t('boxReplay')}</button>}
      </fieldset>
      <fieldset disabled={busy}><legend>{t('roomWall')}</legend>
        <div className="room-prints">{[null, ...cards].map(card => <label key={card?.kind ?? 'botanical'}>
          <input type="radio" name={id+'-print'} checked={room.picture === (card?.kind ?? null)} onChange={() => void change({ picture: card?.kind ?? null })}/>
          <span className="print-sample">{card ? <MemoryPicture card={card}/> : <FlowerPrint/>}</span>
          <span>{card ? t(memoryTitles[card.kind]) : t('roomFlowers')}</span>
        </label>)}</div>
        {!cards.length && <p>{t('roomEmptyWall')}</p>}
      </fieldset>
    </div>
  </section>;
}
