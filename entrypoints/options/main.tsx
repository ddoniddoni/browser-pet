import { t, uiLanguage } from '../../shared/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

document.documentElement.lang = uiLanguage;
document.title = t('optionsTitle');

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
