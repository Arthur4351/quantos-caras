import Phaser from 'phaser';
import { Fighter } from './Fighter';

/**
 * Projetil dos caras de longo alcance. Era um quadradinho amarelo de 8px; agora
 * e a capsula de tinta `fx_bolt`, com rastro e rotacao na direcao do voo.
 */
export class Projectile extends Phaser.GameObjects.Image {
  damage: number;
  target: Fighter;
  private speed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, target: Fighter, damage = 10, speed = 900) {
    super(scene, x, y, scene.textures.exists('fx_bolt') ? 'fx_bolt' : 'fx_spark');
    this.damage = damage;
    this.target = target;
    this.speed = speed;
    scene.add.existing(this);
    this.setDepth(y + 20);
    this.rotation = Phaser.Math.Angle.Between(x, y, target.x, target.y);
  }

  /** Chamado pelo update da cena, com o delta em segundos. */
  step(dt: number): void {
    if (!this.active) return;
    if (!this.target || !this.target.active || !this.target.isAlive()) {
      this.destroy();
      return;
    }
    const ang = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y - 20);
    this.rotation = ang;
    const stepLen = this.speed * dt;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y - 20);
    if (dist <= stepLen) {
      this.target.hurt(this.damage);
      this.destroy();
      return;
    }
    this.x += Math.cos(ang) * stepLen;
    this.y += Math.sin(ang) * stepLen;
    this.setDepth(this.y + 20);
  }

  /** Compatibilidade com o loop antigo de 16ms. */
  update(): void { this.step(1 / 60); }
}
