import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { PetState } from '../../shared/contracts/state';
import type { StateReply } from '../../shared/contracts/commands';
import { enableCat, withExtension, withInstalledExtension } from './browser';

const fixtureUrl = 'http://127.0.0.1:4187/basic';
const storageKey = 'browserPet.state';
declare const chrome: {
    runtime: { sendMessage(message: unknown): Promise<StateReply>; reload(): void };
    storage: { local: { set(items: Record<string, unknown>): Promise<void>; get(key: string): Promise<Record<string, unknown>> } };
};
async function command(page: Page, type: string, params: Record<string, unknown> = {}) {
  return page.evaluate(message => chrome.runtime.sendMessage(message),
    { scope: 'browser-pet', protocolVersion: 1, type, ...params });
}
async function state(page: Page): Promise<PetState> {
  const reply = await command(page, 'GET_STATE');
  return success(reply);
}
function success(reply: StateReply): PetState {
  if (!reply.ok) throw Error(reply.code);
  return reply.state;
}
async function open(context: BrowserContext, url: string) {
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

test('두 웹페이지 이름과 위치 동기화, 워커 재시작, 확장 새로고침과 같은 프로필의 브라우저 재실행', async () => {
  let popupUrl: string;
  let last: PetState;
  await withInstalledExtension(async context => {
    const first = await open(context, fixtureUrl);
    const second = await open(context, fixtureUrl);
    popupUrl = await enableCat(context, first);
    const popup = await open(context, popupUrl);
    await popup.getByText('친구 선택과 이름', { exact: true }).click();
    await popup.getByRole('button', { name: '누룽 설정', exact: true }).click();
    await popup.getByRole('textbox', { name: '누룽 이름' }).fill('  보리  ');
    await popup.getByRole('button', { name: '이름 저장' }).click();
    await expect(popup.getByRole('heading', { name: '보리', exact: true })).toBeVisible();
    for (const tab of [first, second]) {
      await tab.bringToFront();
      await expect(tab.getByRole('button', { name: '보리 메뉴' })).toBeVisible();
    }

    // 창 크기가 달라도 누룽가 놓인 비율은 같다. 드래그 중간 좌표는 디스크에 쓰지 않는다.
    await first.setViewportSize({ width: 900, height: 600 });
    await second.setViewportSize({ width: 620, height: 470 });
    const savedBeforeDrag = await state(popup);
    for (const tab of [first, second]) await tab.emulateMedia({ reducedMotion: 'reduce' });
    await first.bringToFront();
    const cat = (tab: Page) => tab.getByRole('button', { name: '보리 메뉴' });
    const relativePosition = (tab: Page) => cat(tab).evaluate(el => {
      const rect = el.getBoundingClientRect(), view = document.documentElement;
      return { x: rect.x / (view.clientWidth - rect.width), y: rect.y / (view.clientHeight - rect.height) };
    });
    const grip = await cat(first).boundingBox();
    if (!grip) throw Error('드래그할 보리가 보이지 않습니다.');
    await first.mouse.move(grip.x + 16, grip.y + 20);
    await first.mouse.down();
    await first.mouse.move(140, 100);
    expect(await state(popup)).toEqual(savedBeforeDrag);
    await first.mouse.up();
    await expect.poll(async () => (await cat(first).boundingBox())?.x).toBeCloseTo(124, 1);
    await expect.poll(async () => (await cat(first).boundingBox())?.y).toBeCloseTo(80, 1);
    const sharedPin = await relativePosition(first);
    const actor = (tab: Page) => tab.locator('browser-pet-overlay [data-action]');
    await second.bringToFront();
    await expect(actor(second)).toHaveAttribute('data-action', 'PINNED');
    const expectPin = async () => {
      const other = await relativePosition(second);
      expect(other.x).toBeCloseTo(sharedPin.x, 3);
      expect(other.y).toBeCloseTo(sharedPin.y, 3);
    };
    await expect(expectPin).toPass();
    expect((await state(popup)).revision).toBe(savedBeforeDrag.revision + 1);
    await second.reload();
    await expect(actor(second)).toHaveAttribute('data-action', 'PINNED');
    await expect(expectPin).toPass();

    const optionsUrl = new URL('/options.html', popupUrl).href;
    const [optionsA, optionsB] = await Promise.all([open(context, optionsUrl), open(context, optionsUrl)]);
    const original = await state(popup);
    const patch = (payload: Record<string, unknown>) => ({
      payload, expectedPetId: original.pet.id, requestId: crypto.randomUUID(),
    });

    // 실제 두 옵션 문서가 동시에 승인받은 서로 다른 필드가 모두 남아야 한다.
    const small = patch({ sizePx: 32 });
    const [sizeReply, speedReply] = await Promise.all([
      command(optionsA, 'SETTINGS_PATCH', small),
      command(optionsB, 'SETTINGS_PATCH', patch({ speed: 'slow' })),
    ]);
    expect([success(sizeReply).revision, success(speedReply).revision].sort((a, b) => a - b))
      .toEqual([original.revision + 1, original.revision + 2]);
    expect(await state(popup)).toMatchObject({ settings: { sizePx: 32, speed: 'slow' } });
    for (const tab of [first, second]) {
      await tab.bringToFront();
      await expect(tab.getByRole('button', { name: '보리 메뉴' })).toHaveCSS('width', '32px');
    }

    // 같은 필드는 도착 시각을 추측하지 않고 실제 승인 revision을 비교한다.
    const [a, b] = await Promise.all([
      command(optionsA, 'SETTINGS_PATCH', patch({ sizePx: 64 })),
      command(optionsB, 'SETTINGS_PATCH', patch({ sizePx: 96 })),
    ]);
    const [stateA, stateB] = [success(a), success(b)];
    last = stateA.revision > stateB.revision ? stateA : stateB;
    expect(await state(popup)).toEqual(last);

    const devtools = await context.browser()!.newBrowserCDPSession();
    const workerUrl = new URL('/background.js', popupUrl).href;
    const workerId = async () => (await devtools.send('Target.getTargets')).targetInfos
      .find(target => target.type === 'service_worker' && target.url === workerUrl)?.targetId;
    const currentWorker = () => {
      const worker = context.serviceWorkers().find(item => item.url() === workerUrl);
      if (!worker) throw Error('확장 워커 컨텍스트가 없습니다.');
      return worker;
    };
    // Chromium이 Target ID를 재사용하기도 한다. 휘발성 표식으로 JS 컨텍스트 재생성을 확인한다.
    const markWorker = () => currentWorker().evaluate(() => Reflect.set(globalThis, '__browserPetRestartProbe', true));
    const isMarked = () => currentWorker().evaluate(() => Reflect.has(globalThis, '__browserPetRestartProbe'));
    await markWorker();
    expect(await isMarked()).toBe(true);
    const oldWorker = await workerId();
    if (!oldWorker) throw Error('확장 서비스 워커를 찾을 수 없어요.');
    await devtools.send('Target.closeTarget', { targetId: oldWorker });
    await expect.poll(workerId).not.toBe(oldWorker);
    // 같은 ID를 새 워커에 다시 보낸다. 뒤에 승인된 크기를 32로 되돌리면 안 된다.
    expect(success(await command(optionsA, 'SETTINGS_PATCH', small))).toEqual(last);
    expect(await isMarked()).toBe(false);
    await markWorker();

    const beforeReload = await workerId();
    await optionsA.evaluate(() => { setTimeout(() => chrome.runtime.reload(), 0); });
    await expect.poll(workerId).not.toBe(beforeReload);
    // 확장 새로고침 뒤에는 팝업의 첫 GET_STATE가 워커를 다시 깨운다.
    const reopened = await context.newPage();
    // 로딩 중 잠깐 차단되는 chrome-extension URL을 고정 지연 없이 실제 사용 가능할 때 연다.
    await expect(async () => {
      await reopened.goto(popupUrl);
      await expect(reopened.getByRole('heading', { name: '보리', exact: true })).toBeVisible();
    }).toPass({ timeout: 8000 });
    expect(await state(reopened)).toEqual(last);
    expect(await isMarked()).toBe(false);
    await first.reload();
    await first.bringToFront();
    await expect(actor(first)).toHaveAttribute('data-action', 'PINNED');
    const restored = await relativePosition(first);
    expect(restored.x).toBeCloseTo(sharedPin.x, 3);
    expect(restored.y).toBeCloseTo(sharedPin.y, 3);
    await devtools.detach();
  }, async restartedContext => {
    // 이 시점에는 최초 Chromium 프로세스가 종료되었다. 브라우저 저장소만 공유한다.
    const popup = await open(restartedContext, popupUrl);
    await expect(popup.getByRole('heading', { name: '보리', exact: true })).toBeVisible();
    expect(await state(popup)).toEqual(last);
    const page = await open(restartedContext, fixtureUrl);
    await expect(page.getByRole('button', { name: '보리 메뉴' })).toHaveCSS('width', last.settings.sizePx + 'px');
    await expect(page.locator('browser-pet-overlay [data-action]')).toHaveAttribute('data-action', 'PINNED');
  });
});

test('손상된 저장본은 확인한 경우만 초기화하고 미래 형식은 그대로 보존한다', async () => {
  await withExtension(async context => {
    const first = await open(context, fixtureUrl);
    const popupUrl = await enableCat(context, first);
    const options = await open(context, new URL('/options.html', popupUrl).href);
    const initial = await state(options);
    const rootValue = () => options.evaluate(async key => (await chrome.storage.local.get(key))[key], storageKey);
    // 손상과 향후 버전은 일반 명령 경로에서 만들 수 없으므로 이 테스트의 임시 프로필에만 주입한다.
    const seed = (value: unknown) => options.evaluate(
      ({ key, value }) => chrome.storage.local.set({ [key]: value }), { key: storageKey, value });
    const broken = { ...initial, pet: { ...initial.pet, name: '' } };
    await seed(broken);
    await expect(options.getByRole('alert').first()).toBeVisible();
    await first.bringToFront();
    await expect(first.locator('browser-pet-overlay')).toHaveCount(0);
    await options.bringToFront();
    await options.getByText('저장 데이터', { exact: true }).click();
    const reset = options.getByRole('button', { name: '데이터 초기화', exact: true });
    await reset.click();
    const dialog = options.getByRole('dialog');
    await dialog.getByRole('button', { name: '취소' }).click();
    expect(await rootValue()).toEqual(broken);
    await reset.click();
    await dialog.getByRole('button', { name: '초기화하기' }).click();
    await expect(options.getByRole('switch', { name: '누룽 함께 표시' })).toBeVisible();
    const recovered = await state(options);
    expect(recovered.pet.id).not.toBe(initial.pet.id);
    expect(recovered.revision).toBe(initial.revision + 1);
    expect(recovered.settings.enabled).toBe(false);

    const future = { ...recovered, schemaVersion: 5, preservedMarker: 'new-format' };
    await seed(future);
    await expect(options.getByRole('alert').first()).toBeVisible();
    await options.reload();
    await expect(options.getByRole('alert').first()).toBeVisible();
    await expect(reset).toHaveCount(0);
    expect(await rootValue()).toEqual(future);
  });
});

test('누룽 또또와 꼬깃 보리의 이름을 구분하며 두 탭에서 고정 위치를 유지한다', async () => {
  await withExtension(async context => {
    const page = await open(context, fixtureUrl);
    const popupUrl = await enableCat(context, page);
    const second = await open(context, fixtureUrl);
    const popup = await open(context, popupUrl);
    const options = await open(context, new URL('/options.html', popupUrl).href);
    await popup.bringToFront();
    await popup.getByText('친구 선택과 이름', { exact: true }).click();
    await popup.getByRole('button', { name: '누룽 설정', exact: true }).click();
    await popup.getByRole('textbox', { name: '누룽 이름' }).fill('또또');
    await popup.getByRole('button', { name: '이름 저장' }).click();
    await page.bringToFront();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const trigger = page.getByRole('button', { name: '또또 메뉴' });
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    if (!box) throw Error('또또의 드래그 시작 위치가 없습니다.');
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(160, 110);
    await page.mouse.up();
    await expect(page.locator('browser-pet-overlay [data-action]')).toHaveAttribute('data-action', 'PINNED');
    const before = await state(popup);

    await popup.bringToFront();
    await popup.getByRole('textbox', { name: '누룽 이름' }).fill('저장 전');
    for (const species of ['꼬깃', '퐁당']) {
      const show = popup.getByRole('switch', { name: species + ' 함께 표시' });
      await show.click();
      await expect(show).toBeChecked();
    }
    // 방석 선택은 돌볼 친구를 바꾸고, 연필은 이름을 편집한다.
    for (const species of ['꼬깃', '퐁당', '꼬깃', '퐁당', '꼬깃']) {
      await popup.locator('.attic-summary').click();
      await popup.locator('.attic-pick').filter({ hasText: species }).click();
      await expect(popup.getByRole('heading', { name: /돌봄 기록$/ })).toHaveText([species + ' 돌봄 기록']);
      await expect(popup.getByRole('button', { name: '먹이 주기', exact: true })).toHaveCount(1);
      await expect(popup.getByRole('button', { name: '쓰다듬기', exact: true })).toHaveCount(1);
    }
    await popup.getByRole('button', { name: '꼬깃 설정' }).click();
    await expect(popup.getByLabel('꼬깃 이름')).toHaveValue('꼬깃');
    await options.bringToFront();
    await options.reload();
    await options.getByRole('button', { name: '꼬깃 설정' }).click();
    await options.getByLabel('꼬깃 이름').fill('보리');
    await options.getByRole('button', { name: '이름 저장' }).click();
    await expect(popup.getByLabel('꼬깃 이름')).toHaveValue('보리');
    const after = await state(options);
    expect(after.pet).toMatchObject({ id: before.pet.id, speciesId: 'kkogit', name: '보리' });
    expect(after.companions?.nurung?.scene.anchor).toEqual(before.scene?.anchor);
    for (const tab of [page, second]) {
      await tab.bringToFront();
      await expect(tab.locator('browser-pet-overlay .pet-trigger')).toHaveCount(3);
      await expect(tab.locator('[data-companion="nurung"]')).toHaveAttribute('data-action', 'PINNED');
      await tab.getByRole('button', { name: '보리 메뉴' }).press('Enter');
      await expect(tab.getByRole('group', { name: '보리', exact: true })).toBeVisible();
    }
    await options.bringToFront();
    await options.getByRole('button', { name: '또또 설정' }).click();
    await expect(options.getByLabel('누룽 이름')).toHaveValue('또또');
    await page.bringToFront();
    await trigger.press('Enter');
    await expect(page.getByRole('group', { name: '또또', exact: true })).toBeVisible();
    expect((await state(popup)).scene?.anchor).toEqual(before.scene?.anchor);
  });
});

test('펫 메뉴 열기는 XP를 주지 않고 먹이와 쓰다듬기 보상은 팝업과 두 탭이 공유한다', async () => {
  await withExtension(async context => {
    const first = await open(context, fixtureUrl);
    const popupUrl = await enableCat(context, first);
    const second = await open(context, fixtureUrl);
    const popup = await open(context, popupUrl);
    const base = await state(popup);
    for (const tab of [first, second]) {
      await tab.bringToFront();
      await tab.emulateMedia({ reducedMotion: 'reduce' });
      await tab.getByRole('button', { name: '누룽 메뉴' }).click();
      const menu = tab.getByRole('group', { name: '누룽', exact: true });
      await expect(menu).toBeVisible();
      expect((await state(popup)).care.xp).toBe(tab === first ? base.care.xp : base.care.xp + 5);
      await menu.getByRole('button', { name: '먹이 주기', exact: true }).click();
      await expect(menu.getByRole('status')).not.toBeEmpty();
      expect((await state(popup)).care.xp).toBe(base.care.xp + 5);
    }
    await popup.bringToFront();
    await popup.getByRole('button', { name: '쓰다듬기', exact: true }).click();
    await expect.poll(async () => (await state(popup)).care.xp).toBe(base.care.xp + 7);
    await popup.reload();
    expect((await state(popup)).care.xp).toBe(base.care.xp + 7);
    expect((await state(popup)).pet).toEqual(base.pet);
  });
});
