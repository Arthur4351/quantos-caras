import { storage } from '../utils/storage';
import achievements from '../data/achievements.json';

/**
 * CONQUISTAS — todas alcancaveis, todas em portugues.
 *
 * Eram doze e tres nunca podiam acender: `first_blood` pedia contagem de mortes
 * que ninguem passa, `trinket_master` falava de um sistema que nao existe mais e
 * `daily_champ` estava marcado com um "handled separately" que nunca aconteceu.
 * Conquista impossivel e pior que conquista ausente — ela promete um pedaco de
 * jogo que nao esta la. Sobraram as que o `check` de fato distribui, e entraram
 * duas que celebram o que este jogo e: exercito grande demais (`army_50` e
 * `army_120`). `collector` passou a contar TIPOS, nao corpos: com o pacote de
 * copias o exercito passa de cinco na wave 2 e a medalha "rancho cheio" acendia
 * antes do rancho estar cheio.
 */
export interface AchievementProgress {
  wave: number;
  victory: boolean;
  noDeath: boolean;
  /** TIPOS distintos no rancho (nao corpos). */
  dudesCollected: number;
  relicsCollected: number;
  synergyMax: number;
  /** Corpos no campo — o numero que da nome ao jogo. */
  army?: number;
}

export class AchievementSystem {
  private unlocked = new Set<string>();

  constructor() {
    const saved = storage.load('achievements') as string[] | null;
    if (saved) saved.forEach(id => this.unlocked.add(id));
  }

  check(ctx: AchievementProgress): string[] {
    const newly: string[] = [];
    const add = (id: string) => { if (!this.unlocked.has(id)) { this.unlocked.add(id); newly.push(id); } };
    const army = ctx.army ?? 0;
    if (ctx.wave >= 1 && ctx.victory) add('first_win');
    if (ctx.dudesCollected >= 5) add('collector');
    if (ctx.synergyMax >= 2) add('synergy_2');
    if (ctx.synergyMax >= 6) add('synergy_6');
    if (army >= 50) add('army_50');
    if (army >= 120) add('army_120');
    if (ctx.wave >= 10 && ctx.victory) add('gorilla_slayer');
    if (ctx.relicsCollected >= 5) add('relic_hunter');
    if (ctx.wave >= 50) add('wave_50');
    if (ctx.wave >= 100 && ctx.victory) add('god_slayer');
    if (ctx.noDeath && ctx.victory) add('gold_star');
    if (newly.length) storage.save('achievements', Array.from(this.unlocked));
    return newly;
  }

  has(id: string): boolean { return this.unlocked.has(id); }
  all(): string[] { return Array.from(this.unlocked); }
  allData() { return achievements.filter(a => this.unlocked.has(a.id)); }
}
