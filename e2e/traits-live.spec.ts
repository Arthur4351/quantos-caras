import { test, expect } from '@playwright/test';

/**
 * OS 42 CARAS, UM POR UM, EM BRIGA DE VERDADE.
 *
 * `tests/unit/traits.test.ts` prova que a TABELA esta certa: todo cara tem traco,
 * todo traco tem nome, frase e pelo menos um gancho. O que ele nao alcanca — e
 * nao tem como alcancar, porque o Phaser nao entra la — e a pergunta que de fato
 * importa: o gancho DISPARA quando a briga acontece?
 *
 * A diferenca nao e academica. Um traco pode existir na tabela, passar em todos
 * os testes de unidade e nunca rodar, porque o motor nao chama aquele gancho, ou
 * porque a condicao dele nunca fecha em campo. Para o jogador isso e um cara
 * generico: ele paga, recruta e nao acontece nada de diferente. E exatamente o
 * defeito que os 42 tracos existem para evitar.
 *
 * ENTAO ESTE TESTE BRIGA. Cada cara vai a campo SOZINHO, duas vezes:
 *
 *   - wave 1, que ele ganha  -> exercita bater, acertar, matar (onStrike, onHit, onKill);
 *   - wave 15, que ele perde -> exercita apanhar, aparar, cair  (onHurt, onBlock, onDown).
 *
 * Sozinho de proposito: em time de sete, os companheiros roubam os abates e o
 * `onKill` do VAMPIRO nunca fecha — foi o que aconteceu na primeira medicao, e o
 * traco parecia morto quando era so falta de oportunidade.
 *
 * O contador fica em volta do gancho de verdade (um embrulho por funcao), entao o
 * teste nao mede intencao: mede chamada. E o `try/catch` do embrulho registra
 * qualquer excecao que o traco jogue no meio da briga, que de outro jeito o
 * Phaser engoliria dentro do loop de update.
 */

const HOOKS = ['onSpawn', 'onTick', 'onStrike', 'onHit', 'onHurt', 'onBlock', 'onKill', 'onDown'];

/**
 * O BOOT FRIO E O MESMO DE TODO MUNDO — a medida esta em `artshot.spec.ts`.
 *
 * Aqui a espera era 25s escrita a mao, e este arquivo e o pior caso possivel dela:
 * `window.game` e a PRIMEIRA coisa que ele pede depois do `goto`, entao paga o Vite
 * transformando o grafo do Phaser sob demanda e a criacao do contexto WebGL em
 * SwiftShader de uma vez. Reprovou exatamente assim depois de uma edicao em
 * `traits.ts` invalidar o grafo: `Timeout 25000ms exceeded` na linha do
 * `waitForFunction`, com o jogo bootando normalmente no navegador logo depois.
 *
 * SUBIR PARA 30s NAO RESOLVEU — reprovou de novo, igual, `Timeout 30000ms
 * exceeded`. O aviso vale mais que o numero: a espera nao era curta, a conta do
 * aquecimento e que era grande (~45s medidos ate `window.game` existir, num perfil
 * novo de Chromium contra um grafo invalidado) e caia toda em quem rodasse
 * primeiro. Quem paga essa conta agora e `e2e/global-setup.ts`, uma vez, antes de
 * qualquer teste comecar.
 *
 * Os 30s ficam porque alinham com `ESPERA_CANVAS` dos outros tres arquivos e porque
 * medir o boot ainda faz sentido — so que agora e um boot morno, que fecha em
 * segundos. Quem manda no teto de verdade e o `test.setTimeout(300_000)` das 84
 * brigas logo abaixo.
 */
const ESPERA_BOOT = 30000;

type Relato = {
  id: string;
  nome: string;
  ganchos: string;
  zerados: string[];
  wave1: string | null;
  wave15: string | null;
};

