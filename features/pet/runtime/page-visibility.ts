import type { PageReport } from '../../../shared/contracts/page-report';

export function displayReason(enabled: boolean, hidden: boolean, allowedWindow: boolean): PageReport {
  if (!enabled) return 'disabled';
  return hidden || !allowedWindow ? 'window' : 'visible';
}
