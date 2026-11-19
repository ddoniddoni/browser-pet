import { t } from '../i18n';
import { envelope } from './commands';
import { isRecord } from './state';

export const pageReportRequest = { ...envelope, type: 'GET_PAGE_DISPLAY' } as const;
export const reportText = {
  visible: t('pageVisible'),
  window: t('wrongWindow'),
  disabled: t('displayOff'),
  loading: t('pageLoading'),
  stateError: t('pageStateError'),
  detached: t('pageDetached'),
} as const;
export type PageReport = keyof typeof reportText;
export function isPageReport(reply: unknown): reply is { status: PageReport } {
  return isRecord(reply) && typeof reply.status === 'string' && Object.hasOwn(reportText, reply.status);
}
