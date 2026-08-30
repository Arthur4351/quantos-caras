import { storage } from '../utils/storage';
import achievements from '../data/achievements.json';

export interface AchievementProgress { wave: number; victory: boolean; noDeath: boolean; dudesCollected: number; relicsCollected: number; synergyMax: number; }

export class AchievementSystem {
  private unlocked = new Set<string>();

  constructor() {
    const saved = storage.load('achievements') as string[] | null;
    if (saved) saved.forEach(id => this.unlocked.add(id));
  }

  check(ctx: AchievementProgress): string[] {
    const newly: string[] = [];
    const add = (id: string) => { if (!this.unlocked.has(id)) { this.unlocked.add(id); newly.push(id); } };
    if (ctx.wave >= 1 && ctx.victory) add('first_win');
    if (ctx.dudesCollected >= 5) add('collector');
    if (ctx.synergyMax >= 2) add('synergy_2');
    if (ctx.synergyMax >= 6) add('synergy_6');
    if (ctx.wave >= 10 && ctx.victory) add('gorilla_slayer');
    if (ctx.relicsCollected >= 5) add('relic_hunter');
    if (ctx.wave >= 50) add('wave_50');
    if (ctx.wave >= 100 && ctx.victory) add('god_slayer');
    if (ctx.noDeath && ctx.victory) add('gold_star');
    // daily champ handled separately
    if (newly.length) storage.save('achievements', Array.from(this.unlocked));
    return newly;
  }

  has(id: string): boolean { return this.unlocked.has(id); }
  all(): string[] { return Array.from(this.unlocked); }
  allData() { return achievements.filter(a => this.unlocked.has(a.id)); }
}
