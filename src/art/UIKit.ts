import Phaser from 'phaser';
import { INK, WHITE, PAPER, PAPER_SHADE, GOLD, GREEN, RED, FONT_DISPLAY, css } from './palette';
import { OUTLINE } from './ink';
import { shapeImage } from './bakery';

type G = Phaser.GameObjects.Graphics;

/** Escurece uma cor mantendo o matiz — usado nas bordas 3D dos botoes. */
export function shade(color: number, amount = 0.7): number {
  const r = Math.floor(((color >> 16) & 0xff) * amount);
  const gr = Math.floor(((color >> 8) & 0xff) * amount);
  const b = Math.floor((color & 0xff) * amount);
  return (r << 16) | (gr << 8) | b;
}

// ------------------------------------------------------------------ PAINEL
export interface PanelOpts { fill?: number; radius?: number; shadow?: boolean; gloss?: boolean; }

/** Desenha um painel de papel com contorno de tinta, centrado em 0,0. */
export function paintPanel(g: G, w: number, h: number, o: PanelOpts = {}): void {
  const fill = o.fill ?? PAPER;
  const r = o.radius ?? 26;
  if (o.shadow !== false) {
    g.fillStyle(INK, 0.16);
    g.fillRoundedRect(-w / 2 + 7, -h / 2 + 12, w, h, r);
  }
  g.fillStyle(INK, 1);
  g.fillRoundedRect(-w / 2 - OUTLINE, -h / 2 - OUTLINE, w + OUTLINE * 2, h + OUTLINE * 2, r + OUTLINE);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  if (o.gloss !== false) {
    g.fillStyle(WHITE, 0.32);
    g.fillRoundedRect(-w / 2 + 9, -h / 2 + 8, w - 18, h * 0.2, r * 0.55);
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: PanelOpts = {}): G {
  const g = scene.add.graphics({ x, y });
  paintPanel(g, w, h, o);
  return g;
}

/**
 * Painel assado em textura — use SEMPRE que o painel for estatico.
 * `extra` desenha detalhes na mesma textura (faixas, aneis de raridade),
 * e `tag` diferencia a chave de cache desses detalhes.
 */
export function panelImage(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  o: PanelOpts = {}, extra?: (g: G) => void, tag = ''
): Phaser.GameObjects.Image {
  const key = `pnl${tag}_${w}x${h}_${o.fill ?? PAPER}_${o.radius ?? 26}`
    + `_${o.shadow === false ? 0 : 1}${o.gloss === false ? 0 : 1}`;
  return shapeImage(scene, x, y, key, w, h, g => {
    paintPanel(g, w, h, o);
    if (extra) extra(g);
  });
}

// ------------------------------------------------------------------ TEXTO
export function label(
  scene: Phaser.Scene, x: number, y: number, txt: string,
  size: number, color = INK, strokeInk = false
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, txt, {
    fontFamily: FONT_DISPLAY,
    fontSize: `${size}px`,
    color: css(color),
    fontStyle: '800'
  }).setOrigin(0.5);
  if (strokeInk) t.setStroke(css(INK), Math.max(4, size * 0.16));
  return t;
}

/** Titulo grande com contorno de tinta e sombra dura — assinatura do jogo. */
export function title(scene: Phaser.Scene, x: number, y: number, txt: string, size: number, color = GOLD): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const back = scene.add.text(0, size * 0.08, txt, {
    fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color: css(INK), fontStyle: '800'
  }).setOrigin(0.5);
  back.setStroke(css(INK), size * 0.22);
  const front = scene.add.text(0, 0, txt, {
    fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color: css(color), fontStyle: '800'
  }).setOrigin(0.5);
  front.setStroke(css(INK), size * 0.14);
  c.add([back, front]);
  return c;
}
// ------------------------------------------------------------------ BOTAO
export interface ButtonOpts {
  fill?: number;
  textColor?: number;
  size?: number;
  radius?: number;
  enabled?: boolean;
}

/** Botao chunky com aba 3D e afundamento no clique. Base e face sao texturas. */
export class ComicButton {
  readonly container: Phaser.GameObjects.Container;
  private face: Phaser.GameObjects.Image;
  private txt: Phaser.GameObjects.Text;
  private hit: Phaser.GameObjects.Rectangle;
  private enabled: boolean;
  private readonly LIFT = 9;

