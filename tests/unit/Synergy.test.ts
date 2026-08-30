import { describe, it, expect } from 'vitest';
import { calculateSynergyBonus, calculateHpBonus, calculateGoldBonus } from '../../src/systems/Synergy';

describe('Synergy', () => {
  it('2 Warrior = +15% ATK', () => {
    const team = [{ family: 'Warrior' }, { family: 'Warrior' }] as any;
    expect(calculateSynergyBonus(team, 'Warrior')).toBe(0.15);
  });
  it('1 Warrior = 0', () => {
    const team = [{ family: 'Warrior' }] as any;
    expect(calculateSynergyBonus(team, 'Warrior')).toBe(0);
  });
  it('2 Undead = 0 ATK but 20% HP', () => {
    const team = [{ family: 'Undead' }, { family: 'Undead' }] as any;
    expect(calculateSynergyBonus(team, 'Undead')).toBe(0);
    expect(calculateHpBonus(team, 'Undead')).toBe(0.2);
  });
  it('unknown family = 0', () => {
    expect(calculateSynergyBonus([{ family: 'Warrior' } as any], 'Unknown')).toBe(0);
    expect(calculateHpBonus([{ family: 'Warrior' } as any], 'Unknown')).toBe(0);
  });
  it('2 Employed = 1 gold bonus', () => {
    const team = [{ family: 'Employed' }, { family: 'Employed' }] as any;
    expect(calculateGoldBonus(team)).toBe(1);
    expect(calculateSynergyBonus(team, 'Employed')).toBe(0);
  });
  it('mixed families gold bonus sums', () => {
    const team = [{ family: 'Employed' }, { family: 'Employed' }, { family: 'Warrior' }, { family: 'Warrior' }] as any;
    // Employed 2 = 1 gold, Warrior atk not gold
    expect(calculateGoldBonus(team)).toBe(1);
  });
});
