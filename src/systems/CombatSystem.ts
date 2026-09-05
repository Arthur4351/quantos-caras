import Phaser from 'phaser';
import { Fighter, HitKind, Team } from '../entities/Fighter';
import { Dude } from '../entities/Dude';
import { Enemy } from '../entities/Enemy';
import { AOE_RADIUS, HEAL_RADIUS, emptyKit } from './abilities';
import { critStar, flameLick, healPlus, smokePop } from '../art/fx';
import { dudeKey, DUDE_W, DUDE_H, FOOT_ORIGIN_Y } from '../art/textures';
import { canAct, canMove, statusSpeed, tickStatus } from './status';
import {
  DamageEvent, SummonKind, Trait, TraitCtx, TraitEngine, Zone, traitFor
} from './traits';
import { GREEN, ORANGE, WHITE } from '../art/palette';

/** Passo fixo de simulacao. Independente do framerate: 60Hz logico sempre. */
const STEP = 1 / 60;
const MAX_STEPS = 5;
/** Lado da celula do grid de vizinhanca, em px. */
const CELL = 110;
/** Zonas de chao (o broto do druida) nao doem 60x por segundo. */
const ZONE_PULSE = 0.25;
const MAX_ZONES = 24;
const MAX_SUMMONS = 40;

export interface CombatHooks {
  onSwing?(attacker: Fighter, dirX: number): void;
  /**
   * Alcance longo: a cena cria o projetil e ele resolve o dano no impacto.
   *
   * `tint` e a cor de assinatura do traco de quem atirou — a flecha do lich voa
   * azul, a do dragao voa laranja. `onHit` e o recado que o traco quer entregar
   * junto com o dano.
   */
  onRanged?(
    attacker: Fighter, target: Fighter, damage: number,
    tint?: number, onHit?: (t: Fighter, dealt: number) => void
  ): void;
  onSummon?(summon: Fighter): void;
  /**
   * O ULTIMO A CAIR, entregue um instante antes de `onEnd`. A cena usa isto para
   * a camera lenta: sem ele a Battle nao teria como saber QUEM fechou a briga.
   */
  onFinalBlow?(victim: Fighter, won: boolean): void;
  onEnd?(won: boolean): void;
}

export interface CombatOpts {
  /** Sinergia de familia + bonus de reliquia, multiplicando o atk dos caras. */
  dudeAtkMult?: number;
  /** Reducao de dano recebido (escudo): 0.8 = leva 80%. */
  enemyDmgMult?: number;
  arena: { minX: number; maxX: number; minY: number; maxY: number };
  hooks?: CombatHooks;
}

/**
 * O QUE O MOTOR PENDURA EM CADA CORPO.
 *
 * A entidade nao sabe o que e um traco (importar `traits.ts` fecharia ciclo com
 * `Fighter`), entao a mesa de trabalho do traco, o traco resolvido e os tres
 * campos de contabilidade do motor moram aqui, num tipo que so este arquivo ve.
 */
interface Bound extends Fighter {
  _ctx?: TraitCtx;
  _trait?: Trait | null;
  /** Ja foi contado como "caiu agora"? */
  _reaped?: boolean;
  _dsMult?: number;
  _baseMaxHp?: number;
  /** Segundos de vida de um corpo temporario (a sombra do ninja). */
  _life?: number;
}

/** Grid uniforme reconstruido a cada passo — vizinhanca em O(1) com centenas de unidades. */
class Grid {
  private cells = new Map<number, Fighter[]>();

  clear(): void { this.cells.clear(); }

  private static key(x: number, y: number): number {
    return Math.floor(y / CELL) * 100003 + Math.floor(x / CELL);
  }

  insert(f: Fighter): void {
    const k = Grid.key(f.x, f.y);
    let bucket = this.cells.get(k);
    if (!bucket) this.cells.set(k, (bucket = []));
    bucket.push(f);
  }

  near(x: number, y: number, out: Fighter[]): Fighter[] {
    out.length = 0;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.cells.get((cy + dy) * 100003 + (cx + dx));
        if (bucket) for (const f of bucket) out.push(f);
      }
    }
    return out;
  }
}

/**
 * O MOTOR DE COMBATE — e, desde os tracos, o MOTOR DE TRACOS tambem.
 *
 * Um autobattler nao pode resolver briga num timer de 120ms: as unidades
 * teleportam, o dano vem em blocos e nada parece vivo. Aqui a simulacao roda em
 * passo fixo de 60Hz alimentada pelo `update(time, delta)` da cena, e TODAS as
 * 14 habilidades do Kit sao consultadas todo passo. Movimento e em px/s de
 * verdade — a tropa fecha a distancia e o campo vira uma multidao.
 *
 * POR QUE O MOTOR PENSA EM "LADO" E NAO EM "TIME": o virus do hacker vira a
 * casaca de um inimigo por 4 segundos. Se as listas fossem `dudes` e `enemies`,
 * o cara virado continuaria batendo nos amigos dele e o traco nao existiria. As
 * listas sao montadas por `f.side` — que e o time DELE, a nao ser que esteja
 * enfeiticado — e por isso trocar de lado e uma linha de estado, nao um remendo
 * espalhado por dez funcoes.
 */
