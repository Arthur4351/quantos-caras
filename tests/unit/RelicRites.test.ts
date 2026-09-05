import { describe, it, expect } from 'vitest';
import { RelicRites, RiteBody, RiteConfig, RiteDude, riteConfig } from '../../src/systems/RelicRites';
import { RelicSystem } from '../../src/systems/RelicSystem';
import { emptyStatus, emptyTraitState } from '../../src/systems/status';

/**
 * OS SEIS RITUAIS, SEM PHASER NENHUM.
 *
 * `RelicRites` foi escrito para nao conhecer `Fighter` nem o renderer justamente
 * para caber aqui: os corpos destes testes sao objetos crus que satisfazem
 * `RiteBody`/`RiteDude`, e as seis mecanicas de classe podem ser provadas passo a
 * passo, com o tempo na mao, sem subir uma cena.
 */

interface Fake extends RiteDude {
  healed: number;
  shouts: string[];
  bursts: number;
}

let uid = 0;

/** Um corpo do rancho. `family` undefined = cara sem familia (nao recebe ritual). */
function dude(family?: string, over: Partial<Fake> = {}): Fake {
  const maxHp = over.maxHp ?? 100;
  const f: Fake = {
    uid: ++uid,
    st: emptyStatus(),
    tr: emptyTraitState(),
    hp: over.hp ?? maxHp,
    maxHp,
    atk: over.atk ?? 10,
    attackSpeed: over.attackSpeed ?? 1,
    dudeData: { family },
    healed: 0,
    shouts: [],
    bursts: 0,
    isAlive() { return this.hp > 0; },
    healBy(amount: number) {
      this.healed += amount;
      this.hp = Math.min(this.maxHp, this.hp + amount);
    }
  };
  return Object.assign(f, over, { maxHp, dudeData: { family } });
}

/** Um corpo da horda: igual, mas sem familia — a horda nao tem. */
function enemy(alive = true): RiteBody {
  const e = dude(undefined, { hp: alive ? 100 : 0 });
  return e;
}

/** Os seis numeros, todos apagados menos os que o teste liga. */
function cfg(on: Partial<RiteConfig> = {}): RiteConfig {
  return {
    openImmune: 0, corpseFeast: 0, unionRush: 0,
    traitHaste: 0, plasmaShield: 0, lastStand: 0, ...on
  };
}

/** Coleta grito e estouro por corpo, para o teste ler o que a briga mostraria. */
function spy() {
  return {
    shout: (b: RiteBody, text: string) => { (b as Fake).shouts.push(text); },
    burst: (b: RiteBody) => { (b as Fake).bursts++; }
  };
}

/** Passa `seconds` de briga em passos de 100ms, como a cena faria. */
function run(rites: RelicRites, seconds: number): void {
  for (let t = 0; t < seconds * 10; t++) rites.step(100);
}

describe('RelicRites: nada em jogo', () => {
  it('sem reliquia de classe o ritual e idle e nao toca em ninguem', () => {
    const guerreiro = dude('Warrior');
    const rites = new RelicRites([guerreiro], [enemy()], cfg(), spy());
    expect(rites.idle).toBe(true);
    rites.open();
    run(rites, 30);
    expect(guerreiro.st.immune).toBe(0);
    expect(guerreiro.st.rush).toBe(0);
    expect(guerreiro.atk).toBe(10);
    expect(guerreiro.healed).toBe(0);
    expect(guerreiro.shouts).toEqual([]);
  });

  it('qualquer um dos seis numeros liga o ritual', () => {
    const chaves: Array<keyof RiteConfig> = [
      'openImmune', 'corpseFeast', 'unionRush', 'traitHaste', 'plasmaShield', 'lastStand'
    ];
    for (const chave of chaves) {
      const rites = new RelicRites([], [], cfg({ [chave]: 1 }));
      expect(rites.idle).toBe(false);
    }
  });

  it('riteConfig traduz o inventario de reliquias', () => {
    const rs = new RelicSystem([{ id: 'warhorn' } as any, { id: 'plasma' } as any]);
    const c = riteConfig(rs);
    expect(c.openImmune).toBe(3);
    expect(c.plasmaShield).toBeCloseTo(0.25);
    expect(c.corpseFeast).toBe(0);
    expect(c.unionRush).toBe(0);
    expect(c.traitHaste).toBe(0);
    expect(c.lastStand).toBe(0);
    expect(riteConfig(new RelicSystem([])).openImmune).toBe(0);
  });
});