  constructor(
    private scene: Phaser.Scene,
    x: number, y: number,
    private w: number, private h: number,
    text: string,
    private onClick: () => void,
    private o: ButtonOpts = {}
  ) {
    this.enabled = o.enabled !== false;
    const r = o.radius ?? Math.min(this.h * 0.42, 30);
    const fill = this.enabled ? (o.fill ?? GREEN) : 0x9aa3ad;
    const dark = shade(fill, 0.62);

    this.container = scene.add.container(x, y);

    const base = shapeImage(scene, 0, this.LIFT, `btnb_${w}x${h}_${dark}_${r}`, w, h, g => {
      g.fillStyle(INK, 1);
      g.fillRoundedRect(-w / 2 - OUTLINE, -h / 2 - OUTLINE, w + OUTLINE * 2, h + OUTLINE * 2, r + OUTLINE);
      g.fillStyle(dark, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    });

    this.face = shapeImage(scene, 0, 0, `btnf_${w}x${h}_${fill}_${r}`, w, h, g => {
      g.fillStyle(INK, 1);
      g.fillRoundedRect(-w / 2 - OUTLINE, -h / 2 - OUTLINE, w + OUTLINE * 2, h + OUTLINE * 2, r + OUTLINE);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.fillStyle(WHITE, 0.3);
      g.fillRoundedRect(-w / 2 + 8, -h / 2 + 7, w - 16, h * 0.28, r * 0.55);
    });

    this.txt = scene.add.text(0, 0, text, {
      fontFamily: FONT_DISPLAY,
      fontSize: `${o.size ?? Math.round(h * 0.42)}px`,
      color: css(o.textColor ?? WHITE),
      fontStyle: '800'
    }).setOrigin(0.5);
    this.txt.setStroke(css(INK), Math.max(3, (o.size ?? h * 0.42) * 0.14));

    this.hit = scene.add.rectangle(0, this.LIFT / 2, w + OUTLINE * 2, h + this.LIFT + OUTLINE * 2, 0xffffff, 0);
    this.container.add([base, this.face, this.txt, this.hit]);
    this.bind();
  }
  private bind(): void {
    if (!this.enabled) return;
    this.hit.setInteractive({ useHandCursor: true });
    const down = () => { this.face.y = this.LIFT; this.txt.y = this.LIFT; };
    const up = () => { this.face.y = 0; this.txt.y = 0; };
    this.hit.on('pointerover', () => { this.container.setScale(1.04); });
    this.hit.on('pointerout', () => { this.container.setScale(1); up(); });
    this.hit.on('pointerdown', down);
    this.hit.on('pointerup', () => { up(); this.onClick(); });
  }

  setText(t: string): void { this.txt.setText(t); }

  /** Pulso infinito para chamar atencao (usar so no CTA principal). */
  pulse(): this {
    this.scene.tweens.add({
      targets: this.container, scaleX: 1.05, scaleY: 1.05,
      duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    return this;
  }

  destroy(): void { this.container.destroy(); }
}

// ------------------------------------------------------------------ PILULA
/** Pilula compacta de stat (HP / ATK / custo). Fundo assado em textura. */
export function statPill(
  scene: Phaser.Scene, x: number, y: number, txt: string,
  fill = GOLD, w = 96, h = 32, textColor = INK
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const r = h / 2;
  const bg = shapeImage(scene, 0, 0, `pill_${w}x${h}_${fill}`, w, h, g => {
    g.fillStyle(INK, 1);
    g.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 4);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(WHITE, 0.3);
    g.fillRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, h * 0.34, r * 0.6);
  });
  const t = scene.add.text(0, 0, txt, {
    fontFamily: FONT_DISPLAY, fontSize: `${Math.round(h * 0.56)}px`,
    color: css(textColor), fontStyle: '800'
  }).setOrigin(0.5);
  c.add([bg, t]);
  return c;
}

/** Toast comico centralizado no topo. */
export function toast(scene: Phaser.Scene, txt: string, x: number, y: number, bad = true): void {
  const c = scene.add.container(x, y).setDepth(5000);
  const w = Math.max(260, txt.length * 17);
  const bg = shapeImage(scene, 0, 0, `toast_${w}_${bad ? 1 : 0}`, w, 62, g => {
    paintPanel(g, w, 62, { fill: bad ? RED : GREEN, radius: 20 });
  });
  const t = scene.add.text(0, 0, txt, {
    fontFamily: FONT_DISPLAY, fontSize: '26px', color: css(WHITE), fontStyle: '800'
  }).setOrigin(0.5);
  t.setStroke(css(INK), 5);
  c.add([bg, t]);
  c.setScale(0.6);
  scene.tweens.add({ targets: c, scale: 1, duration: 180, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: c, alpha: 0, y: y - 46, duration: 420, delay: 900, onComplete: () => c.destroy() });
}

/** Numero de dano que sobe e desaparece. */
export function floatNumber(scene: Phaser.Scene, x: number, y: number, txt: string, color = WHITE, size = 30): void {
  const t = scene.add.text(x, y, txt, {
    fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color: css(color), fontStyle: '800'
  }).setOrigin(0.5).setDepth(4000);
  t.setStroke(css(INK), size * 0.2);
  scene.tweens.add({
    targets: t, y: y - 52, alpha: 0, scale: 1.25,
    duration: 620, ease: 'Cubic.easeOut', onComplete: () => t.destroy()
  });
}

export { PAPER_SHADE };
