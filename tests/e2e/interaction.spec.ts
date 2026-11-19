import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { withExtension, enableCat } from './browser';

const url = 'http://127.0.0.1:4187/basic';
async function start(context: BrowserContext) {
  const page = context.pages()[0]!;
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto(url);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const popupUrl = await enableCat(context, page);
  const trigger = page.getByRole('button', { name: '누룽 메뉴' });
  const actor = page.locator('browser-pet-overlay [data-action]');
  // 포커스가 주어진 대상은 산책 중에도 제자리에 머문다.
  await trigger.focus();
  await expect(actor).toHaveAttribute('data-action', 'IDLE');
  return { page, popupUrl, actor, trigger, menu: page.getByRole('group', { name: '누룽', exact: true }) };
}

async function pointAtCat(page: Page) {
  const box = await page.getByRole('button', { name: '누룽 메뉴' }).boundingBox();
  if (!box) throw Error('누룽가 보이지 않습니다.');
  const grip = { x: 24, y: 22 };
  await page.mouse.move(box.x + grip.x, box.y + grip.y);
  await page.mouse.down();
  return { box, grip };
}

test('클릭과 키보드 쓰다듬기, 바깥 링크와 입력, 모든 탭 숨기기', async () => {
  await withExtension(async context => {
    const { page, actor, trigger, menu, popupUrl } = await start(context);
    const other = await context.newPage();
    await other.goto(url);
    await other.bringToFront();
    await expect(other.getByRole('button', { name: '누룽 메뉴' })).toBeVisible();
    await page.bringToFront();
    await trigger.focus();
    const { box, grip } = await pointAtCat(page);
    await page.mouse.move(box.x + grip.x + 5, box.y + grip.y);
    await page.mouse.up();
    await expect(menu).toBeVisible();
    await expect(actor).toHaveAttribute('data-action', 'PETTED');
    const pet = menu.getByRole('button', { name: '쓰다듬기' });
    await expect(pet).toBeFocused();
    await expect(menu.getByRole('button', { name: '산책 다시 시작' })).toHaveCount(0);
    const menuPosition = await trigger.boundingBox();
    await expect(actor).toHaveAttribute('data-action', 'IDLE');
    expect(await trigger.boundingBox()).toEqual(menuPosition);
    await page.keyboard.press('Tab');
    const feed = menu.getByRole('button', { name: '먹이 주기' });
    await expect(feed).toBeFocused();
    await feed.press('Enter');
    await expect(menu.getByRole('status')).toContainText('먹이를 줬어요');
    await feed.press('Enter');
    await expect(menu.getByRole('status')).toContainText('10분마다');
    await page.keyboard.press('Shift+Tab');
    await expect(pet).toBeFocused();
    await pet.click();
    await expect(menu.getByRole('status')).toContainText('쓰다듬었어요. 경험치 +2');
    await expect(actor).toHaveAttribute('data-action', 'PETTED');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(menu).toHaveCount(0);
    for (const key of ['Enter', 'Space']) {
      await page.keyboard.press(key);
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    }
    await trigger.press('Enter');
    await page.getByRole('link', { name: '페이지 링크' }).click();
    await expect(page).toHaveURL(/#destination$/);
    await expect(menu).toHaveCount(0);
    await page.getByRole('textbox').fill('페이지 입력 확인');
    await expect(page.getByRole('textbox')).toHaveValue('페이지 입력 확인');
    await page.mouse.move(350, 280);
    await page.mouse.wheel(0, 350);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    await expect(trigger).toBeVisible();
    await page.getByRole('link', { name: '페이지 링크' }).focus();
    await trigger.focus();
    await trigger.press('Space');
    await menu.getByRole('button', { name: '모든 탭에서 숨기기' }).click();
    await expect(page.locator('browser-pet-overlay')).toHaveCount(0);
    await other.bringToFront();
    await expect(other.locator('browser-pet-overlay')).toHaveCount(0);
    await page.bringToFront();
    await page.reload();
    const popup = await context.newPage();
    await popup.goto(popupUrl);
    await popup.getByRole('switch', { name: '펫 표시', checked: false }).click();
    await page.bringToFront();
    await expect(trigger).toBeVisible();
    await other.bringToFront();
    await expect(other.getByRole('button', { name: '누룽 메뉴' })).toBeVisible();
  });
});

test('놓은 화면 위치 고정, 드래그 취소와 창 축소, 산책 재개', async () => {
  await withExtension(async context => {
    const { page, actor, trigger, menu, popupUrl } = await start(context);
    const { box, grip } = await pointAtCat(page);
    await page.mouse.move(box.x + grip.x - 6, box.y + grip.y);
    await expect(actor).toHaveAttribute('data-action', 'DRAG');
    const capture = await trigger.evaluate(b => b.hasPointerCapture(1));
    expect(capture).toBe(true);
    await page.mouse.move(400, 150);
    const held = await trigger.boundingBox();
    expect(held?.x).toBeCloseTo(400 - grip.x, 1);
    expect(held?.y).toBeCloseTo(150 - grip.y, 1);
    await page.mouse.up();
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    expect(await trigger.boundingBox()).toEqual(held);
    await expect(menu).toHaveCount(0);
    await page.getByRole('link', { name: '페이지 링크' }).focus();
    await page.mouse.move(100, 200);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    expect(await trigger.boundingBox()).toEqual(held);
    const other = await context.newPage();
    await other.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
    await page.bringToFront();
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    expect(await trigger.boundingBox()).toEqual(held);
    for (const interruption of ['pointercancel', 'lostpointercapture', 'blur', 'hidden'] as const) {
      await trigger.focus();
      await pointAtCat(page);
      await page.mouse.move(310, 120);
      await expect(actor).toHaveAttribute('data-action', 'DRAG');
      if (interruption === 'pointercancel') {
        await trigger.dispatchEvent('pointercancel', { pointerId: 1 });
      } else if (interruption === 'lostpointercapture') {
        await trigger.evaluate(b => b.releasePointerCapture(1));
        await page.mouse.move(305, 121);
      } else if (interruption === 'blur') {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      } else {
        await other.bringToFront();
        await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
        await page.bringToFront();
      }
      await page.mouse.up();
      await expect(actor).toHaveAttribute('data-action', 'PINNED');
      expect(await trigger.boundingBox()).toEqual(held);
      await expect(menu).toHaveCount(0);
    }
    await pointAtCat(page);
    await page.mouse.move(650, 130);
    await page.setViewportSize({ width: 260, height: 210 });
    const rightEdge = await page.evaluate(() => document.documentElement.clientWidth - 64);
    await expect.poll(async () => (await trigger.boundingBox())?.x).toBeCloseTo(rightEdge, 1);
    await page.mouse.move(245, 130);
    await page.mouse.up();
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pointAtCat(page);
    await page.mouse.move(90, 50);
    await page.mouse.up();
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    const secondPin = await trigger.boundingBox();
    expect(secondPin?.x).toBeCloseTo(90 - grip.x, 1);
    expect(secondPin?.y).toBeCloseTo(50 - grip.y, 1);
    // 백그라운드 페이지를 따로 열어 두면 드래그 중 포커스를 옮기지 않고 설정을 바꿀 수 있다.
    const popup = await context.newPage();
    await popup.goto(popupUrl);
    await page.bringToFront();
    await pointAtCat(page);
    await page.mouse.move(110, 70);
    await expect(actor).toHaveAttribute('data-action', 'DRAG');
    const oldTrigger = await trigger.elementHandle();
    await popup.getByRole('switch', { name: '펫 표시', checked: true }).evaluate(b => (b as HTMLButtonElement).click());
    await expect(trigger).toHaveCount(0);
    // 제거된 버튼의 활성화 리스너도 정리되어 예전 메뉴가 다시 열리지 않는다.
    expect(await oldTrigger?.evaluate(button => {
      (button as HTMLButtonElement).click();
      return button.getAttribute('aria-expanded');
    })).toBe('false');
    await oldTrigger?.dispose();
    await page.mouse.up();
    await popup.getByRole('switch', { name: '펫 표시', checked: false }).evaluate(b => (b as HTMLButtonElement).click());
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    expect(await trigger.boundingBox()).toEqual(secondPin);
    await trigger.click();
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: '쓰다듬기' }).click();
    // 동작 줄이기 상태에서는 클릭이 공유돼도 고정 자세와 좌표를 유지한다.
    await expect(actor).toHaveAttribute('data-paused', '');
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    expect(await trigger.boundingBox()).toEqual(secondPin);
    await menu.getByRole('button', { name: '산책 다시 시작' }).click();
    await expect(menu).toHaveCount(0);
    await expect(actor).not.toHaveAttribute('data-action', 'PINNED');
    await expect.poll(() => trigger.boundingBox()).toEqual(secondPin);
    await trigger.press('Enter');
    await expect(menu.getByRole('button', { name: '산책 다시 시작' })).toHaveCount(0);
  });
});

