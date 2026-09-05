import { StatusBag, TraitState, addShield, applyImmune, applyRush } from './status';
import { RelicSystem } from './RelicSystem';

/**
 * OS RITUAIS DAS RELIQUIAS DE CLASSE — as seis coisas que so uma familia faz.
 *
 * O MOTOR DE COMBATE NAO ENTRA AQUI, E ISSO E DE PROPOSITO. `Battle.applyRelics`
 * ja resolve as reliquias gerais escrevendo numeros no corpo do cara no nascimento
 * (ampulheta vira `attackSpeed`, luneta vira `range`), justamente para que o
 * `CombatSystem` nunca precise saber que reliquia existe. As de classe nao caberiam
 * nesse truque — elas nao sao numeros, sao ACONTECIMENTOS: "quando um inimigo cai",
 * "quando um operario cai", "quando sobrar um so". Enfiar isso no motor faria o
 * motor conhecer familia, reliquia e loja de uma vez.
 *
 * Entao os rituais ficam FORA: um objeto que le as duas listas de corpos e e
 * batido a cada frame pela `Battle`. Ele nao importa Phaser, nao desenha e nao
 * conhece `Fighter` — mexe em campos que qualquer corpo tem (`RiteBody`), o que
 * tambem e o que permite testar as seis mecanicas sem subir um renderer.
 *
 * A PASSADA E LENTA DE PROPOSITO. Contar caidos custa uma volta nas duas listas, e
 * numa horda de wave 90 sao ~440 corpos: a 60 passos por segundo isso seria 26 mil
 * comparacoes por segundo para descobrir uma coisa que muda de meio em meio
 * segundo. A quatro passadas por segundo o jogador nao ve diferenca nenhuma — e o
 * tempo REAL decorrido vai junto na conta, entao acelerar ou travar o frame nao
 * muda o efeito.
 */

/**
 * O MINIMO QUE UM CORPO PRECISA TER para os rituais mexerem nele. Deliberadamente
 * estrutural, e nao `Fighter`: um objeto de teste com estes campos serve, e o
 * modulo nao ganha dependencia da pasta `entities/`.
 */
export interface RiteBody {
  readonly uid: number;
  st: StatusBag;
  tr: TraitState;
  hp: number;
  maxHp: number;
  atk: number;
  attackSpeed: number;
  isAlive(): boolean;
  healBy(amount: number, showNumber?: boolean): void;
}

/** Um corpo do RANCHO — o unico que tem familia. A horda nao tem. */
export interface RiteDude extends RiteBody {
  dudeData: { family?: string };
}

/** Os seis numeros, ja resolvidos. Numeros crus para o teste nao montar um save. */
export interface RiteConfig {
  /** CORNETA: segundos de invulneravel + pressa na abertura (GUERREIRO). */
  openImmune: number;
  /** COVA: vida curada por cadaver de inimigo (MORTO-VIVO). */
  corpseFeast: number;
  /** SINDICATO: segundos de pressa quando um colega cai (OPERARIO). */
  unionRush: number;
  /** GRIMORIO: fracao a mais que o relogio do traco anda (FANTASIA). */
  traitHaste: number;
  /** PLASMA: escudo em fracao da vida maxima, e ele volta (ESPACIAL). */
  plasmaShield: number;
  /** HOLOFOTE: ataque extra do ultimo de pe — 1 = o dobro (ACAO). */
  lastStand: number;
}

/**
 * O BARULHO E A LUZ, pendurados de fora. O ritual nao pode chamar `fx.ts` (que
 * puxa Phaser) sem deixar de ser testavel, entao a `Battle` empresta as duas
 * funcoes e o ritual so diz QUANDO. Sem elas, tudo funciona em silencio.
 */
export interface RiteFx {
  shout?(body: RiteBody, text: string, tint: number): void;
  burst?(body: RiteBody, tint: number): void;
}

export function riteConfig(rs: RelicSystem): RiteConfig {
  return {
    openImmune: rs.openImmuneSeconds(),
    corpseFeast: rs.corpseFeastHeal(),
    unionRush: rs.unionRushSeconds(),
    traitHaste: rs.traitHaste(),
    plasmaShield: rs.plasmaShieldFraction(),
    lastStand: rs.lastStandBonus()
  };
}

/** Segundos entre passadas. Ver o porque no topo do arquivo. */
const RITE_STEP = 0.25;
/** Segundos que o plasma leva para se refazer depois de estourar. */
const PLASMA_RECHARGE = 8;
/** Potencia da pressa do sindicato (+40% de ataque e passo). */
const UNION_RUSH_POWER = 0.4;
/** Velocidade extra do ultimo cara de acao de pe, junto com o ataque. */
const LAST_STAND_SPEED = 0.5;
/** Ataque que cada cadaver de inimigo engorda num morto-vivo. */
const FEAST_ATK_PER_CORPSE = 1;

