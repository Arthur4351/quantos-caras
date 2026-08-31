import Phaser from 'phaser';
import { INK, GREEN, GOLD, RED, WHITE } from './palette';
import { shapeTexture } from './bakery';

/**
 * Barra de vida no estilo adesivo: moldura de tinta + preenchimento chapado.
 *
 * Duas texturas assadas, zero Graphics vivo. O preenchimento tem origem na
 * borda esquerda, entao mudar a vida e um scaleX puro — nunca um redraw.
 * A cor vem de tint sobre um preenchimento branco, o que permite virar
 * verde -> ouro -> vermelho sem gerar textura nova.
 */
export class HpBar {
  private frame: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;
  private ratio = 1;

  constructor(private scene: Phaser.Scene, private w: number, private h: number) {
    const r = h / 2;
    const fk = `hpfr_${w}x${h}`;
    shapeTexture(scene, fk, w + 14, h + 14, g => {
      g.fillStyle(INK, 1);
      g.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 4);
      g.fillStyle(0x2c2c3a, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    });
    // o preenchimento e assado SEM padding: assim a origem (0,0.5) cai exatamente
    // na borda esquerda da forma e o scaleX vira o ratio de vida, sem offset.
    const bk = `hpfl_${w}x${h}`;
    shapeTexture(scene, bk, w, h, g => {
      g.fillStyle(WHITE, 1);
      g.fillRoundedRect(0, 0, w, h, r);
      g.fillStyle(INK, 0.2);
      g.fillRoundedRect(0, h - h * 0.32, w, h * 0.32, r * 0.6);
    }, false);

    this.frame = scene.add.image(0, 0, fk);
    // a origem na esquerda transforma "vida" em scaleX
    this.fill = scene.add.image(0, 0, bk).setOrigin(0, 0.5).setTint(GREEN);
  }

  setRatio(v: number): this {
    this.ratio = Phaser.Math.Clamp(v, 0, 1);
    this.fill.setScale(this.ratio, 1);
    this.fill.setTint(this.ratio > 0.55 ? GREEN : this.ratio > 0.25 ? GOLD : RED);
    return this;
  }

  /** x,y = centro da barra. O preenchimento se ancora na borda esquerda. */
  setPosition(x: number, y: number): this {
    this.frame.setPosition(x, y);
    this.fill.setPosition(x - this.w / 2, y);
    return this;
  }

  setDepth(d: number): this {
    this.frame.setDepth(d);
    this.fill.setDepth(d + 0.1);
    return this;
  }

  setVisible(v: boolean): this {
    this.frame.setVisible(v);
    this.fill.setVisible(v);
    return this;
  }

  destroy(): void {
    this.frame.destroy();
    this.fill.destroy();
  }
}
