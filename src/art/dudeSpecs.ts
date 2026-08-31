import { SKIN } from './palette';

/** Chapeus / cabeca. */
export type Prop =
  | 'none' | 'helmet' | 'greathelm' | 'horns' | 'topknot' | 'wizhat' | 'crown'
  | 'cap' | 'toque' | 'dome' | 'antenna' | 'bandana' | 'brim' | 'tricorn'
  | 'hood' | 'halo' | 'headband' | 'laurel' | 'mohawk';

/** Expressao. Define a personalidade instantanea do dude. */
export type Eyes = 'dots' | 'wide' | 'angry' | 'glow' | 'hollow' | 'shades' | 'visor' | 'happy' | 'spiral';

/** Silhueta. Legibilidade a 32px vem daqui. */
export type Build = 'thin' | 'normal' | 'buff' | 'huge';

export interface DudeSpec {
  skin: number;
  shirt: number;
  pants: number;
  accent: number;
  prop: Prop;
  eyes: Eyes;
  build: Build;
  cape?: number;
  beard?: number;
  tie?: number;
  extra?: 'bones' | 'bandage' | 'fangs' | 'ears' | 'stitch' | 'glow' | 'wings' | 'plate';
}

const S0 = SKIN[0], S1 = SKIN[1], S2 = SKIN[2], S3 = SKIN[3];
const BONE = 0xf2ecd8;
const GHOST = 0xdff1ff;
const STEEL = 0xb9c4cf;
const IRON = 0x8e9aa6;

