import { expect, test, type Page } from '@playwright/test';
import { enableCat, withExtension } from './browser';

const url = 'http://127.0.0.1:4187/basic';
const companion = (page: Page) => page.locator('browser-pet-overlay [data-companion="nurung"]');

function position(page: Page) {
  return companion(page).evaluate(el => {
    const box = el.getBoundingClientRect();
    return {
      x: box.x / (document.documentElement.clientWidth - box.width),
      y: box.y / (document.documentElement.clientHeight - box.height),
    };
  });
}

test('다락방에서 그린 길을 다른 크기의 탭에서도 이어 걷고 끝점부터 자유롭게 산책한다', async () => {
  await withExtension(async context => {
    const page = context.pages()[0]!;
    const peer = await context.newPage();
    await page.setViewportSize({ width: 900, height: 600 });
    await peer.setViewportSize({ width: 680, height: 460 });
    for (const tab of [page, peer]) {
      await tab.goto(url);
      await tab.emulateMedia({ reducedMotion: 'no-preference' });
    }
    const popup = await context.newPage();
    await popup.goto(await enableCat(context, page));
    await popup.bringToFront();
    await popup.getByText('산책길 긋기', { exact: true }).click();
    const start = popup.getByRole('button', { name: '산책 시작', exact: true });
    await expect(start).toBeDisabled();
    await popup.getByRole('button', { name: '하트 길', exact: true }).press('Enter');
    await expect(start).toBeEnabled();
    await popup.getByRole('button', { name: '지우기', exact: true }).click();
    await expect(start).toBeDisabled();

    const pad = popup.getByRole('application', { name: '산책길 도화지' });
    await pad.press('ArrowRight');
    await pad.press('ArrowDown');
    await expect(popup.locator('.walk-path-panel [role="status"]')).toContainText('55%, 60%');
    await popup.emulateMedia({ reducedMotion: 'reduce' });
    await start.click();
    await expect(popup.getByRole('alert')).toContainText('동작 줄이기');
    await popup.emulateMedia({ reducedMotion: 'no-preference' });
    await pad.scrollIntoViewIfNeeded();
    const box = await pad.boundingBox();
    if (!box) throw new Error('산책길을 그릴 영역이 보이지 않습니다.');
    const move = (x: number, y: number) => popup.mouse.move(box.x + x * box.width, box.y + y * box.height, { steps: 5 });
    await move(.15, .32);
    await popup.mouse.down();
    await move(.49, .32);
    await move(.49, .65);
    await popup.mouse.up();
    await expect(start).toBeEnabled();
    await start.click();
    await page.bringToFront();
    await expect(companion(page)).toHaveAttribute('data-drawn-walk', '');
    await popup.close();
    // 첫 구간은 수평이다. 크기가 다른 탭에서는 모서리부터 수직으로 이어간다.
    await expect.poll(async () => {
      const { x, y } = await position(page);
      return x > .19 && x < .48 && Math.abs(y - .32) < .025;
    }).toBe(true);
    // 기기의 동작 줄이기를 켜도 출발점으로 돌아가지 않는다.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(companion(page)).toHaveAttribute('data-paused', '');
    const paused = await position(page);
    expect(paused.x).toBeGreaterThan(.19);
    await peer.emulateMedia({ reducedMotion: 'reduce' });
    await peer.bringToFront();
    await expect(companion(page)).toHaveCount(0);
    await expect(companion(peer)).toHaveAttribute('data-paused', '');
    await expect.poll(async () => Math.abs((await position(peer)).x - paused.x)).toBeLessThan(.01);
    await peer.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => {
      const { x, y } = await position(peer);
      return Math.abs(x - .49) < .025 && y > .37 && y < .64;
    }).toBe(true);
    await expect(companion(peer)).not.toHaveAttribute('data-drawn-walk', '');
    const end = await position(peer);
    expect(Math.abs(end.x - .49)).toBeLessThan(.06);
    expect(Math.abs(end.y - .65)).toBeLessThan(.06);
    await expect.poll(async () => Math.abs((await position(peer)).x - end.x)).toBeGreaterThan(.01);
  });
});
