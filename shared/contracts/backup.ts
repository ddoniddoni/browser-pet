import { isCounter, isPetState, isRecord, type PetState } from './state';
import { t } from '../i18n';

const format = 'browser-pet-backup';
const version = 1;
export const maxBackupBytes = 16 * 1024 * 1024;

export interface PetBackup { exportedAt: number; state: PetState }

export function backupFile(state: PetState, exportedAt: number): Blob {
  // 요청 영수증과 리비전은 이 기기에서 쓰는 값이다.
  const data = { format, version, exportedAt, state: { ...state, revision: 0, recentRequests: [] } };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export function readBackup(text: string): PetBackup {
  if (text.length > maxBackupBytes) throw new Error(t('backupTooLarge'));
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error(t('backupInvalid')); }
  if (!isRecord(data) || data.format !== format) throw new Error(t('backupInvalid'));
  if (data.version !== version || (isRecord(data.state) && typeof data.state.schemaVersion === 'number' && data.state.schemaVersion > 4))
    throw new Error(t('backupVersion'));
  if (!isCounter(data.exportedAt) || !Number.isFinite(new Date(data.exportedAt).getTime()) || !isPetState(data.state))
    throw new Error(t('backupInvalid'));
  return { exportedAt: data.exportedAt, state: data.state };
}
