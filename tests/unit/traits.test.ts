import { describe, it, expect, vi } from 'vitest';

/**
 * O PHASER NAO ENTRA AQUI.
 *
 * `traits.ts` puxa `fx.ts`, que puxa o Phaser, que faz um `require` de CommonJS
 * em `phaser3spectorjs` la dentro do WebGLRenderer — e o alias do vitest resolve
 * imports, nao `require` em tempo de execucao. Nada disso importa para este teste:
 * ele le a TABELA (nomes, blurbs, ganchos), nunca chama um gancho. Um stub vazio
 * deixa os modulos carregarem e o contrato ser verificado sem subir um renderer.
 */
vi.mock('phaser', () => ({ default: { Math: {}, GameObjects: {}, Scenes: {} } }));

import { TRAITS, TRAIT_LIST, traitFor, Trait } from '../../src/systems/traits';
import dudes from '../../src/data/dudes.json';

/**
 * O CONTRATO DOS 42 TRACOS.
 *
 * A regra do jogo e "nenhum cara e o mesmo com outro numero", e isso nao da para
 * testar por unidade — nao existe assert para "isto e divertido". O que DA para
 * travar e o que quebraria a promessa em silencio:
 *
 *  - um cara do `dudes.json` sem traco nenhum (ele luta so com o Kit e fica
 *    generico exatamente como o pedido dizia para nao ficar);
 *  - um traco declarado sem NENHUM gancho — codigo morto que parece feature;
 *  - dois tracos com o mesmo `id`, que faz um sobrescrever o outro no registro;
 *  - blurb que nao cabe na carta da loja (mede-se em caracteres porque a carta
 *    tem 330px e a fonte e a mesma para todos).
 */

const HOOKS: (keyof Trait)[] = [
  'onSpawn', 'onTick', 'onStrike', 'onHit', 'onHurt', 'onBlock', 'onKill', 'onDown'
];

const IDS = (dudes as { id: string }[]).map(d => d.id);

describe('tracos de assinatura', () => {
  it('existe um traco para CADA cara do dudes.json', () => {
    const sem = IDS.filter(id => !TRAITS[id]);
    expect(sem, `caras sem traco: ${sem.join(', ')}`).toEqual([]);
  });

  it('nao existe traco orfao (sem cara correspondente)', () => {
    const orfaos = TRAIT_LIST.map(t => t.id).filter(id => !IDS.includes(id));
    expect(orfaos, `tracos sem cara: ${orfaos.join(', ')}`).toEqual([]);
  });

  it('a lista tem o mesmo tamanho do elenco e nenhum id repetido', () => {
    expect(TRAIT_LIST.length).toBe(IDS.length);
    expect(new Set(TRAIT_LIST.map(t => t.id)).size).toBe(TRAIT_LIST.length);
  });

  it('a ordem da lista segue a ordem do elenco', () => {
    expect(TRAIT_LIST.map(t => t.id)).toEqual(IDS);
  });

  it('todo traco tem pelo menos um gancho — nada de feature morta', () => {
    const mudos = TRAIT_LIST.filter(t => !HOOKS.some(h => typeof t[h] === 'function'));
    expect(mudos.map(t => t.id), 'tracos sem nenhum gancho').toEqual([]);
  });

  it('todo traco tem nome em caixa alta e nao vazio', () => {
    for (const t of TRAIT_LIST) {
      expect(t.name.length, `${t.id} sem nome`).toBeGreaterThan(2);
      expect(t.name, `${t.id} fora da caixa alta`).toBe(t.name.toUpperCase());
    }
  });

  /**
   * O NOME CABE NA PLACA DA CARTA DA LOJA.
   *
   * A faixa colorida onde o nome do golpe e estampado tem 298px de largura
   * (`Shop.buildCard`) e a fonte e 25px em peso 800. Medido no navegador, a fonte
   * do jogo gasta ~13.9px por caractere em caixa alta: o nome mais largo do elenco
   * hoje e FLECHA QUE ATRAVESSA, 20 caracteres, 277px — treze de folga. Um nome de
   * 21 caracteres estoura a faixa e vaza no papel.
   *
   * Contar caractere e aproximacao (M e mais largo que I), mas e a unica medida que
   * um teste sem renderer consegue fazer, e pega o erro que de fato acontece: nome
   * novo comprido demais entrando na tabela.
   */
  it('o nome do traco cabe na faixa da carta (ate 20 caracteres)', () => {
    const largos = TRAIT_LIST.filter(t => t.name.length > 20);
    expect(largos.map(t => `${t.id}:${t.name.length}`), 'nomes que estouram a faixa').toEqual([]);
  });

  it('nenhum nome de traco se repete — cada cara anuncia coisa diferente', () => {
    expect(new Set(TRAIT_LIST.map(t => t.name)).size).toBe(TRAIT_LIST.length);
  });

  /**
   * A FRASE CABE NA TIRA DE CREME.
   *
   * A tira reserva DUAS linhas de 18px num embrulho de 278px — cerca de 556px de
   * texto, ~55 caracteres. O teto de 36 e bem mais apertado que isso de proposito:
   * a frase tem de ser um grito curto ("BOMBA NO MIOLO DA MULTIDAO."), nao um
   * paragrafo de manual, e o teto folgado garante que nenhuma delas chegue na
   * terceira linha e vaze por baixo da placa.
   */
  it('a blurb cabe na tira de creme da carta (ate 36 caracteres)', () => {
    const longas = TRAIT_LIST.filter(t => t.blurb.length > 36);
    expect(longas.map(t => `${t.id}:${t.blurb.length}`), 'blurbs longas').toEqual([]);
  });

  it('a blurb e uma frase de verdade, com ponto final', () => {
    for (const t of TRAIT_LIST) {
      expect(t.blurb.length, `${t.id} sem blurb`).toBeGreaterThan(8);
      expect(t.blurb.endsWith('.'), `${t.id}: "${t.blurb}"`).toBe(true);
    }
  });

  it('todo traco tem cor propria para pintar o tiro e o grito', () => {
    for (const t of TRAIT_LIST) {
      expect(typeof t.tint, `${t.id} sem tint`).toBe('number');
      expect(t.tint).toBeGreaterThanOrEqual(0);
      expect(t.tint).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('traitFor responde por id e ignora id desconhecido', () => {
    expect(traitFor('knight')?.id).toBe('knight');
    expect(traitFor('nao-existe')).toBeUndefined();
    expect(traitFor(undefined)).toBeUndefined();
  });

  /**
   * A PROVA DE QUE NINGUEM E CLONE DE NINGUEM.
   *
   * Dois caras com o MESMO conjunto de ganchos ainda podem ser diferentes (o
   * barbaro e o viking reagem os dois a `onHurt` e fazem coisas opostas), entao
   * assinatura igual nao e erro. O que nao pode e o elenco inteiro se resumir a
   * dois ou tres formatos: se isso acontecer, "cada um faz uma coisa" virou
   * conversa. Sete formatos distintos e o piso.
   */
  it('o elenco usa muitos formatos de gancho, nao dois ou tres', () => {
    const formas = new Set(
      TRAIT_LIST.map(t => HOOKS.filter(h => typeof t[h] === 'function').join('+'))
    );
    expect(formas.size).toBeGreaterThanOrEqual(7);
  });
});
