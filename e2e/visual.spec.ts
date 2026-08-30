import { test, expect } from '@playwright/test';

const breakpoints = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 360, height: 800 },
];

for (const bp of breakpoints) {
  test(`visual ${bp.name} shop`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    // click PLAY at center
    const box = await page.locator('canvas').boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2 + 80;
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(1500);
    }
    await expect(page.locator('canvas')).toBeVisible();
    // allow animations because Phaser canvas is constantly ticking (tweens, particles)
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot(`shop-${bp.name}.png`, { animations: 'allow', maxDiffPixels: 80000, maxDiffPixelRatio: 0.08 });
  });

  test(`visual ${bp.name} battle`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const box = await page.locator('canvas').boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2 + 80;
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(1200);
      // try to buy first dude (shop slot ~30% width, 30% height of canvas)
      const shopX = box.x + box.width * 0.3;
      const shopY = box.y + box.height * 0.35;
      await page.mouse.click(shopX, shopY);
      await page.waitForTimeout(500);
      // click START BATTLE near bottom center
      const battleX = box.x + box.width / 2;
      const battleY = box.y + box.height * 0.85;
      await page.mouse.click(battleX, battleY);
      await page.waitForTimeout(2000);
    }
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot(`battle-${bp.name}.png`, { animations: 'allow', maxDiffPixels: 80000, maxDiffPixelRatio: 0.08 });
  });
}
