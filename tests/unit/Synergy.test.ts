import { describe, it, expect } from 'vitest';
import { calculateSynergyBonus } from '../../src/systems/Synergy';

describe('Synergy', () => {
  it('2 Warrior = +15% ATK', () => {
    const team = [{ family: 'Warrior' }, { family: 'Warrior' }] as any;
    expect(calculateSynergyBonus(team, 'Warrior')).toBe(0.15);
  });
  it('1 Warrior = 0', () => {
    const team = [{ family: 'Warrior' }] as any;
    expect(calculateSynergyBonus(team, 'Warrior')).toBe(0);
  });
  it('2 Undead = +20% HP', () => {
    const team = [{ family: 'Undead' }, { family: 'Undead' }] as any;
    expect(calculateSynergyBonus(team, 'Undead')).toBe(0.2);
  });
  it('unknown family = 0', () => {
    expect(calculateSynergyBonus([{ family: 'Warrior' } as any], 'Unknown')).toBe(0);
  });
});