/** Especificacao visual explicita para os 42 dudes. */
export const DUDE_SPECS: Record<string, DudeSpec> = {
  // ---------- WARRIOR (vermelho) ----------
  knight:    { skin: S0, shirt: STEEL,   pants: 0x5a6472, accent: STEEL,   prop: 'greathelm', eyes: 'glow',  build: 'buff',   extra: 'plate' },
  barbarian: { skin: S1, shirt: 0x8b4a2b, pants: 0x6d3a20, accent: 0xf2ecd8, prop: 'horns',    eyes: 'angry', build: 'huge',  beard: 0x7a3f1c },
  samurai:   { skin: S0, shirt: 0xc4262c, pants: 0x2b2b38, accent: 0xe8402a, prop: 'helmet',   eyes: 'angry', build: 'normal', cape: 0xe8402a },
  viking:    { skin: S0, shirt: 0x9c5b32, pants: 0x5d3a22, accent: STEEL,   prop: 'horns',     eyes: 'wide',  build: 'huge',  beard: 0xe0b040 },
  gladiator: { skin: S2, shirt: 0xd9a13f, pants: 0x9c3a2a, accent: 0xffc42e, prop: 'helmet',   eyes: 'angry', build: 'buff',  extra: 'plate' },
  monk:      { skin: S2, shirt: 0xf2a03c, pants: 0xd97f22, accent: 0xffc42e, prop: 'none',     eyes: 'happy', build: 'thin' },
  warlord:   { skin: S3, shirt: 0x7a1f16, pants: 0x3a1a14, accent: 0xffc42e, prop: 'crown',    eyes: 'glow',  build: 'huge',  cape: 0x7a1f16, extra: 'plate' },

  // ---------- UNDEAD (verde) ----------
  zombie:    { skin: 0x8fc45a, shirt: 0x5b7a3a, pants: 0x3f5628, accent: 0x6ecb3c, prop: 'none',   eyes: 'dots',   build: 'normal', extra: 'stitch' },
  skeleton:  { skin: BONE,     shirt: BONE,     pants: 0xd8d0b8, accent: BONE,     prop: 'none',   eyes: 'hollow', build: 'thin',   extra: 'bones' },
  ghost:     { skin: GHOST,    shirt: GHOST,    pants: GHOST,    accent: 0xbfe6ff, prop: 'none',   eyes: 'hollow', build: 'thin',   extra: 'glow' },
  vampire:   { skin: 0xe8dfe8, shirt: 0x2b2b3d, pants: 0x1e1e2c, accent: 0xc4262c, prop: 'none',   eyes: 'glow',   build: 'thin',   cape: 0xc4262c, extra: 'fangs' },
  lich:      { skin: 0xaee08a, shirt: 0x3f2b5c, pants: 0x2b1d40, accent: 0x6ecb3c, prop: 'wizhat', eyes: 'glow',   build: 'thin',   cape: 0x3f2b5c },
  mummy:     { skin: 0xe4d9b8, shirt: 0xefe6c8, pants: 0xdccfa8, accent: 0xefe6c8, prop: 'none',   eyes: 'hollow', build: 'normal', extra: 'bandage' },
  boneknight:{ skin: BONE,     shirt: 0x6f7d8a, pants: 0x4a5560, accent: 0x6ecb3c, prop: 'greathelm', eyes: 'glow', build: 'buff',  extra: 'plate' },
  // ---------- EMPLOYED (azul) ----------
  office:    { skin: S0, shirt: 0xdfe8f2, pants: 0x2f4a6b, accent: 0x3b8de8, prop: 'none',  eyes: 'dots',  build: 'thin',   tie: 0xc4262c },
  barista:   { skin: S2, shirt: 0x3f6b4a, pants: 0x2b2b38, accent: 0x6b4a2b, prop: 'cap',   eyes: 'happy', build: 'normal' },
  cashier:   { skin: S1, shirt: 0x3b8de8, pants: 0x2b3d5c, accent: 0xffc42e, prop: 'cap',   eyes: 'dots',  build: 'thin' },
  manager:   { skin: S0, shirt: 0x2b2b3d, pants: 0x1e1e2c, accent: 0x3b8de8, prop: 'none',  eyes: 'angry', build: 'buff',   tie: 0x3b8de8 },
  intern:    { skin: S1, shirt: 0xfff6e0, pants: 0x4a5f7a, accent: 0x6fb2f7, prop: 'none',  eyes: 'wide',  build: 'thin',   tie: 0x6fb2f7 },
  courier:   { skin: S3, shirt: 0xff8a1f, pants: 0x3a3a4d, accent: 0xffc42e, prop: 'cap',   eyes: 'happy', build: 'normal' },
  ceo:       { skin: S0, shirt: 0x14141c, pants: 0x14141c, accent: 0xffc42e, prop: 'crown', eyes: 'shades', build: 'normal', tie: 0xffc42e, cape: 0x2b2b3d },

  // ---------- FANTASY (roxo) ----------
  wizard:    { skin: S0, shirt: 0x5b3fa0, pants: 0x3f2b70, accent: 0xa55be0, prop: 'wizhat', eyes: 'glow',  build: 'thin',  beard: 0xf2ecd8, cape: 0x5b3fa0 },
  elf:       { skin: 0xf6dcc0, shirt: 0x4ec95a, pants: 0x3f7a3a, accent: 0xa55be0, prop: 'hood', eyes: 'happy', build: 'thin', extra: 'ears' },
  druid:     { skin: S2, shirt: 0x5f7a3a, pants: 0x4a5c2b, accent: 0x8ad657, prop: 'hood',   eyes: 'glow',  build: 'normal', beard: 0xd8d0b8 },
  bard:      { skin: S1, shirt: 0xe05ba0, pants: 0x7a37b0, accent: 0xffc42e, prop: 'brim',   eyes: 'happy', build: 'thin',   cape: 0xe05ba0 },
  paladin:   { skin: S0, shirt: 0xf2ecd8, pants: STEEL,    accent: 0xffc42e, prop: 'greathelm', eyes: 'glow', build: 'huge', cape: 0xffc42e, extra: 'plate' },
  necro:     { skin: 0xc9b8d8, shirt: 0x2b1d40, pants: 0x1e1428, accent: 0xa55be0, prop: 'wizhat', eyes: 'glow', build: 'thin', cape: 0x2b1d40 },
  dragon:    { skin: 0x4ec95a, shirt: 0x3fae4a, pants: 0x2f8a38, accent: 0xffc42e, prop: 'horns', eyes: 'angry', build: 'huge', extra: 'wings' },
  // ---------- SCIFI (ciano) ----------
  astro:     { skin: S0, shirt: 0xfff6e0, pants: 0xe4dcc4, accent: 0x17c7c7, prop: 'dome',    eyes: 'wide',  build: 'buff' },
  robot:     { skin: STEEL, shirt: IRON,  pants: 0x6f7d8a, accent: 0x17c7c7, prop: 'antenna', eyes: 'glow',  build: 'normal', extra: 'plate' },
  cyborg:    { skin: S1, shirt: 0x3a4a5c, pants: 0x2b3644, accent: 0xe8402a, prop: 'none',    eyes: 'visor', build: 'buff',   extra: 'plate' },
  alien:     { skin: 0x8ad657, shirt: 0x17c7c7, pants: 0x0d9494, accent: 0x5ce4e4, prop: 'antenna', eyes: 'hollow', build: 'thin' },
  mech:      { skin: IRON,  shirt: 0x5ce4e4, pants: IRON,     accent: 0xffc42e, prop: 'greathelm', eyes: 'visor', build: 'huge', extra: 'plate' },
  hacker:    { skin: S3, shirt: 0x2b2b3d, pants: 0x1e1e2c, accent: 0x4ec95a, prop: 'hood',    eyes: 'glow',  build: 'thin' },
  starlord:  { skin: S0, shirt: 0x2b3d6b, pants: 0x1e2b4a, accent: 0xffc42e, prop: 'crown',   eyes: 'shades', build: 'normal', cape: 0x17c7c7 },

  // ---------- ACTION (laranja) ----------
  ninja:     { skin: S0, shirt: 0x2b2b3d, pants: 0x1e1e2c, accent: 0xe8402a, prop: 'headband', eyes: 'angry', build: 'thin' },
  pirate:    { skin: S1, shirt: 0xe8402a, pants: 0x2b2b38, accent: 0xffc42e, prop: 'tricorn',  eyes: 'angry', build: 'normal', beard: 0x3a2a20 },
  cowboy:    { skin: S1, shirt: 0x9c5b32, pants: 0x3b5f8a, accent: 0xd6a065, prop: 'brim',     eyes: 'dots',  build: 'normal' },
  spy:       { skin: S0, shirt: 0x2b2b3d, pants: 0x1e1e2c, accent: 0xfff6e0, prop: 'brim',     eyes: 'shades', build: 'thin',  tie: 0xe8402a },
  athlete:   { skin: S2, shirt: 0xff8a1f, pants: 0x2b2b3d, accent: 0xffc42e, prop: 'headband', eyes: 'wide',  build: 'buff' },
  chef:      { skin: S0, shirt: 0xfff6e0, pants: 0xdfe8f2, accent: 0xe8402a, prop: 'toque',    eyes: 'happy', build: 'buff' },
  dude:      { skin: S1, shirt: 0x4ec95a, pants: 0x3b5f8a, accent: 0xff8a1f, prop: 'none',     eyes: 'happy', build: 'normal' }
};

/** Fallback determinista por familia/role para ids sem spec explicito. */
export function fallbackSpec(family: string, role: string, seed: number): DudeSpec {
  const skin = SKIN[seed % SKIN.length];
  const byFam: Record<string, number> = {
    Warrior: 0xc4262c, Undead: 0x5b7a3a, Employed: 0x2f6fb5,
    Fantasy: 0x7a37b0, SciFi: 0x0d9494, Action: 0xd06400
  };
  const shirt = byFam[family] ?? 0x6d757e;
  return {
    skin, shirt, pants: 0x3a3a4d, accent: 0xffc42e,
    prop: role === 'Tank' ? 'helmet' : role === 'DPS' ? 'bandana' : 'cap',
    eyes: role === 'DPS' ? 'angry' : role === 'Tank' ? 'wide' : 'dots',
    build: role === 'Tank' ? 'buff' : role === 'DPS' ? 'normal' : 'thin'
  };
}

export function specFor(id: string, family: string, role: string, index: number): DudeSpec {
  return DUDE_SPECS[id] ?? fallbackSpec(family, role, index);
}
