import { describe, it, expect } from 'vitest';
import { draft, eligibleRelics, familyCount, relicFamily } from '../../src/systems/RelicShop';
import { relicCatalog } from '../../src/systems/RelicSystem';
import { RelicData } from '../../src/types/RelicData';

/**
 * A BANCA DA LOJA — as tres regras da mesa, provadas sem subir um renderer.
 *
 * Este arquivo existe porque a regra mais importante da loja morava num metodo
 * privado de uma cena do Phaser: `Reward.offer()`. Regra sem teste e regra que
 * volta a quebrar na primeira mexida. Ver o topo de `systems/RelicShop.ts`.
 */

/** Um rancho: a loja so precisa da familia de cada corpo. */
const ranch = (...families: string[]) => families.map(family => ({ family }));

/** Sorteio travado: sempre o primeiro do saco, entao a mesa fica previsivel. */
const first = () => 0;
/** Sorteio travado no ultimo — pega a outra ponta do saco. */
const last = () => 0.9999;

const generals = () => relicCatalog().filter(r => !relicFamily(r));
const classy = () => relicCatalog().filter(r => !!relicFamily(r));

describe('RelicShop.familyCount', () => {
  it('conta CORPOS, nao tipos', () => {
    const meu = ranch('Warrior', 'Warrior', 'Undead');
    expect(familyCount(meu, 'Warrior')).toBe(2);
    expect(familyCount(meu, 'Undead')).toBe(1);
    expect(familyCount(meu, 'SciFi')).toBe(0);
  });
  it('aguenta rancho vazio e corpo sem familia', () => {
    expect(familyCount([], 'Warrior')).toBe(0);
    expect(familyCount([{}, { family: undefined }], 'Warrior')).toBe(0);
  });
});

describe('RelicShop.relicFamily', () => {
  it('le a familia do catalogo quando o save nao tem o campo', () => {
    // save velho: guardou a reliquia antes de `family` existir no tipo
    expect(relicFamily({ id: 'warhorn' } as RelicData)).toBe('Warrior');
    expect(relicFamily({ id: 'sword' } as RelicData)).toBeUndefined();
  });
  it('id extinto nao tem familia e nao explode', () => {
    expect(relicFamily({ id: 'dice' } as RelicData)).toBeUndefined();
  });
});

describe('RelicShop.eligibleRelics', () => {
  it('rancho vazio ve apenas as gerais', () => {
    const ok = eligibleRelics([]);
    expect(ok.map(r => r.id).sort()).toEqual(generals().map(r => r.id).sort());
  });
  it('uma familia no rancho abre exatamente uma carta de classe', () => {
    const ok = eligibleRelics(ranch('SciFi', 'SciFi'));
    const declasse = ok.filter(r => !!relicFamily(r));
    expect(declasse.map(r => r.id)).toEqual(['plasma']);
    expect(ok).toHaveLength(generals().length + 1);
  });
  it('rancho com as seis familias abre o catalogo inteiro', () => {
    const todas = ranch('Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action');
    expect(eligibleRelics(todas)).toHaveLength(relicCatalog().length);
  });
});

