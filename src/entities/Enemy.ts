import Phaser from 'phaser';
import { Fighter } from './Fighter';
import { enemyKey, ENEMY_ORIGIN, ENEMY_SIZE } from '../art/textures';
import { enemyType, enemyKit } from '../systems/enemyTypes';

export class Enemy extends Fighter {
  readonly type: string;
  /** Abelhas flutuam: o rig sobe um pouco e balanca. */
  readonly flying: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number, atk: number, type = 'toddler') {
    const t = enemyType(type);
    const hasArt = scene.textures.exists(enemyKey(type));
    const key = hasArt ? enemyKey(type) : 'missing';
    const size = ENEMY_SIZE[type];
    /**
     * Barra e numeros SO em boss. Com elite tambem (unicornio, urso) a wave 30
     * ficava com 40 barrinhas verdes flutuando sobre a multidao — palitos de HUD
     * competindo com os bichos. O chefe e a unica luta com pace de barra.
     */
    const notable = !!t.boss;
    super(scene, x, y, key, {
      team: 'enemy',
      hp,
      atk,
      range: t.range,
      attackSpeed: t.attackSpeed,
      moveSpeed: t.moveSpeed,
      kit: enemyKit(type),
      visualHeight: t.height,
      sourceHeight: size ? size.h : 116,
      sourceWidth: size ? size.w : 104,
      bodyWidth: size ? size.w * 0.86 : 92,
      footOrigin: size ? ENEMY_ORIGIN[type] : 0.94,
      barWidth: Math.max(56, Math.round(t.height * 0.8)),
      bar: notable,
      numbers: notable
    });
    this.type = type;
    this.flying = !!t.flying;
  }

  /** Compatibilidade com o codigo antigo que le currentHp. */
  get currentHp(): number { return this.hp; }
  set currentHp(v: number) { this.hp = v; }

  takeDamage(n: number): void { this.hurt(n); }
}
