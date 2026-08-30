import { WaveData } from '../types/WaveData';
import { Enemy } from '../entities/Enemy';
import { curveHp, curveCount, curveGold } from './Balance';

export class WaveManager {
  constructor(private waves: WaveData[]) {}

  generateWave(wave: number): WaveData {
    if (wave % 10 === 0) {
      const isGod = wave >= 100;
      const base = isGod ? { type: 'god', hp: 5000, atk: 80 } : { type: 'gorilla', hp: 800, atk: 35 };
      return {
        wave,
        enemies: [{ type: base.type, count: 1, hp: curveHp(base.hp, wave), atk: base.atk + Math.floor(wave / 5) }],
        rewardGold: 10 + Math.floor(wave * 0.5),
        isBoss: true
      } as any;
    }
    const toddlerBase = 8;
    const wolfBase = 6;
    return {
      wave,
      enemies: [
        { type: 'toddler', count: curveCount(toddlerBase, wave), hp: curveHp(20, wave), atk: 5 + Math.floor(wave / 10) },
        { type: 'wolf', count: Math.max(0, Math.floor(curveCount(wolfBase, wave) / 2)), hp: curveHp(40, wave), atk: 10 + Math.floor(wave / 8) }
      ].filter(e => e.count > 0),
      rewardGold: curveGold(5, wave),
      isBoss: false
    } as any;
  }

  getWave(n: number): WaveData {
    const found = this.waves.find(w => w.wave === n);
    if (found) return found;
    if (n > this.waves.length) return this.generateWave(n);
    return this.waves[0];
  }

  spawn(scene: Phaser.Scene, wave: number): Enemy[] {
    const data = this.getWave(wave);
    const enemies: Enemy[] = [];
    data.enemies.forEach((e: any) => {
      for (let i = 0; i < e.count; i++) {
        const x = 1200 + Math.random() * 500;
        const y = 200 + Math.random() * 600;
        const enemy = new Enemy(scene, x, y, e.hp, e.atk, e.type);
        const label = scene.add.text(x, y - 28, e.type, { fontSize: '10px', color: '#fff' }).setOrigin(0.5);
        (enemy as any).label = label;
        enemies.push(enemy);
      }
    });
    return enemies;
  }
}
