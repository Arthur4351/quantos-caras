import families from '../data/families.json';

export function calculateSynergyBonus(team: { family: string }[], family: string): number {
  const count = team.filter(d => d.family === family).length;
  const fam = (families as any)[family];
  if (!fam || !fam.synergy) return 0;
  let best = 0;
  for (const s of fam.synergy) {
    if (count >= s.count) {
      const val = s.bonusAtk ?? 0;
      if (val > best) best = val;
    }
  }
  return best;
}

export function calculateHpBonus(team: { family: string }[], family: string): number {
  const count = team.filter(d => d.family === family).length;
  const fam = (families as any)[family];
  if (!fam || !fam.synergy) return 0;
  let best = 0;
  for (const s of fam.synergy) {
    if (count >= s.count) {
      const val = s.bonusHp ?? 0;
      if (val > best) best = val;
    }
  }
  return best;
}

export function calculateGoldBonus(team: { family: string }[]): number {
  let total = 0;
  const familiesList = Object.keys(families as any);
  for (const famName of familiesList) {
    const count = team.filter(d => d.family === famName).length;
    const fam = (families as any)[famName];
    for (const s of fam.synergy || []) {
      if (count >= s.count && s.bonusGold) total += s.bonusGold;
    }
  }
  return total;
}
