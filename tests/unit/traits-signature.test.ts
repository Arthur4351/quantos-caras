import { describe, it, expect, vi } from 'vitest';

/**
 * NENHUM CARA E OUTRO CARA COM NUMERO DIFERENTE — a prova mecanica.
 *
 * `traits.test.ts` cobre a TABELA (todo cara tem traco, todo traco tem nome, frase
 * e gancho). `e2e/traits-live.spec.ts` cobre a EXECUCAO (todo gancho dispara numa
 * briga de verdade). Nenhum dos dois responde a pergunta que gerou os 42 tracos:
 * dois caras diferentes FAZEM coisas diferentes?
 *
 * Um traco pode ter nome proprio, frase propria, gancho proprio, disparar em campo
 * e ainda assim ser o vizinho com outro multiplicador — `c.hit(alvo, atk*1.5)` de
 * um lado, `c.hit(alvo, atk*2)` do outro. Passa em tudo e nao muda nada na tela.
 *
 * Este teste chama TODOS os ganchos de TODOS os tracos contra um mundo de mentira
 * que ANOTA VERBOS, nao numeros: quem aplicou atordoamento, quem invocou corpo,
 * quem escreveu em `aimMode`, quem mexeu no proprio tamanho, quem pediu ouro. O
 * numero fica de fora DE PROPOSITO — se as quantias entrassem na assinatura, dois
 * tracos identicos com multiplicadores diferentes pareceriam distintos e o teste
 * provaria o contrario do que promete.
 *
 * Assinatura igual = alguem e clone. E o unico jeito de travar por automacao a
 * regra que abre `traits.ts`: "se dois tracos pudessem ser trocados por um
 * parametro, um dos dois esta errado".
 */

const rec = vi.hoisted(() => ({
  /** Verbos observados desde o ultimo `zerar()`. */
  log: [] as string[],
  /** Setup e reset entre ganchos nao contam como efeito do traco. */
  gravando: false,
  /** Fundo de pilha: um fx que chama outro fx nao pode girar para sempre. */
  fundo: 0,
  /** Quantas vezes cada fx saiu DENTRO da chamada atual — um tiro ou uma salva. */
  porChamada: new Map<string, number>(),
  /** Quem e o "eu" da vez — separa "atordoa o inimigo" de "acelera a si mesmo". */
  eu: null as unknown,
  /** Alvo padrao para os callbacks que os fx recebem. */
  alvo: null as unknown,
  STATUS: [
    'applyBurn', 'applyGuard', 'applyImmune', 'applyRoot', 'applyRush',
    'applySlow', 'applyStun', 'applyVuln', 'addFrost', 'addShield', 'cleanse'
  ],
  FX: [
    'aegisFlare', 'arcShell', 'beamDown', 'breathCone', 'coinPop', 'curseGlyph',
    'dashStreak', 'flameLick', 'freezeBlock', 'frostShard', 'healPlus', 'lineSlash',
    'noteFloat', 'plagueBurst', 'rootSnare', 'shockRing', 'smokePop', 'soulBurst',
    'starFall', 'stunSpin', 'traitCall', 'zapArc'
  ]
}));

function anota(verbo: string): void {
  if (rec.gravando) rec.log.push(verbo);
}

/** O Phaser aqui e so tres funcoes de matematica — as que os tracos realmente usam. */
vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (a: number, b: number) => Math.floor((a + b) / 2),
      Clamp: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
      Distance: {
        Squared: (x1: number, y1: number, x2: number, y2: number) =>
          (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
      }
    },
    GameObjects: {},
    Scenes: {}
  }
}));

/**
 * OS ESTADOS ANOTAM EM QUEM CAIRAM, nao quanto tempo duram.
 *
 * "Atordoa o inimigo" e "acelera a si mesmo" sao verbos diferentes mesmo usando a
 * mesma familia de funcao, e essa diferenca e estrutural — ao contrario da duracao,
 * que e o parametro que este teste existe para ignorar.
 */
