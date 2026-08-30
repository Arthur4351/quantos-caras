import { describe, it, expect, beforeEach } from 'vitest';
import { AchievementSystem } from '../../src/systems/AchievementSystem';

describe('AchievementSystem', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  it('first win', () => {
    const ac = new AchievementSystem();
    const n = ac.check({ wave: 1, victory: true, noDeath: true, dudesCollected: 1, relicsCollected: 0, synergyMax: 0 });
    expect(n).toContain('first_win');
    expect(ac.has('first_win')).toBe(true);
  });
  it('gorilla slayer wave 10', () => {
    const ac = new AchievementSystem();
    ac.check({ wave: 10, victory: true, noDeath: false, dudesCollected: 3, relicsCollected: 2, synergyMax: 2 });
    expect(ac.has('gorilla_slayer')).toBe(true);
  });
  it('gold star noDeath', () => {
    const ac = new AchievementSystem();
    ac.check({ wave: 3, victory: true, noDeath: true, dudesCollected: 2, relicsCollected: 1, synergyMax: 2 });
    expect(ac.has('gold_star')).toBe(true);
  });
  it('persists', () => {
    const ac = new AchievementSystem();
    ac.check({ wave: 1, victory: true, noDeath: true, dudesCollected: 1, relicsCollected: 0, synergyMax: 0 });
    const ac2 = new AchievementSystem();
    expect(ac2.has('first_win')).toBe(true);
  });
});
