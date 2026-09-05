import { test, expect } from '@playwright/test';

/**
 * O CELULAR E DEITADO, PORQUE O PROPRIO JOGO EXIGE ISSO.
 *
 * `src/styles.css:1102` acende o `#rotate-gate` em `max-width: 700px` +
 * `orientation: portrait`: um retangulo OPACO `position:fixed; inset:0` com
 * `z-index:40` que cobre o canvas e pede para virar o telefone. O portao esta
 * certo — em 360px de largura o jogo renderiza pequeno demais para jogar.
 *
 * O TESTE E QUE ESTAVA ERRADO. Com `mobile` em 360x800 (retrato) as duas
 * fotos-referencia do celular retratavam O CARTAO DO PORTAO, nao o jogo:
 * `shop-mobile` e `battle-mobile` eram o mesmo desenho de telefone girando. E
 * passavam com ZERO pixel de diferenca todas as rodadas — nao porque a arte do
 * celular estava estavel, mas porque nenhuma arte do jogo aparecia ali. Dois dos
 * seis baselines eram cegos, e o verde deles dizia o contrario.
 *
 * (Foi tambem o que sempre explicou por que so o `shop-tablet` piscava com o
 * sorteio da loja: um cartao parado nao consegue distribuir outros caras.)
 *
 * 844x390 e o telefone DEITADO, que e a pose que o portao pede. Passa dos 700px,
 * entao o portao dorme e a foto mostra a briga de verdade.
 */
const breakpoints = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 844, height: 390 },
];

/**
 * O PRIMEIRO CANVAS DA FILA E O MAIS LENTO — mesma historia de `artshot.spec.ts`.
 *
 * Sao 4 nucleos e um worker so (ver `playwright.config.ts`), mas o boot ainda paga
 * o Vite transformando o Phaser sob demanda e a criacao do contexto WebGL em
 * SwiftShader. Os 10s de antes eram a espera mais apertada de todo o e2e,
 * justamente na etapa mais pesada; as esperas de cena logo abaixo ja usam 25s. O
 * teto de verdade e o `timeout: 180000` do `playwright.config.ts`.
 */
const ESPERA_CANVAS = 30000;

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

/**
 * CONGELA O JOGO NUMA POSE FIXA — nao "num instante qualquer".
 *
 * `game.loop.stop()` sozinho para o relogio onde ele estiver, e onde ele esta
 * depende da maquina: os 42 caras respiram num `idleBob` de 1000ms com `repeat:-1`,
 * entao 30ms de atraso no boot deslocam CADA boneco em 1..3px. O diff soma so
 * contorno vermelho e estoura os 5000px de tolerancia sem que nada tenha mudado
 * no jogo — foi exatamente o que reprovou `battle-desktop` e `battle-mobile`.
 *
 * A correcao e normalizar a fase de cada tween antes de parar o relogio:
 *
 *  - tween INFINITO (respiro, brilho pulsando) volta para o quadro zero, ou seja,
 *    a pose base do boneco. `Phaser` marca esses com `isInfinite` quando algum
 *    `TweenData` tem `repeat:-1` (`BaseTweenData.js:543`);
 *  - tween FINITO (entrada dos caras, poeira, numero subindo) e levado ao FIM,
 *    que e o estado em repouso que a cena teria de qualquer jeito um instante
 *    depois.
 *
 * `seek()` e usado nos dois casos porque ele ESCREVE os valores nos alvos;
 * `complete()` nao — ele so marca o tween para remocao e deixa o alvo parado no
 * meio do caminho, que e a nao-determinacao de novo. `seek` tambem nao dispara
 * callbacks, entao quem se destroi no `onComplete` fica na cena com o alpha final
 * (zero) em vez de sumir: invisivel e igual em toda rodada.
 *
 * A EXCECAO QUE CUSTOU 4979 PIXELS: `seek(0)` num tween que ainda nao comecou.
 * `idleBob` nasce com `delay: Math.random()*700`, e enquanto o atraso corre o
 * `TweenData.start` ainda vale ZERO — o valor real so e lido no primeiro update
 * (`BaseTweenData.js:195`). Como `seek(0)` nao roda update nenhum (`Tween.js:530`,
 * o laco depende de `amount > 0`), ele grava esse zero no alvo: o boneco cujo
 * respiro ainda nao tinha comecado era TELEPORTADO para `y = 0`. Quem tinha
 * comecado ficava certo, e como o atraso vence ou nao dependendo do relogio, o
 * mesmo cara aparecia ora certo ora deslocado. Tween que nao comecou nao escreveu
 * nada, logo o alvo JA esta na pose base: nao se toca nele. `hasStarted` e o
 * proprio sinal do Phaser para isso (`BaseTween.js:555`).
 *
 * Tres passadas porque um tween pode nascer da propria varredura; o `Set` garante
 * que ninguem e tocado duas vezes e que o laco sempre termina.
 */
