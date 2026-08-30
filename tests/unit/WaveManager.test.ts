import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/entities/Enemy', () => ({ Enemy: class MockEnemy { isAlive() { return true; } takeDamage() {} } }));
import { WaveManager } from '../../src/systems/WaveManager';
import waves from '../../src/data/waves.json';

describe('WaveManager', () => {
  it('wave 1 has 8 toddlers', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(1).enemies[0].count).toBe(8);
  });
  it('wave 10 is gorilla boss', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(10).enemies[0].type).toBe('gorilla');
  });
  it('scales hp wave 10 > wave 1', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(10).enemies[0].hp).toBeGreaterThan(wm.getWave(1).enemies[0].hp);
  });
  it('getWave generates procedural for 99', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(99).wave).toBe(99);
    expect(wm.getWave(99).enemies.length).toBeGreaterThan(0);
  });
  it('generate wave 50 procedural', () => {
    const wm = new WaveManager(waves as any);
    const w50 = wm.getWave(50);
    expect(w50.enemies.length).toBeGreaterThan(0);
    expect(w50.enemies[0].hp).toBeGreaterThan(100);
    expect(w50.isBoss).toBe(true);
  });
  it('boss every 10', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(20).isBoss).toBe(true);
    expect(wm.getWave(21).isBoss).toBe(false);
  });
  it('god boss at 100', () => {
    const wm = new WaveManager(waves as any);
    const w100 = wm.getWave(100);
    expect(w100.enemies[0].type).toBe('god');
    expect(w100.isBoss).toBe(true);
  });
});
