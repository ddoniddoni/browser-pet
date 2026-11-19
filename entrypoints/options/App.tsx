import { useState } from 'react';
import { t } from '../../shared/i18n';
import { ImagePets } from '../../components/ImagePets';
import { FriendRoster } from '../../components/FriendRoster';
import friendsArt from '../../assets/signatures/attic-friends.webp';
import { usePetProfile } from '../../components/usePetProfile';
import { PoseBook } from './PoseBook';
import { ResetPanel } from './ResetPanel';
import { Preferences } from './Preferences';
import { Wardrobe } from './Wardrobe';
import { SettingsTabs, type SettingsTab } from './SettingsTabs';

export default function App() {
  const { state, issue } = usePetProfile();
  const [tab, setTab] = useState<SettingsTab>('friend');
  const target = state
    ? { expectedPetId: state.pet.id, expectedRevision: state.revision }
    : issue?.code === 'STORAGE_CORRUPT' ? issue.recovery : undefined;

  return (
    <main className="settings-main">
      <header className="settings-header">
        <div><span className="brand">Browser Pet</span><h1>{t('settingsHeading')}</h1></div>
        <div className="notebook-print" aria-hidden="true"><svg viewBox="0 644 1536 366" focusable="false"><image href={friendsArt} width="1536" height="1024" /></svg></div>
      </header>
      {state && <>
        <SettingsTabs value={tab} onChange={setTab} />
        <div className="settings-panels" key={state.pet.id}>
          <div className="settings-panel" role="tabpanel" id="panel-friend" aria-labelledby="tab-friend" hidden={tab !== 'friend'}>
            <section className="identity" aria-label={t('settingsFriend')}>
              <ImagePets key={'images-' + state.pet.id} state={state} />
              <FriendRoster key={'species-' + state.pet.id} state={state} />
            </section>
            <PoseBook state={state} />
          </div>
          <div className="settings-panel" role="tabpanel" id="panel-behavior" aria-labelledby="tab-behavior" hidden={tab !== 'behavior'}>
            <Preferences state={state} />
          </div>
          <div className="settings-panel" role="tabpanel" id="panel-wardrobe" aria-labelledby="tab-wardrobe" hidden={tab !== 'wardrobe'}>
            <Wardrobe key={state.pet.speciesId} state={state} />
          </div>
        </div>
      </>}
      {!state && !issue && <p role="status">{t('loadingPet')}</p>}
      {issue && <div className="problem" role="alert">
        <strong>{issue.code === 'UNSUPPORTED_SCHEMA' ? t('updateNeeded') :
          issue.code === 'STORAGE_CORRUPT' ? t('unreadablePet') : t('settingsLoadError')}</strong>
        <p>{issue.code === 'UNSUPPORTED_SCHEMA' ? t('newerDataNotice') :
          issue.code === 'STORAGE_CORRUPT' ? t('resetHint') :
          issue.message}</p>
      </div>}
      {target && <ResetPanel target={target} state={state} />}
    </main>
  );
}
