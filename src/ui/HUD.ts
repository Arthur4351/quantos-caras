import Phaser from 'phaser';
import { INK, PAPER, GOLD, WOOD, WHITE, FONT_DISPLAY, css } from '../art/palette';
import { OUTLINE } from '../art/ink';
import { shapeImage } from '../art/bakery';
import { inkStroke } from '../art/UIKit';

/**
 * HUD limpa no estilo How Many Dudes: duas pilulas ancoradas nos cantos, sem
 * moldura de painel, sem texto solto. Le-se a 100% e a 40% de zoom.
 */
export class HUD {
  goldText!: Phaser.GameObjects.Text;
  waveText!: Phaser.GameObjects.Text;
  private coin?: Phaser.GameObjects.Image;

  constructor(
    private scene: Phaser.Scene,
    private economy: { gold: number },
    private wave: number
  ) {
    this.goldText = this.buildPill(196, 52, 300, 76, GOLD, `${economy.gold}`, 44, INK, 'coin');
    this.waveText = this.buildPill(1724, 52, 300, 76, WOOD, `WAVE ${wave}`, 38, PAPER);
  }

  /** Pilula com contorno de tinta + brilho no topo. Retorna o texto para update. */
  private buildPill(
    x: number, y: number, w: number, h: number,
    fill: number, txt: string, size: number, color: number, icon?: string
  ): Phaser.GameObjects.Text {
    const c = this.scene.add.container(x, y).setScrollFactor(0).setDepth(1000);
    const r = h / 2;
    const bg = shapeImage(this.scene, 0, 0, `hud_${w}x${h}_${fill}`, w, h, g => {
      g.fillStyle(INK, 0.18);
      g.fillRoundedRect(-w / 2 + 5, -h / 2 + 9, w, h, r);
      g.fillStyle(INK, 1);
      g.fillRoundedRect(-w / 2 - OUTLINE, -h / 2 - OUTLINE, w + OUTLINE * 2, h + OUTLINE * 2, r + OUTLINE);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.fillStyle(WHITE, 0.28);
      g.fillRoundedRect(-w / 2 + 8, -h / 2 + 7, w - 16, h * 0.3, r * 0.5);
    });
    c.add(bg);

    let tx = 0;
    if (icon && this.scene.textures.exists('fx_coin')) {
      this.coin = this.scene.add.image(-w / 2 + 44, 0, 'fx_coin').setDisplaySize(52, 52);
      c.add(this.coin);
      tx = 24;
    }

    const t = this.scene.add.text(tx, 0, txt, {
      fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color: css(color), fontStyle: '800'
    }).setOrigin(0.5);
    // o contador de ouro e INK numa pilula dourada: contorno de tinta sobre tinta
    // fazia dele uma mancha preta. A regra unica do kit resolve os dois casos.
    inkStroke(t, size, color);
    c.add(t);
    return t;
  }

  update(): void {
    const next = `${this.economy.gold}`;
    if (this.goldText.text === next) return;
    this.goldText.setText(next);
    // pop de feedback — o ouro e a moeda de decisao do jogo, precisa ser sentido
    this.scene.tweens.add({
      targets: [this.goldText, this.coin].filter(Boolean),
      scale: 1.22, duration: 90, yoyo: true, ease: 'Quad.easeOut'
    });
  }

  setWave(wave: number): void {
    this.wave = wave;
    this.waveText.setText(`WAVE ${wave}`);
  }
}
