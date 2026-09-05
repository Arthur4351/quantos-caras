import Phaser from 'phaser';
import { Fighter, HitKind, Team } from '../entities/Fighter';
import {
  applyBurn, applyGuard, applyImmune, applyRoot, applyRush, applySlow, applyStun,
  applyVuln, addFrost, addShield, cleanse
} from './status';
import {
  aegisFlare, arcShell, beamDown, breathCone, coinPop, curseGlyph, dashStreak,
  flameLick, freezeBlock, frostShard, healPlus, lineSlash, noteFloat, plagueBurst,
  rootSnare, shockRing, smokePop, soulBurst, starFall, stunSpin, traitCall, zapArc
} from '../art/fx';
import { BLUE, CYAN, GOLD, GREEN, ORANGE, PURPLE, RED, WHITE } from '../art/palette';

/**
 * OS 42 TRACOS DE ASSINATURA — um VERBO diferente para cada cara.
 *
 * O jogo tinha 42 personagens e 14 numeros. Um dava +dano, outro dava +dano com
 * outro valor, um terceiro dava moeda. Trocar o cavaleiro pelo samurai mudava a
 * planilha e nao mudava NADA na tela: a briga era a mesma briga.
 *
 * A regra desta tabela e uma so: NENHUM traco pode ser "o mesmo com outro
 * numero". Cada um faz algo que nenhum outro faz — puxa o alvo, corta em linha
 * reta, tira o inimigo do campo, cresce de tamanho, reseta o relogio do time,
 * troca de lado, ressuscita, copia o traco do vizinho. Se dois tracos pudessem
 * ser trocados por um parametro, um dos dois esta errado.
 *
 * Os numeros do `Kit` (abilities.ts) continuam existindo e nao foram tocados:
 * eles sao o PISO invisivel que faz um tanque durar mais que um mago. O traco e
 * o TETO visivel, a coisa que o jogador aponta e diz "olha o que ele fez".
 *
 * TRES REGRAS DE ENGENHARIA, todas nascidas do mesmo lugar (o rancho fechado
 * permite 160 copias do MESMO cara em campo):
 *
 *  1. Nada aqui aloca por frame. Contadores vivem em `self.tr` (campos fixos,
 *     criados no nascimento) e varreduras escrevem em `c.buf`, nunca em arrays
 *     novos.
 *  2. Todo efeito de estado e MAX-VENCE (ver status.ts). A copia numero 30 nao
 *     empilha potencia — empilha frequencia.
 *  3. Todo golpe periodico passa por `c.ready(cd, piso)`, que tem um relogio
 *     pessoal E um piso do lado inteiro. Trinta magos prontos no mesmo passo
 *     lancam UM meteoro, e depois outro, e outro — nao trinta de uma vez.
 */

/** Que tipo de corpo uma invocacao cria. */
export type SummonKind = 'skeleton' | 'walker' | 'clone';

/** Area no chao que continua valendo depois de quem a criou sair de perto. */
export interface Zone {
  x: number; y: number; r: number;
  /** Segundos restantes. */
  life: number;
  /** Para quem ela e boa. */
  side: Team;
  kind: 'heal' | 'burn';
  power: number;
  art?: Phaser.GameObjects.GameObject;
}

/** O que o traco pode pedir para o motor. Implementado pelo CombatSystem. */
export interface TraitEngine {
  readonly scene: Phaser.Scene;
  readonly arena: { minX: number; maxX: number; minY: number; maxY: number };
  /** Todo mundo de um lado que ainda esta de pe. Array reusado: nao guarde. */
  sideList(side: Team): Fighter[];
  /** Quantos daquele lado JA CAIRAM. O ossudo cresce com isto. */
  fallen(side: Team): number;
  /** Os corpos caidos daquele lado. O necromante colhe daqui. Array reusado. */
  fallenList(side: Team): Fighter[];
  /** Vizinhos de um lado dentro do raio, escritos em `out`. Usa a grade. */
  near(x: number, y: number, r: number, side: Team, out: Fighter[]): Fighter[];
  /** Dano de habilidade: mesmo portao do golpe normal, com credito de abate. */
  hit(by: Fighter, target: Fighter, amount: number, kind?: HitKind): number;
  /** Piso de tempo do LADO para um golpe. Ver `TraitCtx.ready`. */
  claim(side: Team, key: string, seconds: number): boolean;
  shoot(
    by: Fighter, target: Fighter, dmg: number, tint: number,
    onHit?: (t: Fighter, dealt: number) => void
  ): void;
  summon(by: Fighter, kind: SummonKind, x: number, y: number, power: number, life?: number): Fighter | null;
  addZone(z: Zone): void;
  /** Ouro ganho DENTRO da briga (o troco do caixa), somado no fim da wave. */
  gold(n: number): void;
}

/** O golpe, antes de sair. `handled` = o traco resolveu tudo sozinho. */
export interface DamageEvent {
  amount: number;
  crit: boolean;
  handled: boolean;
}

/**
 * A MESA DE TRABALHO DE UM TRACO — uma por combatente, criada no nascimento.
 *
 * Poderia ser um objeto novo a cada chamada; com 440 corpos e 60 passos por
 * segundo isso seriam 26 mil objetos por segundo so para carregar tres campos.
 * Aqui cada cara tem a sua, para sempre, e `allies`/`foes` sao ATALHOS para as
 * listas que o motor ja mantem — nunca copias.
 *
 * REGRA DE REENTRANCIA: `buf` e para varreduras que causam dano; `buf2` e para
 * os avisos (onHurt/onBlock/onDown/onKill), porque esses podem disparar NO MEIO
 * de uma varredura do mesmo cara e sobrescrever o array que ela esta lendo.
 */
export class TraitCtx {
  dt = 1 / 60;
  readonly buf: Fighter[] = [];
  readonly buf2: Fighter[] = [];

  constructor(private eng: TraitEngine, readonly self: Fighter) {}

  get scene(): Phaser.Scene { return this.eng.scene; }
  get arena(): { minX: number; maxX: number; minY: number; maxY: number } { return this.eng.arena; }
  /** Do lado DELE agora — o virus do hacker troca de lado, e isto acompanha. */
  get allies(): Fighter[] { return this.eng.sideList(this.self.side); }
  get foes(): Fighter[] { return this.eng.sideList(this.self.side === 'dude' ? 'enemy' : 'dude'); }

  foesNear(r: number, out: Fighter[] = this.buf, x = this.self.x, y = this.self.y): Fighter[] {
    return this.eng.near(x, y, r, this.self.side === 'dude' ? 'enemy' : 'dude', out);
  }

  alliesNear(r: number, out: Fighter[] = this.buf, x = this.self.x, y = this.self.y): Fighter[] {
    return this.eng.near(x, y, r, this.self.side, out);
  }

  hit(target: Fighter, amount: number, kind: HitKind = 'true'): number {
    return this.eng.hit(this.self, target, amount, kind);
  }

  shoot(target: Fighter, dmg: number, tint = WHITE, onHit?: (t: Fighter, dealt: number) => void): void {
    this.eng.shoot(this.self, target, dmg, tint, onHit);
  }

  summon(kind: SummonKind, x: number, y: number, power: number, life = 0): Fighter | null {
    return this.eng.summon(this.self, kind, x, y, power, life);
  }

  zone(x: number, y: number, r: number, life: number, kind: 'heal' | 'burn', power: number): void {
    this.eng.addZone({ x, y, r, life, kind, power, side: this.self.side });
  }

  gold(n: number): void { this.eng.gold(n); }

