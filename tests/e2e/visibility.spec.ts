import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { enableCat, withExtension } from './browser';

const base = 'http://127.0.0.1:4187/visibility';
const overlay = (page: Page) => page.locator('browser-pet-overlay');

async function start(context: BrowserContext, url = base) {
  const page = context.pages()[0]!;
  await page.goto(url);
  const popupUrl = await enableCat(context, page);
  const options = await context.newPage();
  await options.goto(new URL('/options.html', popupUrl).href);
  await page.bringToFront();
  await expect(overlay(page)).toHaveCount(1);
  return { page, options };
}

test('입력과 전체화면 중에도 팝업의 전체 표시 버튼을 그대로 따른다', async () => {
  await withExtension(async context => {
    const { page, options } = await start(context);
    const popup = options;
    await popup.goto(new URL('/popup.html', options.url()).href);
    await page.bringToFront();
    const field = page.getByRole('textbox', { name: '짧은 메모' });
    await page.getByRole('button', { name: '전체화면 시작' }).click();
    await field.fill('로컬 예제');
    const host = overlay(page);
    await expect(host).toBeVisible();
    await expect.poll(() => host.evaluate(el => el.matches(':popover-open'))).toBe(true);
    // 테스트 팝업 문서에 포커스를 옮기지 않고 실제 React 버튼과 저장 경로를 거친다.
    await popup.getByRole('switch', { name: '펫 표시', checked: true }).evaluate(el => (el as HTMLButtonElement).click());
    await expect(host).toHaveCount(0);
    await popup.getByRole('switch', { name: '펫 표시', checked: false }).evaluate(el => (el as HTMLButtonElement).click());
    await expect(host).toBeVisible();
    await expect(field).toBeFocused();
    await page.evaluate(() => document.exitFullscreen());
    await expect(host).toBeVisible();
    await expect(field).toHaveValue('로컬 예제');
  });
});

test('이전 프로필의 사이트 숨김과 입력 설정이 켜기 버튼을 막지 않는다', async () => {
  await withExtension(async context => {
    const { page, options } = await start(context);
    const actor = overlay(page).locator('[data-action]');
    await options.bringToFront();
    // 현재 UI에는 없는 이전 버전 저장값을 fixture 프로필에만 남긴다.
    await options.evaluate(async () => {
      const area = (globalThis as typeof globalThis & { chrome: { storage: { local: {
        get(key: string): Promise<Record<string, import('../../shared/contracts/state').PetState>>;
        set(data: Record<string, unknown>): Promise<void>;
      } } } }).chrome.storage.local;
      const key = 'browserPet.state';
      const state = (await area.get(key))[key];
      if (!state) throw new Error('활성 프로필이 없습니다.');
      await area.set({ [key]: { ...state, revision: state.revision + 1, settings: { ...state.settings,
        hideInFullscreen: true, hideWhileFormFocused: true, hiddenHostnames: ['127.0.0.1'] } } });
    });
    await options.locator('#tab-behavior').click();
    const size = options.getByRole('group', { name: '누룽 크기', exact: true }).getByRole('radio', { name: '크게 96 px' });
    const speed = options.getByRole('group', { name: '산책 속도', exact: true }).getByRole('radio', { name: '느리게' });
    const motion = options.getByRole('group', { name: '동작 줄이기', exact: true }).getByRole('radio', { name: '항상 줄이기' });
    await size.click();
    await expect(size).toBeChecked();
    await speed.click();
    await expect(speed).toBeChecked();
    await motion.click();
    await expect(motion).toBeChecked();
    await options.reload();
    await options.locator('#tab-behavior').click();
    await expect(size).toBeChecked();
    await expect(speed).toBeChecked();
    await expect(motion).toBeChecked();
    await page.bringToFront();
    const cat = page.getByRole('button', { name: '누룽 메뉴' });
    await expect(cat).toHaveCSS('width', '96px');
    await expect(actor).toHaveAttribute('data-paused', '');
    await page.reload();
    await page.getByRole('textbox', { name: '짧은 메모' }).focus();
    await expect(cat).toBeVisible();
  });
});

test('열 개 탭에서 보이는 렌더러만 남고 문서 전환이 저장 쓰기를 일으키지 않는다', async () => {
  await withExtension(async context => {
    const { page, options } = await start(context);
    const pages = [page];
    for (let i = 1; i < 10; i++) {
      const next = await context.newPage();
      await next.goto(base);
      pages.push(next);
    }
    // 확장 문서가 자기 프로필의 저장소 변경 이벤트만 센다. fixture 페이지 값은 읽지 않는다.
    const observed = await options.evaluateHandle(() => {
      const counter = { writes: 0 };
      const event = (globalThis as typeof globalThis & {
        chrome: { storage: { onChanged: { addListener(cb: (keys: Record<string, unknown>, area: string) => void): void } } };
      }).chrome.storage.onChanged;
      event.addListener((keys, area) => { if (area === 'local' && 'browserPet.state' in keys) counter.writes++; });
      return counter;
    });
    for (const visible of [pages[9]!, page, pages[6]!, page]) {
      await visible.bringToFront();
      await expect(overlay(visible)).toHaveCount(1);
      await expect.poll(async () => Promise.all(pages.map(tab =>
        tab.evaluate(() => [document.hidden, document.querySelectorAll('browser-pet-overlay').length]))))
        .toEqual(pages.map(tab => tab === visible ? [false, 1] : [true, 0]));
    }
    await page.getByRole('button', { name: '주소만 바꾸기' }).click();
    await expect(page).toHaveURL(/#section$/);
    await expect(overlay(page)).toHaveCount(1);
    await page.getByRole('link', { name: '다른 문서로' }).click();
    await expect(overlay(page)).toHaveCount(1);
    await page.goBack({ waitUntil: 'commit' });
    await expect(page).toHaveURL(/#section$/);
    await expect(overlay(page)).toHaveCount(1);
    await page.reload();
    await expect(overlay(page)).toHaveCount(1);
    expect(await observed.evaluate(counter => counter.writes)).toBe(0);
    await observed.dispose();
  });
});