describe('CORNETA (Guerreiro)', () => {
  it('abre a briga com invulneravel e pressa, so nos guerreiros vivos', () => {
    const vivo = dude('Warrior');
    const caido = dude('Warrior', { hp: 0 });
    const zumbi = dude('Undead');
    const inimigo = enemy();
    const rites = new RelicRites([vivo, caido, zumbi], [inimigo], cfg({ openImmune: 3 }), spy());
    rites.open();

    expect(vivo.st.immune).toBe(3);
    expect(vivo.st.rush).toBe(3);
    expect(vivo.st.rushPow).toBeCloseTo(0.5);
    expect(caido.st.immune).toBe(0);
    expect(zumbi.st.immune).toBe(0);
    expect((inimigo as Fake).st.immune).toBe(0);
    expect(vivo.shouts).toEqual(['CARGA!']);
  });

  it('e um TOQUE, nao uma aura: o passo nao renova o invulneravel', () => {
    const g = dude('Warrior');
    const rites = new RelicRites([g], [enemy()], cfg({ openImmune: 3 }), spy());
    rites.open();
    g.st.immune = 0;  // os 3s acabaram, como `tickStatus` faria na briga
    run(rites, 20);
    expect(g.st.immune).toBe(0);
  });

  it('um grito para o time, nao um por guerreiro', () => {
    const time = [dude('Warrior'), dude('Warrior'), dude('Warrior')];
    const rites = new RelicRites(time, [enemy()], cfg({ openImmune: 3 }), spy());
    rites.open();
    expect(time.map(d => d.shouts.length)).toEqual([1, 0, 0]);
    expect(time.every(d => d.st.immune === 3)).toBe(true);
  });
});

describe('COVA (Morto-vivo)', () => {
  it('cadaver novo cura e engorda os mortos-vivos', () => {
    const zumbi = dude('Undead', { hp: 40 });
    const outro = dude('Warrior', { hp: 40 });
    const horda = [enemy(), enemy(), enemy()];
    const rites = new RelicRites([zumbi, outro], horda, cfg({ corpseFeast: 6 }), spy());

    (horda[0] as Fake).hp = 0;
    (horda[1] as Fake).hp = 0;
    run(rites, 0.3);

    expect(zumbi.healed).toBe(12);      // 6 por cadaver, dois cadaveres
    expect(zumbi.hp).toBe(52);
    expect(zumbi.atk).toBe(12);         // +1 de ataque por cadaver
    expect(outro.healed).toBe(0);       // nao e da familia
    expect(outro.atk).toBe(10);
    expect(zumbi.shouts).toEqual(['+2 CADAVERES']);
  });

  it('corpo que ja estava caido quando a briga abriu nao vale banquete', () => {
    const zumbi = dude('Undead', { hp: 40 });
    const horda = [enemy(false), enemy(false), enemy()];
    const rites = new RelicRites([zumbi], horda, cfg({ corpseFeast: 6 }), spy());
    run(rites, 1);
    expect(zumbi.healed).toBe(0);
    expect(zumbi.atk).toBe(10);
  });

  it('so o cadaver NOVO paga: a mesma horda caida nao paga duas vezes', () => {
    const zumbi = dude('Undead', { hp: 10 });
    const horda = [enemy(), enemy()];
    const rites = new RelicRites([zumbi], horda, cfg({ corpseFeast: 6 }), spy());
    (horda[0] as Fake).hp = 0;
    run(rites, 0.3);
    expect(zumbi.healed).toBe(6);
    run(rites, 5);                      // ninguem mais caiu
    expect(zumbi.healed).toBe(6);
    expect(zumbi.shouts).toEqual(['CADAVER!']);
  });

  /**
   * O TETO DO BANQUETE. A wave 90 joga 95 cadaveres na mesa; sem teto o esqueleto
   * sairia com +95 de ataque. O morto-vivo no maximo DOBRA o ataque de fabrica.
   */
  it('o ataque para em dobro do de fabrica, por mais cadaver que caia', () => {
    const zumbi = dude('Undead', { atk: 10, maxHp: 400, hp: 400 });
    const horda = Array.from({ length: 95 }, () => enemy());
    const rites = new RelicRites([zumbi], horda, cfg({ corpseFeast: 6 }), spy());
    for (const e of horda) (e as Fake).hp = 0;
    run(rites, 2);
    expect(zumbi.atk).toBe(20);
    // e a cura NAO tem teto de reliquia — quem cura demais e o `healBy` do corpo
    expect(zumbi.healed).toBe(95 * 6);
  });

  it('morto-vivo que entrou na briga mais forte tem o teto mais alto', () => {
    const forte = dude('Undead', { atk: 30 });
    const horda = Array.from({ length: 50 }, () => enemy());
    const rites = new RelicRites([forte], horda, cfg({ corpseFeast: 6 }), spy());
    for (const e of horda) (e as Fake).hp = 0;
    run(rites, 2);
    expect(forte.atk).toBe(60);
  });

  it('morto-vivo caido nao come', () => {
    const caido = dude('Undead', { hp: 0 });
    const horda = [enemy()];
    const rites = new RelicRites([caido], horda, cfg({ corpseFeast: 6 }), spy());
    (horda[0] as Fake).hp = 0;
    run(rites, 1);
    expect(caido.healed).toBe(0);
  });
});