vi.mock('../../src/systems/status', () => {
  const m: Record<string, unknown> = {};
  for (const n of rec.STATUS) {
    m[n] = (quem: unknown) => anota(`status:${n}(${quem === rec.eu ? 'eu' : 'outro'})`);
  }
  return m;
});

/**
 * OS EFEITOS RODAM OS PROPRIOS CALLBACKS.
 *
 * O meteoro do mago nao machuca ninguem na chamada de `starFall` — o dano esta
 * DENTRO da funcao que ele passa, chamada quando a pedra pousa. Sem executar esses
 * callbacks a assinatura do mago seria "desenhou uma estrela" e o teste nao veria o
 * golpe. O fundo de pilha existe porque um fx pode agendar outro.
 *
 * E CONTA OS TIROS DA MESMA CHAMADA. Um golpe que sai UMA vez e um golpe que sai
 * QUATRO vezes no mesmo instante nao sao o mesmo golpe com outro numero: um acerta
 * um corpo, o outro cobre uma area com varios pontos de impacto. `salva:` marca a
 * segunda ocorrencia do mesmo efeito na mesma chamada, e e o que separa os tres
 * bombardeios do jogo — os quatro misseis do mech, as oito estrelas do starlord e
 * a bala unica e cega do pirata.
 */
vi.mock('../../src/art/fx', () => {
  const m: Record<string, unknown> = {};
  for (const n of rec.FX) {
    m[n] = (...args: unknown[]) => {
      anota(`fx:${n}`);
      const vezes = (rec.porChamada.get(n) ?? 0) + 1;
      rec.porChamada.set(n, vezes);
      if (vezes === 2) anota(`salva:${n}`);
      if (rec.fundo > 2) return;
      rec.fundo++;
      for (const a of args) {
        if (typeof a === 'function') {
          try { (a as (t: unknown, d: number) => void)(rec.alvo, 1); } catch { /* anotado no gancho */ }
        }
      }
      rec.fundo--;
    };
  }
  return m;
});

import { TRAIT_LIST, TraitCtx, Trait, DamageEvent } from '../../src/systems/traits';

type Corpo = Record<string, any>;

let seq = 0;

/** Saco de estado que anota em QUAL campo o traco escreveu. */
function saco(marca: string, campos: Corpo): Corpo {
  return new Proxy(campos, {
    set(t, k, v) { anota(`${marca}:${String(k)}`); t[k as string] = v; return true; }
  });
}

/**
 * UM CORPO DE MENTIRA COM A SUPERFICIE INTEIRA DO `Fighter`.
 *
 * Nao e um `Fighter` de verdade: aquele estende `Container` do Phaser e precisa de
 * um renderer. E tambem nao pode ser um objeto vazio — traco que le `hitY` de
 * `undefined` explode, e o teste registraria "explodiu" onde o defeito e o boneco
 * de teste. Entao aqui estao todos os campos que os 42 tracos tocam, com valores
 * que fazem qualquer conta fechar, e um Proxy que ANOTA cada escrita.
 */
