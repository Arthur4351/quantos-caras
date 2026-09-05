import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { CombatSystem } from '../systems/CombatSystem';
import { calculateSynergyBonus, calculateHpBonus } from '../systems/Synergy';
import { Dude } from '../entities/Dude';
import { Enemy } from '../entities/Enemy';
import { Fighter } from '../entities/Fighter';
import { Projectile } from '../entities/Projectile';
import { RelicSystem } from '../systems/RelicSystem';
import { RelicRites, RiteBody, riteConfig } from '../systems/RelicRites';
import { battleStats, TrainedMap } from '../systems/RunState';
import { storage } from '../utils/storage';
import { buildRanch } from '../art/Backdrop';
import { TickRoster, TickGroup } from '../art/TickBars';
import { ComicButton, label, panelImage, statPill, toast } from '../art/UIKit';
import { idleBob } from '../art/DudeSprite';
import { dudeKey, enemyKey } from '../art/textures';
import { shockRing, shoutText } from '../art/fx';
import { GOLD, GREEN, INK, ORANGE, PAPER, RED } from '../art/palette';
import waves from '../data/waves.json';
import { DudeData } from '../types/DudeData';

/** Limites do chao — teto e piso absolutos. `layoutField` recorta dentro deles. */
const ARENA = { minX: 140, maxX: 1852, minY: 440, maxY: 958 };
/** Faixa em x de cada papel: tanque na frente, suporte atras. Base; `layoutField` reposiciona. */
const LANE: Record<string, number> = { Tank: 880, DPS: 660, Support: 440 };
/** Distancia entre as faixas de papel. */
const LANE_GAP = 220;
/** Distancia entre linhas e entre colunas dentro de uma faixa. */
const ROW_GAP = 116;
const COL_GAP = 92;
/**
 * A CAMERA LENTA DO GOLPE FINAL: fator do tempo e duracao REAL da volta ao
 * normal. O tombo do corpo dura 620ms de tween (`Fighter.deathBlow`), o que a
 * 0.3 de escala vira ~2.07s de tela — e por isso a janela e de 2s: com os 1250ms
 * antigos o tempo voltava ao normal com o corpo ainda no alto do arco e o
 * arremesso terminava em velocidade dupla. Agora o inimigo ENCOSTA no chao
 * exatamente quando o mundo volta a andar.
 */
const SLOWMO_SCALE = 0.3;
const SLOWMO_MS = 2000;
const SLOWMO_ZOOM = 1.34;
/**
 * Desalinho de posto, deterministico. Colunas perfeitamente retas parecem um
 * grid de planilha; 14px de bagunca fazem a tropa parecer posta a mao — e sem
 * `Math.random` a formacao e a mesma em todo boot da mesma cena.
 */
function wobble(n: number, spread: number): number {
  return (((n + 1) * 9301 + 49297) % (spread * 2 + 1)) - spread;
}

