import { RelicData } from '../types/RelicData';
import catalog from '../data/relics.json';

/**
 * RELIQUIAS — cada uma TEM que fazer algo, e agora em dois andares.
 *
 * Este arquivo tinha quinze reliquias e cinco efeitos. O jogador escolhia uma
 * de tres a cada tres waves e, dois tercos das vezes, levava para casa uma carta
 * decorativa: `magnet` e `dice` mexiam no reroll (que nao existe mais), `anvil`
 * baixava um custo que ninguem cobra, `book` dizia "+10% XP (placeholder)" num
 * jogo sem XP, e ampulheta/pena/luneta/coracao nao tinham UMA linha de codigo.
 * Uma recompensa que nao recompensa e pior que nenhuma: ela gasta a decisao do
 * jogador.
 *
 * DEPOIS DISSO SOBROU O SEGUNDO PROBLEMA: as onze restantes funcionavam, mas sete
 * delas eram a MESMA carta com outro campo — some uma porcentagem no rancho todo.
 * Uma reliquia geral nao consegue fugir muito disso (ela nao sabe quem esta no seu
 * time, entao nao pode prometer nada especifico), e por isso o andar geral ficou:
 * ele e o que se pode oferecer as cegas, com honestidade.
 *
 * O ANDAR NOVO E O DE CLASSE. Seis reliquias, uma por familia, e cada uma sabe
 * exatamente quem vai receber — entao cada uma faz UMA COISA que nenhuma outra faz:
 *
 *   Corneta   (GUERREIRO)   abre a briga: 3s de invulneravel + pressa
 *   Cova      (MORTO-VIVO)  come cadaver: todo inimigo que cai cura e engorda
 *   Sindicato (OPERARIO)    luto: operario que cai apressa os outros operarios
 *   Grimorio  (FANTASIA)    acelera o RELOGIO dos tracos, nao os numeros
 *   Plasma    (ESPACIAL)    escudo que se refaz sozinho depois de estourar
 *   Holofote  (ACAO)        paga o ULTIMO cara de acao que sobrou de pe
 *
 * Nenhuma das seis e "+x% de alguma coisa", nenhuma repete o gatilho da outra, e
 * nenhuma delas e oferecida na loja se o jogador nao tiver a familia (ver
 * `RelicShop.draft`). Quem executa as seis e `RelicRites`, fora do motor de combate.
 *
 * O VALOR VEM SEMPRE DO CATALOGO, nunca do objeto salvo: o save guarda a reliquia
 * inteira como ela era no dia em que foi escolhida, entao um numero rebalanceado
 * hoje nunca chegaria a quem jogou ontem. Ler por `id` do `relics.json` embutido
 * conserta o balanceamento de todo mundo de uma vez — e faz o sistema aceitar um
 * `{ id }` cru, que e como os testes e os saves antigos falam.
 */

const CATALOG = catalog as RelicData[];
const BY_ID: Record<string, RelicData> = {};
for (const r of CATALOG) BY_ID[r.id] = r;

/** O catalogo inteiro, para a loja sortear. */
export function relicCatalog(): RelicData[] { return CATALOG; }
/** Uma reliquia do catalogo por id, ou undefined se o id nao existe mais. */
export function relicById(id: string): RelicData | undefined { return BY_ID[id]; }

export class RelicSystem {
  constructor(private relics: RelicData[] = []) {}

  private count_(id: string): number {
    return this.relics.filter(r => r.id === id).length;
  }

  /** O numero de fabrica desta reliquia, do catalogo. `fallback` cobre id extinto. */
  private val(id: string, fallback = 0): number {
    return BY_ID[id]?.effect?.value ?? fallback;
  }

  /** Tenho esta reliquia? Uma copia basta. */
  has(id: string): boolean {
    return this.relics.some(r => r.id === id);
  }

  goldBonus(): number {
    return this.count_('coinpurse') * this.val('coinpurse', 2);
  }

