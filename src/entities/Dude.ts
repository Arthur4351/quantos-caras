import Phaser from 'phaser';
import { DudeData } from '../types/DudeData';

export class Dude extends Phaser.GameObjects.Sprite {
  data: DudeData;
  currentHp: number;
  attackCooldown: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, data: DudeData) {
    super(scene, x, y, 'missing');
    this.data = data;
    this.currentHp = data.stats.hp;
    scene.add.existing(this);
    if (scene.physics && (scene.physics as any).add) {
      scene.physics.add.existing(this);
    }
    this.setDisplaySize(64, 64);
    this.setOrigin(0.5);
  }

  takeDamage(n: number): void {
    this.currentHp = Math.max(0, this.currentHp - n);
    this.setTint(0xff0000);
    if (this.scene && (this.scene as any).tweens) {
      this.scene.tweens.add({
        targets: this,
        duration: 150,
        onComplete: () => { if (this.active) this.clearTint(); }
      });
    } else if (this.scene) {
      this.scene.time.delayedCall(150, () => { if (this.active) this.clearTint(); });
    }
    if (this.currentHp <= 0) {
      this.setTint(0x555555);
      if (this.scene && (this.scene as any).tweens) {
        this.scene.tweens.add({ targets: this, alpha: 0.4, scale: 0.7, duration: 300 });
      } else {
        this.setAlpha(0.6);
      }
    } else {
      // hit shake
      if (this.scene && (this.scene as any).tweens) {
        this.scene.tweens.add({ targets: this, x: this.x + 4, duration: 40, yoyo: true, repeat: 1 });
      }
    }
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.data.stats.hp, this.currentHp + amount);
    if (this.isAlive()) {
      this.clearTint();
      this.setAlpha(1);
    }
  }

  update(time: number, delta: number): void {
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
  }
}
