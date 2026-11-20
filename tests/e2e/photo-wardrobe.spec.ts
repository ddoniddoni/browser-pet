import { expect, test } from '@playwright/test';
import { enableCat, withExtension } from './browser';

test('사진 펫 선택 시 포커스는 선택 상자에만 표시되고 머리와 목 장식은 함께 저장된다', async () => {
  await withExtension(async context => {
    const tab = context.pages()[0]!;
    await tab.goto('http://reading.browser-pet.test:4187/basic');
    const popupUrl = await enableCat(context, tab);
    const options = await context.newPage();
    await options.goto(new URL('/options.html', popupUrl).href);
    await options.getByLabel('캐릭터 추가', { exact: false }).setInputFiles('public/icon/128.png');
    const dialog = options.getByRole('dialog');
    await dialog.getByRole('button', { name: '내 펫으로 등록' }).click();
    await expect(dialog).toBeHidden();

    const wardrobe = options.getByRole('tab', { name: '옷장' });
    const picker = options.getByRole('combobox', { name: '옷 입힐 친구' });
    await wardrobe.click();
    await wardrobe.press('Tab');
    await expect(picker).toBeFocused();
    await expect(picker).toHaveCSS('box-shadow', /inset/);
    await expect(options.locator('label').filter({ has: picker })).toHaveCSS('outline-style', 'none');
    await picker.selectOption({ label: '128' });

    const bow = options.getByRole('button', { name: '살구 리본', exact: true });
    const bandana = options.getByRole('button', { name: '별밤 반다나', exact: true });
    const apply = options.getByRole('button', { name: '차림 적용' });
    await bow.click();
    await bandana.click();
    await apply.click();
    await expect(options.getByText('차림을 저장했어요.', { exact: true })).toBeVisible();

    await options.reload();
    await wardrobe.click();
    await picker.selectOption({ label: '128' });
    await expect(bow).toHaveAttribute('aria-pressed', 'true');
    await expect(bandana).toHaveAttribute('aria-pressed', 'true');
  });
});
