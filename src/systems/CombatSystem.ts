import Phaser from 'phaser';
import { Fighter } from '../entities/Fighter';
import { Dude } from '../entities/Dude';
import { Enemy } from '../entities/Enemy';
import { AOE_RADIUS, HEAL_RADIUS, emptyKit } from './abilities';
import { critStar } from '../art/fx';
import { dudeKey, DUDE_W, DUDE_H, FOOT_ORIGIN_Y } from '../art/textures';

/** Passo fixo de simulacao. Independente do framerate: 60Hz logico sempre. */
const STEP = 1 / 60;
const MAX_STEPS = 5;
/** Lado da celula do grid de vizinhanca, em px. */
const CELL = 110;

export interface CombatHooks {
  onSwing?(attacker: Fighter, dirX: number): void;
  /** Alcance longo: a cena cria o projetil e ele resolve o dano no impacto. */
  onRanged?(attacker: Fighter, target: Fighter, damage: number): void;
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
 * O MOTOR DE COMBATE.
 *
 * Um autobattler nao pode resolver briga num timer de 120ms: as unidades
 * teleportam, o dano vem em blocos e nada parece vivo. Aqui a simulacao roda em
 * passo fixo de 60Hz alimentada pelo `update(time, delta)` da cena, e TODAS as
 * 14 habilidades do Kit sao consultadas todo passo. Movimento e em px/s de
 * verdade — a tropa fecha a distancia e o campo vira uma multidao.
 */
export class CombatSystem {
  /** Invocacoes (esqueletos do necro) — aliados que nao existiam no rancho. */
  readonly summons: Fighter[] = [];
  running = true;

  private acc = 0;
  private grid = new Grid();
  private scratch: Fighter[] = [];
  private allies: Fighter[] = [];
  private foes: Fighter[] = [];
  /** Ultimo de cada lado a cair. Alimenta o `onFinalBlow`. */
  private lastFoeDown?: Fighter;
  private lastAllyDown?: Fighter;

  constructor(
    private scene: Phaser.Scene,
    public dudes: Dude[],
    public enemies: Enemy[],
    private o: CombatOpts
  ) {}

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

  private roster(): void {
    this.allies.length = 0;
    this.foes.length = 0;
    for (const d of this.dudes) if (d.active) this.allies.push(d);
    for (const s of this.summons) if (s.active) this.allies.push(s);
    for (const e of this.enemies) if (e.active) this.foes.push(e);
  }
  private step(dt: number): void {
    this.roster();

    this.grid.clear();
    for (const f of this.allies) if (f.isAlive()) this.grid.insert(f);
    for (const f of this.foes) if (f.isAlive()) this.grid.insert(f);

    this.applyAuras(this.allies);
    this.applyAuras(this.foes);
    this.applyDeathscale(this.allies);
    this.applyDeathscale(this.foes);
    this.support(this.allies, dt);
    this.support(this.foes, dt);

    this.act(this.allies, this.foes, dt);
    this.act(this.foes, this.allies, dt);

    this.reap();
    this.checkEnd();
  }

  /**
   * Quem caiu neste passo. A morte pode vir de quatro lugares — golpe direto,
   * cleave, splash de area ou projetil — entao em vez de instrumentar os quatro,
   * este passo unico varre o estado e marca os novos caidos.
   */
  private reap(): void {
    for (const f of this.foes) {
      if (!f.downed || (f as any)._reaped) continue;
      (f as any)._reaped = true;
      this.lastFoeDown = f;
    }
    for (const f of this.allies) {
      if (!f.downed || (f as any)._reaped) continue;
      (f as any)._reaped = true;
      this.lastAllyDown = f;
    }
  }

  /** Rally/haste sao AURAS: valem para o time todo, nao acumulam por fonte. */
  private applyAuras(team: Fighter[]): void {
    let atk = 0, spd = 0;
    for (const f of team) {
      if (!f.isAlive()) continue;
      if (f.kit.rally > atk) atk = f.kit.rally;
      if (f.kit.haste > spd) spd = f.kit.haste;
    }
    for (const f of team) {
      f.auraAtk = 1 + atk;
      f.auraSpeed = 1 + spd;
    }
  }