export class Battle extends Phaser.Scene {
  dudes: Dude[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  waveManager!: WaveManager;
  combat?: CombatSystem;
  relicSystem!: RelicSystem;
  /** Os rituais das reliquias de CLASSE. Ver `systems/RelicRites.ts`. */
  private rites?: RelicRites;
  wave = 1;
  dudesData: DudeData[] = [];
  battleActive = false;
  hasRevived = false;
  private economy = { gold: 0 };
  /** Treino permanente e lanche da rodada, vindos da loja. */
  private trained: TrainedMap = {};
  private snack: string | null = null;
  /** Geometria do campo desta wave. Ver `layoutField`. */
  private arena = { ...ARENA };
  private lane: Record<string, number> = { ...LANE };
  private foeBand = { minX: 1040, maxX: 1780 };
  /** As duas pilhas de traços dos cantos + o total da horda (o denominador do placar). */
  private armyRoster?: TickRoster;
  private foeRoster?: TickRoster;
  private foeTotal = 1;
  private barCd = 0;
  /** ms REAIS restantes de camera lenta. Ver `slowmoKill`. */
  private slowmoLeft = 0;
  /** Quem esta sob o holofote do golpe final, para o revive poder apagar a luz. */
  private spotVictim?: Fighter;

  constructor() { super('Battle'); }

  init(data: { wave: number; dudesData: DudeData[]; trained?: TrainedMap; snack?: string | null; economy?: { gold: number } }) {
    this.wave = data.wave ?? 1;
    this.dudesData = data.dudesData ?? [];
    this.trained = data.trained ?? {};
    this.snack = data.snack ?? null;
    this.dudes = [];
    this.enemies = [];
    this.projectiles = [];
    this.combat = undefined;
    this.rites = undefined;
    this.battleActive = false;
    this.hasRevived = false;
    this.armyRoster = undefined;
    this.foeRoster = undefined;
    this.foeTotal = 1;
    this.barCd = 0;
    this.slowmoLeft = 0;
    this.spotVictim = undefined;
    this.arena = { ...ARENA };
    this.lane = { ...LANE };
    this.economy = { gold: data.economy?.gold ?? storage.load('save')?.gold ?? 0 };
  }

  create() {
    // a cena e reentrante: zoom e escala de tempo da batalha anterior ficariam
    // grudados no gerenciador, e a wave nova comecaria em camera lenta ampliada
    this.cameras.main.setZoom(1).centerOn(960, 540);
    this.tweens.timeScale = 1;
    this.cameras.main.fadeIn(320, 126, 209, 245);
    this.waveManager = new WaveManager(waves as any);
    const field = this.layoutField();
    buildRanch(this, {
      horizon: 320, arena: true, shape: 'field',
      arenaY: field.cy, arenaW: field.w, arenaH: field.h, clouds: true
    });
    this.relicSystem = new RelicSystem(storage.load('relics') || []);

    this.buildHeader();
    this.spawnDudes();

    if (this.dudes.length === 0) {
      this.emptyRanch();
      return;
    }

    this.enemies = this.waveManager.spawn(this, this.wave, {
      minX: this.foeBand.minX, maxX: this.foeBand.maxX,
      minY: this.arena.minY, maxY: this.arena.maxY - 8
    });

    this.combat = new CombatSystem(this, this.dudes, this.enemies, {
      dudeAtkMult: 1 + this.relicSystem.attackBonus(),
      enemyDmgMult: 1 - this.relicSystem.defenseBonus(),
      arena: this.arena,
      hooks: {
        onRanged: (a, t, dmg, tint, onHit) => this.fireBolt(a, t, dmg, tint, onHit),
        onSummon: s => this.tintSummon(s),
        onFinalBlow: (victim, won) => this.slowmoKill(victim, won),
        onEnd: won => this.finishBattle(won)
      }
    });

    this.buildRelicControls();
    this.openRites();
    this.buildTickBars();
    this.battleActive = true;
    this.bindInput();
  }

  /**
   * UMA CAPSULA DE TINTA NO AR.
   *
   * A flecha PRECISA saber quem atirou: metade dos tracos do jogo se resolve no
   * instante do impacto (o gelo do lich, a raiz do burocrata, o troco do caixa) e
   * quem mata de longe tem que levar o credito do abate. Antes disto o projetil
   * saia anonimo e o vampiro nunca engordava com as proprias flechas.
   *
   * A cor vem do traco de quem atirou, entao da para ler o campo de longe: se a
   * capsula voa azul, alguem vai congelar.
   */
  private fireBolt(
    a: Fighter, t: Fighter, dmg: number,
    tint?: number, onHit?: (target: Fighter, dealt: number) => void
  ): void {
    const p = new Projectile(this, a.x, a.y - a.visualHeight * 0.5, t, dmg, 900, a, onHit);
    if (tint !== undefined) p.paint(tint);
    this.projectiles.push(p);
  }

  update(_time: number, delta: number): void {
    // a rampa roda ANTES do early-out: o golpe final derruba `battleActive` no
    // mesmo frame que liga a camera lenta, e o tempo ficaria preso em 0.22
    if (this.slowmoLeft > 0) this.rampSlowmo(delta);
    if (!this.battleActive) return;
    this.combat?.update(delta);
    this.rites?.step(delta);
    if (this.projectiles.length) {
      const dt = Math.min(delta, 60) / 1000;
      for (const p of this.projectiles) p.step(dt);
      this.projectiles = this.projectiles.filter(p => p.active);
    }
    this.barCd -= delta;
    if (this.barCd <= 0) { this.barCd = 120; this.refreshBars(); }
  }

  /**
   * O TOPO, DISCRETO. Antes a informacao morava num pill de 640px no rodape que
   * cortava a arena no meio. Agora sao DUAS BARRAS SIMPLES nos cantos de cima —
   * a sua vida somada na esquerda, a da horda espelhada na direita — e a wave no
   * meio, sem painel atras: HUD que encosta na moldura da tela e sai da frente
   * dos caras.
   */
  private buildHeader(): void {
    statPill(this, 960, 46, `WAVE ${this.wave}`, GOLD, 230, 46, INK).setDepth(2000);
    label(this, 960, 92, this.waveManager.headline(this.wave), 21, PAPER, true).setDepth(2000);
  }

  /**
   * UM TRAÇO POR CARA.
   *
   * Aqui morreu a barra somada. Ela era a origem do "quando 1 cara morre os
   * outros tambem": existia UMA barra para o exercito inteiro, entao qualquer
   * morte fazia "a" vida do jogador despencar na tela. A vida sempre foi
   * individual no codigo (cada `Fighter` guarda o seu `hp`) — o que faltava era
   * a tela contar isso.
   *
   * Agora e uma pilha: uma fileira por tipo, um retrato, e um traço por CORPO.
   * O traço enche com a vida daquele cara e esvazia oco quando ele cai. A horda
   * do outro lado, em vermelho, com o placar de mortos embaixo.
   */
  private buildTickBars(): void {
    this.foeTotal = Math.max(1, this.enemies.length);

    this.armyRoster = new TickRoster(this, { x: 44, y: 44, side: 'left' });
    this.foeRoster = new TickRoster(this, { x: 1876, y: 44, side: 'right', tint: RED });
    this.refreshBars();
  }

  /** Uma fileira por tipo de cara, na ordem em que a formacao os pos em campo. */
  private groupDudes(): TickGroup[] {
    const out: TickGroup[] = [];
    const seen = new Map<string, TickGroup>();
    for (const d of this.dudes) {
      const id = d.dudeData.id;
      let g = seen.get(id);
      if (!g) {
        g = { art: dudeKey(id), kind: 'dude', ratios: [] };
        seen.set(id, g);
        out.push(g);
      }
      g.ratios.push(d.maxHp > 0 ? d.hp / d.maxHp : 0);
    }
    return out;
  }

  /** O mesmo para a horda: uma fileira por especie que pisou nesta wave. */
  private groupFoes(): TickGroup[] {
    const out: TickGroup[] = [];
    const seen = new Map<string, TickGroup>();
    for (const e of this.enemies) {
      let g = seen.get(e.type);
      if (!g) {
        g = { art: enemyKey(e.type), kind: 'enemy', ratios: [] };
        seen.set(e.type, g);
        out.push(g);
      }
      g.ratios.push(e.maxHp > 0 ? e.hp / e.maxHp : 0);
    }
    return out;
  }

  private refreshBars(): void {
    if (!this.armyRoster || !this.foeRoster) return;

    this.armyRoster.set(this.groupDudes());
    let up = 0;
    for (const d of this.dudes) if (d.isAlive()) up++;
    const pets = this.combat?.summons.filter(s => s.isAlive()).length ?? 0;
    this.armyRoster.setFooter(`DE PE ${up}/${this.dudes.length}${pets ? `  +${pets} INVOCADOS` : ''}`);

    this.foeRoster.set(this.groupFoes());
    let foes = 0;
    for (const e of this.enemies) if (e.isAlive()) foes++;
    this.foeRoster.setFooter(`MORTOS ${this.foeTotal - foes}/${this.foeTotal}`);
  }

  /**
   * O ULTIMO A CAIR, EM CAMERA LENTA.
   *
   * Escala apenas `tweens.timeScale` — NUNCA `time.timeScale`. As transicoes de
   * cena vivem em `time.delayedCall`, e desacelerar o relogio faria a batalha
   * acabar num tempo diferente do que o codigo promete. A camera empurra pra
   * dentro do corpo (efeito proprio de camera, imune ao timeScale, entao o
   * movimento continua firme enquanto o mundo arrasta).
   */
  private slowmoKill(victim: Fighter, won: boolean): void {
    this.tweens.timeScale = SLOWMO_SCALE;
    this.slowmoLeft = SLOWMO_MS;

    const cam = this.cameras.main;
    // a moldura ampliada nao pode passar da borda do mundo: o cenario acaba em
    // 1920x1080 e um zoom na beirada revelaria vazio
    const halfW = 960 / SLOWMO_ZOOM, halfH = 540 / SLOWMO_ZOOM;
    cam.zoomTo(SLOWMO_ZOOM, 420, 'Cubic.easeOut');
    cam.pan(
      Phaser.Math.Clamp(victim.x, halfW, 1920 - halfW),
      Phaser.Math.Clamp(victim.hitY, halfH, 1080 - halfH),
      420, 'Cubic.easeOut'
    );
    cam.flash(110, 255, 255, 255);
    this.spotVictim = victim;
    this.spotlight(victim, true);
    victim.deathBlow();
    shoutText(this, victim.x, victim.hitY - 74, won ? 'O ULTIMO!' : 'CAIU!', won ? GOLD : RED, 56);
  }

  /**
   * O HOLOFOTE DO GOLPE FINAL.
   *
   * A camera empurra pra dentro do corpo — mas o corpo cai DENTRO da multidao, e
   * com trinta caras em volta a peca mais importante do jogo (o ultimo inimigo
   * rodando no ar) ficava escondida atras de um ombro. Medido em tela: no zoom de
   * 1.34 a vitima era um borrao vermelho entre ombros amarelos.
   *
   * Entao o mundo apaga e a vitima sobe pra frente de tudo. Uma silhueta limpa
   * contra um fundo abafado, que e exatamente o que a arte deste jogo promete.
   */
  private spotlight(victim: Fighter, on: boolean): void {
    for (const f of [...this.dudes, ...this.enemies]) {
      if (f === victim) continue;
      // caido ja vive em 0.55: voltar todo mundo pra 1 acenderia os defuntos
      this.tweens.add({
        targets: f, alpha: on ? 0.34 : (f.isAlive() ? 1 : 0.55),
        duration: on ? 150 : 200
      });
    }
    victim.pinDepth = on ? 9000 : 0;
    victim.setAlpha(1);
  }

  private rampSlowmo(delta: number): void {
    this.slowmoLeft -= delta;
    if (this.slowmoLeft <= 0) {
      this.slowmoLeft = 0;
      this.tweens.timeScale = 1;
      return;
    }
    // cubica: segura o arrasto quase todo o tempo e devolve a velocidade no fim
    const t = Phaser.Math.Clamp(1 - this.slowmoLeft / SLOWMO_MS, 0, 1);
    this.tweens.timeScale = Phaser.Math.Linear(SLOWMO_SCALE, 1, t * t * t);
  }

  /** Desfaz o empurrao de camera (revive: a briga continua). */
  private resetCamera(): void {
    this.slowmoLeft = 0;
    this.tweens.timeScale = 1;
    // o holofote tem que apagar junto: a briga volta e ninguem luta a 34% de alpha
    if (this.spotVictim) { this.spotlight(this.spotVictim, false); this.spotVictim = undefined; }
    this.cameras.main.zoomTo(1, 300, 'Cubic.easeOut');
    this.cameras.main.pan(960, 540, 300, 'Cubic.easeOut');
  }

  private emptyRanch(): void {
    panelImage(this, 960, 600, 620, 220, { fill: PAPER, radius: 28 }).setDepth(3000);
    label(this, 960, 555, 'SEU RANCHO ESTA VAZIO', 32, RED, true).setDepth(3001);
    label(this, 960, 615, 'Volte para a loja e recrute pelo menos um cara.', 21, INK).setDepth(3001);
    new ComicButton(this, 960, 680, 290, 66, 'VOLTAR A LOJA', () => {
      this.scene.start('Shop', {
        wave: this.wave, inventory: this.dudesData,
        trained: this.trained, snack: this.snack, economy: this.economy
      });
    }, { fill: ORANGE, size: 25 }).container.setDepth(3002);
  }

  /**
   * O CORRAL CRESCE COM A HORDA — E COM O EXERCITO.
   *
   * Um corral de 1856px com 6 pirralhos e 3 caras era 80% de terra vazia: a
   * primeira tela do jogo parecia um estacionamento, e as duas tropas gastavam
   * dois segundos marchando por nada. A wave 31, com 277 bichos, precisa dos
   * 1856px inteiros. Entao TODA a geometria — corral, faixas de papel e banda de
   * spawn — sai da contagem de CORPOS da wave.
   *
   * O exercito entra na conta com peso maior que um bicho: depois que o rancho
   * fecha ele empilha copias e chega a 160 caras, e um corral dimensionado so
   * pela horda esmagava a tropa toda contra a borda esquerda.
   */
  private layoutField(): { w: number; h: number; cy: number } {
    const foes = this.waveManager.getWave(this.wave).enemies.reduce((n, e) => n + e.count, 0);
    const army = Math.max(1, this.dudesData.length);
    const t = Phaser.Math.Clamp((foes + army * 1.4 - 12) / 240, 0, 1);
    const w = Math.round(Phaser.Math.Linear(1180, 1856, t));
    const h = Math.round(Phaser.Math.Linear(520, 736, t));
    const cx = 960, cy = 690;

    this.arena = {
      minX: cx - w / 2 + 66,
      maxX: cx + w / 2 - 66,
      // teto: cabeca de cara nao entra na cerca. piso: a borda de baixo da tela
      minY: Math.max(cy - h / 2 + 40, 400),
      maxY: Math.min(cy + h / 2 - 44, 1012)
    };
    const tank = cx - w * 0.06;
    this.lane = { Tank: tank, DPS: tank - LANE_GAP, Support: tank - LANE_GAP * 2 };
    // 72px de recuo na direita: o centro de um urso polar em maxX deixaria
    // metade do bicho fora da tela antes do primeiro passo do motor
    this.foeBand = { minX: cx + w * 0.02, maxX: this.arena.maxX - 72 };
    return { w, h, cy };
  }

  /**
   * UM BLOCO SO, ordenado por papel: tanque na frente para segurar o aggro, DPS
   * no meio, suporte no fundo. O `taunt` do CombatSystem depende dessa ordem.
   *
   * NAO existe mais uma grade por papel. Faixas separadas davam a cada papel a
   * sua propria contagem de linhas, e com o rancho fechado em cinco tipos o
   * normal e 21 copias num papel e UMA em cada outro: o tanque virava uma parede
   * de seis linhas e o DPS e o suporte ficavam dois bonecos em fila indiana atras,
   * sozinhos na terra vazia (medido em tela na wave 13). Agora a tropa e uma
   * grade unica preenchida da frente para o fundo; como a lista vem ordenada por
   * papel, o tanque ocupa as colunas da frente POR CONSTRUCAO e ninguem sobra.
   */
  private spawnDudes(): void {
    const ORDER: Record<string, number> = { Tank: 0, DPS: 1, Support: 2 };
    const troop = [...this.dudesData]
      .sort((a, b) => (ORDER[a.role] ?? 1) - (ORDER[b.role] ?? 1));

    const midY = (this.arena.minY + this.arena.maxY) / 2;
    const span = this.arena.maxY - this.arena.minY;

    // linhas crescem com a tropa (teto 11, como a horda); o passo entre colunas
    // sai da LARGURA QUE SOBRA no corral, entao 160 corpos cabem por construcao
    // em vez de serem empilhados na borda pelo `Clamp`
    const ideal = Phaser.Math.Clamp(Math.round(Math.sqrt(troop.length * 1.6)), 2, 11);
    /**
     * ...e a contagem de linhas escorrega ate a coluna do fundo FECHAR. Com 25
     * caras em 6 linhas sobra 24+1: o vigesimo quinto corpo abre uma coluna
     * inteira para ele so e vira um boneco solto na quina da multidao. 5 linhas
     * fecham um 5x5 exato. Vale para o exercito estourado tambem: 160 em 11
     * linhas deixa 6 sobrando, em 10 fecha 16 colunas cheias.
     */
    const rows = [ideal, ideal - 1, ideal + 1]
      .filter(r => r >= 2 && r <= 11)
      .sort((a, b) => {
        const empty = (r: number) => (troop.length % r === 0 ? 0 : r - (troop.length % r));
        return empty(a) - empty(b) || Math.abs(a - ideal) - Math.abs(b - ideal);
      })[0];
    const cols = Math.max(1, Math.ceil(troop.length / rows));
    const room = Math.max(240, this.lane.Tank - (this.arena.minX + 30));
    const colGap = Phaser.Math.Clamp(room / cols, 42, COL_GAP);
    const rowGap = Math.min(ROW_GAP, (span - 50) / Math.max(1, rows - 1));
    const y0 = midY - ((rows - 1) * rowGap) / 2;

    // as faixas passam a valer a posicao REAL de cada papel no bloco
    this.lane = {
      Tank: this.lane.Tank,
      DPS: this.lane.Tank - Math.floor(cols / 2) * colGap,
      Support: this.lane.Tank - (cols - 1) * colGap
    };

    // a coroa afrouxa o limiar de sinergia em um cara (RelicSystem.hasCrown)
    const slack = this.relicSystem.hasCrown() ? 1 : 0;

    troop.forEach((d, n) => {
      const col = Math.floor(n / rows);
      const px = this.lane.Tank - col * colGap + wobble(n * 3 + col, 14);
      const py = y0 + (n % rows) * rowGap + (col % 2) * (rowGap / 2) + wobble(n * 7 + col, 9);
      const hpBonus = calculateHpBonus(this.dudesData, d.family, slack);
      // treino permanente + lanche da rodada entram AQUI: o motor de combate
      // nunca precisa saber que treinador e cara do lanche existem
      const dude = new Dude(
        this,
        Phaser.Math.Clamp(px, this.arena.minX, this.arena.maxX),
        Phaser.Math.Clamp(py, this.arena.minY, this.arena.maxY),
        battleStats(d, this.trained, this.snack), hpBonus
      );
      // sinergia de familia entra no atk base — o motor le apenas `atk`
      dude.atk = Math.round(dude.atk * (1 + calculateSynergyBonus(this.dudesData, d.family, slack)));
      this.applyRelics(dude);
      idleBob(this, dude, 3, 900 + Math.random() * 300);
      this.dudes.push(dude);
    });
  }

  /** Esqueletos invocados ficam esbranquicados para se distinguirem do exercito. */
  private tintSummon(s: Fighter): void {
    s.setTint(0xd8e6f2);
    s.setAlpha(0.95);
  }

  /**
   * As reliquias PASSIVAS entram no corpo do cara na hora do spawn, nunca no
   * motor de combate: o CombatSystem ja le `attackSpeed`, `moveSpeed`, `range` e
   * `kit.regen` de cada lutador, entao ampulheta, pena, luneta e coracao viram
   * numeros no boneco e o motor nao precisa saber que reliquia existe. Espada e
   * escudo continuam nos multiplicadores globais (`dudeAtkMult`/`enemyDmgMult`).
   *
   * As reliquias de CLASSE nao passam por aqui: elas nao sao numeros, sao
   * acontecimentos ("quando um inimigo cai", "quando sobrar um so"). Ver `openRites`.
   */
  private applyRelics(dude: Dude): void {
    const rs = this.relicSystem;
    const as = rs.attackSpeedBonus();
    if (as > 0) dude.attackSpeed *= 1 + as;
    const ms = rs.moveSpeedBonus();
    if (ms > 0) dude.moveSpeed *= 1 + ms;
    const rg = rs.rangeBonus();
    if (rg > 0) dude.range += rg;
    const regen = rs.regenPerSecond();
    if (regen > 0) dude.kit = { ...dude.kit, regen: dude.kit.regen + regen };
  }

  /**
   * OS RITUAIS DE CLASSE ABREM A BRIGA.
   *
   * Tem que ser DEPOIS de `spawnDudes` e de `waveManager.spawn` — o ritual conta
   * corpos nas duas listas e precisa que as duas existam — e depois de
   * `buildRelicControls`, porque a corneta acende o `CARGA!` na tela e o cartaz do
   * meteoro nao pode nascer em cima dele. Se o jogador nao tiver nenhuma das seis,
   * `RelicRites.idle` deixa tudo isto de graca.
   *
   * O grito e o anel sao emprestados: o ritual e testavel justamente por nao
   * conhecer nem Phaser nem `fx.ts`, entao quem desenha e a cena.
   */
  private openRites(): void {
    const at = (b: RiteBody) => b as Fighter;
    this.rites = new RelicRites(this.dudes, this.enemies, riteConfig(this.relicSystem), {
      shout: (b, text, tint) => shoutText(this, at(b).x, at(b).hitY - 18, text, tint, 30),
      burst: (b, tint) => shockRing(this, at(b).x, at(b).hitY, 170, tint)
    });
    this.rites.open();
  }

  /**
   * A BOMBA: 50 de dano em area a cada 10s, sem clique. E a irma preguicosa do
   * meteoro — mesma explosao, mira automatica no aglomerado mais gordo de
   * inimigos, para que a reliquia funcione enquanto o jogador so assiste.
   */
  private startBomb(): void {
    if (!this.relicSystem.hasBomb()) return;
    this.time.addEvent({
      delay: 10000, loop: true, callback: () => {
        if (!this.battleActive) return;
        const alive = this.enemies.filter(e => e.isAlive());
        if (alive.length === 0) return;
        // alvo = inimigo com mais vizinhos dentro do raio (o miolo da horda)
        let best = alive[0], bestN = -1;
        for (const e of alive) {
          let n = 0;
          for (const o of alive) if (Phaser.Math.Distance.Between(e.x, e.y, o.x, o.y) < 170) n++;
          if (n > bestN) { bestN = n; best = e; }
        }
        const dmg = this.relicSystem.bombDamage();
        for (const e of alive) {
          if (Phaser.Math.Distance.Between(best.x, best.y, e.x, e.y) < 170) e.hurt(dmg);
        }
        shockRing(this, best.x, best.y, 300, ORANGE);
        this.cameras.main.shake(160, 0.006);
      }
    });
  }

  private buildRelicControls(): void {
    this.startBomb();
    if (!this.relicSystem.hasMeteor()) return;
    statPill(this, 960, 1020, 'METEORO  ·  CLIQUE NA ARENA', ORANGE, 460, 48, PAPER).setDepth(2000);
    const meteorHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.battleActive) return;
      const damage = this.relicSystem.meteorDamage();
      let hits = 0;
      for (const enemy of this.enemies) {
        if (!enemy.isAlive()) continue;
        if (Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, enemy.x, enemy.y) < 170) {
          enemy.hurt(damage);
          hits++;
        }
      }
      const ring = this.add.image(pointer.worldX, pointer.worldY, 'fx_ring').setDisplaySize(230, 230).setDepth(pointer.worldY + 60);
      this.tweens.add({ targets: ring, scale: 1.7, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
      if (hits) { try { if (this.cache.audio.exists('meteor')) this.sound.play('meteor', { volume: 0.6 }); } catch {} }
    };
    this.input.on('pointerdown', meteorHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', meteorHandler));
  }

  private bindInput(): void {
    const muteHandler = () => {
      this.sound.mute = !this.sound.mute;
      toast(this, this.sound.mute ? 'SOM DESLIGADO' : 'SOM LIGADO', 960, 120, false);
    };
    this.input.keyboard?.on('keydown-M', muteHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-M', muteHandler);
      this.tweens.timeScale = 1;
      this.projectiles.forEach(p => p.destroy());
      this.projectiles = [];
      this.armyRoster?.destroy();
      this.foeRoster?.destroy();
      this.combat?.destroy();
    });
  }

