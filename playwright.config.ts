import { defineConfig } from '@playwright/test';

/**
 * UM WORKER, DE PROPOSITO — e a medida que forcou isso.
 *
 * Todo teste deste diretorio dirige um canvas WebGL de 1920x1080. O Chromium
 * headless nao tem placa de video aqui: ele cai em SwiftShader, que renderiza na
 * CPU e usa varios nucleos para UM contexto. Esta maquina tem 4, e o padrao do
 * Playwright (`ceil(4/2)` = 2 workers) poe dois contextos disputando os mesmos
 * nucleos.
 *
 * Isso nao divide o trabalho, divide o relogio: cada teste fica ~2x mais lento e
 * as esperas internas sao todas em tempo de PAREDE, entao o risco de timeout dobra
 * sem nenhum ganho de vazao (o gargalo e CPU nas duas configuracoes). Medido com 2
 * workers e a suite inteira junta: 7 dos 18 testes reprovaram, TODOS por timeout —
 * boot, troca de cena e briga, nenhuma falha de conteudo. Rodando um por vez, os
 * 18 passam.
 *
 * TIMEOUT DE 180s pelo mesmo motivo, e por coerencia aritmetica: um teste de arte
 * espera ate 30s pelo canvas e mais 25s + 25s pelas duas fases da cena (`artshot`
 * e `visual`), o que ja soma 80s antes de qualquer clique. Com o teto antigo de 90s
 * um unico boot lento estourava o teste inteiro — o limite de fora era mais
 * apertado que a soma dos limites de dentro. 180s continua reprovando travamento
 * de verdade: quem travou queima os 180s e reprova igual.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180000,
  workers: 1,
  /**
   * E O AQUECIMENTO ANTES DE TODOS ELES — o motivo esta em `e2e/global-setup.ts`.
   *
   * Resumo: o `webServer` abaixo espera a porta, nao o grafo transformado. Sem este
   * passo o primeiro teste da fila paga o boot frio dentro da propria espera, e foi
   * assim que `traits-live` reprovou duas vezes por timeout com o jogo funcionando.
   */
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 20000
  },
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure'
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 }
  }
});
