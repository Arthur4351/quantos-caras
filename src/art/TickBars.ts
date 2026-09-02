import Phaser from 'phaser';
import { shapeImage, shapeTexture } from './bakery';
import { OUTLINE } from './ink';
import { INK, PAPER, WHITE, GREEN, GOLD, RED } from './palette';
import { label } from './UIKit';

/**
 * OS TRAÇOS.
 *
 * A batalha tinha UMA barra para o exercito inteiro: a vida somada de todos os
 * caras num tubo de 340px. Quando um cara morria, "a" barra caia — e a tela
 * dizia, com toda a clareza, que a tropa tem uma vida so. O jogador leu
 * exatamente o que estava escrito: "quando 1 cara morre os outros tambem".
 *
 * Aqui cada CORPO tem o seu traço. Uma fileira por tipo, um retrato na frente,
 * e depois um traço por cara: cheio quando esta inteiro, meio quando esta pela
 * metade, oco quando caiu. Nada de soma. A horda ganha a mesma fileira do outro
 * lado, em vermelho.
 */

/** Teto de traços por fileira. Acima disso cada traço vira um GRUPO e a fileira ganha `xN`. */
const TICK_MAX = 18;
/** Recorte da cabeca no gabarito do dude (168x184): quadrado de 86 centrado em (84,87). */
const HEAD_CROP = { x: 41, y: 44, s: 86 };
/** Altura da pilula de resumo no pe da pilha. */
const FOOT_H = 44;

/**
 * DOIS TAMANHOS, ESCOLHIDOS PELA ALTURA DA PILHA.
 *
 * O rancho cabe cinco tipos (`SQUAD_TYPES`), entao a coluna do jogador nunca
 * passa de cinco fileiras e pode ser generosa. A horda nao: na wave 100 estao os
 * oito bichos do roster MAIS o chefe, nove fileiras. No tamanho grande isso
 * desceria ate 480 — dentro da arena, em cima dos caras brigando. A pilha
 * aperta em vez de invadir o campo.
 *
 * O ORCAMENTO VERTICAL, que decide `rowH`: a pilha nasce em y=44 e o chao da
 * arena comeca em 440, com a pilula de resumo (44) e uma folga no meio. Nove
 * fileiras cabem em `(440 - 16 - 44 - 44 - 8) / 9 = 36`.
 *
 * E a MOLDURA: o quadro do retrato tem `portrait + outline*2` de tinta, entao
 * `rowH` precisa passar disso — senao os retratos encavalam. Com 36 de altura e
 * contorno de 6 nao cabe retrato nenhum de 26; por isso o tamanho apertado usa
 * traço fino, que e o peso de linha certo para um rosto de 26px de qualquer jeito.
 */
interface Tier { rowH: number; portrait: number; outline: number; tickW: number; tickH: number; gap: number; font: number; }
const WIDE: Tier = { rowH: 52, portrait: 36, outline: 6, tickW: 20, tickH: 28, gap: 5, font: 20 };
const TIGHT: Tier = { rowH: 36, portrait: 26, outline: 4, tickW: 16, tickH: 20, gap: 4, font: 17 };
/** Acima de cinco fileiras a pilha muda de marcha. */
const TIER_SWITCH = 5;

export interface TickGroup {
  /** Key da textura do retrato (`dude_x` / `enemy_x`). */
  art: string;
  kind: 'dude' | 'enemy';
  /** Vida de cada corpo, 0..1. UM item = UM cara. */
  ratios: number[];
}

export interface TickRosterOpts {
  x: number;
  y: number;
  side?: 'left' | 'right';
  /** Cor fixa dos traços. Sem cor fixa, cada traço se pinta pela propria vida. */
  tint?: number;
  depth?: number;
}

/** Soquete vazio + preenchimento, assados uma vez por tamanho. */
function tickKeys(scene: Phaser.Scene, t: Tier): { socket: string; fill: string } {
  const o = t.outline;
  const socket = `tick_socket_${t.tickW}x${t.tickH}_${o}`;
  const r = Math.round(t.tickH * 0.22);
  shapeTexture(scene, socket, t.tickW + o * 2 + 4, t.tickH + o * 2 + 4, g => {
    g.fillStyle(INK, 1);
    g.fillRoundedRect(-t.tickW / 2 - o, -t.tickH / 2 - o, t.tickW + o * 2, t.tickH + o * 2, r + o);
    g.fillStyle(0x2a2a38, 1);
    g.fillRoundedRect(-t.tickW / 2, -t.tickH / 2, t.tickW, t.tickH, r);
  });
  // sem padding: a origem (0,0.5) tem que cair EXATAMENTE na borda do traço
  const fill = `tick_fill_${t.tickW}x${t.tickH}`;
  shapeTexture(scene, fill, t.tickW, t.tickH, g => {
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(0, 0, t.tickW, t.tickH, r);
    g.fillStyle(WHITE, 0.55);
    g.fillRoundedRect(2, 2, t.tickW - 4, t.tickH * 0.34, Math.max(2, r - 2));
  }, false);
  return { socket, fill };
}