describe('SINDICATO (Operario)', () => {
  it('operario que cai apressa os outros operarios vivos', () => {
    const morto = dude('Employed');
    const colega = dude('Employed');
    const outro = dude('Employed');
    const cavaleiro = dude('Warrior');
    const rites = new RelicRites([morto, colega, outro, cavaleiro], [enemy()],
      cfg({ unionRush: 5 }), spy());

    morto.hp = 0;
    run(rites, 0.3);

    expect(colega.st.rush).toBe(5);
    expect(colega.st.rushPow).toBeCloseTo(0.4);
    expect(outro.st.rush).toBe(5);
    expect(cavaleiro.st.rush).toBe(0);
    expect(colega.shouts).toEqual(['SINDICATO!']);
    expect(outro.shouts).toEqual([]);
  });

  it('reage as SUAS perdas: cavaleiro caindo nao para a linha de producao', () => {
    const operario = dude('Employed');
    const cavaleiro = dude('Warrior');
    const rites = new RelicRites([operario, cavaleiro], [enemy()], cfg({ unionRush: 5 }), spy());
    cavaleiro.hp = 0;
    run(rites, 1);
    expect(operario.st.rush).toBe(0);
  });

  it('inimigo caindo tambem nao conta — o luto e do rancho', () => {
    const operario = dude('Employed');
    const horda = [enemy(), enemy()];
    const rites = new RelicRites([operario], horda, cfg({ unionRush: 5 }), spy());
    (horda[0] as Fake).hp = 0;
    (horda[1] as Fake).hp = 0;
    run(rites, 1);
    expect(operario.st.rush).toBe(0);
  });

  it('cada perda nova apressa de novo, e a perda velha nao', () => {
    const a = dude('Employed'), b = dude('Employed'), c = dude('Employed');
    const rites = new RelicRites([a, b, c], [enemy()], cfg({ unionRush: 5 }), spy());
    a.hp = 0;
    run(rites, 0.3);
    b.st.rush = 0; c.st.rush = 0;       // como `tickStatus` faria depois dos 5s
    run(rites, 5);
    expect(c.st.rush).toBe(0);          // ninguem novo caiu
    b.hp = 0;
    run(rites, 0.3);
    expect(c.st.rush).toBe(5);
    // o grito e do PRIMEIRO vivo da familia: na primeira perda foi o b, agora e o c
    expect(b.shouts).toEqual(['SINDICATO!']);
    expect(c.shouts).toEqual(['SINDICATO!']);
  });
});

describe('GRIMORIO (Fantasia)', () => {
  it('adianta o RELOGIO do traco e nao toca em ataque nem vida', () => {
    const mago = dude('Fantasy');
    mago.tr.cd = 2;
    const rites = new RelicRites([mago], [enemy()], cfg({ traitHaste: 0.35 }), spy());
    run(rites, 0.3);
    // uma passada de 0.3s adianta 0.3 * 0.35 = 0.105s
    expect(mago.tr.cd).toBeCloseTo(1.895, 3);
    expect(mago.atk).toBe(10);
    expect(mago.hp).toBe(100);
    expect(mago.attackSpeed).toBe(1);
  });

  it('so a familia fantasia; e nunca passa de zero', () => {
    const mago = dude('Fantasy');
    const robo = dude('SciFi');
    mago.tr.cd = 0.05;
    robo.tr.cd = 2;
    const rites = new RelicRites([mago, robo], [enemy()], cfg({ traitHaste: 0.35 }), spy());
    run(rites, 3);
    expect(mago.tr.cd).toBe(0);
    expect(robo.tr.cd).toBe(2);
  });

  it('relogio parado em zero fica em zero (nao vira negativo)', () => {
    const mago = dude('Fantasy');
    const rites = new RelicRites([mago], [enemy()], cfg({ traitHaste: 0.35 }), spy());
    run(rites, 5);
    expect(mago.tr.cd).toBe(0);
  });
});

