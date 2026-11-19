import { ChoicePortrait } from '../../components/SpeciesPicker';
import { t } from '../../shared/i18n';
interface Props {
  enabled: boolean | null;
  onToggle: () => void;
  onSettings: () => void;
}

export function PopupHeader({ enabled, onToggle, onSettings }: Props) {
  return <header className="popup-header">
    <h1><span className="popup-seal"><ChoicePortrait id="kkogit" clip="wordmark-kkogit" /></span>Browser Pet</h1>
    <div className="header-actions">
      {enabled !== null && <button type="button" role="switch" className="display-switch" aria-checked={enabled}
        title={enabled ? t('hideEverywhere') : t('showEverywhere')} onClick={onToggle}>
        {t('showPet')}<span className="switch-track" aria-hidden="true" />
      </button>}
      <button type="button" className="settings-button" aria-label={t('openSettings')} title={t('openSettings')} onClick={onSettings}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.65"
          strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
          <path d="M10.3 2.8h3.4l.6 2.4 1.8 1 2.4-.7 1.7 3-1.8 1.7v2.3l1.8 1.7-1.7 3-2.4-.7-1.8 1-.6 2.4h-3.4l-.6-2.4-1.8-1-2.4.7-1.7-3 1.8-1.7v-2.3L3.8 8.5l1.7-3 2.4.7 1.8-1Z" transform="translate(0 .7)" />
          <circle cx="12" cy="12" r="3.15" />
        </svg>
      </button>
    </div>
  </header>;
}
