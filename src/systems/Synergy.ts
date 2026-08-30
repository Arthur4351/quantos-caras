import families from '../data/families.json';

export function calculateSynergyBonus(team: { family: string }[], family: string): number {
  const count = team.filter(d => d.family === family).length;
  const fam = (families as any)[family];
  if (!fam || !fam.synergy) return 0;
  // find highest applicable synergy
  let best = 0;
  for (const s of fam.synergy) {
    if (count >= s.count) {
      const val = s.bonusAtk ?? s.bonusHp ?? 0;
      if (val > best) best = val;
    }
  }
  return best;
}
