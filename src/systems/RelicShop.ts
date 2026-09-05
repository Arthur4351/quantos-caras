import { RelicData } from '../types/RelicData';
import { relicCatalog, relicById } from './RelicSystem';

/**
 * A BANCA DA LOJA DE RELIQUIAS — quem pode aparecer na mesa, e por que.
 *
 * Isto morava dentro da `Reward` como um `offer()` privado de dez linhas, e por
 * isso a regra mais importante da loja nao tinha teste: metodo privado de uma cena
 * do Phaser nao se instancia sem renderer. Aqui e uma funcao pura — recebe o que
 * voce tem e o que voce tem no rancho, devolve as cartas — entao a regra pode ser
 * provada em `tests/unit/RelicShop.test.ts` e a cena so desenha o resultado.
 *
 * TRES REGRAS, NESTA ORDEM:
 *
 *  1. NADA REPETIDO. A carta que voce ja levou nao volta pra mesa. (Se o catalogo
 *     acabar — jogo longo, jogador guloso — a mesa volta a repetir em vez de
 *     mostrar duas cartas: uma mesa vazia parece bug, repeticao parece escolha.)
 *
 *  2. NENHUMA CARTA MORTA. Reliquia de classe so entra na mesa se o rancho TIVER
 *     a familia. O Grimorio na frente de um jogador sem nenhum cara de fantasia
 *     nao e uma escolha ruim, e uma escolha FALSA: ela ocupa um dos tres lugares e
 *     nao pode ser usada nem por acidente. Este era o pecado original das quinze
 *     reliquias antigas, e ele nao vai voltar disfarcado de familia.
 *
 *  3. SEMPRE UMA CARTA GERAL. Se o sorteio virar tres cartas de classe, a ultima
 *     e trocada por uma geral. Sem isto, um rancho com as seis familias podia
 *     receber uma mesa inteira de reliquias para as duas familias onde ele tem um
 *     cara so — tecnicamente vivas, praticamente inuteis. A geral e o piso.
 */

export interface DraftOpts {
  /** Cartas na mesa. Tres desde sempre; parametro para o teste variar. */
  slots?: number;
  /** Sorteio injetavel — o teste trava o resultado, o jogo passa `Math.random`. */
  rng?: () => number;
}

/** A familia que a reliquia serve, do catalogo (o save do jogador pode ser velho). */
export function relicFamily(r: RelicData): string | undefined {
  return r.family ?? relicById(r.id)?.family;
}

/** Quantos caras desta familia estao no rancho AGORA (conta corpos, nao tipos). */
export function familyCount(roster: { family?: string }[], family: string): number {
  let n = 0;
  for (const d of roster) if (d?.family === family) n++;
  return n;
}

/**
 * As reliquias que FAZEM SENTIDO para este rancho, ignorando o que ja foi levado.
 * Uma geral sempre faz sentido; uma de classe so com pelo menos um cara da familia.
 */
export function eligibleRelics(roster: { family?: string }[]): RelicData[] {
  return relicCatalog().filter(r => {
    const fam = relicFamily(r);
    return !fam || familyCount(roster, fam) > 0;
  });
}

/** Sorteia `n` distintas de `pool` sem alterar `pool`. */
function sample(pool: RelicData[], n: number, rng: () => number): RelicData[] {
  const bag = [...pool];
  const out: RelicData[] = [];
  while (out.length < n && bag.length) {
    out.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
  }
  return out;
}

/** As cartas da mesa desta rodada. Ver as tres regras no topo do arquivo. */
export function draft(
  owned: RelicData[],
  roster: { family?: string }[],
  o: DraftOpts = {}
): RelicData[] {
  const slots = Math.max(1, o.slots ?? 3);
  const rng = o.rng ?? Math.random;

  const ownedIds = new Set(owned.map(r => r.id));
  const useful = eligibleRelics(roster);
  const fresh = useful.filter(r => !ownedIds.has(r.id));

  // regra 1: novidade primeiro; se nao da pra encher a mesa, repete o que ja tem
  let pool = fresh.length >= slots ? fresh : useful;
  // rancho vazio ou familia nenhuma reconhecida: cai no catalogo cru
  if (pool.length < slots) pool = relicCatalog();

  const picks = sample(pool, slots, rng);

  // regra 3: o piso da mesa e uma carta geral
  if (picks.length && picks.every(r => relicFamily(r))) {
    const chosen = new Set(picks.map(r => r.id));
    const generals = pool.filter(r => !relicFamily(r) && !chosen.has(r.id));
    if (generals.length) picks[picks.length - 1] = generals[Math.floor(rng() * generals.length)];
  }

  return picks;
}