function corpo(marca: string, lado: 'dude' | 'enemy', x: number, y: number): Corpo {
  const cru: Corpo = {
    uid: ++seq, team: lado, hp: 80, maxHp: 100, atk: 10, range: 60,
    attackSpeed: 1, moveSpeed: 100, downed: false, cd: 0, summonCd: 0,
    auraAtk: 1, auraSpeed: 1, x, y, hitY: y - 120, aimMode: 'near',
    baseScale: 1, startScale: 1, visualHeight: 184, bodyRadius: 40,
    pinDepth: 0, suspendDrop: 0, traitId: marca, alpha: 1, scale: 1,
    st: saco(`${marca}.st`, {
      burn: 0, burnDps: 0, stun: 0, root: 0, frost: 0, slow: 0, slowPow: 0,
      shield: 0, guard: 0, immune: 0, vuln: 0, rush: 0, rushPow: 0, charm: 0,
      suspend: 0, evasive: 0, dodgeEvery: 0
    }),
    tr: saco(`${marca}.tr`, {
      hits: 0, taken: 0, stacks: 0, cd: 0, timer: 0, used: false,
      aimId: 0, acc: 0, acc2: 0, risen: false
    }),
    kit: saco(`${marca}.kit`, {
      block: 0, regen: 0, heal: 0, taunt: 0, crit: 0, aoe: 0, cleave: 0,
      lifesteal: 0, enrage: 0, rally: 0.1, haste: 0, summon: 0,
      deathscale: 0, goldBonus: 0
    })
  };
  for (const m of ['swing', 'syncRig', 'setPosition', 'setAlpha', 'grow', 'healBy',
    'setMaxHp', 'hurt', 'down', 'raise', 'punch', 'setSuspended', 'restoreTint',
    'deathBlow', 'destroyRig']) {
    cru[m] = () => anota(`${marca}:${m}()`);
  }
  cru.isTargetable = () => true;
  cru.isAlive = () => true;
  Object.defineProperty(cru, 'side', { get: () => cru.team, configurable: true });
  return new Proxy(cru, {
    set(t, k, v) { anota(`${marca}:${String(k)}`); t[k as string] = v; return true; }
  });
}

/**
 * OS AVISOS QUE ACONTECEM MUITAS VEZES NUMA BRIGA — em oposicao a `onSpawn`
 * (nasce uma vez) e `onDown` (cai uma vez).
 *
 * A diferenca nao e cosmetica. Chamando `onDown` em toda volta, o esqueleto nunca
 * se remonta: `onDown` REARMA o relogio de 3s (`tr.timer = 3`) e `onTick` desconta
 * 1/60 — o cronometro andava para tras e o traco aparecia na ficha como "escreveu
 * um timer", sem o `eu:raise()` que e a coisa toda. Nascer uma vez, brigar muito,
 * cair uma vez e continuar caido e a ordem que o motor de verdade usa.
 */
const GANCHOS_DE_BRIGA: (keyof Trait)[] = [
  'onTick', 'onStrike', 'onHit', 'onHurt', 'onBlock', 'onKill'
];

/**
 * QUANTOS PASSOS — medido pelo gatilho mais lento do elenco, nao arredondado.
 *
 * Varios tracos nao dependem de contador de golpes e sim de TEMPO acumulado, e
 * `c.dt` aqui vale 1/60 como no jogo. O REFRAO do bardo sobe o primeiro degrau em
 * 4s (240 passos) e a REMONTA do esqueleto leva 3s (180) depois da queda. Com as
 * 12 voltas de antes, o mundo de teste inteiro durava 0.2s: os dois apareciam como
 * tracos que so escrevem num campo e param, e um numero desses na ficha nao prova
 * nada — dois tracos silenciados pela mesma limitacao do teste pareceriam
 * distintos so porque escreveram em campos de nome diferente.
 */
const PASSOS = 300;

/**
 * A ASSINATURA DE UM TRACO: o conjunto de verbos que ele usa, sem repeticao e sem
 * quantidade. Cada gancho de briga e chamado `PASSOS` vezes porque varios efeitos
 * sao contados (o IAI do samurai sai no quinto golpe, a raiva do barbaro grita a
 * cada cinco pilhas) ou cronometrados (o refrao do bardo, a remonta do esqueleto).
 *
 * O relogio pessoal (`tr.cd`) e zerado ENTRE as chamadas, fora da gravacao: no jogo
 * quem zera e o tempo, e aqui o tempo nao anda. Sem isso todo traco periodico
 * apareceria como "lancou uma vez e ficou quieto".
 */
