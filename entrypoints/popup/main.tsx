import { agendaWindowSearch } from '../../shared/contracts/agenda-window';
import { AgendaWindow } from './AgendaWindow';
import { t, uiLanguage } from '../../shared/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './notebook.css';

document.documentElement.lang = uiLanguage;

const quickAgenda=location.search===agendaWindowSearch;
if(quickAgenda) { document.body.classList.add('quick-agenda'); document.title=t('agendaWindowName'); }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {quickAgenda ? <AgendaWindow/> : <App/>}
  </StrictMode>,
);
