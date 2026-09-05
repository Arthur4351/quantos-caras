import { chromium, FullConfig } from '@playwright/test';

/**
 * O BOOT FRIO PAGO UMA VEZ, FORA DO RELOGIO DE QUALQUER TESTE.
 *
 * O `webServer` do `playwright.config.ts` espera a PORTA 3000 aceitar conexao, e
 * `vite` aceita conexao em ~300ms. Mas o Vite nao transformou nada ainda: ele
 * transforma sob demanda, quando o navegador pede. Quem faz o navegador pedir e o
 * PRIMEIRO teste da fila, e ele paga a conta inteira dentro da propria espera —
 * o grafo do Phaser transformado modulo por modulo mais a criacao do contexto
 * WebGL em SwiftShader, tudo de uma vez, num perfil de Chromium recem-nascido.
 *
 * Medido: depois de uma edicao em `src/systems/traits.ts` (que invalida o grafo),
 * o primeiro `page.goto('/')` levou ~45s ate `window.game` existir. `traits-live`
 * reprovou duas vezes seguidas exatamente ali — `Timeout 25000ms exceeded` e
 * depois `Timeout 30000ms exceeded` na primeira linha de espera — com o jogo
 * bootando normalmente no navegador logo em seguida. Nao era travamento nem
 * regressao: era o primeiro da fila pagando o aquecimento com o cronometro dele.
 *
 * Subir o teto de espera nao resolve isso, so muda quem reprova: a conta e a
 * mesma e continua caindo em quem chegar primeiro, e quem chega primeiro depende
 * do arquivo que o `--grep` da vez selecionou. Aquecer aqui tira a conta do sorteio
 * — as esperas de 25s/30s dos quatro arquivos passam a medir o que prometem medir
 * (a cena subir, a briga terminar) num servidor que ja transformou o grafo.
 *
 * O teto de 120s e generoso de proposito: este e o unico lugar do e2e onde o
 * relogio conta o pior caso legitimo em vez de um defeito. Se ele estourar, o
 * problema e o servidor, e a mensagem diz isso em vez de acusar um teste.
 */
const AQUECIMENTO = 120000;

async function globalSetup(config: FullConfig): Promise<void> {
  const base = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';
  const t0 = Date.now();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(String(base), { waitUntil: 'load', timeout: AQUECIMENTO });
    await page.waitForFunction(
      () => Boolean((window as unknown as { game?: { scene?: unknown } }).game?.scene),
      undefined,
      { timeout: AQUECIMENTO }
    );
    console.log(`aquecimento do vite + primeiro boot: ${Date.now() - t0}ms`);
  } finally {
    await page.close();
    await browser.close();
  }
}

export default globalSetup;
