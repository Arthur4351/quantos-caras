import Phaser from 'phaser';
import { enemyKey, ENEMY_ORIGIN, ENEMY_SIZE } from '../art/textures';

export class Enemy extends Phaser.GameObjects.Sprite {
  currentHp: number;
  maxHp: number;
  atk: number;
  type: string;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number, atk: number, type = 'toddler') {
    super(scene, x, y, scene.textures.exists(enemyKey(type)) ? enemyKey(type) : 'missing');
    this.currentHp = hp;
    this.maxHp = hp;
    this.atk = atk;
    this.type = type;
    scene.add.existing(this);
    if (scene.physics && (scene.physics as any).add) {
      scene.physics.add.existing(this);
    }
    const artSize = ENEMY_SIZE[type];
    const desiredHeight = type === 'gorilla' || type === 'god' ? 210 : type === 'wolf' ? 112 : 78;
    this.setScale(artSize ? desiredHeight / artSize.h : 0.72);
    this.setOrigin(0.5, artSize ? ENEMY_ORIGIN[type] : 0.94);
    this.setTint(0xff4444);
    this.setOrigin(0.5);
  }

  takeDamage(n: number): void {
    this.currentHp = Math.max(0, this.currentHp - n);
    this.setTint(0xffaaaa);
    if (this.scene) {
      this.scene.time.delayedCall(100, () => {
        if (this.active && this.isAlive()) this.setTint(0xff4444);
      });
    }
    if (!this.isAlive()) {
      this.setTint(0x333333);
      this.setAlpha(0.5);
    }
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }
}
