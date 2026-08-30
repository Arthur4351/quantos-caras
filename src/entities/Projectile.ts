import Phaser from 'phaser';

export class Projectile extends Phaser.GameObjects.Rectangle {
  damage: number;
  target: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, target: Phaser.GameObjects.Sprite, damage = 10) {
    super(scene, x, y, 8, 8, 0xffff00);
    this.damage = damage;
    this.target = target;
    scene.add.existing(this);
    if (scene.physics && (scene.physics as any).add) {
      scene.physics.add.existing(this);
    }
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      scene.physics.moveToObject(this, target, 300);
    }
  }

  update(): void {
    if (!this.target || !(this.target as any).isAlive?.() || !this.active) {
      this.destroy();
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
    if (dist < 12) {
      (this.target as any).takeDamage?.(this.damage);
      this.destroy();
    }
  }
}