test.describe('os 42 caras em campo', () => {
  /** 84 brigas passo a passo num navegador. Dois minutos e o normal; cinco e o teto. */
  test.setTimeout(300_000);

  test('todo gancho de todo traco dispara numa briga de verdade', async ({ page }) => {
    const explosoes: string[] = [];
    page.on('pageerror', e => explosoes.push(`pageerror: ${e.message}`));

    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as any).game?.scene), undefined, { timeout: ESPERA_BOOT });

    const ids: string[] = await page.evaluate(async (hooks: string[]) => {
      const w = window as any;
      const g = w.game;

      /**
       * A URL EXATA DO MODULO, nao a que parece obvia.
       *
       * `import('/src/systems/traits.ts')` do lado do teste cria uma SEGUNDA
       * instancia do modulo quando o Vite serviu o jogo com a versao carimbada
       * (`traits.ts?t=1788492957376`). Os embrulhos caem na copia, o jogo continua
       * chamando os originais e o relatorio sai com 42 tracos mudos — falso
       * alarme perfeito, que foi o primeiro resultado desta investigacao. Ler a
       * URL que o navegador REALMENTE baixou resolve nos dois casos, com carimbo
       * ou sem.
       */
      const url = performance.getEntriesByType('resource')
        .map(e => e.name)
        .find(n => n.includes('/src/systems/traits.ts'));
      if (!url) throw new Error('o modulo dos tracos nao aparece nos recursos da pagina');
      const mod = await import(/* @vite-ignore */ url);

      const hits: Record<string, any> = {};
      const errs: string[] = [];
      for (const t of mod.TRAIT_LIST) {
        hits[t.id] = { nome: t.name, declara: [] as string[] };
        for (const h of hooks) {
          const fn = (t as any)[h];
          if (typeof fn !== 'function') continue;
          hits[t.id].declara.push(h);
          hits[t.id][h] = 0;
          (t as any)[h] = function (...args: any[]) {
            hits[t.id][h]++;
            try { return fn.apply(this, args); }
            catch (e: any) { errs.push(`${t.id}.${h} -> ${(e && e.message) || e}`); }
          };
        }
      }
      w.__hits = hits;
      w.__errs = errs;
      w.__mod = mod;

      /**
       * A MAO NO RELOGIO — E SEM DESENHAR NADA.
       *
       * `loop.stop()` desliga o `requestAnimationFrame`: a partir daqui o mundo so
       * anda quando o teste manda, com dt fixo de 16.6ms, sem depender de tempo de
       * parede.
       *
       * E o passo e `scene.update`, nao `game.step`. `game.step` atualiza E DESENHA
       * (`core/Game.js:504`), e desenhar e o custo inteiro: no Chromium sem placa
       * de video o WebGL cai em software, e as 84 brigas estouraram os 300s de
       * timeout so pintando quadros que ninguem vai olhar. Este teste nao mede
       * pixel nenhum — quem mede pixel e `visual.spec.ts`. `scene.update` roda a
       * fila de cenas, os tweens, os timers e o `update` de cada cena
       * (`scene/SceneManager.js:555`), que e tudo de que um traco precisa para
       * disparar, e reduziu a briga a menos da metade do tempo.
       */
      g.loop.stop();
      w.__t = performance.now();
      w.__pump = (n: number) => { for (let i = 0; i < n; i++) { w.__t += 16.6; g.scene.update(w.__t, 16.6); } };

      w.__dudes = await (await fetch('/src/data/dudes.json')).json();
      w.__ativa = () => g.scene.getScenes(true).map((s: any) => s.scene.key);

      /** Uma briga: sobe a cena, bombeia ate ela terminar, devolve para onde foi. */
      w.__briga = (wave: number, id: string, maxFrames: number) => {
        const roster = [JSON.parse(JSON.stringify(w.__dudes.find((d: any) => d.id === id)))];
        for (const k of w.__ativa()) g.scene.stop(k);
        g.scene.start('Battle', { wave, dudesData: roster, trained: {}, snack: null, economy: { gold: 0 } });
        let frames = 0;
        let saiu: string | null = null;
        while (frames < maxFrames) {
          w.__pump(20);
          frames += 20;
          const at = w.__ativa();
          // os 80 primeiros quadros sao a troca de cena; antes disso 'Battle'
          // ainda nao subiu e a saida seria lida como fim de briga
          if (frames > 80 && !at.includes('Battle')) { saiu = at.join(','); break; }
        }
        return saiu;
      };

      /** Um cara: ganha uma, perde uma, e o boletim dos ganchos dele. */
      w.__solo = (lote: string[]) => lote.map((id: string) => {
        // 1000 quadros e teto de seguranca, nao expectativa: medido, o pior caso
        // sozinho fecha em 580 (wave 1) e 240 (wave 15, onde ele cai rapido)
        const wave1 = w.__briga(1, id, 1000);
        const wave15 = w.__briga(15, id, 1000);
        const r = w.__hits[id];
        return {
          id, nome: r.nome,
          ganchos: r.declara.map((k: string) => `${k}=${r[k]}`).join(' '),
          zerados: r.declara.filter((k: string) => r[k] === 0),
          wave1, wave15
        };
      });

      return w.__dudes.map((d: any) => d.id);
    }, HOOKS);

    expect(ids.length, 'o elenco do dudes.json').toBe(42);

    // de sete em sete para o relatorio sair legivel quando algo quebrar
    const boletim: Relato[] = [];
    for (let i = 0; i < ids.length; i += 7) {
      const lote = ids.slice(i, i + 7);
      const t0 = Date.now();
      boletim.push(...await page.evaluate((chunk: string[]) => (window as any).__solo(chunk), lote));
      console.log(`lote ${lote[0]}..${lote[lote.length - 1]}: ${Date.now() - t0}ms`);
    }

    const erros: string[] = await page.evaluate(() => (window as any).__errs);

    /**
     * TRES VEREDITOS, do mais grave para o mais sutil.
     */

    // 1. nenhum traco explodiu no meio da briga
    expect(erros, 'tracos que jogaram excecao em campo').toEqual([]);
    expect(explosoes, 'excecoes soltas na pagina durante as brigas').toEqual([]);

    // 2. todo cara declarou algum gancho E todos eles rodaram
    const mudos = boletim.filter(r => r.zerados.length > 0)
      .map(r => `${r.id} (${r.nome}) nao disparou: ${r.zerados.join(', ')}`);
    expect(mudos, 'ganchos que nunca rodaram numa briga de verdade').toEqual([]);

    const semNada = boletim.filter(r => !r.ganchos).map(r => r.id);
    expect(semNada, 'caras que entraram em campo sem traco nenhum').toEqual([]);

    // 3. a briga aconteceu de verdade: sozinho na wave 15 todo cara cai
    const naoCairam = boletim.filter(r => r.wave15 !== 'GameOver')
      .map(r => `${r.id} terminou a wave 15 em ${r.wave15}`);
    expect(naoCairam, 'a wave 15 sozinho tem de derrubar qualquer cara').toEqual([]);

    expect(boletim.length).toBe(42);
  });
});
