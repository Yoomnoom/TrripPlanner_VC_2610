import { expect, test, type Page } from '@playwright/test';

const title = () => `스모크 ${Date.now().toString(36)}`;

async function createTrip(page: Page, name: string, nickname: string) {
  await page.goto('/new');
  await page.getByLabel('여행 제목').fill(name);
  await page.getByLabel('내 닉네임').fill(nickname);
  await page.getByRole('button', { name: '여행 만들기' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('create a trip and see the home dashboard', async ({ page }) => {
  const name = title();
  await createTrip(page, name, '민수');
  await expect(page.getByRole('button', { name: '동행 초대' })).toBeVisible();
  await expect(page.locator('#main').getByRole('link', { name: /체크리스트/ })).toBeVisible();
});

test('invite link: second person joins, both see each other, stopping the share blocks new joins', async ({ page, browser }) => {
  const name = title();
  await createTrip(page, name, '민수');

  // read the invite link from the sheet
  await page.getByRole('button', { name: '동행 초대' }).click();
  const link = await page.getByRole('textbox', { name: '초대 링크' }).inputValue();
  expect(link).toContain('/join/');
  await page.getByRole('button', { name: '닫기', exact: true }).last().click();

  // second browser context = another person
  const guestCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const guest = await guestCtx.newPage();
  await guest.goto(link);
  await expect(guest.getByRole('heading', { name })).toBeVisible();
  await guest.getByLabel('내 닉네임').fill('지은');
  await guest.getByRole('button', { name: '입장하기' }).click();
  await expect(guest).toHaveURL(/\/t\//);

  // both see two members
  const base = new URL(page.url()).pathname;
  await page.goto(`${base}/members`);
  await expect(page.getByText('지은')).toBeVisible();
  await guest.goto(`${base}/members`);
  await expect(guest.getByText('민수')).toBeVisible();

  // owner stops sharing; a third person cannot join
  await page.getByRole('button', { name: '공유 메뉴' }).click();
  await page.getByRole('button', { name: '공유 중지' }).first().click();
  await page.getByRole('button', { name: '공유 중지' }).last().click();
  const lateCtx = await browser.newContext();
  const late = await lateCtx.newPage();
  await late.goto(link);
  await expect(late.getByText('초대 링크를 쓸 수 없어요')).toBeVisible();

  await guestCtx.close();
  await lateCtx.close();
});

test('unknown route shows a friendly page, not a blank screen', async ({ page }) => {
  await page.goto('/no/such/page');
  await expect(page.getByText('페이지를 찾을 수 없어요')).toBeVisible();
});
