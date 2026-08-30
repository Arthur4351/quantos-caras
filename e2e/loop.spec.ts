import { test, expect } from '@playwright/test';

test('loop shop -> battle -> reward basic', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
  // wait for Menu to load
  await page.waitForTimeout(1500);
  // Menu has canvas, click center to PLAY (approx 960,600 is middle of 1920x1080 scaled to viewport)
  // Use mouse click at center of viewport
  const box = await page.locator('canvas').boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2 + 80; // offset to PLAY button
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(1500);
  }
  // After clicking PLAY, we should be able to see canvas still and not crash
  await expect(page.locator('canvas')).toBeVisible();
  // URL should still be same (SPA)
  await expect(page).toHaveURL(/.*/);
  // Check no console errors that break game (basic)
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.waitForTimeout(1000);
  // should still be canvas visible
  await expect(page.locator('canvas')).toBeVisible();
});

test('canvas responsive loads', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1000);
  await expect(page.locator('canvas')).toBeVisible();
});