async function freezeFrame(page: any): Promise<void> {
  await page.evaluate(() => {
    const game = (window as any).game;
    if (!game) return;

    const feitos = new Set<any>();
    for (let passada = 0; passada < 3; passada++) {
      let mexeu = false;
      for (const scene of game.scene.getScenes(true) ?? []) {
        for (const tw of scene.tweens?.getTweens?.() ?? []) {
          if (feitos.has(tw)) continue;
          feitos.add(tw);
          mexeu = true;
          try {
            if (tw.isInfinite) { if (tw.hasStarted) tw.seek(0); }
            else tw.seek(tw.duration);
          } catch {
            /* alvo ja destruido no meio do caminho: nao ha pose para fixar */
          }
        }
      }
      if (!mexeu) break;
    }

    game.loop?.stop?.();

    /**
     * E DESENHA UMA VEZ COM A POSE NOVA.
     *
     * Sem isto a varredura acima nao chega na tela: `loop.stop()` mata o RAF, e o
     * canvas continua exibindo o ULTIMO quadro desenhado — o de antes dos `seek`.
     * O teste comparava a pose aleatoria de sempre e a normalizacao era enfeite.
     *
     * A sequencia e a mesma de `Game.step` a partir do ponto em que ele para de
     * atualizar e comeca a desenhar (`core/Game.js:504`): `preRender`, as cenas,
     * `postRender`. Os eventos globais de render ficam de fora de proposito —
     * nada no jogo escuta eles, e o que importa aqui e o caminho dos pixels.
     * `scene.render` faz o `depthSort` (`scene/Systems.js:384`), entao a ordem de
     * profundidade (que neste jogo e o proprio y) sai correta.
     */
    const renderer = game.renderer;
    renderer.preRender();
    game.scene.render(renderer);
    renderer.postRender();
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

/**
 * QUANTO DE DIFERENCA E "NADA MUDOU" — medido, nao chutado.
 *
 * Com as poses normalizadas por `freezeFrame`, uma rodada com tolerancia ZERO
 * mostrou onde ainda ha folga e onde nao ha:
 *
 *   shop    desktop/tablet/mobile -> 0 px      (identico ao ultimo pixel)
 *   battle  tablet/mobile         -> 0 px
 *   battle  desktop               -> 2254 px   (0.11% do quadro)
 *
 * A LOJA e tela parada: carta, placa, corral, tudo desenhado uma vez. Ela fecha em
 * zero e e assim que deve ser cobrada. Os 300px sao so para engolir uma borda
 * antisserrada que a GPU resolva diferente entre rodadas — qualquer mexida de
 * verdade e uma ordem de grandeza acima: mover a legenda do corral 6px, o ultimo
 * ajuste real desta tela, custou 4979px.
 *
 * A BRIGA nao e tela parada: os caras marcham enquanto o teste espera. A posicao
 * deles depende de quantos quadros o simulador rodou antes do congelamento, e isso
 * depende do relogio da maquina — foi exatamente o que o diff de `battle-desktop`
 * mostrou: HUD, cerca, morro, painel da arena e placar IDENTICOS, e 4 dos 6
 * inimigos com 2px de contorno. Nao e regressao, e o jogo andando.
 *
 * Por isso a briga e cobrada em PROPORCAO e nao em pixel absoluto: cada
 * viewport tem um numero de pixels diferente (2.07M no desktop, 288k no mobile) e
 * um teto fixo seria apertado num e frouxo no outro. 0.5% do quadro da 4.6x de
 * folga sobre o pior caso medido (0.11% no desktop, 0.17% no tablet) e ainda
 * reprova qualquer mudanca de arte, que mexe em dezenas de milhares de pixels.
 *
 * O `maxDiffPixels` alto na briga NAO e um segundo teto, e a desativacao do
 * primeiro: `playwright.config.ts` fixa `maxDiffPixels: 100` para todo o projeto,
 * e quando os dois limites existem o Playwright aplica o MAIS SEVERO. Sem essa
 * linha o 0.5% seria enfeite e a briga continuaria sendo cobrada em 100px — foi
 * assim que `battle-tablet` reprovou com 240px de marcha, dentro da proporcao e
 * fora do teto herdado. 12000 fica acima do 0.5% de qualquer viewport aqui
 * (10368 no desktop), entao quem manda de fato e a proporcao.
 */
const LOJA_PARADA = { animations: 'disabled' as const, maxDiffPixels: 300 };
const BRIGA_VIVA = {
  animations: 'disabled' as const,
  maxDiffPixels: 12000,
  maxDiffPixelRatio: 0.005
};

for (const bp of breakpoints) {
  test(`visual ${bp.name} shop`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await deterministicRandom(page);
    await expect(page.locator('canvas')).toBeVisible({ timeout: ESPERA_CANVAS });
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
    await expect(page).toHaveScreenshot(`shop-${bp.name}.png`, LOJA_PARADA);
  });

  test(`visual ${bp.name} battle`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await deterministicRandom(page);
    await expect(page.locator('canvas')).toBeVisible({ timeout: ESPERA_CANVAS });
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
      /**
       * A COMPRA REINICIA A CENA, e o clique seguinte tem que esperar ela voltar.
       *
       * Eram 500ms fixos. Com a maquina carregada o `scene.restart` da loja levou
       * mais que isso, o clique em "PRA CIMA DELES!" caiu num quadro em que o botao
       * ainda nao existia, e o teste esperou 25s por uma Battle que ninguem pediu
       * — `battle-desktop` reprovou com a loja perfeitamente saudavel na foto do
       * erro. `waitScene` espera a cena ATIVA e o fade da camera TERMINADO, que e o
       * unico sinal honesto de que a loja esta pronta para o proximo clique.
       */
      await waitScene(page, 'Shop');
      // click START BATTLE near bottom center
      const battleX = box.x + box.width / 2;
      const battleY = box.y + box.height * 0.94;
      await page.mouse.click(battleX, battleY);
      await waitScene(page, 'Battle');
    }
    await expect(page.locator('canvas')).toBeVisible();
    await freezeFrame(page);
    await expect(page).toHaveScreenshot(`battle-${bp.name}.png`, BRIGA_VIVA);
  });
}