describe('PLASMA (Espacial)', () => {
  it('abre a briga com escudo em fracao da vida maxima', () => {
    const robo = dude('SciFi', { maxHp: 200, hp: 200 });
    const mago = dude('Fantasy', { maxHp: 200, hp: 200 });
    const rites = new RelicRites([robo, mago], [enemy()], cfg({ plasmaShield: 0.25 }), spy());
    rites.open();
    expect(robo.st.shield).toBe(50);
    expect(mago.st.shield).toBe(0);
  });

  it('estourou, conta 8s e volta sozinho — a briga inteira', () => {
    const robo = dude('SciFi', { maxHp: 200, hp: 200 });
    const rites = new RelicRites([robo], [enemy()], cfg({ plasmaShield: 0.25 }), spy());
    rites.open();

    robo.st.shield = 0;                 // a horda comeu o escudo
    run(rites, 7);
    expect(robo.st.shield).toBe(0);     // ainda nao
    run(rites, 1.5);
    expect(robo.st.shield).toBe(50);    // 8s depois de estourar
    expect(robo.bursts).toBe(1);

    robo.st.shield = 0;                 // e estoura de novo
    run(rites, 8.5);
    expect(robo.st.shield).toBe(50);
    expect(robo.bursts).toBe(2);
  });

  /**
   * O RELOGIO SO ANDA QUEBRADO. Quem passou a briga inteira com o escudo de pe nao
   * guarda recarga acumulada para gastar no instante em que ele estoura.
   */
  it('escudo de pe nao acumula recarga guardada', () => {
    const robo = dude('SciFi', { maxHp: 200, hp: 200 });
    const rites = new RelicRites([robo], [enemy()], cfg({ plasmaShield: 0.25 }), spy());
    rites.open();
    run(rites, 30);                     // meia briga com o escudo intacto
    expect(robo.bursts).toBe(0);
    robo.st.shield = 0;
    run(rites, 2);
    expect(robo.st.shield).toBe(0);     // os 30s de antes nao contaram
    run(rites, 6.5);
    expect(robo.st.shield).toBe(50);
  });

  it('robo caido nao se recarrega', () => {
    const robo = dude('SciFi', { maxHp: 200, hp: 200 });
    const rites = new RelicRites([robo], [enemy()], cfg({ plasmaShield: 0.25 }), spy());
    rites.open();
    robo.st.shield = 0;
    robo.hp = 0;
    run(rites, 20);
    expect(robo.st.shield).toBe(0);
    expect(robo.bursts).toBe(0);
  });

  it('o teto do escudo e do proprio `addShield`, nao do ritual', () => {
    // 90% da vida maxima pedido, mas `addShield` corta em 60%
    const robo = dude('SciFi', { maxHp: 100, hp: 100 });
    const rites = new RelicRites([robo], [enemy()], cfg({ plasmaShield: 0.9 }), spy());
    rites.open();
    expect(robo.st.shield).toBe(60);
  });
});

describe('HOLOFOTE (Acao)', () => {
  it('paga o ultimo cara de acao de pe, uma vez', () => {
    const a = dude('Action', { atk: 10, attackSpeed: 1 });
    const b = dude('Action');
    const c = dude('Action');
    const rites = new RelicRites([a, b, c], [enemy()], cfg({ lastStand: 1 }), spy());

    run(rites, 1);
    expect(a.atk).toBe(10);             // tres de pe: nao e a ultima cena

    b.hp = 0; c.hp = 0;
    run(rites, 0.3);
    expect(a.atk).toBe(20);             // 1 = o dobro
    expect(a.attackSpeed).toBeCloseTo(1.5);
    expect(a.shouts).toEqual(['ULTIMA CENA!']);
    expect(a.bursts).toBe(1);

    run(rites, 20);                     // e nao paga de novo pelo resto da briga
    expect(a.atk).toBe(20);
    expect(a.attackSpeed).toBeCloseTo(1.5);
    expect(a.shouts).toHaveLength(1);
  });

  /**
   * COM UM CARA DE ACAO SO NO TIME a reliquia seria +100% de ataque de graca desde
   * o primeiro segundo — de novo uma planilha. Ela existe para o momento em que o
   * time de acao caiu todo e sobrou um.
   */
  it('cara de acao sozinho no rancho nunca acende o holofote', () => {
    const solo = dude('Action');
    const zumbi = dude('Undead');
    const rites = new RelicRites([solo, zumbi], [enemy()], cfg({ lastStand: 1 }), spy());
    run(rites, 30);
    expect(solo.atk).toBe(10);
    expect(solo.attackSpeed).toBe(1);
    expect(solo.shouts).toEqual([]);
  });

  it('time de acao inteiro caido nao paga ninguem', () => {
    const a = dude('Action', { hp: 0 });
    const b = dude('Action', { hp: 0 });
    const rites = new RelicRites([a, b], [enemy()], cfg({ lastStand: 1 }), spy());
    run(rites, 5);
    expect(a.atk).toBe(10);
    expect(b.atk).toBe(10);
  });

  it('outras familias caindo nao acendem o holofote', () => {
    const acao = dude('Action');
    const outroAcao = dude('Action');
    const cavaleiro = dude('Warrior');
    const rites = new RelicRites([acao, outroAcao, cavaleiro], [enemy()],
      cfg({ lastStand: 1 }), spy());
    cavaleiro.hp = 0;
    run(rites, 5);
    expect(acao.atk).toBe(10);
    expect(outroAcao.atk).toBe(10);
  });
});

