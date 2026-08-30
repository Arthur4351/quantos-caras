import { describe, it, expect } from 'vitest';
import { Economy } from '../../src/systems/Economy';

describe('Economy', () => {
  it('spend fails if insufficient', () => {
    const e = new Economy(3);
    expect(e.spend(5)).toBe(false);
    expect(e.gold).toBe(3);
  });
  it('spend succeeds', () => {
    const e = new Economy(5);
    expect(e.spend(3)).toBe(true);
    expect(e.gold).toBe(2);
  });
  it('add clamps', () => {
    const e = new Economy(0);
    e.add(5);
    expect(e.gold).toBe(5);
    e.add(-10);
    expect(e.gold).toBe(0);
  });
  it('reroll costs 2', () => {
    const e = new Economy(5);
    e.spend(2);
    expect(e.gold).toBe(3);
  });
  it('add negative not below zero', () => {
    const e = new Economy(1);
    e.add(-5);
    expect(e.gold).toBe(0);
  });
});
