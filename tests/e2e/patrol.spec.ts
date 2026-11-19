import { expect, test } from '@playwright/test';
import { enableCat, withExtension } from './browser';

const fixtureUrl = 'http://127.0.0.1:4187/basic';

test('산책, 휴식, 실제 탭 숨김/복귀, 크기 조정과 정리', async () => {
  await withExtension(async context => {
    const page = context.pages()[0]!;
    await page.setViewportSize({ width: 900, height: 600 });
    await page.goto(fixtureUrl);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const popupUrl = await enableCat(context, page);
    // 새 문서를 열어도 기존 산책 기준이 유지된다.
    const host = page.locator('browser-pet-overlay');
    const actor = host.locator('[data-action]');
    const x = () => actor.evaluate(el => el.getBoundingClientRect().x);
    await expect(host).toHaveCount(1);
    await expect(page.frameLocator('iframe').locator('browser-pet-overlay')).toHaveCount(0);
    await expect(actor).toHaveAttribute('data-action', 'WALK', { timeout: 15_000 });
    const y = () => actor.evaluate(el => el.getBoundingClientRect().y);
    const initial = { x: await x(), y: await y() };
    await expect.poll(async () => Math.min(Math.abs(await x() - initial.x), Math.abs(await y() - initial.y))).toBeGreaterThan(1);
    await page.screenshot({ path: test.info().outputPath('walking.png') });
    await expect(actor).toHaveAttribute('data-action', 'IDLE', { timeout: 9500 });
    await page.getByRole('button', { name: '눌러 보기' }).click();
    await expect(page.getByRole('button', { name: '클릭됨' })).toBeVisible();
    const beforeSwitch = await x();
    const other = await context.newPage();
    await other.setViewportSize({ width: 900, height: 600 });
    await other.goto(fixtureUrl);
    await other.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
    await expect(host).toHaveCount(0);
    const otherActor = other.locator('browser-pet-overlay [data-action]');
    const otherX = () => otherActor.evaluate(el => el.getBoundingClientRect().x);
    // 다른 탭은 독립적으로 다시 걷지 않고 기존 산책 위치를 표시한다.
    await expect(otherActor).toBeVisible();
    expect(Math.abs(await otherX() - beforeSwitch)).toBeLessThan(45);
    const beforeReturn = await otherX();
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(false);
    await expect(host).toHaveCount(1);
    await expect(actor).not.toHaveAttribute('data-paused', '');
    await expect.poll(async () => Math.abs(await x() - beforeReturn)).toBeLessThan(20);
    await page.goto('http://127.0.0.1:4187/quirks');
    await expect(actor).toBeVisible();
    expect(await page.evaluate(() => document.compatMode)).toBe('BackCompat');
    await expect.poll(() => actor.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 16 && r.top >= 16 && r.right <= document.body.clientWidth - 16 + .01 &&
        r.bottom <= document.body.clientHeight - 16 + .01;
    })).toBe(true);
    await page.setViewportSize({ width: 40, height: 45 });
    await expect.poll(() => actor.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    })).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(actor).toHaveAttribute('data-paused', '');
    const popup = await context.newPage();
    await popup.goto(popupUrl);
    await popup.getByRole('switch', { name: '펫 표시', checked: true }).click();
    await page.bringToFront();
    await expect(host).toHaveCount(0);
    await popup.getByRole('switch', { name: '펫 표시', checked: false }).evaluate(b => (b as HTMLButtonElement).click());
    await expect(host).toHaveCount(1);
  });
});
