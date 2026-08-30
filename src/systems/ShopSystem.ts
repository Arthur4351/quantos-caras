import { DudeData } from '../types/DudeData';
import dudes from '../data/dudes.json';

export class ShopSystem {
  slots: (DudeData | null)[] = [];

  constructor() {
    this.rerollFree();
  }

  rerollFree(): void {
    this.slots = Array.from({ length: 5 }, () => {
      const pool = dudes as DudeData[];
      return pool[Math.floor(Math.random() * pool.length)];
    });
  }

  reroll(economy: { spend(n: number): boolean }): boolean {
    if (!economy.spend(2)) return false;
    this.rerollFree();
    return true;
  }

  buy(index: number, economy: { spend(n: number): boolean }): DudeData | null {
    const d = this.slots[index];
    if (!d) return null;
    if (!economy.spend(d.cost)) return null;
    this.slots[index] = null;
    return d;
  }
}
