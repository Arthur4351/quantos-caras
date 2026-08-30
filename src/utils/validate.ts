import { DudeData } from '../types/DudeData';

export function validateDudes(data: unknown): DudeData[] {
  if (!Array.isArray(data)) throw new Error('Dudes must be array');
  return data.map((d: any) => {
    if (!d.id || !d.stats?.hp) throw new Error(`Invalid dude ${JSON.stringify(d)}`);
    if (d.stats.hp <= 0 || d.cost < 0) throw new Error(`Invalid stats for ${d.id}`);
    if (!d.family || !d.role) throw new Error(`Missing family/role for ${d.id}`);
    return d as DudeData;
  });
}

export function validateWaves(data: unknown): void {
  if (!Array.isArray(data)) throw new Error('Waves must be array');
  (data as any[]).forEach(w => {
    if (!w.wave || !Array.isArray(w.enemies)) throw new Error(`Invalid wave ${JSON.stringify(w)}`);
  });
}

export const fallbackDudes: DudeData[] = [
  { id: 'knight', name: 'Knight', family: 'Warrior', role: 'Tank', stats: { hp: 100, atk: 10, range: 60, attackSpeed: 1, moveSpeed: 80 }, ability: { type: 'none', value: 0 }, cost: 3, sprite: 'missing', rarity: 'common' }
];
