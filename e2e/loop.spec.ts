import { test, expect } from '@playwright/test';

/**
 * A VOLTA COMPLETA: MENU -> LOJA -> BRIGA -> RECOMPENSA -> LOJA.
 *
 * O titulo deste arquivo sempre foi "loop shop -> battle -> reward" e o que ele
 * media era outra coisa: clicava no meio da tela duas vezes, dormia 1500ms de cada
 * vez e conferia que o canvas continuava VISIVEL. Canvas visivel e o que sobra
 * quando o jogo trava — Phaser deixa a ultima tela pintada. O teste passava com a
 * loja congelada, com a briga nunca comecando e com a recompensa nunca chegando.
 *
 * Tinha mais tres defeitos de forma: `toHaveURL(/.*\/)` casa com qualquer coisa e
 * nao afirma nada; o escutador de erros de console era registrado DEPOIS dos
 * cliques que ele deveria vigiar; e a lista `errors` era preenchida e nunca lida.
 *
 * Agora cada passo e cobrado pela CENA ATIVA, que e o estado que o jogo de fato
 * muda, e a volta fecha onde comecou: loja da wave 2 com o rancho da wave 1 dentro.
 */

/** Boot frio com 2 workers e SwiftShader — a medida esta em `artshot.spec.ts`. */
const ESPERA_CANVAS = 30000;
const ESPERA_CENA = 30000;

/**
 * A BRIGA CORRE EM TEMPO REAL AQUI, e e de proposito.
 *
 * `traits-live.spec.ts` para o relogio e bombeia `scene.update` porque ele mede 84
 * brigas e nao olha um pixel. Este teste mede o CAMINHO DO JOGADOR: clique de
 * mouse, fade de camera, `delayedCall`, o `update` real desenhando. Bombear o
 * relogio aqui tiraria justamente o que ha para testar.
 *
 * Medido: a wave 1 com dois caras fecha em 15.6s de tempo de parede no Chromium
 * headless com WebGL por software, e a volta inteira (boot, menu, loja, carta,
 * briga, recompensa) em 52s. 60s de teto na briga da 3.8x de folga sobre a
 * medida, e o `timeout` de 180s do `playwright.config.ts` e o que reprova briga
 * travada de verdade.
 */
const ESPERA_BRIGA = 60000;

/** Chaves das cenas ativas — a unica pergunta que diz onde o jogo esta. */
async function ativas(page: any): Promise<string[]> {
  return page.evaluate(() => ((window as any).game?.scene?.getScenes(true) ?? [])
    .map((s: any) => s.scene?.key ?? s.sys?.settings?.key));
}

/** Espera a cena subir E o fade da camera terminar (o clique seguinte depende disso). */
async function esperaCena(page: any, key: string, timeout = ESPERA_CENA): Promise<void> {
  await page.waitForFunction((k: string) => {
    const s = ((window as any).game?.scene?.getScenes(true) ?? [])
      .find((sc: any) => (sc.scene?.key ?? sc.sys?.settings?.key) === k);
    const fx = s?.cameras?.main?.fadeEffect;
    return Boolean(s) && (!fx || !fx.isRunning);
  }, key, { timeout });
  await page.waitForTimeout(500);
}