/**
 * E O PORTAO DE RETRATO CONTINUA COBRADO — agora no lugar certo.
 *
 * Ele nao entra como setimo baseline de pixel: o cartao tem `card-pop` na entrada
 * e `rotate-hint` em `infinite alternate`, e uma foto dele mede a animacao, nao a
 * regra. O que importa e absoluto e da para afirmar direto: em retrato o portao
 * COBRE a tela inteira, e deitando o telefone ele sai da frente.
 *
 * Este e o teste que impede a volta do defeito de cima. Se alguem mexer no media
 * query — ou apontar um breakpoint de foto para o retrato outra vez — ele reprova
 * ANTES de a arte do celular ser fotografada errada de novo.
 */
test('visual portao de retrato', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: ESPERA_CANVAS });

  const portao = page.locator('#rotate-gate');
  await expect(portao).toBeVisible();

  // nao e um aviso no canto: e um portao, e cobre os 390x844 inteiros
  const caixa = await portao.boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa!.width).toBe(390);
  expect(caixa!.height).toBe(844);
  expect(caixa!.x).toBe(0);
  expect(caixa!.y).toBe(0);

  // e o canvas continua VIVO embaixo (o portao cobre, nao esconde: `display:none`
  // no `#game` daria um pai 0x0 para o ScaleManager)
  const jogo = await page.locator('canvas').boundingBox();
  expect(jogo!.width).toBeGreaterThan(0);
  expect(jogo!.height).toBeGreaterThan(0);

  // deitou o telefone, o portao sai da frente
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(portao).toBeHidden();
});
