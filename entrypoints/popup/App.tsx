import { AtticRoster } from './AtticRoster';
import { WalkPathPanel } from './WalkPathPanel';
import { atticFor } from '../../shared/contracts/attic';
import { announcementCompanion, projectCompanion } from '../../shared/contracts/companions';
import { t } from '../../shared/i18n';
import { useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Chevron } from '../../components/Chevron';
import { PhotoBooth } from './PhotoBooth';
import { portraitOf } from '../../shared/contracts/keepsakes';
import { PetRoom } from './PetRoom';
import { useRoomDecorator } from './useRoomDecorator';
import { usePetCards } from './usePetCards';
import { isPetSpeciesId } from '../../features/pet/definitions/species';
import { ImagePets } from '../../components/ImagePets';
import { FriendRoster } from '../../components/FriendRoster';
import { usePetProfile } from '../../components/usePetProfile';
import { toggleFromPopup } from '../../shared/messaging/display-click';
import { AgendaPanel } from './AgendaPanel';
import { StudyTimerPanel } from './StudyTimer';
import { MemoryAlbum } from './MemoryAlbum';
import { CarePanel } from './CarePanel';
import { CurrentPageStatus } from './CurrentPageStatus';
import { FirstMeeting } from './FirstMeeting';
import { PopupHeader } from './PopupHeader';
import { ConnectionCheck } from './ConnectionCheck';

export default function App() {
  const { state, issue } = usePetProfile();
  const [error, setError] = useState('');
  const latest = useRef(0);
  const intended = useRef<boolean | null>(null);
  const [pending, setPending] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState<typeof state>(null);
  // 응답이 storage 이벤트보다 앞서도 직전 결과를 기준으로 다음 클릭을 처리한다.
  const base = state && confirmed && confirmed.pet.id === state.pet.id && confirmed.revision > state.revision ? confirmed : state;
  const enabled = pending ?? base?.settings.enabled ?? false;

  const attic = base && atticFor(base);
  const center = enabled && attic ? attic.center : null;
  const friend = center && base ? projectCompanion(base, center) : base;
  const guests = center && attic ? attic.order.filter(id => id !== center).slice(0, 2) : [];
  const cards = usePetCards(friend);
  const portrait = friend && portraitOf(friend);
  const decor = useRoomDecorator(friend);

  const firstVisit = !!base?.awaitingFirstPet && !base.settings.enabled;

  const firstId = firstVisit && base ? announcementCompanion(base) : undefined;
  const firstPet = firstId && base ? projectCompanion(base, firstId).pet : base?.pet;

  async function toggle(meet = false) {
    if (!base || (meet && intended.current !== null)) return;
    const token = ++latest.current;
    const next = meet || !(intended.current ?? enabled);
    intended.current = next;
    setPending(next);
    setError('');
    try {
      const saved = await toggleFromPopup(base, next, meet);
      setConfirmed(prev => prev && prev.revision > saved.revision ? prev : saved);
      if (meet && !await browser.tabs.getCurrent()) window.close();
    } catch (reason) {
      if (token === latest.current) setError(reason instanceof Error ? reason.message : t('visibilitySaveError'));
    } finally {
      if (token === latest.current) {
        intended.current = null;
        setPending(null);
      }
    }
  }

  return (
    <main className="pet-notebook">
      <PopupHeader enabled={state && !firstVisit ? enabled : null} onToggle={() => void toggle()} onSettings={() => {
        void browser.runtime.openOptionsPage().catch(() =>
          setError(t('openSettingsError')));
      }} />
      {firstVisit && firstPet && <FirstMeeting name={firstPet.name} speciesId={firstPet.speciesId} busy={pending !== null} onMeet={() => void toggle(true)} />}
      {!firstVisit && state && base && friend && attic && <>
        <div className="attic-postcard">
          <PetRoom key={friend.pet.id + ':' + (center ?? 'empty')} state={friend} guests={guests} occupied={!!center} cards={cards} decor={decor}>
            {!enabled && <p className="profile-status">{t('hiddenOnPages')}</p>}
            {enabled && pending === null && <CurrentPageStatus settings={base.settings} name={friend.pet.name} />}
          </PetRoom>
          <AtticRoster key={base.pet.id} state={base} attic={attic} enabled={enabled} />
          {center && pending === null &&
            <WalkPathPanel key={base.pet.id} state={friend} friend={center} order={attic.order} />}
        </div>
        <div className="tool-shelf">
          <AgendaPanel key={'agenda:' + state.pet.id} state={state}/>
          <StudyTimerPanel key={'timer:' + state.pet.id} state={state} />
          {portrait && <PhotoBooth key={JSON.stringify([state.pet.id,portrait.speciesId,portrait.name,portrait.scarf,portrait.outfit])}
            pet={portrait} still={state.settings.reduceMotion === 'always'}/>}
        </div>
        <CarePanel key={'care:' + friend.pet.id + ':' + friend.pet.speciesId} state={friend} />
        {isPetSpeciesId(friend.pet.speciesId) && <MemoryAlbum cards={cards} decor={decor} picture={isPetSpeciesId(friend.pet.speciesId) ? friend.rooms?.[friend.pet.speciesId]?.picture ?? null : null} />}
        {decor.error && <p role="alert">{decor.error}</p>}
        <details className="pet-edit">
          <summary>{t('changePet')}<Chevron /></summary>
          <ImagePets key={'images-' + state.pet.id} state={state} compact />
          <FriendRoster key={'species-' + state.pet.id} state={state} compact />
        </details>
      </>}
      {!state && !issue && <p role="status">{t('loadingPet')}</p>}
      {(issue || error) && <p role="alert">{error || issue?.message}</p>}
      {issue && !browser.storage && (
        <button className="secondary" type="button" onClick={() => {
          void browser.tabs.create({ url: 'chrome://extensions/' }).catch(() =>
            setError(t('extensionsHelp')));
        }}>{t('openExtensions')}</button>
      )}
      {!firstVisit && <ConnectionCheck />}
    </main>
  );
}