/** Clique em fracao do canvas: o jogo escala 1920x1080 para qualquer viewport. */
async function clique(page: any, fx: number, fy: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('sem canvas para clicar');
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

/** Le um campo da cena ativa — para provar que o rancho atravessou a volta. */
async function campo(page: any, key: string, nome: string): Promise<any> {
  return page.evaluate(([k, n]: [string, string]) => {
    const s = ((window as any).game?.scene?.getScenes(true) ?? [])
      .find((sc: any) => (sc.scene?.key ?? sc.sys?.settings?.key) === k);
    return s ? (s as any)[n] : undefined;
  }, [key, nome]);
}

/**
 * OS BOTOES, EM FRACAO DO CANVAS.
 *
 * O jogo desenha num quadro virtual de 1920x1080 e escala para o viewport, entao
 * fracao vale em qualquer tamanho. Cada numero abaixo e a coordenada real no
 * codigo dividida por 1920 (x) ou 1080 (y) — nao chute:
 *
 *   PLAY           `Menu.ts:143`    y=871           -> 0.807
 *   1a CARTA       `Shop.ts:241`    x=578, y=505    -> 0.301, 0.468
 *   PRA CIMA DELES `Shop.ts:607`    y=1016          -> 0.941
 *   CONTINUAR      `Reward.ts:208`  y=520           -> 0.481
 *
 * O x da carta sai de `startX = 960 - (2 * CARD_STEP) / 2` com `CARD_STEP = 382`:
 * tres cartas centradas, a primeira em 578.
 */
const PLAY = 0.807;
const CARTA1 = { x: 0.301, y: 0.468 };
const BRIGAR = 0.941;
const CONTINUAR = 0.481;

test('a volta completa: menu -> loja -> briga -> recompensa -> loja', async ({ page }) => {
  // ANTES do goto: escutador registrado depois do clique nao vigia o clique
  const explosoes: string[] = [];
  const consoleErros: string[] = [];
  page.on('pageerror', e => explosoes.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErros.push(m.text()); });

  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: ESPERA_CANVAS });
  await esperaCena(page, 'Menu');

  // MENU -> LOJA
  await clique(page, 0.5, PLAY);
  await esperaCena(page, 'Shop');
  expect(await ativas(page), 'o PLAY tem de abrir a loja').toContain('Shop');

  /**
   * A RUN NASCE COM O CARA DENTRO (`Menu.ts:141`), entao o rancho ja e valido e o
   * botao de briga ja funciona sem compra nenhuma.
   */
  const rancho = await campo(page, 'Shop', 'inventory');
  expect(Array.isArray(rancho) && rancho.length, 'a loja abre com o CARA').toBeGreaterThan(0);
  expect(await campo(page, 'Shop', 'wave'), 'a run comeca na wave 1').toBe(1);

  /**
   * E A CARTA DA RODADA E PARTE DO CAMINHO, nao um extra.
   *
   * A propria loja escreve "UMA CARTA POR RODADA. AGORA E BRIGA." (`Shop.ts:238`):
   * o jogador chega na wave 1 com DOIS caras, o CARA e a carta que ele escolheu.
   * Medido pulando a carta: o CARA sozinho contra os 6 pirralhos da wave 1
   * (`WaveManager.ts:31`, 18 de vida e 4 de dano cada) PERDE, e o teste caia em
   * GameOver. Nao e desequilibrio, e a mao do jogador faltando uma carta.
   */
  await clique(page, CARTA1.x, CARTA1.y);
  await page.waitForTimeout(600);
  const rancho2 = await campo(page, 'Shop', 'inventory');
  expect(rancho2.length, 'a carta escolhida entra no rancho').toBe(rancho.length + 1);

  // LOJA -> BRIGA
  await clique(page, 0.5, BRIGAR);
  await esperaCena(page, 'Battle');

  // BRIGA -> RECOMPENSA (a wave 1 com dois caras e ganhavel; perder cai em GameOver)
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const at = ((window as any).game?.scene?.getScenes(true) ?? [])
      .map((s: any) => s.scene?.key ?? s.sys?.settings?.key);
    return at.includes('Reward') || at.includes('GameOver');
  }, undefined, { timeout: ESPERA_BRIGA });
  console.log(`wave 1 em tempo real: ${Date.now() - t0}ms`);
  expect(await ativas(page), 'a wave 1 com dois caras tem de ser ganha').toContain('Reward');
  await esperaCena(page, 'Reward');

  // RECOMPENSA -> LOJA, e a volta fecha
  await clique(page, 0.5, CONTINUAR);
  await esperaCena(page, 'Shop');
  expect(await campo(page, 'Shop', 'wave'), 'a recompensa avanca a wave').toBe(2);
  const rancho3 = await campo(page, 'Shop', 'inventory');
  expect(rancho3.length, 'o rancho atravessa a volta').toBeGreaterThanOrEqual(rancho2.length);

  expect(explosoes, 'excecoes soltas durante a volta').toEqual([]);
  expect(consoleErros, 'erros de console durante a volta').toEqual([]);
});

test('o canvas sobe no mobile e o jogo chega no menu', async ({ page }) => {
  const explosoes: string[] = [];
  page.on('pageerror', e => explosoes.push(e.message));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: ESPERA_CANVAS });
  // canvas visivel e so o elemento no DOM; o menu vivo e o que prova que bootou
  await esperaCena(page, 'Menu');
  expect(await ativas(page)).toContain('Menu');
  expect(explosoes, 'excecoes soltas no boot mobile').toEqual([]);
});