describe('o relogio dos rituais', () => {
  /**
   * A ABA QUE VOLTOU DO FUNDO entrega um delta de dois segundos. Sem a apara em
   * 250ms, o plasma se recarregaria e o grimorio adiantaria meia briga num frame.
   */
  it('delta gigante e aparado em 250ms — nada de viagem no tempo', () => {
    const mago = dude('Fantasy');
    mago.tr.cd = 10;
    const rites = new RelicRites([mago], [enemy()], cfg({ traitHaste: 0.35 }), spy());
    rites.step(60000);
    expect(mago.tr.cd).toBeCloseTo(10 - 0.25 * 0.35, 4);
  });

  it('delta negativo ou zero nao anda o relogio', () => {
    const mago = dude('Fantasy');
    mago.tr.cd = 5;
    const rites = new RelicRites([mago], [enemy()], cfg({ traitHaste: 0.35 }), spy());
    for (let i = 0; i < 50; i++) { rites.step(0); rites.step(-1000); }
    expect(mago.tr.cd).toBe(5);
  });

  it('espera os 250ms e depois cobra o tempo REAL que passou', () => {
    const mago = dude('Fantasy');
    mago.tr.cd = 5;
    const rites = new RelicRites([mago], [enemy()], cfg({ traitHaste: 1 }), spy());
    for (let i = 0; i < 4; i++) rites.step(60);
    expect(mago.tr.cd).toBe(5);                // 240ms: a passada ainda nao veio
    rites.step(60);
    // e quando vem, ela adianta os 300ms que passaram de verdade, nao 250 fixos
    expect(mago.tr.cd).toBeCloseTo(4.7, 4);
  });
});

describe('os seis juntos', () => {
  it('um rancho de seis familias com as seis reliquias recebe cada ritual no seu', () => {
    const rs = new RelicSystem([
      { id: 'warhorn' }, { id: 'graveyard' }, { id: 'union' },
      { id: 'grimoire' }, { id: 'plasma' }, { id: 'spotlight' }
    ] as any[]);
    const guerreiro = dude('Warrior');
    const zumbi = dude('Undead', { hp: 50 });
    const op1 = dude('Employed'), op2 = dude('Employed');
    const mago = dude('Fantasy');
    const robo = dude('SciFi', { maxHp: 200, hp: 200 });
    const acao1 = dude('Action'), acao2 = dude('Action');
    const horda = [enemy(), enemy()];
    mago.tr.cd = 3;

    const time = [guerreiro, zumbi, op1, op2, mago, robo, acao1, acao2];
    const rites = new RelicRites(time, horda, riteConfig(rs), spy());
    expect(rites.idle).toBe(false);
    rites.open();
    expect(guerreiro.st.immune).toBe(3);
    expect(robo.st.shield).toBe(50);

    (horda[0] as Fake).hp = 0;
    op2.hp = 0;
    acao2.hp = 0;
    run(rites, 0.3);

    expect(zumbi.healed).toBe(6);
    expect(op1.st.rush).toBe(5);
    expect(mago.tr.cd).toBeLessThan(3);
    expect(acao1.atk).toBe(20);
    // e nenhum ritual escorreu para a familia errada
    expect(guerreiro.healed).toBe(0);
    expect(mago.st.rush).toBe(0);
    expect(zumbi.st.shield).toBe(0);
    expect(op1.atk).toBe(10);
  });
});
