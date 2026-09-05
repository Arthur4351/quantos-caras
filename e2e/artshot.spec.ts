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

/**
 * O CANVAS DEMORA MAIS QUE TUDO NO PRIMEIRO TESTE DA FILA.
 *
 * Esta maquina tem 4 nucleos, entao o Playwright abre 2 workers: dois Chromium
 * criando contexto WebGL em SwiftShader ao mesmo tempo, mais o Vite transformando
 * o grafo do Phaser sob demanda. Sozinho, este arquivo boota em 10.8s — contra um
 * teto de 15s isso era 39% de folga, e a folga acabou num run de 12 testes: o
 * `artshot menu`, que e o PRIMEIRO da fila e paga o boot frio inteiro, estourou o
 * `waitForSelector` enquanto passava em isolamento.
 *
 * 30s deixa a espera do canvas na mesma ordem das esperas de cena logo abaixo
 * (25s cada). Teto alto nao deixa teste lento passar por bom: quem manda no tempo
 * total e o `timeout: 180000` do `playwright.config.ts`, que continua reprovando
 * qualquer boot que de fato travou.
 */
const ESPERA_CANVAS = 30000;

async function boot(page: any, w = 1920, h = 1080) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: ESPERA_CANVAS });
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

/**
 * UM EXERCITO DE VERDADE PARA AS FOTOS.
 *
 * As fotos de recompensa e de fim de run passavam `dudesData: []`: retratavam as
 * duas telas na sua versao mais vazia — sem rancho no rodape, sem contador de
 * copias, sem estrelas de treino, sem placar. Justamente o que essas telas tem para
 * mostrar. `army(...)` monta o que uma run de meio caminho tem de fato: cinco TIPOS
 * distintos, empilhados em quantidades diferentes.
 *
 * O PRIMEIRO NUMERO E SEMPRE O CARA. Antes o helper pegava os cinco primeiros
 * tipos de `dudes.json` — e o CARA e o ULTIMO dos 42, entao ele nunca aparecia. As
 * fotos retratavam uma run IMPOSSIVEL: ninguem comeca sem o CARA, e ele ganha uma
 * copia a cada dez rodadas. Contagem honesta na wave 13: dois CARAs. Na 31: quatro.
 */