function assinatura(t: Trait): { verbos: string[]; erros: string[] } {
  rec.gravando = false;
  const eu = corpo('eu', 'dude', 900, 600);
  const aliados = [eu, corpo('amigo', 'dude', 820, 560), corpo('amigo', 'dude', 980, 640)];
  /**
   * OS COMPANHEIROS TEM TRACO DE VERDADE, e o mesmo traco nos dois.
   *
   * O APRENDIZ troca a propria identidade pela de um colega, e so aceita colega
   * cujo `traitId` exista em `TRAITS`. Com bonecos batizados 'amigo' ele caia
   * sempre no galho de consolo (`applyRush` em si mesmo) e a copia — que e o traco
   * inteiro — nunca era medida. Os dois carregam 'knight' e nao um traco cada
   * porque a escolha e `Math.random()`: com ids diferentes a ficha do aprendiz
   * mudaria de rodada em rodada.
   */
  aliados[1].traitId = 'knight';
  aliados[2].traitId = 'knight';
  const inimigos = [
    corpo('inimigo', 'enemy', 1100, 600),
    corpo('inimigo', 'enemy', 1160, 560),
    corpo('inimigo', 'enemy', 1180, 660)
  ];
  const caidos = [corpo('caido', 'enemy', 1200, 700)];
  const invocado = corpo('invocado', 'dude', 900, 640);
  rec.eu = eu;
  rec.alvo = inimigos[0];

  /**
   * O MOTOR ANOTA TAMBEM O QUE O TRACO OLHA, nao so o que ele faz.
   *
   * Quem consulta a lista de inimigos para escolher onde bater e quem atira as
   * cegas numa distancia fixa fazem coisas diferentes mesmo gastando o mesmo verbo
   * — e o caso do pirata, cuja bala cai 350..700px a frente doa a quem estiver la.
   * Ler a arena e a marca de quem calcula um PONTO NO CHAO em vez de mirar num
   * corpo. Nada disso e quantidade: e de onde vem o alvo.
   */
  /**
   * AS BAIXAS SOBEM, uma por consulta.
   *
   * `fallen()` devolvia 4 sempre. O COLETA OSSOS do cavaleiro-osso anota o numero
   * ao nascer e so cresce quando ele SOBE (`if (down <= tr.acc) return`) — com um
   * numero fixo ele nunca crescia, e o unico traco do jogo que muda de TAMANHO na
   * tela aparecia na ficha como "leu as baixas e escreveu um contador". Numa briga
   * de verdade os corpos se acumulam; aqui tambem.
   */
  let mortos = 0;

  const eng = {
    scene: { CENA: true },
    get arena() { anota('ctx:arena'); return { minX: 200, maxX: 1720, minY: 200, maxY: 880 }; },
    sideList: (side: string) => {
      anota(side === eu.team ? 'ctx:allies' : 'ctx:foes');
      return side === eu.team ? aliados : inimigos;
    },
    fallen: () => { anota('ctx:fallen'); return ++mortos; },
    fallenList: () => { anota('ctx:fallenList'); return caidos; },
    near: (_x: number, _y: number, _r: number, side: string, out: Corpo[]) => {
      anota(side === eu.team ? 'ctx:alliesNear' : 'ctx:foesNear');
      out.length = 0;
      for (const f of side === eu.team ? aliados : inimigos) out.push(f);
      return out;
    },
    /**
     * O GOLPE ANOTA POR QUAL PORTA ELE PASSA.
     *
     * `HitKind` nao e quantidade: e se o dano NEGOCIA. `'true'` atravessa escudo,
     * guarda e imunidade; `'hit'` e cobrado como golpe e ainda pode ser aparado;
     * `'dot'` queima por fora e nao conta como pancada. A DEMISSAO do CEO e uma
     * execucao inegociavel e o TROCO do caixa e um trocado que o escudo apara —
     * duas coisas mecanicamente opostas que, sem isto, sairiam na ficha como o
     * mesmo `eng:hit`.
     */
    hit: (_by: Corpo, _t: Corpo, _amount: number, kind = 'true') => {
      anota(`eng:hit:${kind}`);
      return 5;
    },
    claim: () => true,
    shoot: (_by: Corpo, alvo: Corpo, dmg: number, _tint: number,
            onHit?: (t: Corpo, d: number) => void) => {
      anota('eng:shoot');
      onHit?.(alvo, dmg);
    },
    summon: (_by: Corpo, kind: string) => { anota(`eng:summon:${kind}`); return invocado; },
    addZone: (z: { kind: string }) => anota(`eng:zone:${z.kind}`),
    gold: () => anota('eng:gold')
  };

  const c = new TraitCtx(eng as never, eu as never);
  const erros: string[] = [];
  rec.log = [];

  /**
   * TRES MUNDOS, PORQUE TRES TRACOS DEPENDEM DO MUNDO E NAO DE CONTADOR.
   *
   * O ULTIMO SUSPIRO do viking so existe no instante em que a vida chega a zero
   * (`if (s.hp > 0) return`); o PELAS COSTAS do espiao so existe quando o inimigo
   * esta mirando OUTRA pessoa (`if (!target.aim || target.aim === c.self) return`);
   * e a DEMISSAO EM MASSA do CEO so existe contra quem esta abaixo de 15% de vida
   * (`if (t.hp / t.maxHp > 0.15) continue`). Num mundo de teste sempre saudavel,
   * sem mira e com inimigo inteiro, esses tres aparecem como tracos MUDOS — e nao
   * sao: `e2e/traits-live.spec.ts` conta 29 disparos do viking e 9 do espiao em
   * briga de verdade. A ficha e a UNIAO das tres passadas, e uniao so ACRESCENTA
   * verbo: nenhum cenario novo pode esconder o que outro mostrou.
   */
  const CENARIOS: { nome: string; prepara: () => void }[] = [
    {
      nome: 'inteiro',
      prepara: () => {
        eu.hp = 80; eu.downed = false; eu.tr.used = false;
        for (const f of inimigos) { f.aim = undefined; f.hp = 80; f.maxHp = 100; }
      }
    },
    {
      nome: 'na beira',
      prepara: () => {
        eu.hp = 0; eu.downed = false; eu.tr.used = false;
        // mirando o companheiro, nao o portador: e o gatilho do espiao
        for (const f of inimigos) { f.aim = aliados[1]; f.hp = 80; f.maxHp = 100; }
      }
    },
    {
      nome: 'inimigo na lona',
      prepara: () => {
        eu.hp = 80; eu.downed = false; eu.tr.used = false;
        for (const f of inimigos) { f.aim = undefined; f.hp = 4; f.maxHp = 100; }
      }
    }
  ];

  /** Uma chamada de gancho, com o mundo arrumado e a gravacao ligada em volta. */
  const chama = (g: keyof Trait, cen: string): void => {
    const fn = t[g];
    if (typeof fn !== 'function') return;
    rec.gravando = false;
    eu.tr.cd = 0;
    rec.porChamada.clear();
    // o golpe tambem e anotado: quem triplica o dano, quem vira critico e quem
    // resolve o golpe sozinho fazem tres coisas mecanicamente diferentes
    const ev = saco('ev', { amount: 10, crit: false, handled: false }) as DamageEvent;
    rec.gravando = true;
    try {
      const h = fn as (...a: unknown[]) => void;
      if (g === 'onStrike') h.call(t, c, inimigos[0], ev);
      else if (g === 'onHit') h.call(t, c, inimigos[0], 7);
      else if (g === 'onHurt') h.call(t, c, 6, inimigos[0], 'hit');
      else if (g === 'onBlock' || g === 'onKill') h.call(t, c, inimigos[0]);
      else h.call(t, c);
    } catch (e) {
      erros.push(`${t.id}.${g} [${cen}]: ${(e as Error).message}`);
    }
    rec.gravando = false;
  };

  /**
   * A VIDA DE UM CARA, na ordem em que o motor a toca: nasce, briga muito, cai, e
   * continua caido. A segunda rodada de `onTick` e o que o `tickDown` existe para
   * cobrir — o esqueleto se remontando do chao acontece SO ali.
   */
  for (const cen of CENARIOS) {
    cen.prepara();
    chama('onSpawn', cen.nome);
    for (let volta = 0; volta < PASSOS; volta++) {
      for (const g of GANCHOS_DE_BRIGA) chama(g, cen.nome);
    }
    eu.downed = true;
    chama('onDown', cen.nome);
    for (let volta = 0; volta < PASSOS; volta++) chama('onTick', cen.nome);
    eu.downed = false;
  }

  return { verbos: [...new Set(rec.log)].sort(), erros };
}

