import { describe, expect, it } from 'vitest';
import { isPong, ping, replyToPing } from '../../shared/contracts/ping';

describe('Background PING', () => {
  it('replies to a version 1 PING from the extension', () => {
    const reply = replyToPing({ scope: 'browser-pet', protocolVersion: 1, type: 'PING' }, true);
    expect(reply).toEqual({ ok: true, type: 'PONG' });
    expect(isPong(reply)).toBe(true);
  });

  it.each([null, [], 'PING', {}, { ...ping, scope: 'other' }])(
    'leaves unrelated messages unanswered (%j)', (message) => {
      expect(replyToPing(message, true)).toBeUndefined();
    },
  );

  it.each([{ ...ping, protocolVersion: 2 }, { ...ping, type: 'PONG' }])(
    'rejects an unsupported envelope (%j)', (message) => {
      expect(replyToPing(message, true)).toMatchObject({ ok: false, code: 'INVALID_MESSAGE' });
    },
  );

  it('rejects a sender outside the extension', () => {
    expect(replyToPing(ping, false)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it.each([undefined, 'PONG', { type: 'PONG' }, { ok: false, type: 'PONG' }, { ok: true, type: 'PING' }])(
    'does not show success for an invalid reply (%j)', (reply) => {
      expect(isPong(reply)).toBe(false);
    },
  );
});