export class CombatSystem implements TraitEngine {
  /** Invocacoes (esqueleto, sombra) — corpos que nao existiam no rancho. */
  readonly summons: Fighter[] = [];
  running = true;
  /** Ouro ganho DENTRO da briga (o troco do caixa). A cena colhe no fim. */
  bonusGold = 0;

  private acc = 0;
  private grid = new Grid();
  private scratch: Fighter[] = [];
  /** Todo corpo do campo, vivo ou caido. Reconstruida por passo. */
  private everyone: Fighter[] = [];
  private sideDude: Fighter[] = [];
  private sideEnemy: Fighter[] = [];
  private downDude: Fighter[] = [];
  private downEnemy: Fighter[] = [];
  private zones: Zone[] = [];
  private zoneCd = 0;
  /** Piso de tempo por lado+golpe. Ver `TraitCtx.ready`. */
  private claims = new Map<string, number>();
  /**
   * O ENVELOPE DO GOLPE, um so para todo o jogo.
   *
   * `strike()` e chamado de UM lugar (`act`) e nunca de dentro de si mesmo — o
   * dano de traco vai direto ao `hurt()`, sem passar por aqui. Enquanto essa
   * invariante valer, um envelope reusado poupa 26 mil objetos por segundo.
   */
  private ev: DamageEvent = { amount: 0, crit: false, handled: false };
  /** Ultimo de cada lado a cair. Alimenta o `onFinalBlow`. */
  private lastFoeDown?: Fighter;
  private lastAllyDown?: Fighter;

  constructor(
    readonly scene: Phaser.Scene,
    public dudes: Dude[],
    public enemies: Enemy[],
    private o: CombatOpts
  ) {}

  get arena(): { minX: number; maxX: number; minY: number; maxY: number } { return this.o.arena; }

  // ============================================================ TRAIT ENGINE
  sideList(side: Team): Fighter[] { return side === 'dude' ? this.sideDude : this.sideEnemy; }
  fallen(side: Team): number { return (side === 'dude' ? this.downDude : this.downEnemy).length; }
  fallenList(side: Team): Fighter[] { return side === 'dude' ? this.downDude : this.downEnemy; }

  /**
   * Vizinhos de um LADO dentro do raio, escritos em `out`.
   *
   * De proposito NAO usa o grid: a celula tem 110px e o grid so olha 3x3, entao
   * qualquer raio acima de ~110px (e quase todo traco pede 200, 300, 500) leria
   * um campo truncado e o golpe simplesmente nao acertaria quem esta na tela. A
   * varredura linear e sobre uma lista de no maximo ~440 corpos e roda so quando
   * um traco esta pronto — barato o suficiente, e sempre certa.
   */
  near(x: number, y: number, r: number, side: Team, out: Fighter[]): Fighter[] {
    out.length = 0;
    const r2 = r * r;
    const list = side === 'dude' ? this.sideDude : this.sideEnemy;
    for (const f of list) {
      if (!f.isTargetable()) continue;
      if (Phaser.Math.Distance.Squared(x, y, f.x, f.y) > r2) continue;
      out.push(f);
    }
    return out;
  }

  /** Dano de habilidade: mesmo portao do golpe normal, com credito de abate. */
  hit(by: Fighter, target: Fighter, amount: number, kind: HitKind = 'true'): number {
    if (!target.isTargetable()) return 0;
    return target.hurt(amount, true, by, kind);
  }

  /** Piso de tempo do LADO para um golpe. Ver `TraitCtx.ready`. */
  claim(side: Team, key: string, seconds: number): boolean {
    const k = `${side}:${key}`;
    if ((this.claims.get(k) ?? 0) > 0) return false;
    this.claims.set(k, seconds);
    return true;
  }

  shoot(
    by: Fighter, target: Fighter, dmg: number, tint: number,
    onHit?: (t: Fighter, dealt: number) => void
  ): void {
    this.o.hooks?.onRanged?.(by, target, dmg, tint, onHit);
  }

  gold(n: number): void { this.bonusGold += n; }