  /** Deathscale: mais forte por aliado caido. Recalculado, nunca acumulado. */
  private applyDeathscale(team: Fighter[]): void {
    let downed = 0;
    for (const f of team) if (f.downed) downed++;
    for (const f of team) {
      if (f.kit.deathscale <= 0) continue;
      const mult = 1 + f.kit.deathscale * downed;
      (f as any)._dsMult = mult;
      const anyF = f as any;
      if (anyF._baseMaxHp === undefined) anyF._baseMaxHp = f.maxHp;
      f.setMaxHp(Math.floor(anyF._baseMaxHp * mult));
    }
  }

  /** Regen em si mesmo + pulso de cura em area nos aliados vivos por perto. */
  private support(team: Fighter[], dt: number): void {
    for (const f of team) {
      if (!f.isAlive()) continue;
      if (f.kit.regen > 0) f.healBy(f.kit.regen * dt);
      if (f.kit.heal > 0) {
        const amount = f.kit.heal * dt;
        for (const ally of team) {
          if (ally === f || !ally.isAlive()) continue;
          if (Phaser.Math.Distance.Squared(f.x, f.y, ally.x, ally.y) <= HEAL_RADIUS * HEAL_RADIUS) {
            ally.healBy(amount);
          }
        }
      }
    }
  }
  /** Mira, anda, bate, invoca — por combatente, por passo. */
  private act(team: Fighter[], foes: Fighter[], dt: number): void {
    const { minX, maxX, minY, maxY } = this.o.arena;
    for (const f of team) {
      if (!f.isAlive()) continue;

      if (f.kit.summon > 0) {
        f.summonCd -= dt;
        if (f.summonCd <= 0) {
          f.summonCd = f.kit.summon;
          this.spawnSummon(f);
        }
      }

      const target = this.pickTarget(f, foes);
      if (!target) continue;

      const dist = Phaser.Math.Distance.Between(f.x, f.y, target.x, target.y);
      f.cd -= dt;

      // alcance conta o tamanho dos dois corpos: um urso nao precisa colar o
      // nariz no cara pra alcancar, e um pirralho precisa chegar perto
      const reach = f.range + (f.bodyRadius + target.bodyRadius) * 0.5;
      if (dist <= reach) {
        if (f.cd <= 0) {
          f.cd = 1 / Math.max(0.1, f.attackSpeed * f.auraSpeed);
          this.strike(f, target);
        }
      } else {
        const ang = Math.atan2(target.y - f.y, target.x - f.x);
        f.x += Math.cos(ang) * f.moveSpeed * dt;
        f.y += Math.sin(ang) * f.moveSpeed * dt;
      }

      this.separate(f, dt);
      // o clamp conta o corpo: um urso polar de 250px de largo com o centro em
      // maxX ficava com metade do bicho fora da tela
      const pad = f.bodyRadius * 0.55;
      f.x = Phaser.Math.Clamp(f.x, minX + pad, maxX - pad);
      f.y = Phaser.Math.Clamp(f.y, minY, maxY);
    }
  }

