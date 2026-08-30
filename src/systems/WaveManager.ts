import { WaveData } from '../types/WaveData';
import { Enemy } from '../entities/Enemy';

export class WaveManager {
  constructor(private waves: WaveData[]) {}

  getWave(n: number): WaveData {
    const found = this.waves.find(w => w.wave === n);
    return found || this.waves[0];
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