  /**
   * ZONA DE CHAO. O broto do druida e a unica coisa no jogo que SOBREVIVE a quem
   * a criou, e por isso ela precisa de dono nenhum: mora aqui, no motor.
   *
   * O anel e achatado (altura = metade da largura) porque a arena e vista de
   * lado: um circulo perfeito no chao pareceria uma bola flutuando.
   *
   * E O FOGO NAO RESPIRA COMO O BROTO. As duas zonas nasciam do mesmo desenho com
   * a mesma pulsacao lenta e so o tom mudava — verde/laranja. Isso e pouco: uma
   * cura no chao e uma armadilha no chao sao as coisas mais opostas que este jogo
   * tem, e quem chega no meio da briga precisa saber ONDE NAO PISAR sem ler a cor.
   * Broto: 720ms de vai-e-vem, o ritmo de algo vivo respirando. Fogo: 240ms, tremor
   * de chama, e mais opaco porque ele tem de ser visto DEBAIXO de uma pilha de
   * corpos (o `depth` de zona e o chao, entao todo mundo que pisa nela passa na
   * frente). As labaredas de `tickZones` completam a leitura.
   */
  addZone(z: Zone): void {
    if (this.zones.length >= MAX_ZONES) return;
    const fogo = z.kind === 'burn';
    if (this.scene.textures.exists('fx_ring')) {
      const art = this.scene.add.image(z.x, z.y, 'fx_ring')
        .setDisplaySize(z.r * 2, z.r)
        .setTint(fogo ? ORANGE : GREEN)
        .setAlpha(fogo ? 0.34 : 0.22)
        .setDepth(z.y - 4);
      this.scene.tweens.add({
        targets: art,
        alpha: fogo ? { from: 0.26, to: 0.58 } : { from: 0.16, to: 0.42 },
        duration: fogo ? 240 : 720,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      z.art = art;
    }
    this.zones.push(z);
  }

  /** Chamado pelo `update` da cena. Consome o delta em passos fixos. */
  update(deltaMs: number): void {
    if (!this.running) return;
    this.acc += Math.min(deltaMs, 120) / 1000;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.acc -= STEP;
      this.step(STEP);
      steps++;
      if (!this.running) break;
    }
    if (steps) this.syncRigs();
  }

  /**
   * As listas do passo. Vivo de um lado, caido do outro — e o caido importa: o
   * cavaleiro-osso cresce com os aliados que cairam e o necromante colhe os
   * inimigos que cairam. Reconstruida do zero por passo, sem alocar (as quatro
   * arrays sao as mesmas para sempre).
   */
  private roster(): void {
    this.everyone.length = 0;
    this.sideDude.length = 0;
    this.sideEnemy.length = 0;
    this.downDude.length = 0;
    this.downEnemy.length = 0;
    for (const d of this.dudes) if (d.active) this.everyone.push(d);
    for (const s of this.summons) if (s.active) this.everyone.push(s);
    for (const e of this.enemies) if (e.active) this.everyone.push(e);
    for (const f of this.everyone) {
      const alive = f.isAlive();
      if (f.side === 'dude') (alive ? this.sideDude : this.downDude).push(f);
      else (alive ? this.sideEnemy : this.downEnemy).push(f);
    }
  }

  private step(dt: number): void {
    this.roster();
    this.bindAll();

    this.grid.clear();
    for (const f of this.everyone) if (f.isAlive()) this.grid.insert(f);

    this.statusStep(dt);
    this.tickClaims(dt);

    this.applyAuras(this.sideDude);
    this.applyAuras(this.sideEnemy);
    this.applyDeathscale(this.sideDude, this.downDude.length);
    this.applyDeathscale(this.sideEnemy, this.downEnemy.length);
    this.support(this.sideDude, dt);
    this.support(this.sideEnemy, dt);
    this.tickZones(dt);
    this.traitTick(dt);

    this.act(this.sideDude, this.sideEnemy, dt);
    this.act(this.sideEnemy, this.sideDude, dt);

    this.reap();
    this.checkEnd();
  }

  /**
   * O NASCIMENTO, EM DUAS PASSADAS.
   *
   * A primeira monta a mesa de trabalho e resolve o traco. A segunda dispara o
   * `onSpawn` — separada de proposito, porque o ESTAGIARIO copia o traco de um
   * companheiro e precisa que o campo inteiro ja exista. Numa unica passada, o
   * primeiro cara do rancho copiaria de uma lista com um corpo dentro (o dele).
   */
  private bindAll(): void {
    for (const f of this.everyone) if (!(f as Bound)._ctx) this.bind(f as Bound);
    for (const f of this.everyone) {
      if (f.tr.born) continue;
      f.tr.born = true;
      const b = f as Bound;
      if (!b._ctx) continue;
      b._trait?.onSpawn?.(b._ctx);
      // o estagiario TROCA o proprio traitId dentro do onSpawn. Reler aqui e o
      // que faz o traco copiado valer pelo resto da briga.
      if (b._trait?.id !== f.traitId) b._trait = traitFor(f.traitId) ?? null;
    }
  }

  /**
   * OS QUATRO AVISOS, pendurados no corpo uma vez na vida.
   *
   * `hurt()` (na entidade) e o unico gargalo de dano do jogo e nao pode conhecer
   * a tabela de tracos. Entao ele grita, e quem escuta e este fecho — quatro
   * funcoes por combatente, criadas no nascimento e nunca mais.
   */
  private bind(b: Bound): void {
    const ctx = new TraitCtx(this, b);
    ctx.dt = STEP;
    b._ctx = ctx;
    b._trait = traitFor(b.traitId) ?? null;

    b.onDamaged = (dealt, by, kind) => { b._trait?.onHurt?.(ctx, dealt, by, kind); };
    b.onBlocked = (by) => { b._trait?.onBlock?.(ctx, by); };
    b.onLanded = (target, dealt) => { b._trait?.onHit?.(ctx, target, dealt); };
    b.onDowned = () => {
      b._trait?.onDown?.(ctx);
      // CREDITO DE ABATE. Quem deu o ultimo golpe fica sabendo — e assim o
      // vampiro engorda com a propria flecha e o motor nao precisa instrumentar
      // os quatro caminhos por onde a morte pode chegar.
      const killer = b.lastHitBy as Bound | undefined;
      if (killer && killer.active && !killer.downed && killer._ctx) {
        killer._trait?.onKill?.(killer._ctx, b);
      }
    };
  }

  /** Desconta um passo dos pisos de lado. `forEach` para nao alocar tuplas. */
  private tickClaims(dt: number): void {
    if (!this.claims.size) return;
    this.claims.forEach((left, k) => {
      const n = left - dt;
      if (n <= 0) this.claims.delete(k); else this.claims.set(k, n);
    });
  }

  /**
   * O PASSO DOS ESTADOS — fogo queimando, gelo esfriando, disco soltando o corpo.
   *
   * Roda para TODO MUNDO antes de qualquer um agir, senao o primeiro cara da
   * lista lutaria com o estado do passo passado e o ultimo com o deste passo.
   */
  private statusStep(dt: number): void {
    for (const f of this.everyone) {
      const b = f as Bound;

      // corpo temporario (a sombra do ninja) vencendo o prazo
      if (b._life !== undefined && !f.downed) {
        b._life -= dt;
        if (b._life <= 0) { this.expire(b); continue; }
      }

      // o relogio pessoal do traco anda mesmo caido: o esqueleto se remonta.
      if (f.tr.cd > 0) { f.tr.cd -= dt; if (f.tr.cd < 0) f.tr.cd = 0; }
      if (f.downed) continue;

      const st = f.st;
      const wasGone = st.suspend > 0;
      tickStatus(f, dt);

      // ABDUCAO ACABANDO: o disco solta, e a queda conta como golpe do alien.
      if (wasGone && st.suspend <= 0) {
        f.setSuspended(false);
        if (f.suspendDrop > 0) {
          const drop = f.suspendDrop;
          const by = f.suspendBy;
          f.suspendDrop = 0;
          f.suspendBy = undefined;
          f.hurt(drop, true, by, 'true');
          if (f.downed) continue;
        }
      }

      if (st.burn > 0 && st.burnDps > 0) {
        // sem numero: 60 "-2" por segundo por corpo apagaria a tela
        f.hurt(st.burnDps * dt, false, undefined, 'dot');
        if (f.downed) continue;
        // a labareda sai por sorteio (~2.5x/s), e ainda passa pelo teto de FX
        if (Math.random() < dt * 2.5) flameLick(this.scene, f.x, f.y, f.punch * 0.8);
      }
      f.restoreTint();
    }
  }

  /**
   * O PRAZO DA SOMBRA VENCEU. Ela nao MORRE (nao sangra, nao vira cadaver que o
   * necromante colhe, nao conta como o ultimo a cair): ela some numa fumaca.
   *
   * `downed` e escrito na mao em vez de chamar `down()` justamente para pular o
   * sangue, o aviso de queda e o credito de abate. O `_reaped` ja vem marcado
   * para o `reap` nunca a confundir com o golpe final da briga.
   */
  private expire(b: Bound): void {
    smokePop(this.scene, b.x, b.y, b.punch * 1.2, 0x2b2b3a);
    b.hp = 0;
    b.downed = true;
    b._reaped = true;
    b.setSuspended(true);
    this.scene.time.delayedCall(40, () => b.destroy());
  }

  /**
   * Quem caiu neste passo. A morte pode vir de sete lugares — golpe, cleave,
   * splash, projetil, fogo, zona ou queda de disco voador — entao em vez de
   * instrumentar os sete, este passo unico varre o estado e marca os novos.
   */
  private reap(): void {
    for (const f of this.everyone) {
      const b = f as Bound;
      if (!f.downed || b._reaped) continue;
      b._reaped = true;
      // conta pelo TIME de nascimento, nao pelo lado: um inimigo enfeiticado que
      // cai lutando por voce ainda e uma baixa da horda.
      if (f.team === 'dude') this.lastAllyDown = f; else this.lastFoeDown = f;
    }
  }

  /** Rally/haste sao AURAS: valem para o lado todo, nao acumulam por fonte. */
  private applyAuras(team: Fighter[]): void {
    let atk = 0, spd = 0;
    for (const f of team) {
      if (f.kit.rally > atk) atk = f.kit.rally;
      if (f.kit.haste > spd) spd = f.kit.haste;
    }
    for (const f of team) {
      f.auraAtk = 1 + atk;
      f.auraSpeed = 1 + spd;
    }
  }

  /** Deathscale: mais forte por aliado caido. Recalculado, nunca acumulado. */
  private applyDeathscale(team: Fighter[], downed: number): void {
    for (const f of team) {
      if (f.kit.deathscale <= 0) continue;
      const b = f as Bound;
      const mult = 1 + f.kit.deathscale * downed;
      b._dsMult = mult;
      if (b._baseMaxHp === undefined) b._baseMaxHp = f.maxHp;
      f.setMaxHp(Math.floor(b._baseMaxHp * mult));
    }
  }

  /** Regen em si mesmo + pulso de cura em area nos aliados vivos por perto. */
  private support(team: Fighter[], dt: number): void {
    for (const f of team) {
      if (f.kit.regen > 0) f.healBy(f.kit.regen * dt);
      if (f.kit.heal > 0) {
        const amount = f.kit.heal * dt;
        for (const ally of team) {
          if (ally === f) continue;
          if (Phaser.Math.Distance.Squared(f.x, f.y, ally.x, ally.y) <= HEAL_RADIUS * HEAL_RADIUS) {
            ally.healBy(amount);
          }
        }
      }
    }
  }

  /**
   * ZONAS DE CHAO. Pulsam a cada 0.25s — a 60Hz o broto do druida curaria 60x
   * por segundo e um totem valeria mais que o time inteiro.
   */
  private tickZones(dt: number): void {
    if (!this.zones.length) return;
    this.zoneCd -= dt;
    const fire = this.zoneCd <= 0;
    if (fire) this.zoneCd = ZONE_PULSE;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) {
        if (z.art) { this.scene.tweens.killTweensOf(z.art); z.art.destroy(); }
        this.zones.splice(i, 1);
        continue;
      }
      if (!fire) continue;
      const heal = z.kind === 'heal';
      // o chao pega fogo mesmo com ninguem dentro: e o que faz a zona do pirata
      // NEGAR TERRENO em vez de so machucar quem por acaso passou por ali
      if (!heal) this.zoneFlames(z);
      const list = heal
        ? this.sideList(z.side)
        : this.sideList(z.side === 'dude' ? 'enemy' : 'dude');
      const r2 = z.r * z.r;
      /**
       * TETO DE TRES CORPOS EM CHAMAS POR PULSO — o orcamento de FX e do combate
       * inteiro, nao desta poca.
       *
       * Sem teto, uma horda de 20 corpos parada dentro do fogo pede 10 chamas por
       * pulso (a moeda de 50%), 40 por segundo, e cada uma vive 0.4s: sao ~16
       * chamas vivas de uma poca so. Com as tres ou quatro pocas que o piso do lado
       * permite, isso come metade dos 150 objetos de `art/fx.ts` — e o que fica de
       * fora e a `hitSpark` de todo mundo, o feedback mais importante do combate.
       * Tres chamas por pulso ja dizem "tem gente queimando ai" e sobra tela.
       */
      let brasas = 3;
      for (const f of list) {
        if (!f.isTargetable()) continue;
        if (Phaser.Math.Distance.Squared(z.x, z.y, f.x, f.y) > r2) continue;
        if (heal) {
          if (f.hp >= f.maxHp) continue;
          f.healBy(z.power);
          // um mais por pulso e por corpo ja e leitura suficiente; a horda toda
          // florescendo estouraria o teto de FX em meio segundo
          if (Math.random() < 0.34) healPlus(this.scene, f.x, f.hitY, f.punch * 0.8);
        } else {
          f.hurt(z.power, false, undefined, 'dot');
          /**
           * E QUEM ESTA PISANDO NO FOGO PEGA FOGO.
           *
           * O galho da cura pipocava um `healPlus` e o galho do dano nao mostrava
           * NADA: o corpo perdia vida de quatro em quatro vezes por segundo e a
           * unica pista era a barrinha andando para tras. Fogo no pe (`f.y` e a
           * linha do chao, e `flameLick` nasce na frente do corpo) diz de quem e o
           * dano e por que ele esta acontecendo, e a chance parcial existe pelo
           * mesmo motivo do galho de cima: dez bichos na mesma poca nao podem
           * gastar o orcamento de FX inteiro num pulso. A escala 1.2 e a mesma
           * medida das labaredas de chao logo abaixo, um degrau menor: fogo no
           * corpo tem de ser visto SEM cobrir o boneco que esta queimando.
           */
          if (brasas > 0 && Math.random() < 0.5) { brasas--; flameLick(this.scene, f.x, f.y, 1.2); }
        }
      }
    }
  }

  /**
   * AS LABAREDAS DA POCA — tres por pulso, sorteadas por AREA e nao por raio.
   *
   * `Math.sqrt(Math.random())` em vez de `Math.random()`: sem a raiz, metade das
   * chamas cai na metade interna do circulo, que e um quarto da area, e a poca
   * parece uma fogueira com uma aureola vazia. Com a raiz, a chama cai em qualquer
   * ponto com a mesma probabilidade por centimetro de chao.
   *
   * O `0.5` no eixo Y e o mesmo achatamento do anel de `addZone`: a arena e vista
   * de lado, entao a poca e uma elipse e as chamas tem de nascer DENTRO dela.
   *
   * O TAMANHO FOI MEDIDO NA TELA, e o primeiro chute (0.9) reprovou: `flameLick`
   * multiplica a textura de 48x56 por `0.5 * escala`, o que dava uma chama de 22x25
   * no canvas virtual — e o canvas virtual e 1920 de largura exibido em ~930px
   * nesta janela, ou seja 11px reais. A poca tem 280px de largura: tres fagulhas de
   * 11px dentro dela leem como sujeira no chao, nao como fogo. Contado na tela: 4
   * objetos `fx_flame` vivos, e nenhum visivel na captura. Em 2.0 a chama nasce com
   * 48x56 virtuais (~27px reais, acima do piso de leitura deste jogo) e sobe 108px
   * antes de sumir, que e o tamanho de uma labareda de verdade contra uma poca desse
   * diametro.
   *
   * Nada aqui precisa de teto proprio — `spawn` recusa o pedido quando a cena ja
   * tem 150 objetos de FX vivos (`art/fx.ts`), e uma chama perdida no meio de uma
   * horda em chamas e invisivel.
   */
  private zoneFlames(z: Zone): void {
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random());
      flameLick(
        this.scene,
        z.x + Math.cos(ang) * z.r * dist,
        z.y + Math.sin(ang) * z.r * 0.5 * dist,
        2
      );
    }
  }

  /** O passo dos tracos. O que nao implementa `onTick` nao custa nada aqui. */
  private traitTick(dt: number): void {
    for (const f of this.everyone) {
      const b = f as Bound;
      const t = b._trait;
      if (!t?.onTick || !b._ctx) continue;
      if (f.downed && !t.tickDown) continue;
      if (f.st.suspend > 0) continue;
      b._ctx.dt = dt;
      t.onTick(b._ctx);
    }
  }

  /** Mira, anda, bate, invoca — por combatente, por passo. */
  private act(team: Fighter[], foes: Fighter[], dt: number): void {
    const { minX, maxX, minY, maxY } = this.o.arena;
    for (const f of team) {
      if (!f.isAlive()) continue;
      f.cd -= dt;
      // abduzido: nao existe no campo neste instante
      if (f.st.suspend > 0) { f.aim = undefined; continue; }

      if (f.kit.summon > 0) {
        f.summonCd -= dt;
        if (f.summonCd <= 0) {
          f.summonCd = f.kit.summon;
          this.summon(f, 'skeleton', f.x - 40 + Math.random() * 80, f.y + (Math.random() - 0.5) * 90, 0.5);
        }
      }

      const target = this.pickTarget(f, foes);
      // A MIRA FICA GRAVADA. O espiao triplica em quem esta olhando para outro
      // lado, e sem este campo nao havia como saber para onde alguem olha.
      f.aim = target ?? undefined;
      if (!target) continue;

      const speed = statusSpeed(f.st);
      const acting = canAct(f.st);
      const moving = canMove(f.st);
      const dist = Phaser.Math.Distance.Between(f.x, f.y, target.x, target.y);

      // alcance conta o tamanho dos dois corpos: um urso nao precisa colar o
      // nariz no cara pra alcancar, e um pirralho precisa chegar perto
      const reach = f.range + (f.bodyRadius + target.bodyRadius) * 0.5;
      if (dist <= reach) {
        if (acting && f.cd <= 0) {
          f.cd = 1 / Math.max(0.1, f.attackSpeed * f.auraSpeed * speed);
          this.strike(f, target);
        }
      } else if (moving) {
        const ang = Math.atan2(target.y - f.y, target.x - f.x);
        f.x += Math.cos(ang) * f.moveSpeed * speed * dt;
        f.y += Math.sin(ang) * f.moveSpeed * speed * dt;
      }

      // enraizado nao e empurrado: a raiz do burocrata prende no lugar
      if (moving) this.separate(f, dt);
      // o clamp conta o corpo: um urso polar de 250px de largo com o centro em
      // maxX ficava com metade do bicho fora da tela
      const pad = f.bodyRadius * 0.55;
      f.x = Phaser.Math.Clamp(f.x, minX + pad, maxX - pad);
      f.y = Phaser.Math.Clamp(f.y, minY, maxY);
    }
  }

  /**
   * A ESCOLHA DO ALVO, em duas varreduras.
   *
   * A primeira respeita o FANTASMA: quem atira de longe simplesmente nao o ve. A
   * segunda existe porque, se o campo inimigo fosse SO de fantasmas, o arqueiro
   * ficaria de pe sem alvo e a briga nunca terminaria — entao no segundo passe
   * ele acha, de perto, o que nao conseguia mirar de longe.
   */
  private pickTarget(f: Fighter, foes: Fighter[]): Fighter | null {
    const ranged = f.range > 150;
    const best = this.scanTarget(f, foes, ranged);
    if (best || !ranged) return best;
    return this.scanTarget(f, foes, false);
  }

  /**
   * Alvo = menor `distancia / taunt`. Um provocador com taunt 3 puxa aggro como
   * se estivesse 3x mais perto — e assim o tanque cumpre o papel de tanque.
   *
   * `aimMode: 'far'` inverte a conta: o astronauta pula a linha de frente e cai
   * em cima de quem esta no fundo, onde moram os curandeiros.
   */
  private scanTarget(f: Fighter, foes: Fighter[], skipEvasive: boolean): Fighter | null {
    const far = f.aimMode === 'far';
    let best: Fighter | null = null;
    let bestScore = Infinity;
    for (const t of foes) {
      if (!t.isTargetable()) continue;
      if (skipEvasive && t.st.evasive > 0) continue;
      const d = Phaser.Math.Distance.Between(f.x, f.y, t.x, t.y);
      const score = far ? -d : d / Math.max(1, t.kit.taunt);
      if (score < bestScore) { bestScore = score; best = t; }
    }
    return best;
  }

  /** Empurrao suave entre unidades proximas: multidao densa, sem sobreposicao total. */
  private separate(f: Fighter, dt: number): void {
    const near = this.grid.near(f.x, f.y, this.scratch);
    let px = 0, py = 0;
    for (const other of near) {
      if (other === f || !other.isAlive()) continue;
      // o espaco pessoal e proporcional aos corpos, nao um raio fixo
      const room = (f.bodyRadius + other.bodyRadius) * 0.62;
      const dx = f.x - other.x, dy = (f.y - other.y) * 1.6;
      const d2 = dx * dx + dy * dy;
      if (d2 > room * room || d2 === 0) continue;
      const d = Math.sqrt(d2);
      px += (dx / d) * (room - d);
      py += (dy / d) * (room - d);
    }
    f.x += px * dt * 4;
    f.y += py * dt * 4;
  }

  /**
   * Resolve um golpe: traco, crit, area, cleave e dreno.
   *
   * A ORDEM AQUI E O CONTRATO DO JOGO. O traco fala ANTES de o dano existir, e
   * pode fazer tres coisas: mudar o numero (o foco do ciborgue, as costas do
   * espiao), ligar o critico, ou dizer `handled` e resolver o golpe inteiro
   * sozinho — o corte em linha do samurai, o bafo do dragao e a flecha que
   * atravessa do elfo nao batem em UM alvo, entao nem passam pelo resto daqui.
   */
  private strike(a: Fighter, target: Fighter): void {
    const b = a as Bound;
    const teamMult = a.team === 'dude' ? (this.o.dudeAtkMult ?? 1) : (this.o.enemyDmgMult ?? 1);
    // enrage: +X% por 10% de vida perdida
    const lost = Math.floor((1 - a.hp / a.maxHp) * 10);
    const enrage = a.kit.enrage > 0 ? 1 + a.kit.enrage * lost : 1;
    const ds = b._dsMult ?? 1;
    let crit = a.kit.crit > 0 && Math.random() < a.kit.crit;
    let dmg = a.atk * teamMult * a.auraAtk * enrage * ds;
    if (crit) dmg *= 2;

    const dirX = Math.sign(target.x - a.x) || 1;
    a.swing(dirX);
    this.o.hooks?.onSwing?.(a, dirX);

    const trait = b._trait;
    if (trait?.onStrike && b._ctx) {
      const ev = this.ev;
      ev.amount = dmg;
      ev.crit = crit;
      ev.handled = false;
      trait.onStrike(b._ctx, target, ev);
      if (ev.handled) return;
      dmg = ev.amount;
      crit = ev.crit;
      if (!target.isTargetable()) return;
    }

    // critico e raro: merece a estrela dourada
    if (crit) critStar(this.scene, target.x, target.hitY, 1);

    // alcance longo = projetil, pintado com a cor do traco de quem atirou
    if (a.range > 150 && this.o.hooks?.onRanged) {
      this.shoot(a, target, dmg, trait?.tint ?? WHITE);
      return;
    }

    const dealt = target.hurt(dmg, true, a);
    // o corpo-a-corpo tambem "encosta": sem isto a raiz do burocrata, o gelo do
    // lich e as sete palmas do monge so funcionariam com flecha.
    a.onLanded?.(target, dealt);
    let drained = dealt;

    // cleave: mesmo dano cheio em N inimigos adjacentes
    if (a.kit.cleave > 0) {
      let left = a.kit.cleave;
      for (const other of this.grid.near(target.x, target.y, this.scratch)) {
        if (left <= 0) break;
        if (other === target || other.side === a.side || !other.isTargetable()) continue;
        if (Phaser.Math.Distance.Between(target.x, target.y, other.x, other.y) > AOE_RADIUS) continue;
        drained += other.hurt(dmg, true, a);
        left--;
      }
    }

    // aoe: fracao do dano espirra em volta do alvo
    if (a.kit.aoe > 0) {
      const splash = dmg * a.kit.aoe;
      for (const other of this.grid.near(target.x, target.y, this.scratch)) {
        if (other === target || other.side === a.side || !other.isTargetable()) continue;
        if (Phaser.Math.Distance.Between(target.x, target.y, other.x, other.y) > AOE_RADIUS) continue;
        drained += other.hurt(splash, true, a);
      }
    }

    if (a.kit.lifesteal > 0 && drained > 0) a.healBy(drained * a.kit.lifesteal, true);
  }

  /**
   * UM CORPO NOVO NO CAMPO. Aliado de verdade: mira, bate, leva dano e conta para
   * vitoria ou derrota. Tres sabores, um construtor.
   *
   * `power` escala vida e ataque a partir de quem invocou; `life` em segundos > 0
   * faz dele um corpo TEMPORARIO (a sombra do ninja, que dura 6s e some).
   *
   * O time e o LADO de quem invocou, nao o time de nascimento: um cara virado
   * pelo virus que invoque alguem, invoca do lado em que esta lutando.
   */
  summon(by: Fighter, kind: SummonKind, x: number, y: number, power: number, life = 0): Fighter | null {
    if (this.summons.length >= MAX_SUMMONS) return null;
    const clone = kind === 'clone';
    const wanted = clone ? by.texture.key : dudeKey(kind === 'walker' ? 'zombie' : 'skeleton');
    const key = this.scene.textures.exists(wanted) ? wanted : by.texture.key;
    const s = new Fighter(
      this.scene, x,
      Phaser.Math.Clamp(y, this.o.arena.minY, this.o.arena.maxY),
      key,
      {
        team: by.side,
        hp: Math.max(8, Math.floor(by.maxHp * power * 0.5)),
        atk: Math.max(2, Math.floor(by.atk * power)),
        range: clone ? by.range : 56,
        attackSpeed: clone ? by.attackSpeed : 1.1,
        moveSpeed: clone ? by.moveSpeed : 120,
        kit: { ...emptyKit() },
        visualHeight: clone ? by.visualHeight : 140,
        sourceHeight: DUDE_H,
        sourceWidth: DUDE_W,
        bodyWidth: 92,
        footOrigin: FOOT_ORIGIN_Y,
        contentTop: 44,
        barWidth: 62,
        bar: false,
        numbers: false
      }
    );
    if (life > 0) (s as Bound)._life = life;
    if (clone) s.setAlpha(0.72);
    this.summons.push(s);
    this.o.hooks?.onSummon?.(s);
    return s;
  }

  /** Levanta o primeiro cara caido (reliquia de revive). */
  reviveOne(fraction = 0.5): boolean {
    const fallen = this.dudes.find(d => d.downed);
    if (!fallen) return false;
    fallen.raise(fraction);
    // volta a ser "colhivel": se cair de novo, ele conta como ultimo golpe
    (fallen as Bound)._reaped = false;
    if (this.lastAllyDown === fallen) this.lastAllyDown = undefined;
    return true;
  }

  /**
   * Conta CORPOS DE PE POR LADO, lidos agora — nao a lista do inicio do passo.
   * Um esqueleto erguido pelo necromante segura a briga de pe; um cara virado
   * pelo virus conta para o lado em que esta lutando.
   */
  private checkEnd(): void {
    let dudesUp = 0, foesUp = 0;
    for (const f of this.everyone) {
      if (!f.isAlive()) continue;
      if (f.side === 'dude') dudesUp++; else foesUp++;
    }
    if (foesUp && dudesUp) return;
    this.running = false;
    this.syncRigs();
    const won = !foesUp;
    const victim = won ? this.lastFoeDown : this.lastAllyDown;
    if (victim) this.o.hooks?.onFinalBlow?.(victim, won);
    this.o.hooks?.onEnd?.(won);
  }

  private syncRigs(): void {
    for (const d of this.dudes) if (d.active) d.syncRig();
    for (const s of this.summons) if (s.active) s.syncRig();
    for (const e of this.enemies) if (e.active) e.syncRig();
  }

  destroy(): void {
    this.running = false;
    for (const z of this.zones) {
      if (z.art) { this.scene.tweens.killTweensOf(z.art); z.art.destroy(); }
    }
    this.zones.length = 0;
    this.claims.clear();
    for (const s of this.summons) s.destroy();
    this.summons.length = 0;
  }
}