/**
 * O TETO DO BANQUETE: o morto-vivo no maximo DOBRA o ataque de fabrica.
 *
 * Sem teto, a wave 90 joga noventa e cinco cadaveres na mesa e o esqueleto sai da
 * briga com +95 de ataque — mais forte que qualquer chefe do jogo, por ter ficado
 * de pe. A reliquia tem que pagar o morto-vivo por sobreviver a horda, nao
 * transformar sobrevivencia em ataque infinito.
 */
const FEAST_ATK_CAP = 1;

export class RelicRites {
  /** Nenhuma das seis em jogo? Entao `step` e `open` saem na primeira linha. */
  readonly idle: boolean;
  private clock = 0;
  /** Quantos inimigos ja estavam caidos na ultima passada. */
  private enemiesDown = 0;
  /** Quantos OPERARIOS ja estavam caidos na ultima passada. */
  private employedDown = 0;
  /** O holofote acende uma vez por briga. */
  private spotPaid = false;
  /** Ataque de fabrica de cada morto-vivo, para o teto do banquete. */
  private feastBase = new Map<number, number>();
  /** Segundos ate o plasma se refazer, por corpo. */
  private plasmaCd = new Map<number, number>();

  constructor(
    private dudes: RiteDude[],
    private enemies: RiteBody[],
    private cfg: RiteConfig,
    private fx: RiteFx = {}
  ) {
    this.idle = !cfg.openImmune && !cfg.corpseFeast && !cfg.unionRush
      && !cfg.traitHaste && !cfg.plasmaShield && !cfg.lastStand;
    // a linha de base e o campo COMO ELE ESTA AGORA: um corpo que ja entrou caido
    // (ninguem entra caido hoje, mas a Battle e reentrante) nao vale banquete
    this.enemiesDown = this.countDown(this.enemies);
    this.employedDown = this.countDownOf('Employed');
  }

  /**
   * O TOQUE DE ABERTURA. Vale so no instante em que a briga comeca: a corneta e um
   * TOQUE, nao uma aura — se ela renovasse, os guerreiros seriam imortais.
   */
  open(): void {
    if (this.idle) return;
    const horn = this.cfg.openImmune;
    if (horn > 0) {
      this.each('Warrior', d => {
        applyImmune(d, horn);
        applyRush(d, horn, 0.5);
      });
      this.firstOf('Warrior', d => this.fx.shout?.(d, 'CARGA!', 0xe8402a));
    }
    const frac = this.cfg.plasmaShield;
    if (frac > 0) this.each('SciFi', d => {
      addShield(d, d.maxHp * frac);
      this.plasmaCd.set(d.uid, PLASMA_RECHARGE);
    });
  }

  /**
   * UMA PASSADA A CADA 250ms, com o tempo REAL na mao.
   *
   * `dtMs` e o delta da cena, aparado em 250ms como o resto da `Battle` faz: uma
   * aba que voltou do fundo entrega um delta de dois segundos, e sem a apara o
   * plasma se recarregaria e o grimorio adiantaria meia briga num frame.
   */
  step(dtMs: number): void {
    if (this.idle) return;
    this.clock += Math.min(Math.max(dtMs, 0), 250) / 1000;
    if (this.clock < RITE_STEP) return;
    const elapsed = this.clock;
    this.clock = 0;
    if (this.cfg.traitHaste > 0) this.haste(elapsed);
    if (this.cfg.corpseFeast > 0) this.feast();
    if (this.cfg.unionRush > 0) this.union();
    if (this.cfg.plasmaShield > 0) this.plasma(elapsed);
    if (this.cfg.lastStand > 0) this.spotlight();
  }

  /**
   * GRIMORIO — o unico efeito do jogo que mexe no RELOGIO em vez do numero.
   *
   * Todo traco de assinatura espera em `tr.cd`; adiantar esse relogio faz o
   * feiticeiro relampejar mais vezes, o druida brotar mais raiz e o necromante
   * levantar mais osso, cada um do seu jeito, sem tocar em ataque nem em vida. E
   * por isso que a reliquia de fantasia nao precisa dizer "+35% de dano": ela diz
   * "magia nao espera", e o que acelera e a MAGIA de cada um.
   */
  private haste(elapsed: number): void {
    const extra = elapsed * this.cfg.traitHaste;
    this.each('Fantasy', d => {
      if (d.tr.cd <= 0) return;
      d.tr.cd = Math.max(0, d.tr.cd - extra);
    });
  }

