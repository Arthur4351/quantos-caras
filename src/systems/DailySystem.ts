import { DudeData } from '../types/DudeData';
import dudes from '../data/dudes.json';

export class DailySystem {
  getSeed(dateStr = new Date().toISOString().slice(0, 10)): string {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    return Math.abs(hash).toString(36);
  }

  getDailyDudes(allDudes: DudeData[] = dudes as DudeData[], seedStr?: string): DudeData[] {
    const seed = seedStr ?? this.getSeed();
    // seeded random: simple xorshift
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    const rand = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    // pick 5 random dudes based on seed
    const pool = [...allDudes];
    const picked: DudeData[] = [];
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(rand() * pool.length);
      picked.push(pool[idx]);
    }
    return picked;
  }

  isDailyAvailable(lastPlayed: string | null, today = new Date().toISOString().slice(0, 10)): boolean {
    return lastPlayed !== today;
  }
}
