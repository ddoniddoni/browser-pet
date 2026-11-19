import { usePetProfile } from '../../components/usePetProfile';
import { t } from '../../shared/i18n';
import { AgendaPanel } from './AgendaPanel';

export function AgendaWindow() {
  const {state,issue}=usePetProfile();
  return <main className="agenda-window">
    <header><span>Browser Pet</span><button className="link" type="button" onClick={()=>window.close()}>{t('agendaClose')}</button></header>
    {state ? <AgendaPanel key={state.pet.id} state={state} standalone/> :
      <p role={issue?'alert':'status'}>{issue?.message ?? t('loadingPet')}</p>}
  </main>;
}