  hasRevive(): boolean {
    return this.has('revive');
  }

  meteorDamage(): number {
    return this.has('meteor') ? this.val('meteor', 100) : 0;
  }

  hasMeteor(): boolean {
    return this.has('meteor');
  }

  attackBonus(): number {
    return this.count_('sword') * this.val('sword', 0.15);
  }

  defenseBonus(): number {
    return this.count_('shield') * this.val('shield', 0.2);
  }

  /** Multiplicador de velocidade de ataque dos MEUS caras (ampulheta). */
  attackSpeedBonus(): number {
    return this.count_('hourglass') * this.val('hourglass', 0.2);
  }

  /** Multiplicador de velocidade de deslocamento (pena). */
  moveSpeedBonus(): number {
    return this.count_('feather') * this.val('feather', 0.3);
  }

  /** Alcance somado em pixels (luneta). */
  rangeBonus(): number {
    return this.count_('telescope') * this.val('telescope', 30);
  }

  /** Vida curada por segundo, para sempre (coracao). */
  regenPerSecond(): number {
    return this.count_('heart') * this.val('heart', 1);
  }

  hasBomb(): boolean {
    return this.has('bomb');
  }

  bombDamage(): number {
    return this.count_('bomb') * this.val('bomb', 50);
  }

  hasCrown(): boolean {
    return this.has('crown');
  }

  // ------------------------------------------------------- RELIQUIAS DE CLASSE
  /**
   * As reliquias de classe NAO empilham por copia, e isso e de proposito: a loja
   * nunca oferece uma reliquia que voce ja tem, entao a segunda copia so poderia
   * chegar pelo save antigo de alguem. Duas cornetas nao dobram os 3 segundos de
   * abertura — cada uma delas responde "tenho ou nao tenho", como o amuleto.
   */
  classRelics(): RelicData[] {
    return this.relics.filter(r => !!(r.family ?? BY_ID[r.id]?.family));
  }

  /** A familia que esta reliquia serve, lida do catalogo (o save pode ser velho). */
  private familyOf(r: RelicData): string | undefined {
    return r.family ?? BY_ID[r.id]?.family;
  }

  /** Tenho alguma reliquia de classe desta familia? */
  hasClassRelic(family: string): boolean {
    return this.relics.some(r => this.familyOf(r) === family);
  }

  /** GUERREIRO: segundos de invulneravel + pressa na abertura. 0 = nao tenho. */
  openImmuneSeconds(): number {
    return this.has('warhorn') ? this.val('warhorn', 3) : 0;
  }

  /** MORTO-VIVO: vida curada em cada morto-vivo por cadaver de inimigo. */
  corpseFeastHeal(): number {
    return this.has('graveyard') ? this.val('graveyard', 6) : 0;
  }

  /** OPERARIO: segundos de pressa nos outros operarios quando um cai. */
  unionRushSeconds(): number {
    return this.has('union') ? this.val('union', 5) : 0;
  }

  /** FANTASIA: fracao a mais que o relogio dos tracos anda por segundo. */
  traitHaste(): number {
    return this.has('grimoire') ? this.val('grimoire', 0.35) : 0;
  }

  /** ESPACIAL: escudo em fracao da vida maxima, que volta sozinho. */
  plasmaShieldFraction(): number {
    return this.has('plasma') ? this.val('plasma', 0.25) : 0;
  }

  /** ACAO: ataque extra do ultimo cara de acao de pe (1 = o dobro). */
  lastStandBonus(): number {
    return this.has('spotlight') ? this.val('spotlight', 1) : 0;
  }

  /** Alguma das seis esta em jogo? A batalha usa isto para nem ligar os rituais. */
  hasAnyClassRelic(): boolean {
    return this.classRelics().length > 0;
  }

  add(relic: RelicData): void {
    this.relics.push(relic);
  }

  getAll(): RelicData[] {
    return [...this.relics];
  }

  count(): number {
    return this.relics.length;
  }
}