  /**
   * O FIM DA BRIGA, EM TRES TEMPOS: o golpe final em camera lenta (ja disparado
   * pelo `onFinalBlow`), o cartaz quando o tempo volta ao normal, e so depois a
   * troca de cena. Escrever "VITORIA!" no meio da tela ampliada jogaria o cartaz
   * fora do quadro e roubaria a unica coisa que o jogador quer ver.
   */
  private finishBattle(won: boolean): void {
    // reliquia de revive: uma segunda chance antes de encerrar
    if (!won && !this.hasRevived && this.relicSystem.hasRevive() && this.combat?.reviveOne(0.5)) {
      this.hasRevived = true;
      this.combat.running = true;
      this.resetCamera();
      toast(this, 'REVIVE! UM CARA VOLTOU', 960, 450, false);
      return;
    }
    if (!this.battleActive) return;
    this.battleActive = false;
    this.refreshBars();

    const hold = Math.max(0, this.slowmoLeft);
    this.time.delayedCall(hold, () => {
      /**
       * O HOLOFOTE TEM QUE APAGAR AQUI.
       *
       * `slowmoKill` abaixa TODO o campo pra 34% de alpha para destacar o ultimo
       * a cair — e nada acendia a luz de volta. Resultado: no exato segundo em
       * que o jogador olha o placar, o exercito inteiro aparecia apagado atras do
       * cartaz, como se tivesse sumido junto com o defunto. Some com a soma da
       * barra, era a segunda metade da mentira "morreu um, morreram todos".
       */
      if (this.spotVictim) { this.spotlight(this.spotVictim, false); this.spotVictim = undefined; }
      this.cameras.main.zoomTo(1, 260, 'Cubic.easeOut');
      this.cameras.main.pan(960, 540, 260, 'Cubic.easeOut');
      label(this, 960, 450, won ? 'VITORIA!' : 'DERROTA!', 76, won ? GREEN : RED, true).setDepth(4000);
      if (won) this.cameras.main.flash(300, 78, 201, 90);
      else this.cameras.main.shake(400, 0.015);
    });

    this.time.delayedCall(hold + 850, () => {
      this.projectiles.forEach(p => p.destroy());
      this.projectiles = [];
      this.scene.start(won ? 'Reward' : 'GameOver', {
        wave: this.wave,
        victory: won,
        dudesData: this.dudesData,
        // o treino e permanente e atravessa a run; o lanche morreu nesta batalha
        trained: this.trained,
        // o troco que o caixa arrancou durante a briga
        bonusGold: this.combat?.bonusGold ?? 0,
        // estrela de ouro: vencer sem perder nenhum cara
        noDeath: this.dudes.every(d => d.isAlive())
      });
    });
  }
}
