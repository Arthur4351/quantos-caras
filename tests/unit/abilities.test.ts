import { describe, it, expect } from 'vitest';
import { kitFrom, abilityBlurb, emptyKit, AbilityType } from '../../src/systems/abilities';
import { enemyKit, ENEMY_TYPES } from '../../src/systems/enemyTypes';
import dudes from '../../src/data/dudes.json';

const ALL: AbilityType[] = [
  'block', 'regen', 'heal', 'taunt', 'crit', 'aoe', 'cleave',
  'lifesteal', 'enrage', 'rally', 'haste', 'summon', 'deathscale', 'goldBonus'
];

describe('abilities', () => {
  it('kit vazio tem taunt 1 (peso de aggro neutro)', () => {
    expect(emptyKit().taunt).toBe(1);
  });

  it('cada tipo de habilidade escreve o proprio campo', () => {
    for (const type of ALL) {
      const kit = kitFrom({ type, value: 0.5 }) as any;
      expect(kit[type], `${type} nao foi aplicado ao kit`).toBeGreaterThan(0);
    }
  });

  it('taunt nunca cai abaixo de 1', () => {
    expect(kitFrom({ type: 'taunt', value: 0.2 }).taunt).toBe(1);
  });

  it('todo cara tem uma habilidade valida e implementada', () => {
    for (const d of dudes as any[]) {
      expect(d.ability, `${d.id} sem habilidade`).toBeDefined();
      expect(ALL, `${d.id} usa habilidade inexistente: ${d.ability.type}`).toContain(d.ability.type);
      expect(abilityBlurb(d.ability), `${d.id} sem texto de kit`).not.toBe('');
    }
  });

  it('as 14 habilidades estao em uso no elenco', () => {
    const used = new Set((dudes as any[]).map(d => d.ability.type));
    expect([...ALL].filter(a => !used.has(a))).toEqual([]);
  });

  it('nenhuma habilidade domina o elenco', () => {
    const counts = new Map<string, number>();
    for (const d of dudes as any[]) counts.set(d.ability.type, (counts.get(d.ability.type) ?? 0) + 1);
    for (const [type, n] of counts) {
      expect(n, `${type} repetido demais`).toBeLessThanOrEqual(7);
    }
  });

  it('kit de inimigo mescla sobre os padroes', () => {
    expect(enemyKit('honeybadger').block).toBeGreaterThan(0);
    expect(enemyKit('toddler')).toEqual(emptyKit());
    for (const type of Object.keys(ENEMY_TYPES)) {
      expect(enemyKit(type).taunt).toBeGreaterThanOrEqual(1);
    }
  });

  it('todo inimigo tem velocidade e alcance reais', () => {
    for (const [name, t] of Object.entries(ENEMY_TYPES)) {
      expect(t.moveSpeed, `${name} parado`).toBeGreaterThan(40);
      expect(t.range, `${name} sem alcance`).toBeGreaterThan(0);
      expect(t.attackSpeed, `${name} sem cadencia`).toBeGreaterThan(0);
    }
  });
});