test('화면 왼쪽 끝에 놓은 자리에서 산책하고, 다른 크기의 탭에서도 같은 대각선 경로를 이어간다', async () => {
  await withExtension(async context => {
    const { page, trigger, actor, menu } = await start(context);
    const { grip } = await pointAtCat(page);
    await page.mouse.move(grip.x, 120 + grip.y);
    await page.mouse.up();
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.click();
    await menu.getByRole('button', { name: '산책 다시 시작' }).click();
    await expect(actor).not.toHaveAttribute('data-action', 'PINNED');
    await expect.poll(async () => (await trigger.boundingBox())?.x).toBeCloseTo(0, 1);
    await expect.poll(async () => (await trigger.boundingBox())?.y).toBeCloseTo(120, 1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(actor).toHaveAttribute('data-action', 'WALK');
    await expect.poll(async () => (await trigger.boundingBox())?.x).toBeGreaterThan(2);
    await expect.poll(async () => Math.abs((await trigger.boundingBox())!.y-120)).toBeGreaterThan(12);
    const ratio = (el: Element) => {
      const r=el.getBoundingClientRect(), view=document.documentElement;
      return {x:r.x/(view.clientWidth-r.width),y:r.y/(view.clientHeight-r.height),at:Date.now()};
    };
    const before=await trigger.evaluate(ratio);
    const peer = await context.newPage();
    await peer.setViewportSize({ width: 800, height: 420 });
    await peer.goto(url);
    await peer.bringToFront();
    const peerCat = peer.getByRole('button', { name: '누룽 메뉴' });
    await expect(peerCat).toBeVisible();
    const after=await peerCat.evaluate(ratio);
    const maxTravel=30*((after.at-before.at)/1000+.15);
    expect(Math.abs(after.x-before.x)*900).toBeLessThan(maxTravel);
    expect(Math.abs(after.y-before.y)*600).toBeLessThan(maxTravel);
  });
});

test('두 일반 창 사이에서 한 마리만 고정 위치를 이어가고, 별도 팝업에서는 숨긴다', async () => {
  await withExtension(async context => {
    const { page, trigger, actor } = await start(context);
    await trigger.focus();
    const { grip } = await pointAtCat(page);
    await page.mouse.move(360, 180);
    await page.mouse.up();
    await expect(actor).toHaveAttribute('data-action', 'PINNED');
    const host = (p: Page) => p.locator('browser-pet-overlay');
    const cdp = await context.browser()!.newBrowserCDPSession();
    try {
      const added = context.waitForEvent('page');
      await cdp.send('Target.createTarget', { url, newWindow: true });
      const peer = await added;
      await peer.setViewportSize({ width: 900, height: 600 });
      await peer.bringToFront();
      const peerCat = peer.getByRole('button', { name: '누룽 메뉴' });
      await expect(peerCat).toBeVisible();
      await expect.poll(async () => (await peerCat.boundingBox())?.x).toBeCloseTo(360 - grip.x, 1);
      await expect(host(page)).toHaveCount(0);

      await page.bringToFront();
      await expect(actor).toHaveAttribute('data-action', 'PINNED');
      await expect(host(peer)).toHaveCount(0);

      // 실제 사용자 클릭으로 별도의 브라우저 팝업을 연다.
      await page.evaluate(() => {
        document.querySelector('button')!.addEventListener('click', () => {
          window.open('/basic', '_blank', 'popup,width=400,height=320');
        }, { once: true });
      });
      const opened = page.waitForEvent('popup');
      await page.getByRole('button', { name: '눌러 보기' }).click();
      const child = await opened;
      await child.bringToFront();
      await expect(child.getByRole('heading', { name: '산책 확인' })).toBeVisible();
      await expect(host(page)).toHaveCount(0);
      await expect(host(peer)).toHaveCount(0);
      await expect(host(child)).toHaveCount(0);
      await child.close();
      await page.bringToFront();
      await expect(actor).toHaveAttribute('data-action', 'PINNED');
      await expect(host(peer)).toHaveCount(0);
    } finally {
      await cdp.detach();
    }
  });
});

test('메뉴를 닫은 직후 멈춘 자리에서 산책을 계속한다',async()=>{
  await withExtension(async context=>{
    const {page,actor,trigger,menu}=await start(context);
    await trigger.press('Enter');
    await expect(menu).toBeVisible();
    const x=()=>actor.evaluate(el=>el.getBoundingClientRect().x);
    const held=await x();
    // 쓰다듬는 동작이 끝날 때까지 메뉴를 유지한다. 옛 시계라면 이 시간만큼 위치가 앞선다.
    await expect(actor).toHaveAttribute('data-action','PETTED');
    await expect(actor).toHaveAttribute('data-action','IDLE');
    // 첫 걸음의 좌표를 브라우저 프레임 안에서 읽어 폴링 사이의 정상 이동을 제외한다.
    const firstStep = await actor.evaluateHandle(el => {
      const result = { x: null as number | null };
      const observer = new MutationObserver(() => {
        if (el.getAttribute('data-action') !== 'WALK') return;
        observer.disconnect();
        result.x = el.getBoundingClientRect().x;
      });
      observer.observe(el, { attributes: true, attributeFilter: ['data-action'] });
      return result;
    });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect.poll(() => firstStep.evaluate(value => value.x)).not.toBeNull();
    expect(Math.abs(await firstStep.evaluate(value => value.x!) - held)).toBeLessThan(8);
    await firstStep.dispose();
    await expect.poll(async()=>Math.abs(await x()-held)).toBeGreaterThan(8);
  });
});

test('하이파이브가 끝나면 손을 내밀었던 자리에서 걷는다',async()=>{
  await withExtension(async context=>{
    const {page,actor,trigger,menu}=await start(context);
    await trigger.press('Enter');
    await menu.getByRole('button',{name:'하이파이브',exact:true}).press('Enter');
    await expect(actor).toHaveAttribute('data-action','FIVE_READY');
    const x=()=>actor.evaluate(el=>el.getBoundingClientRect().x);
    const held=await x();
    // 폴링 지연으로 이미 몇 걸음 지난 좌표를 읽지 않도록 첫 WALK 렌더를 기록한다.
    const firstWalk=actor.evaluate(el=>new Promise<number>(resolve=>{
      const changes=new MutationObserver(()=>{
        if(el.getAttribute('data-action')==='WALK') {
          changes.disconnect(); resolve(el.getBoundingClientRect().x);
        }
      });
      changes.observe(el,{attributes:true,attributeFilter:['data-action']});
    }));
    await page.keyboard.press('Enter');
    await expect(actor).toHaveAttribute('data-action','FIVE_HIT');
    expect(Math.abs(await firstWalk-held)).toBeLessThan(8);
    await expect.poll(async()=>Math.abs(await x()-held)).toBeGreaterThan(8);
  });
});