async function army(page: any, counts = [2, 18, 14, 11, 8]) {
  return page.evaluate(async (c: number[]) => {
    const all = await fetch('/src/data/dudes.json').then(r => r.json());
    const hero = all.find((d: any) => d.id === 'dude');
    const seen = new Set<string>(['dude']);
    const types = [hero, ...all.filter((d: any) => !seen.has(d.id) && seen.add(d.id))]
      .slice(0, c.length);
    const out: any[] = [];
    types.forEach((d: any, i: number) => {
      for (let k = 0; k < c[i]; k++) out.push(JSON.parse(JSON.stringify(d)));
    });
    return out;
  }, counts);
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

/** Wave multipla de 3: a recompensa oferece RELIQUIA. */
test('artshot reward reliquia', async ({ page }) => {
  await boot(page);
  const inv = await army(page, [1, 6, 4]);
  await page.evaluate((dudesData: any) => (window as any).game.scene.start('Reward', {
    wave: 3, dudesData, economy: { gold: 18 }, noDeath: true
  }), inv);
  await waitScene(page, 'Reward');
  await page.screenshot({ path: `${SHOTS}/06-reward.png` });
});

/**
 * A TELA MAIS CHEIA DO JOGO: wave 30 e ao mesmo tempo multipla de 10 (o CARA da
 * decada cai) e multipla de 3 (a loja de reliquias abre). Os dois cartazes dividem
 * a mesma faixa vertical, e e esta foto que prova que a pilula do CARA (275..321)
 * nao encosta na banca de madeira (331..437). Com um rancho das seis familias, a
 * mesa tambem mostra o caso mais raro: carta de classe ao lado de carta geral.
 */
test('artshot reward reliquia + cara', async ({ page }) => {
  await boot(page);
  const inv = await army(page, [3, 8, 5, 4, 3, 2]);
  await page.evaluate((dudesData: any) => (window as any).game.scene.start('Reward', {
    wave: 30, dudesData, economy: { gold: 64 }, noDeath: true, trained: { dude: 3 }
  }), inv);
  await waitScene(page, 'Reward');
  await page.screenshot({ path: `${SHOTS}/06c-reward-reliquia-cara.png` });
});

/**
 * O PIOR CASO DE TEXTO DA CARTA — as duas descricoes mais compridas do catalogo.
 *
 * `RelicSystem.test.ts` tranca a descricao em 56 caracteres porque e o que cabe em
 * tres linhas de 23px dentro da carta (`Reward.relicCard`). Um teto em caracteres e
 * aproximacao: quem decide se vaza e a largura de cada letra na fonte do jogo. Esta
 * foto mostra o wrap de verdade das duas cartas mais faladeiras (CORNETA, 50, e
 * HOLOFOTE, 49) — se alguem esticar uma descricao ate o teto e ela pingar por baixo
 * do papel, e aqui que aparece.
 *
 * A MESA E FORCADA, nao sorteada: com o rancho so de GUERREIRO e ACAO, as unicas
 * cartas de classe elegiveis sao corneta e holofote (ver `RelicShop.eligibleRelics`),
 * e com as outras catorze ja no bolso sobram exatamente tres cartas novas para tres
 * lugares. A bolsa entra como a geral que a regra 3 exige.
 */
test('artshot reward carta faladeira', async ({ page }) => {
  await boot(page);
  const inv = await army(page, [4, 6]);   // CARA (Acao) + CAVALEIRO (Guerreiro)
  await page.evaluate(() => localStorage.setItem('relics', JSON.stringify([
    'meteor', 'bomb', 'sword', 'shield', 'hourglass', 'feather', 'telescope',
    'heart', 'revive', 'crown',
    'graveyard', 'union', 'grimoire', 'plasma'
  ].map(id => ({ id })))));
  await page.evaluate((dudesData: any) => (window as any).game.scene.start('Reward', {
    wave: 33, dudesData, economy: { gold: 80 }, noDeath: false, trained: { dude: 1 }
  }), inv);
  await waitScene(page, 'Reward');
  await page.screenshot({ path: `${SHOTS}/06d-reward-carta-faladeira.png` });
});

/** Wave comum: o rodape do RANCHO, com copias e estrelas de treino. */
test('artshot reward rancho', async ({ page }) => {
  await boot(page);
  const inv = await army(page);
  // SO O CARA TREINA. O seed antigo (`knight: 3, zombie: 1, office: 2`) coroava
  // tres mercenarios de estrelas — um estado que `canTrain` nao deixa mais existir,
  // e a foto contradizia a regra que ela deveria documentar.
  await page.evaluate((dudesData: any) => (window as any).game.scene.start('Reward', {
    wave: 13, dudesData, economy: { gold: 46 }, noDeath: false,
    trained: { dude: 2 }
  }), inv);
  await waitScene(page, 'Reward');
  await page.screenshot({ path: `${SHOTS}/06b-reward-rancho.png` });
});

test('artshot game over', async ({ page }) => {
  await boot(page);
  const inv = await army(page);
  // placar e conquistas seeded: sem isto a tela sai sem a fileira de pilulas e
  // sem a linha de CONQUISTAS, que e metade do que ela tem para dizer
  await page.evaluate(async () => {
    const relics = await fetch('/src/data/relics.json').then(r => r.json());
    const stars: any = {};
    for (let w = 1; w <= 12; w++) stars[w] = { silver: true, gold: w <= 3 };
    localStorage.setItem('stars', JSON.stringify(stars));
    localStorage.setItem('relics', JSON.stringify(relics.slice(0, 4)));
    localStorage.setItem('achievements', JSON.stringify(
      ['first_win', 'collector', 'synergy_2', 'synergy_6', 'army_50', 'gorilla_slayer']
    ));
  });
  await page.evaluate((dudesData: any) => (window as any).game.scene.start('GameOver', {
    wave: 13, victory: false, dudesData
  }), inv);
  await waitScene(page, 'GameOver');
  await page.screenshot({ path: `${SHOTS}/07-game-over.png` });
});

test('artshot daily', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('daily_last');
    localStorage.setItem('daily_board', JSON.stringify([
      { date: '2026-08-31', wave: 100, victory: true },
      { date: '2026-08-30', wave: 47, victory: false },
      { date: '2026-08-28', wave: 9, victory: false }
    ]));
    (window as any).game.scene.start('DailyDude');
  });
  await waitScene(page, 'DailyDude');
  await page.screenshot({ path: `${SHOTS}/08-daily.png` });
});

/**
 * A FOTO QUE IMPORTA: wave tardia com exercito cheio. A assinatura do How Many
 * Dudes e a multidao — se esta cena nao encher a tela, a direcao de arte falhou.
 *
 * Doze bonecos unicos (um de cada role) nao sao uma multidao: sao um pelotao. Na
 * wave 31 a run de verdade chegou com cinco tipos EMPILHADOS, setenta corpos no
 * campo. E esse numero que da nome ao jogo, entao e esse que a foto precisa ter.
 */
test('artshot horda', async ({ page }) => {
  await boot(page);
  const inv = await army(page, [4, 18, 16, 14, 12]);
  await page.evaluate((dudesData: any) =>
    (window as any).game.scene.start('Battle', { wave: 31, dudesData }), inv);
  await waitScene(page, 'Battle');
  await page.screenshot({ path: `${SHOTS}/09-horda.png` });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SHOTS}/09b-horda-choque.png` });
});