  /** COVA — cada inimigo que cai desde a ultima passada cura e engorda os mortos-vivos. */
  private feast(): void {
    const now = this.countDown(this.enemies);
    const fresh = now - this.enemiesDown;
    this.enemiesDown = now;
    if (fresh <= 0) return;
    const heal = this.cfg.corpseFeast * fresh;
    this.each('Undead', d => {
      let base = this.feastBase.get(d.uid);
      if (base === undefined) { base = d.atk; this.feastBase.set(d.uid, base); }
      d.healBy(heal);
      const cap = base * (1 + FEAST_ATK_CAP);
      if (d.atk < cap) d.atk = Math.min(cap, d.atk + FEAST_ATK_PER_CORPSE * fresh);
    });
    this.firstOf('Undead', d =>
      this.fx.shout?.(d, fresh > 1 ? `+${fresh} CADAVERES` : 'CADAVER!', 0x6ecb3c));
  }

  /**
   * SINDICATO — o unico efeito do jogo que reage as SUAS proprias perdas.
   *
   * Todo o resto do rancho reage ao inimigo: bate, mata, cura. Aqui o gatilho e um
   * colega caindo — e so operario conta. Um cavaleiro morrendo nao para a linha de
   * producao; um operario morrendo, sim.
   */
  private union(): void {
    const now = this.countDownOf('Employed');
    const fell = now - this.employedDown;
    this.employedDown = now;
    if (fell <= 0) return;
    this.each('Employed', d => applyRush(d, this.cfg.unionRush, UNION_RUSH_POWER));
    this.firstOf('Employed', d => this.fx.shout?.(d, 'SINDICATO!', 0x3b8de8));
  }

  /**
   * PLASMA — escudo que VOLTA. O escudo do paladino e um presente de uma vez; este
   * conta 8 segundos depois de estourar e se refaz sozinho, a briga inteira. O
   * relogio so anda enquanto o escudo esta QUEBRADO: quem nunca levou dano nao
   * acumula recarga guardada para gastar depois.
   */
  private plasma(elapsed: number): void {
    const frac = this.cfg.plasmaShield;
    this.each('SciFi', d => {
      if (d.st.shield > 0.5) { this.plasmaCd.set(d.uid, PLASMA_RECHARGE); return; }
      const left = (this.plasmaCd.get(d.uid) ?? PLASMA_RECHARGE) - elapsed;
      if (left > 0) { this.plasmaCd.set(d.uid, left); return; }
      addShield(d, d.maxHp * frac);
      this.plasmaCd.set(d.uid, PLASMA_RECHARGE);
      this.fx.burst?.(d, 0x17c7c7);
    });
  }

  /**
   * HOLOFOTE — o unico efeito do jogo que LE quantos da familia sobraram.
   *
   * Paga uma vez, e so quando o rancho TINHA mais de um cara de acao: com um cara
   * de acao sozinho no time, "o ultimo de pe" seria ele desde o primeiro segundo e
   * a reliquia viraria um +100% de ataque de graca — de novo uma planilha. Ela
   * existe para o momento em que o time de acao ja caiu todo e sobrou um.
   */
  private spotlight(): void {
    if (this.spotPaid) return;
    let total = 0, alive = 0;
    let last: RiteDude | undefined;
    for (const d of this.dudes) {
      if (d.dudeData?.family !== 'Action') continue;
      total++;
      if (d.isAlive()) { alive++; last = d; }
    }
    if (total < 2 || alive !== 1 || !last) return;
    this.spotPaid = true;
    last.atk *= 1 + this.cfg.lastStand;
    last.attackSpeed *= 1 + LAST_STAND_SPEED;
    this.fx.shout?.(last, 'ULTIMA CENA!', 0xff8a1f);
    this.fx.burst?.(last, 0xff8a1f);
  }

  // ------------------------------------------------------------------ VARREDURA
  /**
   * Um `for` cru em vez de `filter(...).forEach(...)`: sao ate quatro varreduras
   * por passada e o `filter` alocaria um array novo em cada uma. Vivos apenas —
   * nenhum dos seis rituais tem o que fazer com um corpo no chao.
   */
  private each(family: string, fn: (d: RiteDude) => void): void {
    for (const d of this.dudes) {
      if (d.dudeData?.family !== family) continue;
      if (!d.isAlive()) continue;
      fn(d);
    }
  }

  /** O primeiro vivo da familia — quem carrega o grito da reliquia pelos outros. */
  private firstOf(family: string, fn: (d: RiteDude) => void): void {
    for (const d of this.dudes) {
      if (d.dudeData?.family !== family) continue;
      if (!d.isAlive()) continue;
      fn(d);
      return;
    }
  }

  private countDown(list: RiteBody[]): number {
    let n = 0;
    for (const f of list) if (!f.isAlive()) n++;
    return n;
  }

  private countDownOf(family: string): number {
    let n = 0;
    for (const d of this.dudes) if (d.dudeData?.family === family && !d.isAlive()) n++;
    return n;
  }
}

