import { describe, expect, it } from 'vitest';
import { backupFile, readBackup } from '../../shared/contracts/backup';
import { envelope, parseCommand, type Mutation } from '../../shared/contracts/commands';
import { createPetState } from '../../shared/contracts/state';
import { createStateWriter } from '../../shared/storage/writer';

function destination() {
  let state = createPetState();
  const run = createStateWriter({
    read: async () => state,
    write: async next => { state = next; },
  });
  function restore(file: string): Extract<Mutation, { type: 'RESTORE_BACKUP' }> {
    return {
      type: 'RESTORE_BACKUP', expectedPetId: state.pet.id, requestId: crypto.randomUUID(),
      payload: { confirmed: true, expectedRevision: state.revision, file },
    };
  }
  return { run, restore, read: () => state };
}

describe('컴퓨터 사이의 백업 이동', () => {
  it('펫과 알람을 복원하고 응답 유실로 다시 요청해도 한 번만 교체한다', async () => {
    const now = Date.now(), src = createPetState(now);
    src.pet.name = '달콩';
    src.care.xp = 19;
    src.agenda = { payday: null, recent: [], alarms: [
      { id: crypto.randomUUID(), title: '점심', date: '2030-06-14', time: '12:30', repeat: 'daily', enabled: true },
    ] };
    const file = await backupFile(src, now).text();
    expect(readBackup(file).exportedAt).toBe(now);
    const dst = destination(), previous = dst.read(), cmd = dst.restore(file);
    expect(await dst.run(cmd)).toMatchObject({ ok: true });
    const imported = dst.read();
    expect(imported).toMatchObject({ pet: { name: '달콩' }, care: src.care, agenda: src.agenda, revision: 1 });
    expect([previous.pet.id, src.pet.id]).not.toContain(imported.pet.id);
    expect(await dst.run(cmd)).toMatchObject({ ok: true, alreadyApplied: true });
    expect(dst.read()).toBe(imported);
  });

  it('다른 탭이 미리보기 뒤에 저장하면 최신 기록을 보존한다', async () => {
    const dst = destination(), before = dst.read();
    const cmd = dst.restore(await backupFile(createPetState(), Date.now()).text());
    await dst.run({ type: 'PET_RENAME', expectedPetId: before.pet.id, requestId: crypto.randomUUID(),
      payload: { speciesId: before.pet.speciesId, name: '새 이름' } });
    expect(await dst.run(cmd)).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(dst.read().pet.name).toBe('새 이름');
  });

  it('옵션에서 확인한 백업만 허용하고 손상된 파일은 저장하지 않는다', async () => {
    const dst = destination(), before = dst.read(), cmd = dst.restore('{');
    expect(parseCommand({ ...envelope, ...cmd }, 'content')).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand({ ...envelope, ...cmd }, 'popup')).toMatchObject({ code: 'FORBIDDEN' });
    expect(parseCommand({ ...envelope, ...cmd, payload: { ...cmd.payload, confirmed: false } }, 'options'))
      .toMatchObject({ code: 'VALIDATION_ERROR' });
    const unknownVersion = JSON.stringify({ format: 'browser-pet-backup', version: 2 });
    for (const file of ['{', unknownVersion, JSON.stringify({ format: 'browser-pet-backup', version: 1, exportedAt: 0, state: {} })]) {
      expect(await dst.run(dst.restore(file))).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
      expect(dst.read()).toBe(before);
    }
  });
});