const FICHAS = TRAIT_LIST.map(t => ({ id: t.id, name: t.name, ...assinatura(t) }));

/** Verbo que muda o jogo, em oposicao a `fx:` (que so pinta a tela). */
const MECANICO = (v: string) => !v.startsWith('fx:');

/**
 * `FICHAS=1` liga o relatorio. Lido por `globalThis` de proposito: o projeto nao
 * tem `@types/node` instalado (o `tsc --noEmit` cobre `src`, `tests` e `e2e` com
 * as libs do navegador), e `process` global reprovaria o typecheck por causa de
 * uma linha de depuracao.
 */
const MOSTRA_FICHAS = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.FICHAS
);

describe('cada cara faz uma coisa diferente', () => {
  it('nenhum traco explode contra um corpo minimo', () => {
    const quebrados = FICHAS.flatMap(f => f.erros);
    expect(quebrados, 'ganchos que jogaram excecao').toEqual([]);
  });

  it('todo traco faz ALGUMA coisa observavel', () => {
    const vazios = FICHAS.filter(f => f.verbos.length === 0).map(f => f.id);
    expect(vazios, 'tracos que nao produziram efeito nenhum').toEqual([]);
  });

  /**
   * ARTE SEM MECANICA E CENARIO, NAO PERSONAGEM. Um traco que so chama `shockRing`
   * pisca bonito e nao muda a briga — e a definicao de generico com outro nome.
   */
  it('nenhum traco e so efeito visual', () => {
    const enfeites = FICHAS.filter(f => !f.verbos.some(MECANICO))
      .map(f => `${f.id} (${f.name}): ${f.verbos.join(' ')}`);
    expect(enfeites, 'tracos que so desenham').toEqual([]);
  });

  /**
   * O TESTE QUE O PEDIDO ORIGINAL EXIGE.
   *
   * Duas fichas iguais significam dois caras que fazem a MESMA coisa — e como a
   * assinatura ignora quantidade, iguais aqui e igual de verdade: trocar um pelo
   * outro muda a planilha e nao muda a briga.
   */
  it('nao existem dois tracos com a mesma assinatura mecanica', () => {
    const porFicha = new Map<string, string[]>();
    for (const f of FICHAS) {
      const chave = f.verbos.filter(MECANICO).join(' ');
      porFicha.set(chave, [...(porFicha.get(chave) ?? []), f.id]);
    }
    const clones = [...porFicha.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([chave, ids]) => `${ids.join(' == ')} -> ${chave || '(nada)'}`);
    expect(clones, 'caras que sao o mesmo cara').toEqual([]);
  });

  /**
   * E O ELENCO NAO PODE SER TRES VERBOS RECOMBINADOS. 42 assinaturas distintas
   * feitas de cinco verbos ainda seriam 42 variacoes do mesmo jogo; o vocabulario
   * tem de ser largo. Medido hoje: 75 verbos mecanicos distintos. O piso de 45 e
   * folgado de proposito — ele reprova o elenco virar recombinacao de meia duzia
   * de acoes, nao mudanca de nome de campo.
   */
  it('o elenco fala um vocabulario largo de verbos', () => {
    const todos = new Set(FICHAS.flatMap(f => f.verbos.filter(MECANICO)));
    expect(todos.size).toBeGreaterThanOrEqual(45);
  });

  it('as 42 fichas ficam no relatorio para leitura humana', () => {
    const linhas = FICHAS.map(f => `${f.id.padEnd(11)} ${f.name.padEnd(21)} ${f.verbos.join(' ')}`);
    expect(linhas.length).toBe(42);
    if (MOSTRA_FICHAS) console.log(linhas.join('\n'));
  });
});
