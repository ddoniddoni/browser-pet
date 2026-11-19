import { t } from '../../shared/i18n';

export const settingsTabs = [
  ['friend', 'settingsFriend'], ['behavior', 'appearance'], ['wardrobe', 'wardrobe'],
] as const;
export type SettingsTab = typeof settingsTabs[number][0];

export function SettingsTabs({ value, onChange }: {
  value: SettingsTab; onChange: (value: SettingsTab) => void;
}) {
  return <div className="settings-tabs" role="tablist" aria-label={t('settingsHeading')}>
    {settingsTabs.map(([id, label], index) => <button key={id} type="button" role="tab"
      id={'tab-' + id} aria-controls={'panel-' + id} aria-selected={value === id}
      tabIndex={value === id ? 0 : -1} onClick={() => onChange(id)}
      onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % settingsTabs.length
          : event.key === 'ArrowLeft' ? (index + settingsTabs.length - 1) % settingsTabs.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? settingsTabs.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        const nextTab = settingsTabs[next]?.[0];
        if (!nextTab) return;
        onChange(nextTab);
        document.getElementById('tab-' + nextTab)?.focus();
      }}>{t(label)}</button>)}
  </div>;
}
