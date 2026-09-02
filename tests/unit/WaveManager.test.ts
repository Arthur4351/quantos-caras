import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/entities/Enemy', () => ({ Enemy: class MockEnemy { isAlive() { return true; } takeDamage() {} } }));
import { WaveManager } from '../../src/systems/WaveManager';
import { ENEMY_TYPES } from '../../src/systems/enemyTypes';

const total = (wave: number) =>
  new WaveManager().getWave(wave).enemies.reduce((sum, e) => sum + e.count, 0);

describe('WaveManager', () => {
  it('wave 1 e uma tropa pequena de pirralhos', () => {
    const w1 = new WaveManager().getWave(1);
    expect(w1.enemies).toHaveLength(1);
    expect(w1.enemies[0].type).toBe('toddler');
    expect(w1.enemies[0].count).toBeGreaterThanOrEqual(4);
    expect(w1.enemies[0].count).toBeLessThanOrEqual(10);
  });
  it('a horda cresce: wave 31 tem muito mais inimigos que wave 5', () => {
    expect(total(31)).toBeGreaterThan(total(5) * 8);
    expect(total(31)).toBeGreaterThan(150);
  });
  it('libera o bestiario aos poucos', () => {
    const types = (n: number) => new WaveManager().getWave(n).enemies.map(e => e.type);
    expect(types(1)).not.toContain('wolf');
    expect(types(6)).toContain('wolf');
    expect(types(35)).toContain('polarbear');
  });
  it('todo tipo usado existe no bestiario', () => {
    for (const wave of [1, 7, 13, 19, 25, 31, 40, 50, 99, 100]) {
      for (const e of new WaveManager().getWave(wave).enemies) {
        expect(ENEMY_TYPES[e.type], `tipo ${e.type} sem definicao`).toBeDefined();
      }
    }
  });
  it('wave 10 e boss de gorila com escolta', () => {
    const w10 = new WaveManager().getWave(10);
    expect(w10.enemies[0].type).toBe('gorilla');
    expect(w10.isBoss).toBe(true);
    expect(w10.enemies.length).toBeGreaterThan(1);
  });
  it('escala hp: wave 10 > wave 1', () => {
    expect(new WaveManager().getWave(10).enemies[0].hp)
      .toBeGreaterThan(new WaveManager().getWave(1).enemies[0].hp);
  });
  it('gera wave procedural para 99', () => {
    const w99 = new WaveManager().getWave(99);
    expect(w99.wave).toBe(99);
    expect(w99.enemies.length).toBeGreaterThan(0);
  });
  it('boss a cada 10', () => {
    expect(new WaveManager().getWave(20).isBoss).toBe(true);
    expect(new WaveManager().getWave(21).isBoss).toBe(false);
  });
  it('deus aparece na wave 50 e na 100', () => {
    expect(new WaveManager().getWave(50).enemies[0].type).toBe('god');
    expect(new WaveManager().getWave(100).enemies[0].type).toBe('god');
    expect(new WaveManager().getWave(100).isBoss).toBe(true);
  });
  it('headline descreve a wave', () => {
    expect(new WaveManager().headline(30)).toMatch(/INIMIGOS/);
  });
});
