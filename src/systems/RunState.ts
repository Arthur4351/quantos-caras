import { DudeData } from '../types/DudeData';
import dudes from '../data/dudes.json';

/**
 * O ESTADO DA RUN — as regras que fazem isto ser How Many Dudes e nao uma loja.
 *
 * O rancho aceita no maximo CINCO TIPOS de cara. Passou disso, a oferta vira
 * COPIA de quem voce ja tem: a run deixa de ser colecao e vira ACUMULO — o
 * mesmo cara empilhado dez vezes, que e a imagem do jogo original. Uma carta
 * por rodada, tres opcoes, ZERO reroll: a escolha tem que doer.
 *
 * Com o rancho fechado a carta deixa de valer um cara e passa a valer um PACOTE
 * (ver `copiesFor`) — e assim que o exercito acompanha uma horda que ganha seis
 * bichos por rodada.
 *
 * Tudo aqui e puro (nada de Phaser) para rodar no vitest.
 */

/** Tipos DISTINTOS que cabem no rancho. Copias do mesmo tipo sao infinitas. */
export const SQUAD_TYPES = 5;
/** Cartas por rodada. Escolhe UMA. */
export const DRAFT_SIZE = 3;
/** Ganho por nivel de treino do treinador. */
export const TRAIN_ATK = 0.25;
export const TRAIN_HP = 0.2;
/** Teto de treino por tipo — o treinador nao transforma pirralho em deus. */
export const TRAIN_MAX = 4;

/**
 * O CARA. Nao "um cara qualquer": O cara.
 *
 * A run comeca com ele e so com ele, e ele e o UNICO que o treinador aceita. Os
 * outros quarenta e um sao mao de obra contratada — entram, batem, caem, e no
 * lugar deles vem outros. O CARA e o seu: ele engorda com o treino e a cada dez
 * rodadas chega mais um igualzinho, ja com todo o treino que voce pagou (o
 * `trained` e por ID, entao subir um nivel sobe TODOS os corpos dele de uma vez).
 *
 * Esse e o laco da run: treinar o CARA vale pouco na rodada 4 e vale um exercito
 * na rodada 60.
 */
export const HERO_ID = 'dude';
/** De quantas em quantas rodadas cai mais um CARA no rancho. */
export const HERO_EVERY = 10;

/** O molde do CARA, direto dos dados. */
export function heroDude(): DudeData {
  const d = (dudes as DudeData[]).find(x => x.id === HERO_ID);
  if (!d) throw new Error(`dudes.json sem o cara base "${HERO_ID}"`);
  return d;
}

/** Com o que a run nasce: um CARA, sozinho no rancho. */
export function startingInventory(): DudeData[] {
  return [cloneDude(heroDude())];
}

/** Rodada de presente? Rodada 10, 20, 30... */
export function heroGrantAt(wave: number): boolean {
  return wave > 0 && wave % HERO_EVERY === 0;
}

/**
 * Entrega o CARA da decada. Devolve quantos entraram (0 se o exercito estourou o
 * teto) para a cena saber se tem cartaz pra mostrar.
 */
export function grantHero(inv: DudeData[]): number {
  if (inv.length >= MAX_ARMY) return 0;
  inv.push(cloneDude(heroDude()));
  return 1;
}

/** Peso de sorteio por raridade: raro aparece, mas nao domina a oferta. */
const WEIGHT: Record<string, number> = { common: 6, rare: 1 };

/** id do cara -> niveis de treino acumulados na run. */
export type TrainedMap = Record<string, number>;

/** Evento de rodada. `null` = rodada seca, so o draft. */
export type RunEvent = 'trainer' | 'snack' | null;

export interface Snack {
  id: string;
  name: string;
  blurb: string;
  /** Multiplicadores aditivos: 0.2 = +20%. Valem UMA batalha. */
  hp?: number;
  atk?: number;
  attackSpeed?: number;
  moveSpeed?: number;
}

/** O carrinho do cara do lanche. Tres saem sorteados por rodada. */
export const SNACKS: Snack[] = [
  { id: 'burger', name: 'HAMBURGUER', blurb: '+22% DE VIDA', hp: 0.22 },
  { id: 'pizza', name: 'PIZZA', blurb: '+18% DE ATAQUE', atk: 0.18 },
  { id: 'energy', name: 'ENERGETICO', blurb: '+25% VEL. DE ATAQUE', attackSpeed: 0.25 },
  { id: 'coffee', name: 'CAFEZINHO', blurb: '+35% DE VELOCIDADE', moveSpeed: 0.35 },
  { id: 'banana', name: 'BANANA', blurb: '+10% VIDA E ATAQUE', hp: 0.1, atk: 0.1 },
  { id: 'taco', name: 'TACO', blurb: '+12% ATAQUE E VEL.', atk: 0.12, attackSpeed: 0.12 }
];

/** O que atravessa as cenas e o localStorage. */
export interface RunSave {
  wave: number;
  inventory: DudeData[];
  gold: number;
  trained: TrainedMap;
  snack: string | null;
}

