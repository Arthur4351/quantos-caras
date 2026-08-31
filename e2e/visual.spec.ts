import { test, expect } from '@playwright/test';

const breakpoints = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 360, height: 800 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__visualTest = true;
  });
});

async function waitScene(page: any, key: string): Promise<void> {
  await page.waitForFunction(() => Boolean((window as any).game?.scene), undefined, { timeout: 25000 });
  await page.waitForFunction((sceneKey: string) => {
    return ((window as any).game?.scene?.getScenes(true) ?? [])
      .some((scene: any) => scene.scene?.key === sceneKey || scene.sys?.settings?.key === sceneKey);
  }, key, { timeout: 25000 });
  await page.waitForFunction((sceneKey: string) => {
    const scene = ((window as any).game?.scene?.getScenes(true) ?? [])
      .find((active: any) => active.scene?.key === sceneKey || active.sys?.settings?.key === sceneKey);
    return Boolean(scene && !scene.cameras?.main?.fadeEffect?.isRunning);
  }, key, { timeout: 25000 });
  await page.waitForTimeout(650);
}

async function freezeFrame(page: any): Promise<void> {
  await page.evaluate(() => {
    const game = (window as any).game;
    game?.loop?.stop?.();
  });
}

async function deterministicRandom(page: any): Promise<void> {
  await page.evaluate(() => {
    let seed = 928374;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
}

for (const bp of breakpoints) {
  test(`visual ${bp.name} shop`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await deterministicRandom(page);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    await waitScene(page, 'Menu');
    // click PLAY at center
    const box = await page.locator('canvas').boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height * 0.807;
      await page.mouse.click(cx, cy);
      await waitScene(page, 'Shop');
    }
    await expect(page.locator('canvas')).toBeVisible();
    await freezeFrame(page);
    await expect(page).toHaveScreenshot(`shop-${bp.name}.png`, { animations: 'disabled', maxDiffPixels: 5000, maxDiffPixelRatio: 0.02 });
  });

  test(`visual ${bp.name} battle`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await deterministicRandom(page);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    await waitScene(page, 'Menu');
    const box = await page.locator('canvas').boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height * 0.807;
      await page.mouse.click(cx, cy);
      await waitScene(page, 'Shop');
      // try to buy first dude (shop slot ~30% width, 30% height of canvas)
      const shopX = box.x + box.width * 0.3;
      const shopY = box.y + box.height * 0.35;
      await page.mouse.click(shopX, shopY);
      await page.waitForTimeout(500);
      // click START BATTLE near bottom center
      const battleX = box.x + box.width / 2;
      const battleY = box.y + box.height * 0.94;
      await page.mouse.click(battleX, battleY);
      await waitScene(page, 'Battle');
    }
    await expect(page.locator('canvas')).toBeVisible();
    await freezeFrame(page);
    await expect(page).toHaveScreenshot(`battle-${bp.name}.png`, { animations: 'disabled', maxDiffPixels: 5000, maxDiffPixelRatio: 0.02 });
  });
}
