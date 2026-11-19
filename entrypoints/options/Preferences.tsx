import { t } from '../../shared/i18n';
import { useId, useRef, useState } from 'react';
import { personalities } from '../../shared/contracts/character';
import { PetMiniature } from '../../components/PetMiniature';
import { getPetDefinition } from '../../features/pet/definitions/species';
import type { PetState, SettingsPatch } from '../../shared/contracts/state';
import { patchSettings } from '../../shared/messaging/state';

type Feedback =
  | { kind: 'idle' }
  | { kind: 'pending' | 'success' | 'error'; text: string };

// 화면에는 승인된 저장값을 표시하고, 각 조작은 필드 하나만 바꾼다.
export function useSaveFeedback() {
  const busy = useRef(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  async function save(operation: () => Promise<PetState>, success: string) {
    if (busy.current) return;
    busy.current = true;
    setFeedback({ kind: 'pending', text: t('saving') });
    try {
      await operation();
      setFeedback({ kind: 'success', text: success });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : t('saveError') });
    } finally {
      busy.current = false;
    }
  }
  return { feedback, save };
}

export function SaveNotice({ feedback }: { feedback: Feedback }) {
  return (
    <div className="save-notice">
      <p role="status">{feedback.kind === 'pending' || feedback.kind === 'success' ? feedback.text : ''}</p>
      {feedback.kind === 'error' && <p role="alert">{feedback.text}</p>}
    </div>
  );
}

interface Choice<T extends string | number> { value: T; label: string }
function ChoiceRow<T extends string | number>({ label, choices, value, onChange, note }: {
  label: string; choices: ReadonlyArray<Choice<T>>; value: T; onChange: (value: T) => void; note?: string;
}) {
  const id = useId();
  return <div className="behavior-choice" role="group" aria-labelledby={id + '-label'}
    aria-describedby={note ? id + '-note' : undefined}>
    <span className="choice-label" id={id + '-label'}>{label}</span>
    <div className="choice-strip">
      {choices.map(option => <label className="choice-option" key={option.value}>
        <input type="radio" name={id} value={option.value} checked={value === option.value}
          onChange={() => onChange(option.value)} />
        <span>{option.label}</span>
      </label>)}
    </div>
    {note && <p className="choice-note" id={id + '-note'}>{note}</p>}
  </div>;
}

const sizes = [{ value: 32, label: t('sizeSmall') }, { value: 64, label: t('sizeMedium') }, { value: 96, label: t('sizeLarge') }] as const;
type PetSize = typeof sizes[number]['value'];

function SizeSamples({ state, onChange }: { state: PetState; onChange: (size: PetSize) => void }) {
  const group = useId();
  return <fieldset className="size-samples">
    <legend>{t('speciesSize', getPetDefinition(state.pet.speciesId).displayName)}</legend>
    <div className="size-scale">
      {sizes.map(({ value, label }) => <label key={value} className="size-sample">
        <input type="radio" name={group} value={value} aria-label={label + ' ' + value + ' px'} checked={state.settings.sizePx === value}
          onChange={() => onChange(value)} />
        <span className="size-stage" aria-hidden="true">
          <span style={{ width: value, height: value }}>
            <PetMiniature speciesId={state.pet.speciesId} name={state.pet.name} scarf={state.settings.scarf} outfit={state.settings.outfit} />
          </span>
        </span>
        <span className="sample-caption"><b>{label}</b><small>{value} px</small></span>
      </label>)}
    </div>
  </fieldset>;
}

const speechChoices = [{ value: 'on', label: t('onLabel') }, { value: 'off', label: t('offLabel') }] as const;
const speeds = [{ value: 'slow', label: t('slow') }, { value: 'normal', label: t('normalSpeed') }] as const;
const motion = [{ value: 'system', label: t('systemMotion') }, { value: 'always', label: t('reduceAlways') }] as const;

export function Preferences({ state }: { state: PetState }) {
  const { feedback, save } = useSaveFeedback();
  const change = (patch: SettingsPatch) => void save(() => patchSettings(state, patch), t('saved'));
  const { settings } = state;

  return (
    <section className="preferences behavior" id="behavior" aria-labelledby="preferences-title">
      <h2 id="preferences-title">{t('appearance')}</h2>
      <p className="section-note">{t('allTabsHint')}</p>
      <fieldset className="preference-fields" disabled={feedback.kind === 'pending'} aria-labelledby="preferences-title">
        <SizeSamples state={state} onChange={sizePx => change({ sizePx })} />
        <div className="behavior-choices">
          <ChoiceRow label={t('personality')} value={settings.personality ?? 'calm'} choices={personalities}
            note={settings.personality === 'lively' ? t('livelyHint') : t('calmHint')}
            onChange={personality => change({ personality })} />
          <ChoiceRow label={t('speechBubbles')} value={settings.ambientSpeech === false ? 'off' : 'on'} choices={speechChoices}
            note={t('speechHint')}
            onChange={choice => change({ ambientSpeech: choice === 'on' })} />
          <ChoiceRow label={t('walkSpeed')} value={settings.speed} choices={speeds} onChange={speed => change({ speed })} />
          <ChoiceRow label={t('reduceMotion')} value={settings.reduceMotion} choices={motion} onChange={reduceMotion => change({ reduceMotion })} />
        </div>
      </fieldset>
      <SaveNotice feedback={feedback} />
    </section>
  );
}