/**
 * Calendario de eventos. Rodada 1 e 2 sao secas — o jogador precisa entender o
 * draft antes de levar modal na cara. Depois: treinador a cada 4, lanche a cada
 * 3. O treinador ganha o empate porque investimento permanente > buff de uma
 * batalha.
 */
export function eventFor(wave: number): RunEvent {
  if (wave < 3) return null;
  if (wave % 4 === 0) return 'trainer';
  if (wave % 3 === 0) return 'snack';
  return null;
}

/**
 * `dudes.json` e importado UMA vez e o objeto e compartilhado por todo mundo.
 * Sem clonar, treinar o "dude" da wave 4 vazaria para o menu, para a horda de
 * fundo e para a run seguinte.
 */
export function cloneDude(d: DudeData): DudeData {
  return { ...d, stats: { ...d.stats }, ability: { ...d.ability } };
}

/** id -> quantas copias. A UI mostra isso como `x3`. */
export function countById(inv: DudeData[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of inv) out[d.id] = (out[d.id] ?? 0) + 1;
  return out;
}

export function distinctIds(inv: DudeData[]): string[] {
  return Object.keys(countById(inv));
}

/** Rancho com os 5 tipos: da aqui pra frente a oferta so empilha copias. */
export function squadFull(inv: DudeData[]): boolean {
  return distinctIds(inv).length >= SQUAD_TYPES;
}

/** Primeira copia de cada tipo, na ordem em que entraram no rancho. */
export function uniqueOwned(inv: DudeData[]): DudeData[] {
  const seen = new Set<string>();
  const out: DudeData[] = [];
  for (const d of inv) if (!seen.has(d.id)) { seen.add(d.id); out.push(d); }
  return out;
}

/**
 * O PACOTE — o que transforma acumulo em ESCALA.
 *
 * Enquanto o rancho monta os cinco tipos, a carta vale UM cara: cada escolha e
 * uma peca nova do pelotao e a run e colecao. Fechado o rancho, a MESMA carta
 * passa a valer um pacote de copias que cresce com a wave.
 *
 * Isto nao e generosidade, e aritmetica. A horda ganha ~6 bichos por rodada; com
 * uma copia por rodada o exercito chegava na wave 12 com doze caras contra 83
 * bichos e a run virava parede intransponivel na wave 6. Com o pacote, a wave 12
 * tem 25 caras contra 83 — e a wave 20 tem sessenta caras no campo, que e a
 * imagem que da nome ao jogo.
 *
 * O teto de 6 por carta e o de 160 corpos nao sao balanceamento: sao frame
 * budget. Passando de 160 o jogador ja tem exercito demais para o campo, e a
 * carta vira TREINO (ver `Shop.pick`).
 */
export const PACK_MAX = 6;
export const MAX_ARMY = 160;

export function packSize(wave: number): number {
  return Math.min(PACK_MAX, 1 + Math.floor(wave / 4));
}

/** Copias que a carta desta rodada entrega. 0 = rancho no limite de corpos. */
export function copiesFor(inv: DudeData[], wave: number): number {
  if (!squadFull(inv)) return 1;
  return Math.max(0, Math.min(packSize(wave), MAX_ARMY - inv.length));
}

/** Empilha o pacote no rancho (muta `inv`). Devolve quantas copias entraram. */
export function addPack(inv: DudeData[], d: DudeData, wave: number): number {
  const n = copiesFor(inv, wave);
  for (let i = 0; i < n; i++) inv.push(cloneDude(d));
  return n;
}

/**
 * O PRECO DE UM CARA EXTRA — o unico lugar onde o ouro sai do bolso.
 *
 * O ouro estava morto: entrava +12 por wave, aparecia na pilula mais visivel da
 * tela com um pop de moeda, era salvo... e nao comprava NADA. O reroll pagava por
 * ele antes de sair do jogo, e a carta da rodada e de graca. Uma moeda que nao
 * gasta e um numero decorativo no canto mais nobre da HUD.
 *
 * Agora ela compra um corpo a mais de um tipo que voce JA tem — o que o jogo pede
 * ("fica acumulando o mesmo cara") sem furar nenhuma regra do sorteio: continua
 * UMA carta por rodada, sem reroll, cinco tipos no maximo.
 *
 * O preco sobe com o tamanho do exercito para nao virar torneira: com +12 de
 * renda por wave, `8 + army/4` paga ~1 corpo por rodada no comeco e menos de um
 * la na frente, entao a escolha e real — junta tres waves para uma compra grande
 * ou leva um agora.
 */
export function copyPrice(inv: DudeData[]): number {
  return 8 + Math.floor(inv.length / 4);
}

/** Pode comprar? Precisa de ouro, de espaco no campo e do rancho fechado. */
export function canBuyCopy(inv: DudeData[], gold: number): boolean {
  return squadFull(inv) && inv.length < MAX_ARMY && gold >= copyPrice(inv);
}

