import { test, expect } from '@playwright/test';

test('main creator workspace opens directly and prompter flow works on desktop and mobile', async ({ page }) => {
  const errors=[];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Teleqen/i);

  const editor = page.getByLabel('Script text');
  await expect(editor).toBeVisible();
  await expect(page.getByRole('button', { name: /Start reading/i })).toBeVisible();

  await editor.fill('Welcome to Teleqen.\nThis is a real creator workflow test.');
  await page.getByRole('button', { name: /Start reading/i }).click();

  await expect(page.getByLabel('Teleprompter script')).toBeVisible();
  await expect(page.getByLabel('Start scrolling')).toBeVisible();
  await expect(page.getByLabel('Toggle mirror')).toBeVisible();
  await expect(page.getByLabel('Open display settings')).toBeVisible();
  await expect(page.getByLabel('Toggle camera preview')).toBeVisible();
  await expect(page.getByText('Voice', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Keys', { exact: true })).toHaveCount(0);

  await page.getByLabel('Open display settings').click();
  await expect(page.getByRole('dialog', { name: 'Display settings' })).toBeVisible();
  await page.getByLabel('Close settings').click();

  await page.getByLabel('Exit teleprompter').click();
  await expect(page.getByLabel('Script text')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel('Script text')).toBeVisible();
  await page.getByLabel('Script text').fill('Mobile creator test');
  await page.getByRole('button', { name: /Start reading/i }).click();
  await expect(page.getByLabel('Teleprompter script')).toBeVisible();
  await expect(page.getByText('Voice', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Keys', { exact: true })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});