  fallen(): number { return this.eng.fallen(this.self.side); }
  fallenFoes(): Fighter[] { return this.eng.fallenList(this.self.side === 'dude' ? 'enemy' : 'dude'); }

  /**
   * O RELOGIO DE DOIS ANDARES — o que segura o rancho fechado de pe.
   *
   * Andar de baixo: o relogio pessoal (`tr.cd`). Este cara so lanca a cada `cd`.
   * Andar de cima: o piso do LADO. Ainda que 30 copias estejam prontas no mesmo
   * passo, o lado inteiro so pode lancar de novo depois de `floor` segundos.
   *
   * Sem o andar de cima, "um meteoro a cada 5s" viraria "30 meteoros a cada 5s"
   * com 30 magos — a tela pisca uma vez e a wave acaba. Com ele, a copia extra
   * compra FREQUENCIA: um meteoro a cada 1.25s, sem fim de mundo.
   */
  ready(cd: number, floor = cd / 4): boolean {
    const tr = this.self.tr;
    if (tr.cd > 0) return false;
    // piso 0 = efeito de AURA (a maldicao da mumia, a cobertura do robo). Ali o
    // piso do lado seria errado: um so aplicaria, e os outros 29 estariam noutro
    // canto do campo com ninguem coberto. Aura e max-vence, entao repetir e barato.
    if (floor > 0 && !this.eng.claim(this.self.side, this.self.traitId ?? 'x', floor)) return false;
    tr.cd = cd;
    return true;
  }

  /** O nome do golpe estourando sobre a cabeca. */
  say(txt: string, color = GOLD): void {
    traitCall(this.scene, this.self.x, this.self.hitY - 30, txt, color);
  }
}

/**
 * UM TRACO. Nome, uma linha de texto e os avisos que ele quer ouvir.
 *
 * Nenhum e obrigatorio: o `dude` so precisa de `onTick`, o cavaleiro so precisa
 * de `onBlock`. O que o traco NAO implementa simplesmente nao custa nada no
 * passo — o motor testa a existencia da funcao antes de chamar.
 */
export interface Trait {
  id: string;
  /** Caixa alta, curto: a carta da loja tem 292px de largura util. */
  name: string;
  /** UMA linha, ate ~36 caracteres, ou quebra na carta. */
  blurb: string;
  tint?: number;
  /** No primeiro passo, nunca no construtor: o campo ainda nao existe la. */
  onSpawn?(c: TraitCtx): void;
  onTick?(c: TraitCtx): void;
  /** Antes do dano sair. Marque `ev.handled` para resolver o golpe sozinho. */
  onStrike?(c: TraitCtx, target: Fighter, ev: DamageEvent): void;
  /** Encostou no alvo — corpo-a-corpo ou projetil que chegou. */
  onHit?(c: TraitCtx, target: Fighter, dealt: number): void;
  onHurt?(c: TraitCtx, dealt: number, by?: Fighter, kind?: HitKind): void;
  onBlock?(c: TraitCtx, by?: Fighter): void;
  onKill?(c: TraitCtx, victim: Fighter): void;
  onDown?(c: TraitCtx): void;
  /** Continua recebendo `onTick` DEPOIS de cair (a remontagem do esqueleto). */
  tickDown?: boolean;
}