/** Sorteio ponderado SEM reposicao — as tres cartas nunca repetem tipo. */
function pickWeighted(source: DudeData[], luck: number, n: number): DudeData[] {
  const pool = [...source];
  const out: DudeData[] = [];
  const w = (d: DudeData) => {
    const base = WEIGHT[d.rarity] ?? 1;
    return d.rarity === 'rare' ? base * (1 + luck) : base;
  };
  while (out.length < n && pool.length) {
    let total = 0;
    for (const d of pool) total += w(d);
    let roll = Math.random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= w(pool[i]);
      if (roll <= 0) { index = i; break; }
    }
    out.push(cloneDude(pool[index]));
    pool.splice(index, 1);
  }
  return out;
}

/**
 * AS TRES CARTAS DA RODADA.
 *
 * Rancho incompleto -> tipos que voce NAO tem (a run monta o pelotao).
 * Rancho completo   -> copias de quem voce JA tem (a run empilha o mesmo cara).
 *
 * Nao existe reroll: o que saiu, saiu.
 *
 * `bestiary` restringe o sorteio a um subconjunto — e o que o DESAFIO DIARIO usa:
 * cinco tipos sorteados pela data, iguais para todo mundo, a RUN INTEIRA. Antes o
 * pool do dia valia so para a wave 1 e so para as tres primeiras cartas, entao a
 * tela do diario prometia "estes cinco caras hoje" e entregava tres deles uma vez.
 */
export function draftOffers(inv: DudeData[], wave: number, bestiary?: DudeData[]): DudeData[] {
  const luck = Math.min(4, wave * 0.12);
  const owned = new Set(inv.map(d => d.id));
  const mine = uniqueOwned(inv);
  if (squadFull(inv)) return pickWeighted(mine, 0, DRAFT_SIZE);

  const all = bestiary?.length ? bestiary : (dudes as DudeData[]);
  const fresh = all.filter(d => !owned.has(d.id));
  const out = pickWeighted(fresh, luck, DRAFT_SIZE);
  // 42 caras no bestiario: o pool nunca seca de verdade. Mas se secar, empilha.
  if (out.length < DRAFT_SIZE) out.push(...pickWeighted(mine, 0, DRAFT_SIZE - out.length));
  return out;
}

/**
 * Reconstroi a oferta a partir dos ids salvos. Recarregar a pagina NAO pode
 * sortear tres cartas novas — sem isto o F5 seria o reroll que este jogo nao tem.
 */
export function offersFromIds(ids: string[]): DudeData[] {
  const all = dudes as DudeData[];
  const out: DudeData[] = [];
  for (const id of ids) {
    const found = all.find(d => d.id === id);
    if (found) out.push(cloneDude(found));
  }
  return out;
}

/** Niveis de treino de um tipo, com o teto aplicado. */
export function trainLevel(trained: TrainedMap | undefined, id: string): number {
  return Math.min(TRAIN_MAX, trained?.[id] ?? 0);
}

/**
 * SO O CARA TREINA.
 *
 * A regra vive AQUI e nao na tela do treinador, porque `train()` passa por esta
 * porta: nao existe caminho no jogo que suba o nivel de um mercenario. O
 * treinador do rancho e do CARA — ver `HERO_ID` la em cima.
 */
export function canTrain(trained: TrainedMap | undefined, id: string): boolean {
  if (id !== HERO_ID) return false;
  return trainLevel(trained, id) < TRAIN_MAX;
}

/** O treinador sobe UM nivel. Devolve um mapa novo (o antigo fica intacto). */
export function train(trained: TrainedMap, id: string): TrainedMap {
  if (!canTrain(trained, id)) return trained;
  return { ...trained, [id]: (trained[id] ?? 0) + 1 };
}

export function snackById(id: string | null | undefined): Snack | undefined {
  return id ? SNACKS.find(s => s.id === id) : undefined;
}

/** Tres lanches distintos do carrinho. */
export function snackOffers(n = 3): Snack[] {
  const pool = [...SNACKS];
  const out: Snack[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

/**
 * O cara como ele entra na arena: base do json + treino permanente + lanche da
 * rodada. A Battle chama isto e joga o resultado no `new Dude(...)` — nenhum
 * sistema de combate precisa saber que treino ou lanche existem.
 */
export function battleStats(d: DudeData, trained?: TrainedMap, snackId?: string | null): DudeData {
  const lvl = trainLevel(trained, d.id);
  const s = snackById(snackId);
  if (!lvl && !s) return d;
  const c = cloneDude(d);
  const hp = 1 + TRAIN_HP * lvl + (s?.hp ?? 0);
  const atk = 1 + TRAIN_ATK * lvl + (s?.atk ?? 0);
  c.stats.hp = Math.round(d.stats.hp * hp);
  c.stats.atk = Math.round(d.stats.atk * atk);
  c.stats.attackSpeed = +(d.stats.attackSpeed * (1 + (s?.attackSpeed ?? 0))).toFixed(3);
  c.stats.moveSpeed = Math.round(d.stats.moveSpeed * (1 + (s?.moveSpeed ?? 0)));
  return c;
}
