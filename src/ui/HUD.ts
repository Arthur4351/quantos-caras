import Phaser from 'phaser';

export class HUD {
  goldText!: Phaser.GameObjects.Text;
  waveText!: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private economy: { gold: number },
    private wave: number
  ) {
    this.goldText = scene.add
      .text(50, 30, `Gold: ${economy.gold}`, { fontSize: '24px', color: '#ffd700', fontStyle: 'bold' })
      .setScrollFactor(0)
      .setDepth(1000);
    this.waveText = scene.add
      .text(1870, 30, `Wave: ${wave}`, { fontSize: '24px', color: '#fff' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  update(): void {
    this.goldText.setText(`Gold: ${this.economy.gold}`);
  }

  setWave(wave: number): void {
    this.wave = wave;
    this.waveText.setText(`Wave: ${wave}`);
  }
}