// -------------------------------------------------------------- FERRAMENTAS
/** O mais perto. `null` se a lista estiver vazia ou tudo fora do raio. */
function nearest(list: Fighter[], x: number, y: number, maxR = Infinity): Fighter | null {
  let best: Fighter | null = null, bd = maxR * maxR;
  for (const f of list) {
    if (!f.isTargetable()) continue;
    const d = Phaser.Math.Distance.Squared(x, y, f.x, f.y);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

/** O mais LONGE — o salto orbital do astronauta mira a retaguarda. */
function farthest(list: Fighter[], x: number, y: number): Fighter | null {
  let best: Fighter | null = null, bd = -1;
  for (const f of list) {
    if (!f.isTargetable()) continue;
    const d = Phaser.Math.Distance.Squared(x, y, f.x, f.y);
    if (d > bd) { bd = d; best = f; }
  }
  return best;
}

/** Quem mais bate dentro do raio. A reuniao do gerente convoca o maior perigo. */
function biggest(list: Fighter[], x: number, y: number, r: number): Fighter | null {
  let best: Fighter | null = null, ba = -1;
  const r2 = r * r;
  for (const f of list) {
    if (!f.isTargetable()) continue;
    if (Phaser.Math.Distance.Squared(x, y, f.x, f.y) > r2) continue;
    const a = f.atk * f.attackSpeed + f.maxHp * 0.05;
    if (a > ba) { ba = a; best = f; }
  }
  return best;
}

/** Um aleatorio que ainda esta em jogo. */
function anyOf(list: Fighter[]): Fighter | null {
  let n = 0;
  for (const f of list) if (f.isTargetable()) n++;
  if (!n) return null;
  let k = (Math.random() * n) | 0;
  for (const f of list) {
    if (!f.isTargetable()) continue;
    if (k-- === 0) return f;
  }
  return null;
}

/**
 * O MIOLO DA MULTIDAO. Devolve o corpo com mais vizinhos em volta.
 *
 * O meteoro do mago precisa cair ONDE DOI. Se ele caisse no alvo normal (o mais
 * perto), acertaria a mesma linha de frente que a tropa ja esta moendo. Isto e
 * O(n²) sobre a lista, entao vem com um teto de 40 amostras: a partir dai a
 * diferenca entre "o miolo" e "quase o miolo" nao aparece na tela.
 */
function densest(list: Fighter[], r: number): Fighter | null {
  let best: Fighter | null = null, bn = -1, seen = 0;
  const r2 = r * r;
  for (const a of list) {
    if (!a.isTargetable()) continue;
    if (++seen > 40) break;
    let n = 0;
    for (const b of list) {
      if (!b.isTargetable()) continue;
      if (Phaser.Math.Distance.Squared(a.x, a.y, b.x, b.y) <= r2) n++;
    }
    if (n > bn) { bn = n; best = a; }
  }
  return best;
}

/**
 * OS N MAIS MACHUCADOS, escritos em `out` (nao aloca).
 *
 * O juramento do paladino nao pode escudar quem esta cheio de vida — seria um
 * escudo jogado no lixo. Selecao por insercao: `n` e sempre 3, 4 ou 5, entao
 * ordenar a lista inteira custaria mais do que percorrer ela `n` vezes.
 */
function weakest(list: Fighter[], n: number, out: Fighter[]): Fighter[] {
  out.length = 0;
  for (const f of list) {
    if (!f.isTargetable()) continue;
    const ratio = f.hp / f.maxHp;
    let i = out.length;
    while (i > 0 && out[i - 1].hp / out[i - 1].maxHp > ratio) i--;
    if (i >= n) continue;
    out.splice(i, 0, f);
    if (out.length > n) out.length = n;
  }
  return out;
}

/** Esta dentro do cone de `reach` px abrindo `spread` rad para o lado `dirX`? */
function inCone(from: Fighter, t: Fighter, dirX: number, reach: number, spread: number): boolean {
  const dx = (t.x - from.x) * dirX;
  if (dx < -20) return false;
  const dy = t.y - from.y;
  if (dx * dx + dy * dy > reach * reach) return false;
  return Math.abs(Math.atan2(dy, Math.max(1, dx))) <= spread;
}

/** Empurrao seco, escrito direto em x/y — o passo fixo reescreve posicao. */
function shove(t: Fighter, fromX: number, dist: number, arena: { minX: number; maxX: number }): void {
  const dir = Math.sign(t.x - fromX) || 1;
  t.x = Phaser.Math.Clamp(t.x + dir * dist, arena.minX + 20, arena.maxX - 20);
}

// ================================================================== O ELENCO
const LIST: Trait[] = [
  // ------------------------------------------------------------- GUERREIROS
  {
    id: 'knight', name: 'CONTRA-ATAQUE', blurb: 'Aparou? Devolve na hora.', tint: RED,
    /**
     * O bloqueio do cavaleiro era um numero que NAO ACONTECIA: o dano virava
     * zero, um anelzinho piscava e a briga seguia igual. Agora aparar e uma
     * DECISAO — quanto mais golpe ele leva, mais ele devolve.
     */
    onBlock(c, by) {
      if (!by || !by.isTargetable()) return;
      const dir = Math.sign(by.x - c.self.x) || 1;
      c.self.swing(dir);
      c.hit(by, c.self.atk * 0.6);
      applyStun(by, 0.4);
      stunSpin(c.scene, by.x, by.hitY - 34, 420);
    }
  },
  {
    id: 'zombie', name: 'PRAGA NA QUEDA', blurb: 'Cai e explode em podridao.', tint: GREEN,
    /** O unico cara que vale MAIS morto: a queda dele e um golpe de area. */
    onDown(c) {
      plagueBurst(c.scene, c.self.x, c.self.hitY, 260);
      const near = c.foesNear(240, c.buf2);
      for (let i = 0; i < near.length; i++) {
        c.hit(near[i], c.self.atk * 1.4);
        applySlow(near[i], 2, 0.3);
      }
    }
  },
  {
    id: 'office', name: 'BUROCRACIA', blurb: 'Prende o alvo em papelada.', tint: BLUE,
    /** ENRAIZAR: o alvo continua batendo, mas nao sai mais do lugar. */
    onHit(c, target) {
      if (!target.isTargetable()) return;
      applyRoot(target, 1);
      rootSnare(c.scene, target.x, target.y, 900, target.punch);
    }
  },
  {
    id: 'wizard', name: 'METEORO DE BOLSO', blurb: 'Bomba no miolo da multidao.', tint: ORANGE,
    /**
     * O meteoro nao cai no alvo dele — cai ONDE DOI. `densest` acha o corpo com
     * mais vizinhos em volta, e e la que a pedra desce. E a diferenca entre um
     * mago e um arqueiro com numero maior.
     */
    onTick(c) {
      if (!c.ready(5, 1.25)) return;
      const hub = densest(c.foes, 170);
      if (!hub) return;
      const tx = hub.x, ty = hub.y;
      c.say('METEORO!', ORANGE);
      starFall(c.scene, tx, ty, () => {
        shockRing(c.scene, tx, ty, 380, ORANGE);
        flameLick(c.scene, tx, ty, 2);
        const near = c.foesNear(170, c.buf, tx, ty);
        for (let i = 0; i < near.length; i++) {
          c.hit(near[i], c.self.atk * 2);
          applyBurn(near[i], 3, c.self.atk * 0.2);
        }
      }, 'fx_flame', ORANGE, 460, 1.9);
    }
  },
  {
    id: 'astro', name: 'SALTO ORBITAL', blurb: 'Ignora a frente, cai no fundo.', tint: CYAN,
    /**
     * O UNICO que escolhe alvo ao contrario. Todo mundo bate em quem esta perto;
     * ele pula a linha de frente e vai atras do curandeiro que estava seguro la
     * atras. Um campo em `Fighter` resolve — nao um `if` no `pickTarget`.
     */
    onSpawn(c) {
      c.self.aimMode = 'far';
      c.self.moveSpeed *= 1.4;
      beamDown(c.scene, c.self.x, c.self.y, CYAN, 420);
    },
    onHit(c, target) {
      shockRing(c.scene, target.x, target.y, 110, CYAN);
    }
  },
  {
    id: 'barbarian', name: 'SANGUE NOS OLHOS', blurb: 'Cada surra o deixa mais rapido.', tint: RED,
    /** Escala com o que ele RECEBE, nao com o que ele tem. Teto de 15 pilhas. */
    onHurt(c) {
      const tr = c.self.tr;
      if (tr.stacks < 15) tr.stacks++;
      applyRush(c.self, 3, 0.06 * tr.stacks);
      if (tr.stacks % 5 === 0) c.say('RAIVA!', RED);
    }
  },
  {
    id: 'samurai', name: 'IAI', blurb: 'Quinto golpe corta em linha.', tint: WHITE,
    /**
     * GEOMETRIA, nao area. O corte pega uma FAIXA de 260px a frente com 70px de
     * altura — quem estiver enfileirado morre junto, quem estiver desviado uma
     * fileira acima nao sente nada. Nenhum outro traco acerta em linha reta.
     *
     * O ALVO ENTRA SEMPRE, faixa ou nao. `ev.handled` faz o motor devolver sem
     * bater (`CombatSystem.strike`), entao um corte que nao pegasse ninguem seria
     * um golpe PERDIDO — e a faixa erra o proprio alvo mais vezes do que parece: a
     * separacao entre corpos (`CombatSystem` empurra 4px por passo) desalinha a
     * fila, e um inimigo colado 80px acima esta dentro do alcance de melee e fora
     * dos 70px da faixa. Pior: o quinto golpe cairia no vazio e o contador so
     * voltaria a fechar cinco golpes depois. Quem ele estava cortando e cortado; a
     * faixa e o BONUS.
     */
    onStrike(c, target, ev) {
      const tr = c.self.tr;
      if (++tr.hits % 5 !== 0) return;
      ev.handled = true;
      const dir = Math.sign(target.x - c.self.x) || 1;
      lineSlash(c.scene, c.self.x, c.self.hitY, 300, dir);
      c.say('IAI!', WHITE);
      const dano = ev.amount * 1.5;
      c.hit(target, dano);
      const foes = c.foes;
      for (const t of foes) {
        if (t === target || !t.isTargetable()) continue;
        const dx = (t.x - c.self.x) * dir;
        if (dx < -30 || dx > 300) continue;
        if (Math.abs(t.y - c.self.y) > 70) continue;
        c.hit(t, dano);
      }
    }
  },
  {
    id: 'viking', name: 'ULTIMO SUSPIRO', blurb: 'A primeira morte nao conta.', tint: GOLD,
    /**
     * O aviso `onDamaged` sai ANTES do motor conferir a queda (ver Fighter.hurt),
     * e e exatamente por causa deste cara: aqui ele reescreve a propria vida para
     * 1 e o tombo nunca acontece. Uma vez por briga.
     */
    onHurt(c) {
      const s = c.self;
      if (s.hp > 0 || s.tr.used) return;
      s.tr.used = true;
      s.hp = 1;
      applyImmune(s, 2);
      applyRush(s, 4, 1);
      shockRing(c.scene, s.x, s.hitY, 300, GOLD);
      c.say('AINDA NAO!', GOLD);
    }
  },
  {
    id: 'gladiator', name: 'REDE E TRIDENTE', blurb: 'Puxa o alvo para o abraco.', tint: GOLD,
    /** O unico que MOVE o inimigo para dentro. Quem foge dele nao foge. */
    onHit(c, target) {
      if (!target.isTargetable()) return;
      zapArc(c.scene, c.self.x, c.self.hitY, target.x, target.hitY, GOLD);
      const ang = Math.atan2(c.self.y - target.y, c.self.x - target.x);
      target.x += Math.cos(ang) * 44;
      target.y += Math.sin(ang) * 22;
      applySlow(target, 1.5, 0.35);
    }
  },
  {
    id: 'monk', name: 'SETE PALMAS', blurb: 'No setimo toque, todos param.', tint: CYAN,
    /** Conta ate sete e ATORDOA em volta. Controle de area, sem dano grande. */
    onHit(c) {
      const tr = c.self.tr;
      if (++tr.hits % 7 !== 0) return;
      shockRing(c.scene, c.self.x, c.self.hitY, 420, CYAN);
      c.say('SETE!', CYAN);
      const near = c.foesNear(210);
      for (let i = 0; i < near.length; i++) {
        c.hit(near[i], c.self.atk * 0.8);
        applyStun(near[i], 0.8);
        stunSpin(c.scene, near[i].x, near[i].hitY - 34, 700);
      }
    }
  },
  {
    id: 'warlord', name: 'ORDEM DE AVANCAR', blurb: 'Zera o relogio do time todo.', tint: GOLD,
    /**
     * Nao da dano nem vida: da TEMPO. Todo aliado com o golpe carregando perde o
     * resto da espera e bate AGORA. Num time de 12, a ordem vira uma salva de 12
     * golpes no mesmo instante — nenhum numero de ataque faz isso.
     */
    onTick(c) {
      if (!c.ready(6, 2)) return;
      c.say('AVANCAR!', GOLD);
      const list = c.allies;
      let sparks = 6;
      for (const a of list) {
        if (!a.isTargetable()) continue;
        a.cd = 0;
        applyRush(a, 2, 0.3);
        if (sparks-- > 0) zapArc(c.scene, c.self.x, c.self.hitY, a.x, a.hitY, GOLD);
      }
    }
  },
  // ----------------------------------------------------------- MORTOS-VIVOS
  {
    id: 'skeleton', name: 'REMONTA OS OSSOS', blurb: 'Levanta sozinho, uma vez.', tint: WHITE,
    tickDown: true,
    /**
     * O unico que se levanta SEM ninguem. `tickDown` existe so por ele: o motor
     * segue chamando o traco de um corpo caido, e tres segundos depois o corpo
     * se remonta com metade da vida.
     */
    onDown(c) {
      if (c.self.tr.used) return;
      c.self.tr.timer = 3;
    },
    onTick(c) {
      const s = c.self;
      if (!s.downed || s.tr.used) return;
      s.tr.timer -= c.dt;
      if (s.tr.timer > 0) return;
      s.tr.used = true;
      s.raise(0.5);
      smokePop(c.scene, s.x, s.y, 1.2, 0xe8e8f4);
      c.say('DE VOLTA!', WHITE);
    }
  },
  {
    id: 'ghost', name: 'INTANGIVEL', blurb: 'Um em tres golpes atravessa.', tint: CYAN,
    /**
     * Nao tem escudo nem cura: ele simplesmente NAO ESTA LA. Um golpe em cada
     * tres passa reto, e quem atira de longe nao consegue nem mirar nele. O
     * `evasive` e renovado todo passo de proposito — enquanto ele existir, vale.
     */
    onSpawn(c) {
      c.self.st.dodgeEvery = 3;
      c.self.setAlpha(0.82);
    },
    onTick(c) { c.self.st.evasive = 0.5; }
  },
  {
    id: 'vampire', name: 'SEDE DE SANGUE', blurb: 'Cada morte o deixa maior.', tint: RED,
    /** Cresce com ABATES, para sempre, ate 10 pilhas. Quem nao mata, nao cresce. */
    onKill(c) {
      const tr = c.self.tr;
      if (tr.stacks >= 10) return;
      tr.stacks++;
      c.self.setMaxHp(Math.floor(c.self.maxHp * 1.08));
      c.self.atk += 4;
      c.self.healBy(c.self.maxHp * 0.12, true);
      soulBurst(c.scene, c.self.x, c.self.hitY, 150);
    }
  },
  {
    id: 'lich', name: 'GELO NEGRO', blurb: 'Na quarta pilha, congela.', tint: BLUE,
    /**
     * A UNICA COISA QUE SOMA no jogo inteiro (ver status.addFrost). Tres tiros
     * nao fazem nada visivel; o quarto trava o corpo. A graca e ver a horda
     * chegando cada vez mais devagar e de repente parando.
     */
    onHit(c, target) {
      if (!target.isTargetable()) return;
      if (addFrost(target, 1.4)) {
        freezeBlock(c.scene, target.x, target.hitY, target.punch);
      } else {
        frostShard(c.scene, target.x, target.hitY, target.punch);
        applySlow(target, 1, 0.2);
      }
    }
  },
  {
    id: 'mummy', name: 'MALDICAO DO FARAO', blurb: 'Quem chega perto sofre mais.', tint: PURPLE,
    /**
     * AURA, e por isso o piso do lado e ZERO: com 30 mumias espalhadas, deixar
     * so uma aplicar cobriria um canto do campo e nada mais. Maldicao e max-vence,
     * entao repetir e barato — o que nao pode e somar.
     */
    onTick(c) {
      if (!c.ready(0.3, 0)) return;
      const near = c.foesNear(220);
      for (let i = 0; i < near.length; i++) {
        applyVuln(near[i], 0.9, 0.25);
        if (Math.random() < 0.06) curseGlyph(c.scene, near[i].x, near[i].hitY - 20, 0.8);
      }
    }
  },
  {
    id: 'boneknight', name: 'COLETA OSSOS', blurb: 'Cresce de verdade a cada baixa.', tint: WHITE,
    /**
     * O unico que MUDA DE TAMANHO na tela. `grow` mexe na escala, na sombra, no
     * raio do corpo (que alimenta alcance e empurrao) e na altura da barra — ele
     * fica fisicamente maior, nao "mais forte na ficha". Teto de 1.7x, senao ele
     * engole o campo e o time atras dele nao alcanca mais ninguem.
     */
    onSpawn(c) { c.self.tr.acc = c.fallen(); },
    onTick(c) {
      const tr = c.self.tr;
      const down = c.fallen();
      if (down <= tr.acc) return;
      const add = down - tr.acc;
      tr.acc = down;
      c.self.grow(1 + 0.05 * add);
      c.self.setMaxHp(c.self.maxHp + 20 * add);
      c.self.atk += 6 * add;
      c.self.healBy(20 * add);
      c.say('MAIOR!', WHITE);
      shockRing(c.scene, c.self.x, c.self.y, 200, 0xe8e8f4);
    }
  },
  // -------------------------------------------------------------- OPERARIOS
  {
    id: 'barista', name: 'CAFE DUPLO', blurb: 'Serve cafe: todos aceleram.', tint: ORANGE,
    /** Entrega VELOCIDADE de mao em mao, para tres por vez. Nao e aura: e servico. */
    onTick(c) {
      if (!c.ready(3, 1)) return;
      const near = c.alliesNear(320);
      let n = 3;
      for (let i = 0; i < near.length && n > 0; i++) {
        const a = near[i];
        if (a === c.self) continue;
        applyRush(a, 4, 0.25);
        noteFloat(c.scene, a.x, a.hitY, 0.9);
        n--;
      }
      applyRush(c.self, 4, 0.25);
    }
  },
  {
    id: 'cashier', name: 'TROCO NA CARA', blurb: 'A moeda pula no vizinho e paga.', tint: GOLD,
    /**
     * ECONOMIA DENTRO DA BRIGA — e a moeda BATE DUAS VEZES.
     *
     * Todo o resto do jogo ganha ouro no fim da wave; ele ganha DURANTE, e a moeda
     * salta na tela. Ele e o unico traco cujo resultado o jogador leva para a loja.
     *
     * Sendo so isso, ele era o traco mais fino do elenco: UMA coisa mecanica, "da
     * moeda", que e exatamente o cara generico que esta tabela existe para nao ter.
     * Entao o troco RICOCHETEIA — a moeda que ele arranca do primeiro pula no
     * vizinho mais perto e cobra dele tambem.
     *
     * E a unica CADEIA do jogo: nao e area (as sete palmas do monge), nao e linha
     * (a flecha do elfo), nao e salva (os misseis do mech). Sao dois corpos ligados
     * por um pulo de 220px, e o segundo leva metade — dano de troco, `kind: 'hit'`,
     * que escudo e guarda ainda aparam. Contra um alvo solto e so a moeda; contra
     * dois encostados, o dobro de barulho pelo mesmo golpe.
     *
     * `buf2` e nao `buf` pela regra de reentrancia do arquivo: isto roda DENTRO da
     * resolucao de um golpe, e o `c.hit` daqui pode acordar o `onHurt` de quem
     * levou, que varre com o outro buffer.
     */
    onHit(c, target, dealt) {
      if (Math.random() > 0.25) return;
      c.gold(1);
      coinPop(c.scene, target.x, target.hitY);
      const perto = c.foesNear(220, c.buf2, target.x, target.y);
      for (let i = 0; i < perto.length; i++) {
        const t = perto[i];
        if (t === target || !t.isTargetable()) continue;
        zapArc(c.scene, target.x, target.hitY, t.x, t.hitY, GOLD);
        c.hit(t, Math.max(2, dealt * 0.5), 'hit');
        coinPop(c.scene, t.x, t.hitY);
        return;
      }
    }
  },
  {
    id: 'manager', name: 'REUNIAO OBRIGATORIA', blurb: 'Convoca o mais forte e trava.', tint: BLUE,
    /**
     * CONTROLE ESCOLHIDO. Ele nao atordoa quem esta perto — atordoa o MAIOR
     * PERIGO num raio de 300px, o chefe da wave inclusive. Um atordoamento no
     * lugar certo vale mais que area.
     */
    onTick(c) {
      if (!c.ready(2.5, 0.8)) return;
      const boss = biggest(c.foes, c.self.x, c.self.y, 300);
      if (!boss) return;
      applyStun(boss, 1.2);
      zapArc(c.scene, c.self.x, c.self.hitY, boss.x, boss.hitY, BLUE);
      stunSpin(c.scene, boss.x, boss.hitY - 34, 1100);
      c.say('REUNIAO!', BLUE);
    }
  },
  {
    id: 'intern', name: 'APRENDIZ', blurb: 'Copia o traco de um colega.', tint: GREEN,
    /**
     * O TRACO QUE NAO E UM TRACO. Ele troca a propria identidade pela de um
     * companheiro no primeiro passo — literalmente reescreve o proprio `traitId`,
     * e a partir dai o motor despacha o traco copiado sem saber que houve troca.
     * O preco e 30% do ataque: aprendiz nao faz igual ao mestre.
     *
     * Roda depois de todos nascerem (o motor faz o `onSpawn` em passada propria),
     * senao ele copiaria o vazio de um campo que ainda nao existe.
     */
    onSpawn(c) {
      const list = c.allies;
      let n = 0;
      for (const a of list) if (a !== c.self && a.traitId && a.traitId !== 'intern' && TRAITS[a.traitId]) n++;
      if (!n) { applyRush(c.self, 9999, 0.35); return; }
      let k = (Math.random() * n) | 0;
      for (const a of list) {
        if (a === c.self || !a.traitId || a.traitId === 'intern' || !TRAITS[a.traitId]) continue;
        if (k-- > 0) continue;
        c.self.traitId = a.traitId;
        c.self.atk *= 0.7;
        noteFloat(c.scene, c.self.x, c.self.hitY, 1);
        c.say(TRAITS[a.traitId].name, GREEN);
        TRAITS[a.traitId].onSpawn?.(c);
        return;
      }
    }
  },
  {
    id: 'courier', name: 'ENTREGA EXPRESSA', blurb: 'Primeiro golpe em cada alvo: 3x.', tint: ORANGE,
    /**
     * Recompensa TROCAR de alvo, o contrario de todo mundo. Ele corre 80% mais
     * rapido, chega, entrega o pacote triplicado e vai embora. `tr.aimId` guarda
     * um numero, nao a referencia do corpo — cadaver nao fica preso na memoria.
     */
    onSpawn(c) { c.self.moveSpeed *= 1.8; },
    onStrike(c, target, ev) {
      if (c.self.tr.aimId === target.uid) return;
      c.self.tr.aimId = target.uid;
      ev.amount *= 3;
      dashStreak(c.scene, c.self.x, c.self.hitY, target.x, target.hitY, ORANGE);
      c.say('ENTREGA!', ORANGE);
    }
  },
  {
    id: 'ceo', name: 'DEMISSAO EM MASSA', blurb: 'Executa quem esta abaixo de 15%.', tint: GOLD,
    /**
     * LIMIAR, nao dano. Ele nao bate mais forte: ele APAGA quem ja esta acabando,
     * sem negociar com escudo, guarda nem imunidade (`kind: 'true'`). Contra vida
     * cheia nao vale nada; contra uma horda ferida limpa o campo.
     */
    onTick(c) {
      if (!c.ready(6, 2)) return;
      const foes = c.foes;
      for (const t of foes) {
        if (!t.isTargetable() || t.hp / t.maxHp > 0.15) continue;
        curseGlyph(c.scene, t.x, t.hitY, 1.3);
        c.hit(t, t.hp + 9999, 'true');
        c.say('DEMITIDO!', GOLD);
        return;
      }
      // ninguem para demitir: o relogio nao pode ficar preso em 6s
      c.self.tr.cd = 1;
    }
  },
  // --------------------------------------------------------------- FANTASIA
  {
    id: 'elf', name: 'FLECHA QUE ATRAVESSA', blurb: 'A flecha varre a fila inteira.', tint: GREEN,
    /**
     * Resolve o golpe SOZINHO (`ev.handled`) e por isso nem chega a virar
     * projetil: a flecha e uma LINHA, e todo mundo a 55px dela leva o tiro cheio.
     * Contra uma fila enfileirada e devastador; contra um alvo solto e um tiro
     * normal — geometria, nao numero.
     */
    onStrike(c, target, ev) {
      ev.handled = true;
      const dir = Math.sign(target.x - c.self.x) || 1;
      const ang = Math.atan2(target.y - c.self.y, target.x - c.self.x);
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      lineSlash(c.scene, c.self.x, c.self.hitY, 560, dir, GREEN);
      const foes = c.foes;
      for (const t of foes) {
        if (!t.isTargetable()) continue;
        const vx = t.x - c.self.x, vy = t.y - c.self.y;
        const along = vx * Math.cos(ang) + vy * Math.sin(ang);
        if (along < -20 || along > 620) continue;
        if (Math.abs(vx * nx + vy * ny) > 55) continue;
        c.hit(t, ev.amount);
        frostShard(c.scene, t.x, t.hitY, 0.7);
      }
    }
  },
  {
    id: 'druid', name: 'BROTO DE VIDA', blurb: 'Planta um totem que cura.', tint: GREEN,
    /**
     * O UNICO que deixa algo NO CHAO. A zona fica onde nasceu e continua curando
     * mesmo depois de o druida morrer — e a unica coisa no jogo que sobrevive a
     * quem a criou.
     */
    onTick(c) {
      if (!c.ready(8, 3)) return;
      c.zone(c.self.x, c.self.y, 240, 8, 'heal', 7);
      c.say('BROTOU!', GREEN);
    }
  },
  {
    id: 'bard', name: 'REFRAO QUE PEGA', blurb: 'Quanto mais longa a briga, pior.', tint: PURPLE,
    /**
     * ESCALA COM O TEMPO, nao com o alvo nem com as baixas. A cada 4 segundos o
     * refrao sobe um degrau (+5% de ataque para o time, ate +40%). Numa briga
     * curta ele e o pior cara do rancho; numa briga longa ele decide.
     *
     * O canal e o proprio `kit.rally`, que o motor ja le como aura max-vence —
     * entao dez bardos nao viram +400%, viram o degrau mais alto entre eles.
     */
    onSpawn(c) { c.self.tr.acc = c.self.kit.rally; },
    onTick(c) {
      const tr = c.self.tr;
      tr.timer += c.dt;
      if (tr.timer < 4 || tr.stacks >= 8) return;
      tr.timer = 0;
      tr.stacks++;
      c.self.kit.rally = tr.acc + 0.05 * tr.stacks;
      noteFloat(c.scene, c.self.x, c.self.hitY, 1.1);
      c.say(`REFRAO ${tr.stacks}`, PURPLE);
    }
  },
  {
    id: 'paladin', name: 'JURAMENTO', blurb: 'Escuda os cinco mais feridos.', tint: GOLD,
    /**
     * ESCUDO — pontos que comem o dano antes da vida (ver Fighter.hurt). Nao e
     * cura: nao volta vida, mas segura o golpe que ia matar. E vai para os CINCO
     * MAIS MACHUCADOS, nunca para quem esta cheio.
     */
    onTick(c) {
      if (!c.ready(4, 1.5)) return;
      const list = weakest(c.allies, 5, c.buf);
      for (let i = 0; i < list.length; i++) {
        addShield(list[i], list[i].maxHp * 0.18);
        aegisFlare(c.scene, list[i].x, list[i].hitY, list[i].punch);
      }
      if (list.length) c.say('JURAMENTO!', GOLD);
    }
  },
  {
    id: 'necro', name: 'LEVANTA OS MORTOS', blurb: 'Cada cadaver vira esqueleto seu.', tint: PURPLE,
    /**
     * O campo de batalha e a MUNICAO dele. Cada inimigo caido pode ser erguido
     * UMA vez (`tr.risen` marca o corpo), e o esqueleto que sobe luta do lado
     * dele. Quanto mais gente morre, maior o exercito — e quem morreu foi o
     * inimigo, entao ele fica mais forte exatamente quando esta vencendo.
     */
    onTick(c) {
      if (!c.ready(2.2, 0.9)) return;
      const dead = c.fallenFoes();
      for (const corpse of dead) {
        if (corpse.tr.risen) continue;
        if (Phaser.Math.Distance.Squared(c.self.x, c.self.y, corpse.x, corpse.y) > 420 * 420) continue;
        corpse.tr.risen = true;
        soulBurst(c.scene, corpse.x, corpse.hitY, 160);
        c.summon('skeleton', corpse.x, corpse.y, 0.55);
        c.say('LEVANTA!', PURPLE);
        return;
      }
      c.self.tr.cd = 0.6;
    }
  },
  {
    id: 'dragon', name: 'BAFO DE FOGO', blurb: 'Cada 4o golpe vira um leque.', tint: ORANGE,
    /**
     * CONE, nao circulo. O bafo pega tudo num leque de 90 graus para a frente,
     * ate 320px — quem esta atras dele nao sente nada. E o unico traco que
     * PREMIA formacao: enfileire o dragao na frente e ele lava a fila inteira.
     *
     * O ALVO QUEIMA SEMPRE, pela mesma razao do IAI do samurai: `ev.handled` come
     * o golpe, e o cone e medido pelo LADO do dragao (`dirX`), nao pela direcao do
     * alvo. Um inimigo que passou por ele — ou um aliado enfeiticado pelo hacker,
     * que briga para o outro lado — fica com `dx` negativo, cai fora do `inCone` e
     * o quarto golpe seria fumaca de graca.
     */
    onStrike(c, target, ev) {
      const tr = c.self.tr;
      if (++tr.hits % 4 !== 0) return;
      ev.handled = true;
      const dirX = c.self.side === 'dude' ? 1 : -1;
      breathCone(c.scene, c.self.x + dirX * 40, c.self.hitY, dirX, 320);
      const dano = c.self.atk * 1.1;
      const brasa = c.self.atk * 0.35;
      c.hit(target, dano);
      applyBurn(target, 3, brasa);
      const list = c.foesNear(340);
      for (const t of list) {
        if (t === target || !inCone(c.self, t, dirX, 340, 0.78)) continue;
        c.hit(t, dano);
        applyBurn(t, 3, brasa);
      }
      c.say('BAFO!', ORANGE);
    }
  },
  {
    id: 'robot', name: 'PROTOCOLO DE ESCUDO', blurb: 'Da cobertura a quem esta perto.', tint: BLUE,
    /**
     * GUARDA e reducao CHAPADA de dano (-25%), diferente do escudo do paladino
     * (pontos que acabam) e da cura do medico (vida que volta). E uma aura de
     * proximidade: piso 0 no `ready` porque aura nao disputa vez com ninguem,
     * so re-aplica de perto em perto.
     */
    onTick(c) {
      if (!c.ready(0.4, 0)) return;
      const list = c.alliesNear(200);
      for (const a of list) applyGuard(a, 0.6, 0.25);
      applyGuard(c.self, 0.6, 0.25);
    }
  },
  {
    id: 'cyborg', name: 'SUPERAQUECIMENTO', blurb: 'Bate mais forte no mesmo alvo.', tint: RED,
    /**
     * FOCO. Cada golpe seguido no MESMO corpo esquenta +15%, ate +150%. Trocar de
     * alvo esfria tudo. O contrario do samurai (que quer varios) e do dragao (que
     * quer fila): o ciborgue quer UM inimigo, e o mais gordo que houver.
     */
    onStrike(c, target, ev) {
      const tr = c.self.tr;
      if (tr.aimId !== target.uid) { tr.aimId = target.uid; tr.stacks = 0; }
      else if (tr.stacks < 10) tr.stacks++;
      if (tr.stacks <= 0) return;
      ev.amount *= 1 + 0.15 * tr.stacks;
      if (tr.stacks >= 10) flameLick(c.scene, target.x, target.y, 1.2);
      if (tr.stacks === 10) c.say('FUNDIU!', RED);
    }
  },
  {
    id: 'alien', name: 'ABDUCAO', blurb: 'Suga um cara pro disco e solta.', tint: GREEN,
    /**
     * TIRA UM CORPO DO CAMPO. Por 2.5 segundos o alvo simplesmente NAO EXISTE —
     * nao bate, nao anda, nao pode ser atacado, nao conta para ninguem mirar. E
     * volta caindo, levando dano de queda que conta como abate do alien.
     *
     * Remocao temporaria e diferente de atordoar (o mumo continua ali levando
     * porrada) e de matar. Vale mais contra o cara mais perigoso do que contra
     * o mais fraco.
     */
    onTick(c) {
      if (!c.ready(5, 2)) return;
      const t = biggest(c.foes, c.self.x, c.self.y, 500);
      if (!t) { c.self.tr.cd = 0.8; return; }
      beamDown(c.scene, t.x, t.y, GREEN, 420);
      t.st.suspend = 2.5;
      t.suspendBy = c.self;
      t.suspendDrop = 40 + c.self.atk * 0.6;
      t.setSuspended(true);
      c.say('ABDUZIDO!', GREEN);
    }
  },
  {
    id: 'mech', name: 'MISSEIS DE TETO', blurb: 'Quatro misseis em quem der.', tint: BLUE,
    /**
     * ATINGE DE LONGE SEM MIRAR. Quatro cascos sobem em parabola e caem em quatro
     * corpos sorteados em 500px — inclusive gente que ninguem esta atacando, la
     * atras. E o unico que ignora completamente a linha de frente.
     */
    onTick(c) {
      if (!c.ready(3, 1)) return;
      const list = c.foesNear(500);
      if (!list.length) { c.self.tr.cd = 0.6; return; }
      const dmg = c.self.atk * 0.45;
      for (let i = 0; i < 4; i++) {
        const t = anyOf(list);
        if (!t) break;
        const tx = t.x, ty = t.y;
        arcShell(c.scene, c.self.x, c.self.hitY, tx, ty, () => {
          shockRing(c.scene, tx, ty, 90, BLUE);
          const hitList = c.foesNear(95, c.buf2, tx, ty);
          for (const h of hitList) c.hit(h, dmg);
        }, BLUE, 520 + i * 90);
      }
      c.say('MISSEIS!', BLUE);
    }
  },
  {
    id: 'hacker', name: 'VIRUS DE CONTROLE', blurb: 'Vira a casaca de um inimigo.', tint: CYAN,
    /**
     * TROCA UM CORPO DE LADO. Por 4 segundos o inimigo luta PARA voce — bate nos
     * proprios amigos, e eles batem nele. Nao e dano, e aritmetica: -1 deles, +1
     * seu, duas vezes.
     *
     * Nunca dispara com 2 ou menos inimigos vivos, senao o virus terminaria a
     * batalha sozinho e o fim de rodada nunca chegaria (ver checkEnd, que conta
     * por `side`, e um time de zero corpos do proprio lado ja perdeu).
     */
    onTick(c) {
      if (!c.ready(8, 3)) return;
      if (c.foes.length <= 2) { c.self.tr.cd = 1; return; }
      let flipped = 0;
      for (const a of c.allies) if (a.team !== c.self.team) flipped++;
      if (flipped >= 6) { c.self.tr.cd = 1; return; }
      const t = anyOf(c.foesNear(460));
      if (!t) { c.self.tr.cd = 0.8; return; }
      t.st.charm = 4;
      zapArc(c.scene, c.self.x, c.self.hitY, t.x, t.hitY, CYAN);
      smokePop(c.scene, t.x, t.y, t.punch, CYAN);
      c.say('HACKEADO!', CYAN);
    }
  },
  {
    id: 'starlord', name: 'CHUVA DE ESTRELAS', blurb: 'Oito estrelas caem do ceu.', tint: GOLD,
    /**
     * COBERTURA, nao precisao. Oito estrelas caem espalhadas na frente dele; cada
     * uma acerta pouco (60%) num raio pequeno. Contra um inimigo sozinho e o pior
     * traco do jogo; contra uma horda de 40 corpos colados, e o melhor.
     */
    onTick(c) {
      if (!c.ready(5, 2)) return;
      const list = c.foesNear(560);
      if (!list.length) { c.self.tr.cd = 0.7; return; }
      const dmg = c.self.atk * 0.6;
      for (let i = 0; i < 8; i++) {
        const seed = anyOf(list);
        if (!seed) break;
        const tx = seed.x + Phaser.Math.Between(-90, 90);
        const ty = Phaser.Math.Clamp(seed.y + Phaser.Math.Between(-60, 60), c.arena.minY, c.arena.maxY);
        starFall(c.scene, tx, ty, () => {
          const hitList = c.foesNear(92, c.buf2, tx, ty);
          for (const h of hitList) c.hit(h, dmg);
        }, 'fx_star', GOLD, 380 + i * 70, 1);
      }
      c.say('CHUVA!', GOLD);
    }
  },
  {
    id: 'ninja', name: 'SOMBRA DUPLA', blurb: 'Deixa um clone brigando por 6s.', tint: PURPLE,
    /**
     * DOIS CORPOS SEUS. O clone e um combatente de verdade (mira, bate, leva
     * dano) que dura 6 segundos e some. Dobra a presenca dele no campo sem
     * dobrar o preco — e o unico traco que muda a CONTAGEM do seu lado por
     * conta propria, o que num jogo chamado "Quantos Caras?" e o cumulo.
     */
    onTick(c) {
      if (!c.ready(6, 2.5)) return;
      const dirX = c.self.side === 'dude' ? 1 : -1;
      const x = Phaser.Math.Clamp(c.self.x - dirX * 70, c.arena.minX, c.arena.maxX);
      smokePop(c.scene, x, c.self.y, c.self.punch * 1.2, 0x2b2b3a);
      c.summon('clone', x, c.self.y, 0.6, 6);
      c.say('SOMBRA!', PURPLE);
    }
  },
  {
    id: 'pirate', name: 'CANHAO DE BORDO', blurb: 'A bala deixa o chao pegando fogo.', tint: ORANGE,
    /**
     * BOMBARDEIO CEGO A DISTANCIA FIXA — E O CHAO FICA QUEIMANDO.
     *
     * A bala cai entre 350 e 700px A FRENTE dele, doa a quem estiver la — nunca no
     * cara que ele esta cutucando. Punir a retaguarda e o oposto do que todo o resto
     * do jogo faz.
     *
     * SO ISSO NAO BASTAVA. O jogo tem tres bombardeios (os quatro misseis do mech, as
     * oito estrelas do starlord e esta bala), e a bala era o mesmo golpe dos outros
     * dois com a contagem em UM: cai do ceu, estoura um circulo, machuca quem estava
     * dentro. Trocar um pelo outro mudava o numero de explosoes e nada mais — que e
     * exatamente o cara generico que esta tabela existe para nao ter.
     *
     * Entao a bala INCENDEIA O CHAO. O tico de convés em brasa fica 5 segundos onde
     * caiu, pulsando a cada 0.25s (`CombatSystem.tickZones`), e cobra de quem passar
     * por cima — dano `'dot'`, que ignora bloqueio e nao conta como golpe. E a UNICA
     * zona hostil do jogo: o broto do druida e a outra zona que existe, e ela cura os
     * amigos dele. Nenhum outro traco nega TERRENO.
     *
     * O bombardeio tambem deixa de ser um golpe instantaneo e passa a ser uma aposta
     * de posicao: a horda que marcha em fila passa inteira pela brasa; um inimigo
     * solto e parado nao passa por ela nunca.
     */
    onTick(c) {
      if (!c.ready(4, 1.5)) return;
      const dirX = c.self.side === 'dude' ? 1 : -1;
      const tx = Phaser.Math.Clamp(
        c.self.x + dirX * Phaser.Math.Between(350, 700), c.arena.minX + 40, c.arena.maxX - 40
      );
      const ty = Phaser.Math.Clamp(c.self.y + Phaser.Math.Between(-120, 120), c.arena.minY, c.arena.maxY);
      const dmg = c.self.atk * 1.8;
      const brasa = Math.max(1, c.self.atk * 0.12);
      arcShell(c.scene, c.self.x, c.self.hitY, tx, ty, () => {
        shockRing(c.scene, tx, ty, 150, ORANGE);
        smokePop(c.scene, tx, ty, 1.6, ORANGE);
        const hitList = c.foesNear(155, c.buf2, tx, ty);
        for (const h of hitList) c.hit(h, dmg);
        flameLick(c.scene, tx, ty, 1.6);
        c.zone(tx, ty, 140, 5, 'burn', brasa);
      }, ORANGE, 700);
      c.say('FOGO!', ORANGE);
    }
  },
  {
    id: 'cowboy', name: 'SEIS TIROS', blurb: 'Seis tiros rapidos, e recarrega.', tint: GOLD,
    /**
     * RITMO, nao velocidade media. Seis tiros a jato (rush de +140%) e depois 1.8s
     * PARADO recarregando. No papel a media da no mesmo; na pratica o pente inteiro
     * derruba um corpo antes de ele reagir, e e por isso que ele e diferente do
     * barista (que so acelera todo mundo um pouco).
     *
     * A recarga escreve em `self.cd` DENTRO do onStrike. Funciona porque `act()`
     * define `f.cd` antes de chamar `strike()`, entao esta escrita e a que vale.
     */
    onTick(c) {
      const tr = c.self.tr;
      if (tr.timer > 0) {
        tr.timer -= c.dt;
        if (tr.timer <= 0) { tr.timer = 0; tr.hits = 0; c.say('RECARREGADO', GOLD); }
        return;
      }
      applyRush(c.self, 0.3, 1.4);
    },
    onStrike(c) {
      const tr = c.self.tr;
      if (tr.timer > 0) return;
      if (++tr.hits < 6) return;
      tr.timer = 1.8;
      c.self.cd = 1.8;
      c.self.st.rush = 0; c.self.st.rushPow = 0;
      smokePop(c.scene, c.self.x, c.self.hitY, c.self.punch, 0xd9d2c2);
    }
  },
  {
    id: 'spy', name: 'PELAS COSTAS', blurb: 'Triplica em quem nao olha pra ele.', tint: PURPLE,
    /**
     * DEPENDE DO QUE O ALVO ESTA FAZENDO, nao de contador nem de relogio. Se o
     * inimigo esta mirando OUTRA pessoa, o golpe vale 3x. Se virou para o espiao,
     * vale 1x. Nenhum outro traco no jogo le a mira do inimigo.
     */
    onStrike(c, target, ev) {
      if (!target.aim || target.aim === c.self) return;
      ev.amount *= 3;
      ev.crit = true;
      lineSlash(c.scene, target.x, target.hitY, 150, c.self.x < target.x ? 1 : -1, PURPLE);
      c.say('PELAS COSTAS!', PURPLE);
    }
  },
  {
    id: 'athlete', name: 'CORRIDA MALUCA', blurb: 'Atravessa a linha empurrando.', tint: CYAN,
    /**
     * MOVE OS OUTROS DE LUGAR. Ele atravessa a linha inimiga num risco e EMPURRA
     * todo mundo que estava no caminho para tras. Dano pequeno; o que importa e a
     * formacao do inimigo desmanchando — e o unico traco que reposiciona corpos.
     */
    onTick(c) {
      if (!c.ready(2, 0.8)) return;
      const t = nearest(c.foes, c.self.x, c.self.y, 620);
      if (!t) { c.self.tr.cd = 0.5; return; }
      const x0 = c.self.x, y0 = c.self.y;
      const dirX = t.x >= x0 ? 1 : -1;
      const x1 = Phaser.Math.Clamp(t.x + dirX * 90, c.arena.minX, c.arena.maxX);
      const y1 = Phaser.Math.Clamp(t.y, c.arena.minY, c.arena.maxY);
      dashStreak(c.scene, x0, y0 - 40, x1, y1 - 40, CYAN);
      c.self.setPosition(x1, y1);
      c.self.syncRig();
      const list = c.foesNear(150, c.buf, (x0 + x1) * 0.5, (y0 + y1) * 0.5);
      for (const f of list) {
        c.hit(f, c.self.atk * 0.7);
        shove(f, x0, 90, c.arena);
      }
      if (list.length) c.say('SAI DA FRENTE!', CYAN);
    }
  },
  {
    id: 'chef', name: 'BANQUETE', blurb: 'Serve todo mundo e limpa o mal.', tint: GOLD,
    /**
     * O UNICO QUE LIMPA. Fogo, gelo, lentidao, raiz, maldicao, atordoamento: o
     * banquete apaga tudo do time inteiro e ainda devolve 20% do que falta de
     * vida. Contra um time sem tracos de estado ele quase nao faz nada; contra
     * lich + mumia + dragao ele desmonta a estrategia toda.
     *
     * Cura por VIDA QUE FALTA e nao por vida maxima: serve mais a quem esta pior,
     * sem virar cura infinita para quem esta cheio.
     */
    onTick(c) {
      if (!c.ready(5, 2)) return;
      let served = 0;
      for (const a of c.allies) {
        if (!a.isAlive()) continue;
        const miss = a.maxHp - a.hp;
        const cleaned = cleanse(a);
        if (miss > 1) { a.healBy(miss * 0.2, true); healPlus(c.scene, a.x, a.hitY, a.punch); served++; }
        else if (cleaned) { healPlus(c.scene, a.x, a.hitY, a.punch * 0.8); served++; }
      }
      if (served) c.say('BANQUETE!', GOLD);
      else c.self.tr.cd = 1;
    }
  },
  {
    id: 'dude', name: 'QUANTOS CARAS?', blurb: 'Forte na razao dos caras vivos.', tint: WHITE,
    /**
     * O TITULO DO JOGO VIRADO EM MECANICA. Ele fica mais forte por cada OUTRO cara
     * vivo do lado dele: +4% de ataque e +3% de vida, ate 30 caras. E o unico traco
     * que le o TAMANHO DA MULTIDAO em vez de um alvo, um contador ou um relogio.
     *
     * Recalcula SEMPRE a partir dos numeros de fabrica guardados em `acc`/`acc2`,
     * nunca multiplicando o valor atual: multiplicar acumularia erro a 60 passos
     * por segundo e em um minuto ele teria ataque infinito.
     *
     * O ATAQUE ANDA PARA OS DOIS LADOS: a conta e refeita do zero a cada meio
     * segundo, entao ele encolhe junto com o time. O TETO DE VIDA SO SOBE, e nao
     * por esquecimento — `setMaxHp` e via de mao unica de proposito (ver Fighter),
     * porque baixar o teto no meio da briga obrigaria a aparar a vida atual, e um
     * cara podia MORRER porque o VIZINHO dele caiu. Entao a vida dele guarda a
     * maior multidao em que ele ja esteve, e o ataque conta quem ainda esta de pe.
     */
    onSpawn(c) {
      c.self.tr.acc = c.self.atk;
      c.self.tr.acc2 = c.self.maxHp;
    },
    onTick(c) {
      if (!c.ready(0.5, 0)) return;
      const tr = c.self.tr;
      let n = 0;
      for (const a of c.allies) if (a !== c.self && a.isAlive()) n++;
      if (n > 30) n = 30;
      if (n === tr.stacks) return;
      tr.stacks = n;
      c.self.atk = tr.acc * (1 + 0.04 * n);
      c.self.setMaxHp(tr.acc2 * (1 + 0.03 * n));
      if (n > 0) c.say(`+${n} CARAS`, WHITE);
    }
  }
];

/**
 * O REGISTRO. `LIST` e a fonte unica; o mapa e derivado dele para nao existir
 * chance de um traco existir na tabela e nao no indice (ou o contrario).
 */
export const TRAITS: Record<string, Trait> = {};
for (const t of LIST) TRAITS[t.id] = t;

/** Todos os tracos, na ordem em que foram escritos. Usado pelos testes. */
export const TRAIT_LIST: readonly Trait[] = LIST;

/** O traco de um cara, ou `undefined` se aquele id nao tem traco proprio. */
export function traitFor(id?: string): Trait | undefined {
  return id ? TRAITS[id] : undefined;
}




