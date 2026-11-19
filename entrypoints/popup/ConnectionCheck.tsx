import { t } from '../../shared/i18n';
import { useState } from 'react';
import { Chevron } from '../../components/Chevron';
import { browser } from 'wxt/browser';
import { isPong, ping } from '../../shared/contracts/ping';

export function ConnectionCheck() {
  const [status, setStatus] = useState('');
  async function check() {
    setStatus(t('pingWaiting'));
    try {
      const reply: unknown = await browser.runtime.sendMessage(ping);
      if (isPong(reply)) {
        setStatus(t('pongReceived'));
        return;
      }
    } catch { /* 전송 실패와 잘못된 응답을 같은 상태로 안내한다. */ }
    setStatus(t('noPong'));
  }
  return (
    <details className="connection-check">
      <summary>{t('connection')}<Chevron /></summary>
      <button className="secondary" type="button" onClick={check} disabled={status === t('pingWaiting')}>{t('sendPing')}</button>
      <span role="status">{status}</span>
    </details>
  );
}
