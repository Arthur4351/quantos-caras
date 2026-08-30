import { describe, it, expect } from 'vitest';
import { validateDudes, validateWaves } from '../../src/utils/validate';

describe('validateDudes', () => {
  it('should accept valid dudes', () => {
    const data = [{ id: 'knight', stats: { hp: 100, atk: 10, range: 50, attackSpeed: 1, moveSpeed: 80 }, cost: 3, family: 'Warrior', role: 'Tank', ability: { type: 'x', value: 1 }, name: 'k', sprite: 's', rarity: 'common' }];
    expect(validateDudes(data).length).toBe(1);
  });
  it('should throw on invalid hp', () => {
    expect(() => validateDudes([{ id: 'bad', stats: { hp: -5 }, cost: 1 } as any])).toThrow();
  });
  it('should throw on non-array', () => {
    expect(() => validateDudes({} as any)).toThrow();
  });
  it('should throw on cost negative', () => {
    expect(() => validateDudes([{ id: 'bad', stats: { hp: 10 }, cost: -1, family: 'Warrior', role: 'Tank', ability: {type:'x', value:1}, name:'k', sprite:'s' } as any])).toThrow();
  });
});

describe('validateWaves', () => {
  it('accepts valid waves', () => {
    expect(() => validateWaves([{ wave: 1, enemies: [] }])).not.toThrow();
  });
  it('throws on non-array', () => {
    expect(() => validateWaves({} as any)).toThrow();
  });
});