/** Moldura do retrato. */
function frameKey(scene: Phaser.Scene, size: number, o: number): string {
  const key = `tick_portrait_${size}_${o}`;
  shapeTexture(scene, key, size + o * 2 + 4, size + o * 2 + 4, g => {
    g.fillStyle(INK, 1);
    g.fillRoundedRect(-size / 2 - o, -size / 2 - o, size + o * 2, size + o * 2, 9 + o);
    g.fillStyle(PAPER, 1);
    g.fillRoundedRect(-size / 2, -size / 2, size, size, 9);
  });
  return key;
}

/** Uma fileira: retrato + traços + o `xN` do agrupamento. */
class TickRow {
  private frame: Phaser.GameObjects.Image;
  private face?: Phaser.GameObjects.Image;
  private sockets: Phaser.GameObjects.Image[] = [];
  private fills: Phaser.GameObjects.Image[] = [];
  private packLabel?: Phaser.GameObjects.Text;
  private art = '';

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    private y: number,
    private dir: 1 | -1,
    private t: Tier,
    private tint?: number
  ) {
    this.frame = scene.add.image(dir * (t.portrait / 2 + 2), y, frameKey(scene, t.portrait, t.outline));
    container.add(this.frame);
  }

  /** Onde nasce o traço `i`. O lado direito espelha tudo com `dir = -1`. */
  private tickX(i: number): number {
    const t = this.t;
    // 6px de folga entre a tinta da moldura e a tinta do primeiro traço
    const first = t.portrait + 2 + t.outline * 2 + 6 + t.tickW / 2;
    return this.dir * (first + i * (t.tickW + t.gap));
  }

  private growTo(n: number): void {
    const { socket, fill } = tickKeys(this.scene, this.t);
    while (this.sockets.length < n) {
      const i = this.sockets.length;
      const s = this.scene.add.image(this.tickX(i), this.y, socket);
      // o preenchimento drena PARA fora: os dois lados esvaziam em direcao ao centro
      const f = this.scene.add.image(this.tickX(i) - this.dir * (this.t.tickW / 2), this.y, fill)
        .setOrigin(this.dir === 1 ? 0 : 1, 0.5);
      this.container.add([s, f]);
      this.sockets.push(s);
      this.fills.push(f);
    }
  }

  set(group: TickGroup): void {
    if (group.art !== this.art) {
      this.art = group.art;
      this.face?.destroy();
      this.face = this.buildFace(group);
      if (this.face) this.container.add(this.face);
    }

    const n = Math.max(1, group.ratios.length);
    // acima do teto, cada traço passa a valer `per` corpos e a fileira diz isso
    const per = Math.ceil(n / TICK_MAX);
    const slots = Math.ceil(n / per);
    this.growTo(slots);

    for (let i = 0; i < this.sockets.length; i++) {
      const on = i < slots;
      this.sockets[i].setVisible(on);
      this.fills[i].setVisible(on);
      if (!on) continue;
      let sum = 0, bodies = 0;
      for (let k = i * per; k < Math.min(n, (i + 1) * per); k++) { sum += group.ratios[k] ?? 0; bodies++; }
      const r = bodies ? Phaser.Math.Clamp(sum / bodies, 0, 1) : 0;
      this.fills[i].setScale(r, 1).setVisible(r > 0.004);
      this.fills[i].setTint(this.tint ?? (r > 0.55 ? GREEN : r > 0.25 ? GOLD : RED));
    }

    const packText = per > 1 ? `x${per}` : '';
    if (packText && !this.packLabel) {
      // na COR da fileira, nao em creme: no lado da horda esse `xN` cai em cima do
      // ceu, e um numero pálido ali vira uma nuvem com numero em vez do fim do traço
      this.packLabel = label(this.scene, 0, this.y, '', this.t.font, this.tint ?? GOLD, true);
      this.container.add(this.packLabel);
    }
    if (this.packLabel) {
      this.packLabel.setText(packText)
        .setPosition(this.tickX(slots - 1) + this.dir * (this.t.tickW / 2 + 20), this.y)
        .setVisible(!!packText);
    }
  }

  /**
   * O RETRATO E UM ROSTO, NAO UMA MINIATURA DO CORPO.
   *
   * A primeira versao encaixava o bicho INTEIRO no quadro: o chefe (264x340) saia
   * com 20x26 pixels dentro de uma moldura de 44 — um borrao cinza que nao dizia
   * qual bicho era. O dude sempre teve recorte de cabeca; a horda passa a ter o
   * mesmo tratamento. Quadrado de lado `min(w,h)` colado no TOPO da textura, que e
   * onde mora a cabeca de todo bicho do roster, e ele preenche a moldura.
   *
   * O deslocamento: o Phaser mantem a origem no centro do QUADRO da textura, entao
   * um recorte fora do centro aparece torto. `(alturaDoQuadro/2 - centroDoRecorte)`
   * vezes a escala devolve o recorte para o meio da moldura.
   */
  private buildFace(group: TickGroup): Phaser.GameObjects.Image | undefined {
    if (!this.scene.textures.exists(group.art)) return undefined;
    const src = this.scene.textures.get(group.art).getSourceImage();
    const size = this.t.portrait;
    const crop = group.kind === 'dude'
      ? HEAD_CROP
      : { x: Math.round((src.width - Math.min(src.width, src.height)) / 2), y: 0, s: Math.min(src.width, src.height) };
    const scale = size / crop.s;
    const img = this.scene.add.image(
      this.frame.x + (src.width / 2 - (crop.x + crop.s / 2)) * scale,
      this.y + (src.height / 2 - (crop.y + crop.s / 2)) * scale,
      group.art
    ).setScale(scale);
    img.setCrop(crop.x, crop.y, crop.s, crop.s);
    return img;
  }

  setVisible(v: boolean): void {
    this.frame.setVisible(v);
    this.face?.setVisible(v);
    if (!v) {
      this.sockets.forEach(s => s.setVisible(false));
      this.fills.forEach(f => f.setVisible(false));
      this.packLabel?.setVisible(false);
    }
  }
}

