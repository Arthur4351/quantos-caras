export function calculateDamage(baseAtk: number, synergyBonus: number): number {
  return Math.max(0, baseAtk * (1 + synergyBonus));
}

export class BattleSystem {
  checkWin(dudes: { isAlive(): boolean }[], enemies: { isAlive(): boolean }[]): 'win' | 'lose' | 'ongoing' {
    if (enemies.length > 0 && enemies.every(e => !e.isAlive())) return 'win';
    if (dudes.length > 0 && dudes.every(d => !d.isAlive())) return 'lose';
    if (enemies.length === 0) return 'win';
    if (dudes.length === 0) return 'lose';
    return 'ongoing';
  }

  findClosest(
    attacker: Phaser.GameObjects.Sprite,
    targets: Phaser.GameObjects.Sprite[]
  ): Phaser.GameObjects.Sprite | null {
    let best: Phaser.GameObjects.Sprite | null = null;
    let dist = Infinity;
    const alive = targets.filter(t => (t as any).isAlive?.() ?? true);
    for (const t of alive) {
      const d = Phaser.Math.Distance.Between(attacker.x, attacker.y, t.x, t.y);
      if (d < dist) {
        dist = d;
        best = t;
      }
    }
    return best;
  }
}
