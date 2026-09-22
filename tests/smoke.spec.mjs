import { test, expect } from '@playwright/test';

test('creator flow works on desktop and mobile without voice or keys controls', async ({ page }) => {
  const errors:string[]=[];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Teleqen/i);

  const editor = page.getByLabel('Script text');
  await editor.fill('Welcome to Teleqen.\nThis is a real creator workflow test.');
  await expect(page.getByText('Start reading')).toBeVisible();
  await page.getByRole('button', { name: /Start reading/i }).click();

  await expect(page.getByLabel('Teleprompter script')).toBeVisible();
  await expect(page.getByLabel('Start scrolling')).toBeVisible();
  await expect(page.getByLabel('Toggle mirror')).toBeVisible();
  await expect(page.getByLabel('Open display settings')).toBeVisible();
  await expect(page.getByText('Voice', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Keys', { exact: true })).toHaveCount(0);

  await page.getByLabel('Open display settings').click();
  await expect(page.getByRole('dialog', { name: 'Display settings' })).toBeVisible();
  await page.getByLabel('Close settings').click();

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