/**
 * A pilha de fileiras num canto. Cresce e encolhe sozinha, reaproveitando os
 * objetos entre atualizacoes — isso roda a cada 120ms com ate nove fileiras de
 * dezoito traços.
 */
export class TickRoster {
  private container: Phaser.GameObjects.Container;
  private rows: TickRow[] = [];
  private dir: 1 | -1;
  /** Escolhido na primeira `set` e fixo dali em diante: o elenco nao muda no meio da briga. */
  private tier?: Tier;
  private footBg?: Phaser.GameObjects.Image;
  private footLabel?: Phaser.GameObjects.Text;
  private footW = 0;

  constructor(private scene: Phaser.Scene, private o: TickRosterOpts) {
    this.dir = o.side === 'right' ? -1 : 1;
    this.container = scene.add.container(o.x, o.y).setDepth(o.depth ?? 2000).setScrollFactor(0);
  }

  set(groups: TickGroup[]): void {
    const t = this.tier ??= groups.length > TIER_SWITCH ? TIGHT : WIDE;
    while (this.rows.length < groups.length) {
      this.rows.push(new TickRow(
        this.scene, this.container, this.rows.length * t.rowH, this.dir, t, this.o.tint
      ));
    }
    this.rows.forEach((row, i) => {
      if (i < groups.length) { row.setVisible(true); row.set(groups[i]); }
      else row.setVisible(false);
    });
  }

  /**
   * A LINHA DE RESUMO E UMA PILULA, NAO UM SUSSURRO.
   *
   * `MORTOS 0/653` era texto solto e caia exatamente onde a horda da wave 100
   * encosta na cerca: creme com contorno em cima de ursos polares brancos. A pilha
   * inteira e feita de tinta e chapado — o rodape tambem. A largura e assada em
   * passos de 20px, entao a run usa meia duzia de texturas em vez de uma por numero.
   */
  setFooter(text: string): void {
    const t = this.tier ?? WIDE;
    const y = Math.max(1, this.rows.length) * t.rowH + 4 + FOOT_H / 2;
    if (!this.footLabel) {
      this.footLabel = label(this.scene, 0, y, text, 24, this.o.tint ? PAPER : INK);
      this.container.add(this.footLabel);
    }
    this.footLabel.setText(text);
    const need = Math.ceil((this.footLabel.width + 46) / 20) * 20;
    if (need !== this.footW) {
      this.footW = need;
      this.footBg?.destroy();
      const fill = this.o.tint ?? PAPER;
      const r = FOOT_H / 2;
      this.footBg = shapeImage(this.scene, 0, 0, `tick_foot_${need}_${fill}`, need, FOOT_H, g => {
        g.fillStyle(INK, 1);
        g.fillRoundedRect(-need / 2 - OUTLINE / 2, -r - OUTLINE / 2, need + OUTLINE, FOOT_H + OUTLINE, r + OUTLINE / 2);
        g.fillStyle(fill, 1);
        g.fillRoundedRect(-need / 2, -r, need, FOOT_H, r);
        g.fillStyle(WHITE, 0.28);
        g.fillRoundedRect(-need / 2 + 6, -r + 5, need - 12, FOOT_H * 0.32, r * 0.5);
      });
      this.container.add(this.footBg);
      this.container.bringToTop(this.footLabel);
    }
    // a pilula encosta na borda de FORA da moldura do retrato, o mesmo prumo da pilha
    const cx = this.dir * (this.footW / 2 - 4);
    this.footBg!.setPosition(cx, y);
    this.footLabel.setPosition(cx, y);
  }

  setVisible(v: boolean): this { this.container.setVisible(v); return this; }
  destroy(): void { this.container.destroy(true); this.rows = []; }
}
