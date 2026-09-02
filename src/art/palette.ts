/**
 * HOW MANY DUDES — Art Direction Tokens (canonical).
 *
 * Regras nao-negociaveis desta direcao de arte:
 *  - Cor CHAPADA. Zero gradiente, zero textura, zero blur.
 *  - Todo objeto tem contorno de tinta grossa (ver ink.ts).
 *  - Alto contraste: silhueta legivel a 32px de altura.
 *  - Paleta quente/diurna de rancho. Nada de dark-mode navy.
 */

// ---- Tinta (contornos + tipografia) ----
export const INK = 0x14141c;
export const INK_CSS = '#14141c';
export const INK_SOFT = 0x3a3a4d;
export const INK_SOFT_CSS = '#3a3a4d';

// ---- Ambiente / Dude Ranch ----
export const SKY = 0x7ed1f5;
export const SKY_LOW = 0xbdebff;
export const CLOUD = 0xffffff;
export const HILL = 0x4f9c2c;
export const HILL_FAR = 0x3d7d24;
export const GRASS = 0x6bc23e;
export const GRASS_DARK = 0x55a52d;
export const GRASS_LIGHT = 0x8ad657;
export const DIRT = 0xd6a065;
export const DIRT_DARK = 0xba834a;
export const WOOD = 0xc98f52;
export const WOOD_DARK = 0xa06f3a;

// ---- Papel / UI ----
export const PAPER = 0xfff6e0;
export const PAPER_CSS = '#fff6e0';
export const PAPER_DARK = 0xffe4a8;
export const PAPER_SHADE = 0xe4cd9e;

// ---- Acentos ----
export const GOLD = 0xffc42e;
export const GOLD_CSS = '#ffc42e';
export const GOLD_DARK = 0xdf9f0c;
export const RED = 0xe8402a;
export const RED_CSS = '#e8402a';
export const GREEN = 0x4ec95a;
export const GREEN_CSS = '#3fae4a';
export const BLUE = 0x3b8de8;
export const PURPLE = 0xa55be0;
export const CYAN = 0x17c7c7;
export const ORANGE = 0xff8a1f;
export const WHITE = 0xffffff;
export const WHITE_CSS = '#ffffff';

export interface FamilyPaint { main: number; dark: number; light: number; css: string; }

/** As 6 familias oficiais. Matizes maximamente separados no circulo cromatico. */
export const FAMILY: Record<string, FamilyPaint> = {
  Warrior:  { main: 0xe8402a, dark: 0xb92a18, light: 0xff6d55, css: '#e8402a' },
  Undead:   { main: 0x6ecb3c, dark: 0x4d9d27, light: 0x95e46a, css: '#6ecb3c' },
  Employed: { main: 0x3b8de8, dark: 0x2465b0, light: 0x6fb2f7, css: '#3b8de8' },
  Fantasy:  { main: 0xa55be0, dark: 0x7a37b0, light: 0xc38af0, css: '#a55be0' },
  SciFi:    { main: 0x17c7c7, dark: 0x0d9494, light: 0x5ce4e4, css: '#17c7c7' },
  Action:   { main: 0xff8a1f, dark: 0xd06400, light: 0xffab5c, css: '#ff8a1f' }
};

export const FAMILY_FALLBACK: FamilyPaint = { main: 0x9aa3ad, dark: 0x6d757e, light: 0xc2c9d0, css: '#9aa3ad' };

export function fam(name: string): FamilyPaint { return FAMILY[name] ?? FAMILY_FALLBACK; }

/**
 * O ELENCO FALAVA INGLES NUM JOGO ESCRITO EM PORTUGUES.
 *
 * A tela do diario dizia "O MESMO ELENCO PARA TODO MUNDO HOJE" e logo abaixo
 * estampava CHEF · BONE KNIGHT · ASTRO sobre faixas ACTION, UNDEAD, SCIFI. A loja
 * fazia o mesmo: "WARRIOR · TANK" numa carta cujo botao dizia CONTRATAR. Metade da
 * interface num idioma, a outra metade no outro.
 *
 * `family` e `role` sao CHAVES — a paleta, a sinergia, as conquistas e o desenho do
 * boneco (`dudeSpecs` le 'Tank'/'DPS'/'Support') dependem do valor em ingles. Entao
 * o dado nao muda: traduz-se na hora de MOSTRAR, que e o unico lugar onde o idioma
 * importa. Os nomes dos caras nao sao chave de nada (o `id` e), por isso foram
 * traduzidos direto no `dudes.json`.
 *
 * Rotulos curtos de proposito: a carta da loja imprime "FAMILIA · FUNCAO" numa linha
 * de 336px, e "TRABALHADORES · SUPORTE" nao caberia.
 */
export const FAMILY_PT: Record<string, string> = {
  Warrior: 'GUERREIRO',
  Undead: 'MORTO-VIVO',
  Employed: 'OPERARIO',
  Fantasy: 'FANTASIA',
  SciFi: 'ESPACIAL',
  Action: 'ACAO'
};

export const ROLE_PT: Record<string, string> = {
  Tank: 'TANQUE',
  DPS: 'DANO',
  Support: 'SUPORTE'
};

/** Nome da familia em portugues, em caixa alta. Cai no proprio valor se for novo. */
export function famLabel(family: string): string {
  return FAMILY_PT[family] ?? String(family ?? '').toUpperCase();
}

/** Funcao de combate em portugues, em caixa alta. */
export function roleLabel(role: string): string {
  return ROLE_PT[role] ?? String(role ?? '').toUpperCase();
}

export interface RarityPaint { ring: number; css: string; }

export const RARITY: Record<string, RarityPaint> = {
  common:    { ring: 0xffffff, css: '#ffffff' },
  rare:      { ring: 0x3b8de8, css: '#3b8de8' },
  epic:      { ring: 0xa55be0, css: '#a55be0' },
  legendary: { ring: 0xffc42e, css: '#ffc42e' }
};

export function rar(name: string): RarityPaint { return RARITY[name] ?? RARITY.common; }

/** Tons de pele — variedade sem sair do chapado. */
export const SKIN = [0xf8cda4, 0xe8ab7c, 0xc9855a, 0x9c6039, 0x704527];

/** Tipografia: display arredondada e gorda. Fallback seguro se a webfont falhar. */
export const FONT_DISPLAY = '"Baloo 2", "Trebuchet MS", "Verdana", sans-serif';
export const FONT_BODY = '"Baloo 2", "Trebuchet MS", "Verdana", sans-serif';

/** Helper: converte 0xRRGGBB em '#rrggbb' para Phaser.Text. */
export function css(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