describe('RelicShop.draft', () => {
  it('serve tres cartas distintas', () => {
    const mesa = draft([], ranch('Warrior'), { rng: () => 0.42 });
    expect(mesa).toHaveLength(3);
    expect(new Set(mesa.map(r => r.id)).size).toBe(3);
  });

  /** REGRA 2: a carta que voce nao pode usar nem por acidente nao entra na mesa. */
  it('nunca oferece reliquia de classe de familia que o rancho nao tem', () => {
    for (let i = 0; i < 300; i++) {
      const mesa = draft([], ranch('Undead', 'Undead', 'Fantasy'));
      for (const carta of mesa) {
        const fam = relicFamily(carta);
        if (fam) expect(['Undead', 'Fantasy']).toContain(fam);
      }
    }
  });
  it('rancho sem familia nenhuma recebe mesa 100% geral', () => {
    for (let i = 0; i < 200; i++) {
      const mesa = draft([], []);
      expect(mesa.filter(r => !!relicFamily(r))).toEqual([]);
    }
  });

  /** REGRA 1: novidade primeiro. */
  it('nao repete carta que o jogador ja levou', () => {
    const owned = generals().slice(0, 6);
    for (let i = 0; i < 200; i++) {
      const mesa = draft(owned, ranch('Action', 'Action'));
      for (const carta of mesa) expect(owned.map(r => r.id)).not.toContain(carta.id);
    }
  });
  it('catalogo esgotado repete em vez de mostrar mesa vazia', () => {
    // levou tudo: uma mesa com uma carta parece bug, repeticao parece escolha
    const mesa = draft(relicCatalog(), ranch('Warrior'));
    expect(mesa).toHaveLength(3);
    expect(new Set(mesa.map(r => r.id)).size).toBe(3);
  });
  it('nao muda a lista de reliquias que ja tenho', () => {
    const owned = [{ id: 'sword' }, { id: 'crown' }] as RelicData[];
    draft(owned, ranch('SciFi'));
    expect(owned.map(r => r.id)).toEqual(['sword', 'crown']);
    expect(relicCatalog()).toHaveLength(17);
  });

  /**
   * REGRA 3: A GERAL E O PISO DA MESA.
   *
   * Com as seis familias no rancho e um sorteio azarado, a mesa podia sair com tres
   * cartas de classe das familias onde o jogador tem UM cara — tecnicamente vivas,
   * praticamente inuteis. Uma das tres e sempre trocada por uma geral.
   */
  it('sempre entrega pelo menos uma carta geral', () => {
    const todas = ranch('Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action');
    for (let i = 0; i < 400; i++) {
      const mesa = draft([], todas);
      expect(mesa.filter(r => !relicFamily(r)).length).toBeGreaterThanOrEqual(1);
    }
  });
  it('troca a ultima carta quando o sorteio vira tres de classe', () => {
    // `last` puxa sempre o fim do saco, e o catalogo termina nas seis de classe:
    // holofote, plasma, grimorio — mesa inteira de classe, que a regra 3 corta
    const todas = ranch('Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action');
    const mesa = draft([], todas, { rng: last });
    expect(relicFamily(mesa[0])).toBeTruthy();
    expect(relicFamily(mesa[1])).toBeTruthy();
    expect(relicFamily(mesa[2])).toBeUndefined();
  });
  it('mesa 100% de classe e legitima quando as gerais ja foram todas levadas', () => {
    // aqui a regra 3 nao tem o que oferecer, e esta certo: nao existe carta geral
    // nova para servir de piso, e repetir uma que ele ja tem seria a carta morta
    const soClasse = draft(generals(), ranch('Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action'), { rng: first });
    expect(soClasse).toHaveLength(3);
    expect(soClasse.every(r => !!relicFamily(r))).toBe(true);
  });
  it('a geral que entra no lugar nao duplica carta que ja esta na mesa', () => {
    for (const rng of [first, last, () => 0.5]) {
      const mesa = draft([], ranch('Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action'), { rng });
      expect(new Set(mesa.map(r => r.id)).size).toBe(mesa.length);
    }
  });

  it('slots respeita o pedido e nunca desce de um', () => {
    expect(draft([], ranch('Warrior'), { slots: 5 })).toHaveLength(5);
    expect(draft([], ranch('Warrior'), { slots: 1 })).toHaveLength(1);
    expect(draft([], ranch('Warrior'), { slots: 0 })).toHaveLength(1);
  });
  it('com um slot so, o piso engole a mesa e a carta sai geral', () => {
    // consequencia direta da regra 3 num slot unico: se a unica carta for de classe,
    // TODAS as cartas da mesa sao de classe, entao ela e trocada pela geral. Fica
    // documentado — o jogo sempre pede tres, e num slot o piso vale mais que a
    // variedade: com uma carta so, uma reliquia inutil nao tem vizinha para salvar.
    for (let i = 0; i < 200; i++) {
      const mesa = draft([], ranch('Undead'), { slots: 1 });
      expect(relicFamily(mesa[0])).toBeUndefined();
    }
  });

  it('as dezessete cartas do catalogo conseguem aparecer', () => {
    const todas = ranch('Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action');
    const vistas = new Set<string>();
    for (let i = 0; i < 4000; i++) for (const r of draft([], todas)) vistas.add(r.id);
    expect(vistas.size).toBe(relicCatalog().length);
    expect(classy().every(r => vistas.has(r.id))).toBe(true);
  });
});
