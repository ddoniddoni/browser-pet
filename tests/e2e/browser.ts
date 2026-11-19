import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';

// 기존 시나리오는 한국어 레이블과 기본 펫 이름을 사용한다.
const koreanUI = ['--lang=ko', ...(process.platform === 'darwin' ? ['-AppleLanguages', '(ko)'] : [])];

type Session = (context: BrowserContext) => Promise<void>;

async function withProfile(run: (profile: string) => Promise<void>) {
  const profile = await mkdtemp(join(tmpdir(), 'browser-pet-e2e-'));
  try {
    await run(profile);
  } finally {
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  }
}

export const withExtension = (run: Session) => withProfile(profile => runInProfile(profile, run));

// CDP로 압축 해제된 확장을 처음 한 번 설치한다. 확장 새로고침과 브라우저 재시작에도
// 설치가 유지되는 실제 프로필 경로이며, 각 세션은 서로 다른 Chromium 프로세스다.
export async function withInstalledExtension(...sessions: Session[]) {
  await withProfile(async profile => {
    const path = resolve('.output/chrome-mv3');
    for (const [i, run] of sessions.entries()) {
      await runInProfile(profile, async context => {
        const cdp = await context.browser()!.newBrowserCDPSession();
        if (i === 0) {
          const manager = await context.newPage();
          await manager.goto('chrome://extensions/');
          const developerMode = manager.locator('#devMode');
          const isOn = () => developerMode.evaluate(el =>
            ['aria-pressed', 'aria-checked'].some(attr => el.getAttribute(attr) === 'true'));
          if (!await isOn()) await developerMode.click();
          await expect.poll(isOn).toBe(true);
          await cdp.send('Extensions.loadUnpacked', { path });
          await manager.close();
        } else {
          const { extensions } = await cdp.send('Extensions.getExtensions');
          expect(extensions).toContainEqual(expect.objectContaining({ path, enabled: true }));
        }
        await cdp.detach();
        await run(context);
      }, true);
    }
  });
}

// 독립 프로필의 Chromium에 noDefaults로 연결해 실제 visibilitychange를 관찰한다.
async function runInProfile(profile: string, run: Session, installed = false) {
  const extension = resolve('.output/chrome-mv3');
  const child = spawn(chromium.executablePath(), [
    ...koreanUI, '--user-data-dir=' + profile, '--remote-debugging-port=0', '--no-first-run',
    '--no-default-browser-check', ...(installed ? ['--enable-unsafe-extension-debugging'] :
      ['--disable-extensions-except=' + extension, '--load-extension=' + extension]), '--window-size=940,720',
    '--host-resolver-rules=MAP *.browser-pet.test 127.0.0.1', '--no-proxy-server', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const exited = once(child, 'close');
  const stderr = createInterface({ input: child.stderr });
  let browser: Browser | undefined;
  try {
    const endpoint = await new Promise<string>((resolveEndpoint, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chromium 연결 시간 초과')), 10000);
      stderr.on('line', (line: string) => {
        const url = line.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
        if (url) { clearTimeout(timeout); resolveEndpoint(url); }
      });
      void exited.then(() => {
        clearTimeout(timeout);
        reject(new Error('Chromium이 연결 전에 종료됨'));
      }, error => { clearTimeout(timeout); reject(error); });
    });
    browser = await chromium.connectOverCDP(endpoint, { noDefaults: true, timeout: 10000 });
    await run(browser.contexts()[0]!);
  } finally {
    stderr.close();
    // 프로필이 저장되도록 정상 종료한다. 연결 실패나 종료 지연 때도 테스트 프로세스는 정리한다.
    const deadline = setTimeout(() => child.kill('SIGKILL'), 4000);
    try {
      if (browser?.isConnected()) {
        const control = await browser.newBrowserCDPSession();
        await control.send('Browser.close');
      } else child.kill();
    } catch {
      child.kill();
    } finally {
      await exited.catch(() => {});
      clearTimeout(deadline);
    }
  }
}

export async function enableCat(context: BrowserContext, page: Page) {
  // Chromium의 내장 확장도 background.js를 사용하므로 실제 manifest로 식별한다.
  let popupUrl = '';
  await expect.poll(async () => {
    for (const worker of context.serviceWorkers()) {
      if (new URL(worker.url()).pathname !== '/background.js') continue;
      const name = await worker.evaluate('chrome.runtime.getManifest().name');
      if (name === 'Browser Pet') popupUrl = new URL('/popup.html', worker.url()).href;
    }
    return popupUrl;
  }).not.toBe('');
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  // 먼저 제한된 탭에서의 안내를 확인한 뒤, 일반 페이지를 활성 탭으로 유지한다.
  await expect(popup.getByText('일반 웹페이지에서 만나요.', { exact: false })).toBeVisible();
  await page.bringToFront();
  await popup.reload();
  const meet = popup.getByRole('button', { name: '누룽 만나기' });
  await meet.evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.locator('browser-pet-overlay [data-action="WAVE"]')).toBeVisible();
  await expect(popup.getByRole('switch', { name: '펫 표시', checked: true })).toBeVisible();
  await popup.close();
  await page.bringToFront();
  return popupUrl;
}
