import { test } from '@playwright/test';

/**
 * Captura de direcao de arte. NAO e um teste de regressao — e a ferramenta que
 * uso para olhar o jogo e comparar com a referencia do How Many Dudes.
 * Uso: npx playwright test e2e/artshot.spec.ts
 *
 * O headless roda em SwiftShader (WebGL por software), entao o framerate aqui
 * nao diz nada sobre a maquina do jogador. Por isso esperamos pela CENA ATIVA,
 * nunca por um timeout fixo.
 */

const SHOTS = 'e2e/artshots';

async function boot(page: any, w = 1920, h = 1080) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await waitScene(page, 'Menu');
}

async function waitScene(page: any, key: string) {
  await page.waitForFunction(
    (k: string) => ((window as any).game?.scene?.getScenes(true) ?? [])
      .some((s: any) => s.scene.key === k),
    key, { timeout: 25000 }
  );
  // espera o fade-in da camera terminar — no SwiftShader o create() trava a
  // thread e o fade fica no meio do caminho por varios frames
  await page.waitForFunction(
    (k: string) => {
      const s = ((window as any).game?.scene?.getScenes(true) ?? [])
        .find((sc: any) => sc.scene.key === k);
      const fx = s?.cameras?.main?.fadeEffect;
      return !!s && (!fx || !fx.isRunning);
    },
    key, { timeout: 25000 }
  );
  await page.waitForTimeout(700); // deixa os tweens de entrada assentarem
}

async function canvasClick(page: any, fx: number, fy: number) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) return;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test('artshot menu', async ({ page }) => {
  await boot(page);
  await page.screenshot({ path: `${SHOTS}/01-menu.png` });
});

test('artshot shop', async ({ page }) => {
  await boot(page);
  await canvasClick(page, 0.5, 0.807);
  await waitScene(page, 'Shop');
  await page.screenshot({ path: `${SHOTS}/02-shop.png` });
});

test('artshot battle', async ({ page }) => {
  await boot(page);
  await canvasClick(page, 0.5, 0.807);
  await waitScene(page, 'Shop');
  // compra os 3 primeiros slots (cada compra reinicia a cena)
  for (const fx of [0.22, 0.34, 0.5]) {
    await canvasClick(page, fx, 0.41);
    await page.waitForTimeout(1400);
  }
  await page.screenshot({ path: `${SHOTS}/02b-shop-cheio.png` });
  await canvasClick(page, 0.5, 0.94);
  await waitScene(page, 'Battle');
  await page.screenshot({ path: `${SHOTS}/03-battle.png` });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${SHOTS}/03b-battle-meio.png` });
});

test('artshot mobile', async ({ page }) => {
  await boot(page, 390, 844);
  await page.screenshot({ path: `${SHOTS}/04-menu-mobile.png` });
  await canvasClick(page, 0.5, 0.807);
  await waitScene(page, 'Shop');
  await page.screenshot({ path: `${SHOTS}/05-shop-mobile.png` });
});

test('artshot reward', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).game.scene.start('Reward', {
    wave: 3,
    dudesData: []
  }));
  await waitScene(page, 'Reward');
  await page.screenshot({ path: `${SHOTS}/06-reward.png` });
});

test('artshot game over', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).game.scene.start('GameOver', {
    wave: 7,
    victory: false,
    dudesData: []
  }));
  await waitScene(page, 'GameOver');
  await page.screenshot({ path: `${SHOTS}/07-game-over.png` });
});

test('artshot daily', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).game.scene.start('DailyDude'));
  await waitScene(page, 'DailyDude');
  await page.screenshot({ path: `${SHOTS}/08-daily.png` });
});
