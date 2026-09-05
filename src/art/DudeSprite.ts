import Phaser from 'phaser';
import { dudeKey, enemyKey, ENEMY_ORIGIN, ENEMY_SIZE } from './textures';
import { DUDE_H, FOOT_ORIGIN_Y } from './drawDude';

/**
 * Helpers de colocacao. Regra: y informado e SEMPRE a linha do chao (pes),
 * nunca o centro. Isso mantem a profundidade coerente no campo inteiro.
 */

export function addDudeImage(
  scene: Phaser.Scene, x: number, y: number, id: string, height = 120
): Phaser.GameObjects.Image {
  const key = scene.textures.exists(dudeKey(id)) ? dudeKey(id) : 'missing';
  const img = scene.add.image(x, y, key).setOrigin(0.5, FOOT_ORIGIN_Y);
  img.setScale(height / DUDE_H);
  return img;
}

export function addEnemyImage(
  scene: Phaser.Scene, x: number, y: number, type: string, height: number
): Phaser.GameObjects.Image {
  const key = scene.textures.exists(enemyKey(type)) ? enemyKey(type) : 'missing';
  const img = scene.add.image(x, y, key).setOrigin(0.5, ENEMY_ORIGIN[type] ?? 0.95);
  const src = ENEMY_SIZE[type];
  img.setScale(src ? height / src.h : height / 100);
  return img;
}

/** Sombra de contato. Vende o peso do personagem no chao. */
export function addShadow(
  scene: Phaser.Scene, x: number, y: number, width: number
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, 'fx_shadow')
    .setDisplaySize(width, width * 0.32)
    .setAlpha(0.9);
}

/** Respiro parado — nenhum dude fica congelado nesta direcao de arte. */
export function idleBob(
  scene: Phaser.Scene, obj: Phaser.GameObjects.Components.Transform & { y: number },
  amp = 4, dur = 900
): void {
  scene.tweens.add({
    targets: obj,
    y: obj.y - amp,
    duration: dur + Math.random() * 340,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
    delay: Math.random() * 700
  });
}

/** Squash & stretch de ataque. */
export function attackPop(scene: Phaser.Scene, obj: Phaser.GameObjects.Image, dir = 1): void {
  const s = obj.scale;
  scene.tweens.add({
    targets: obj,
    scaleX: s * 1.18, scaleY: s * 0.86,
    x: obj.x + 10 * dir,
    duration: 70, yoyo: true, ease: 'Quad.easeOut'
  });
}