  /**
   * Alvo = menor `distancia / taunt`. Um provocador com taunt 3 puxa aggro como
   * se estivesse 3x mais perto — e assim o tanque cumpre o papel de tanque.
   */
  private pickTarget(f: Fighter, foes: Fighter[]): Fighter | null {
    let best: Fighter | null = null;
    let bestScore = Infinity;
    for (const t of foes) {
      if (!t.isAlive()) continue;
      const score = Phaser.Math.Distance.Between(f.x, f.y, t.x, t.y) / Math.max(1, t.kit.taunt);
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
   * Resolve um golpe: crit, area, cleave e dreno. `hurt()` devolve o dano
   * efetivo (0 se o alvo bloqueou), entao o lifesteal drena o valor real.
   */
  private strike(a: Fighter, target: Fighter): void {
    const teamMult = a.team === 'dude' ? (this.o.dudeAtkMult ?? 1) : (this.o.enemyDmgMult ?? 1);
    // enrage: +X% por 10% de vida perdida
    const lost = Math.floor((1 - a.hp / a.maxHp) * 10);
    const enrage = a.kit.enrage > 0 ? 1 + a.kit.enrage * lost : 1;
    const ds = (a as any)._dsMult ?? 1;
    const crit = a.kit.crit > 0 && Math.random() < a.kit.crit;
    let dmg = a.atk * teamMult * a.auraAtk * enrage * ds;
    if (crit) dmg *= 2;

    const dirX = Math.sign(target.x - a.x) || 1;
    a.swing(dirX);
    this.o.hooks?.onSwing?.(a, dirX);
    // critico e raro: merece a estrela dourada
    if (crit) critStar(this.scene, target.x, target.hitY, 1);

    // alcance longo = projetil; a cena resolve o dano no impacto
    if (a.range > 150 && this.o.hooks?.onRanged) {
      this.o.hooks.onRanged(a, target, dmg);
      return;
    }

    const dealt = target.hurt(dmg);
    let drained = dealt;

    // cleave: mesmo dano cheio em N inimigos adjacentes
    if (a.kit.cleave > 0) {
      let left = a.kit.cleave;
      for (const other of this.grid.near(target.x, target.y, this.scratch)) {
        if (left <= 0) break;
        if (other === target || other.team === a.team || !other.isAlive()) continue;
        if (Phaser.Math.Distance.Between(target.x, target.y, other.x, other.y) > AOE_RADIUS) continue;
        drained += other.hurt(dmg);
        left--;
      }
    }

    // aoe: fracao do dano espirra em volta do alvo
    if (a.kit.aoe > 0) {
      const splash = dmg * a.kit.aoe;
      for (const other of this.grid.near(target.x, target.y, this.scratch)) {
        if (other === target || other.team === a.team || !other.isAlive()) continue;
        if (Phaser.Math.Distance.Between(target.x, target.y, other.x, other.y) > AOE_RADIUS) continue;
        drained += other.hurt(splash);
      }
    }

    if (a.kit.lifesteal > 0 && drained > 0) a.healBy(drained * a.kit.lifesteal, true);
  }
  /** Esqueleto invocado: aliado real, com rig e barra, que conta para vitoria/derrota. */
  private spawnSummon(by: Fighter): void {
    if (this.summons.length >= 40) return;
    const key = this.scene.textures.exists(dudeKey('skeleton')) ? dudeKey('skeleton') : by.texture.key;
    const s = new Fighter(
      this.scene,
      by.x - 40 + Math.random() * 80,
      Phaser.Math.Clamp(by.y + (Math.random() - 0.5) * 90, this.o.arena.minY, this.o.arena.maxY),
      key,
      {
        team: by.team,
        hp: Math.max(8, Math.floor(by.maxHp * 0.25)),
        atk: Math.max(2, Math.floor(by.atk * 0.5)),
        range: 56,
        attackSpeed: 1.1,
        moveSpeed: 120,
        kit: { ...emptyKit() },
        visualHeight: 140,
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
    this.summons.push(s);
    this.o.hooks?.onSummon?.(s);
  }

  /** Levanta o primeiro cara caido (reliquia de revive). */
  reviveOne(fraction = 0.5): boolean {
    const fallen = this.dudes.find(d => d.downed);
    if (!fallen) return false;
    fallen.raise(fraction);
    // volta a ser "colhivel": se cair de novo, ele conta como ultimo golpe
    (fallen as any)._reaped = false;
    if (this.lastAllyDown === fallen) this.lastAllyDown = undefined;
    return true;
  }

  private checkEnd(): void {
    const dudesUp = this.dudes.some(d => d.isAlive()) || this.summons.some(s => s.isAlive());
    const foesUp = this.enemies.some(e => e.isAlive());
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
    for (const s of this.summons) s.destroy();
    this.summons.length = 0;
  }
}





