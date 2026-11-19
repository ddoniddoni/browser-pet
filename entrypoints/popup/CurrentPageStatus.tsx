import { t } from '../../shared/i18n';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { isPageReport, pageReportRequest, reportText, type PageReport } from '../../shared/contracts/page-report';
import type { PetState } from '../../shared/contracts/state';

type PageStatus = PageReport | 'noTab' | 'noReceiver' | 'checking';
export async function readPage(): Promise<PageStatus> {
  try {
    const win = await browser.windows.getCurrent();
    if (win.id === undefined || win.type !== 'normal') return 'window';
    const [tab] = await browser.tabs.query({ active: true, windowId: win.id });
    if (!tab || tab.id === undefined) return 'noTab';
    const reply: unknown = await browser.tabs.sendMessage(tab.id, pageReportRequest, { frameId: 0 });
    if (isPageReport(reply)) return reply.status;
  } catch { /* 접근 제한 페이지 또는 확장 업데이트 전부터 열린 페이지에는 수신자가 없다. */ }
  return 'noReceiver';
}

export function CurrentPageStatus({ settings, name }: { settings: PetState['settings']; name: string }) {
  const [status, setStatus] = useState<PageStatus>('checking');
  const [request, setRequest] = useState(0);
  useEffect(() => {
    let active = true;
    void readPage().then(result => { if (active) setStatus(result); });
    return () => { active = false; };
  }, [settings, request]);
  const text = status === 'noReceiver' ? t('pageMeetPet',name) : status === 'checking' ? t('checkingPage') :
    status === 'window' ? t('pageChooseTab') : status === 'noTab' ? t('noTab') : status === 'visible' ? t('visibleHere') : reportText[status];
  return <div className="page-status" data-visible={status === 'visible' || undefined}>
    <div><p role="status">{text}</p>
      {(status === 'noReceiver' || status === 'window') && <details className="page-guide">
        <summary>{t('pageHelp')}</summary><p>{status==='window' ? reportText.window : t('noReceiver')}</p>
      </details>}
    </div>
    <button className="link" type="button" aria-label={t('recheckPage')} title={t('recheckPage')}
      onClick={() => setRequest(value => value + 1)}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 6.5a5.1 5.1 0 1 0-.6 4.3M13 2.8v3.8H9.2" />
      </svg>
    </button>
  </div>;
}
