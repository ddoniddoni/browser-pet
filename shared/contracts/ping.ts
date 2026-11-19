import { t } from '../i18n';
import { isRecord } from './state';
import { envelope } from './commands';

export const ping = {
  ...envelope,
  type: 'PING',
} as const;

type Pong = { ok: true; type: 'PONG' };
type PingReply = Pong | { ok: false; code: 'INVALID_MESSAGE' | 'FORBIDDEN'; message: string };

export function replyToPing(message: unknown, ownSender: boolean): PingReply | undefined {
  // 다른 scope의 메시지는 WXT 등 다른 리스너가 처리할 수 있게 둔다.
  if (!isRecord(message) || message.scope !== ping.scope) return;
  if (!ownSender) {
    return { ok: false, code: 'FORBIDDEN', message: t('internalOnly') };
  }
  if (message.protocolVersion !== ping.protocolVersion || message.type !== ping.type || Object.keys(message).length !== 3) {
    return { ok: false, code: 'INVALID_MESSAGE', message: t('unsupportedMessage') };
  }
  return { ok: true, type: 'PONG' };
}

export function isPong(value: unknown): value is Pong {
  return isRecord(value) && value.ok === true && value.type === 'PONG';
}
