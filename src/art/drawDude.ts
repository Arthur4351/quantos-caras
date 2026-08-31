import Phaser from 'phaser';
import { DudeSpec, Build } from './dudeSpecs';
import { INK, WHITE } from './palette';
import { inkCircle, inkEllipse, inkRRC, inkTri, flatCircle, flatRRC, flatEllipse, inkLine } from './ink';
import { drawEyes, drawMouth, drawFangs, FaceGeom } from './face';
import { drawProp, PROP_BEFORE_FACE } from './props';

type G = Phaser.GameObjects.Graphics;

export const DUDE_W = 168;
export const DUDE_H = 184;
const CX = 84;
/** Linha do chao dentro do canvas — usada para ancorar os pes. */
const FY = 172;
export const FOOT_ORIGIN_Y = FY / DUDE_H;

interface Metrics {
  headR: number; torsoW: number; torsoH: number;
  armW: number; armH: number; legW: number; legH: number;
}

/** Silhuetas. A leitura a 32px de altura vem daqui, nao dos detalhes. */
const BUILDS: Record<Build, Metrics> = {
  thin:   { headR: 25, torsoW: 34, torsoH: 40, armW: 11, armH: 34, legW: 12, legH: 32 },
  normal: { headR: 27, torsoW: 44, torsoH: 42, armW: 13, armH: 34, legW: 14, legH: 30 },
  buff:   { headR: 28, torsoW: 56, torsoH: 46, armW: 17, armH: 36, legW: 17, legH: 28 },
  huge:   { headR: 31, torsoW: 66, torsoH: 52, armW: 21, armH: 38, legW: 20, legH: 26 }
};

export function drawDude(g: G, spec: DudeSpec): void {
  const m = BUILDS[spec.build];
  const torsoBottom = FY - m.legH + 8;
  const torsoTop = torsoBottom - m.torsoH;
  const torsoCy = (torsoTop + torsoBottom) / 2;
  const headR = m.headR;
  const headCy = torsoTop - headR + 10;
  const f: FaceGeom = { cx: CX, cy: headCy, r: headR };

  // --- 1. Aura (fantasma / divino) ---
  if (spec.extra === 'glow') {
    flatCircle(g, CX, torsoCy - 8, m.torsoW * 1.05, WHITE, 0.16);
  }

  // --- 2. Asas (atras de tudo) ---
  if (spec.extra === 'wings') {
    inkTri(g, [CX - m.torsoW * 0.36, torsoTop + 4, CX - m.torsoW * 0.3, torsoBottom, CX - m.torsoW * 1.1, torsoTop - 16], spec.accent, 4);
    inkTri(g, [CX + m.torsoW * 0.36, torsoTop + 4, CX + m.torsoW * 0.3, torsoBottom, CX + m.torsoW * 1.1, torsoTop - 16], spec.accent, 4);
  }

  // --- 3. Capa ---
  if (spec.cape !== undefined) {
    inkRRC(g, CX, torsoCy + 8, m.torsoW * 1.46, m.torsoH * 1.45, m.torsoW * 0.28, spec.cape);
  }

  // --- 4. Pernas e sapatos ---
  const legX = m.torsoW * 0.24;
  inkRRC(g, CX - legX, FY - m.legH / 2 - 4, m.legW, m.legH, m.legW * 0.42, spec.pants);
  inkRRC(g, CX + legX, FY - m.legH / 2 - 4, m.legW, m.legH, m.legW * 0.42, spec.pants);
  flatEllipse(g, CX - legX - 3, FY - 3, m.legW * 1.7, m.legW * 0.95, INK);
  flatEllipse(g, CX + legX + 3, FY - 3, m.legW * 1.7, m.legW * 0.95, INK);

  // --- 5. Bracos e maos (para fora da silhueta do torso, com leve assimetria) ---
  const armX = m.torsoW / 2 + m.armW / 2 + 4;
  const armY = torsoTop + m.armH / 2 + 3;
  inkRRC(g, CX - armX, armY, m.armW, m.armH, m.armW * 0.45, spec.shirt);
  inkRRC(g, CX + armX, armY + 4, m.armW, m.armH, m.armW * 0.45, spec.shirt);
  inkCircle(g, CX - armX, armY + m.armH / 2 + 2, m.armW * 0.62, spec.skin, 4);
  inkCircle(g, CX + armX, armY + m.armH / 2 + 6, m.armW * 0.62, spec.skin, 4);

  // --- 6. Torso ---
  inkRRC(g, CX, torsoCy, m.torsoW, m.torsoH, m.torsoW * 0.32, spec.shirt);
  // --- 7. Detalhes do torso ---
  if (spec.extra === 'plate') {
    flatRRC(g, CX, torsoCy - 1, m.torsoW * 0.68, m.torsoH * 0.6, m.torsoW * 0.16, WHITE, 0.22);
    inkCircle(g, CX - m.torsoW * 0.5, torsoTop + 9, m.armW * 0.82, spec.accent, 4);
    inkCircle(g, CX + m.torsoW * 0.5, torsoTop + 9, m.armW * 0.82, spec.accent, 4);
  }
  if (spec.extra === 'bones') {
    inkLine(g, CX, torsoTop + 8, CX, torsoBottom - 8, 5);
    for (let i = 0; i < 3; i++) {
      const y = torsoTop + 13 + i * 10;
      inkLine(g, CX - m.torsoW * 0.3, y, CX + m.torsoW * 0.3, y, 4);
    }
  }
  if (spec.extra === 'bandage') {
    for (let i = 0; i < 4; i++) {
      const y = torsoTop + 8 + i * 10;
      inkLine(g, CX - m.torsoW * 0.44, y + 3, CX + m.torsoW * 0.44, y - 2, 3);
    }
  }
  if (spec.extra === 'stitch') {
    inkLine(g, CX - m.torsoW * 0.22, torsoTop + 13, CX + m.torsoW * 0.26, torsoTop + 21, 3);
    inkLine(g, CX - m.torsoW * 0.1, torsoTop + 11, CX - m.torsoW * 0.1, torsoTop + 19, 3);
    inkLine(g, CX + m.torsoW * 0.12, torsoTop + 15, CX + m.torsoW * 0.12, torsoTop + 23, 3);
  }
  if (spec.tie !== undefined) {
    inkTri(g, [CX - 10, torsoTop + 1, CX + 10, torsoTop + 1, CX, torsoTop + 15], WHITE, 3);
    inkTri(g, [CX - 7, torsoTop + 9, CX + 7, torsoTop + 9, CX, torsoTop + m.torsoH * 0.72], spec.tie, 3);
  }

  // --- 8. Orelhas pontudas ---
  if (spec.extra === 'ears') {
    inkTri(g, [CX - headR * 0.92, headCy - headR * 0.12, CX - headR * 0.66, headCy + headR * 0.3, CX - headR * 1.46, headCy - headR * 0.6], spec.skin, 3);
    inkTri(g, [CX + headR * 0.92, headCy - headR * 0.12, CX + headR * 0.66, headCy + headR * 0.3, CX + headR * 1.46, headCy - headR * 0.6], spec.skin, 3);
  }

  // --- 9. Cabeca ---
  inkCircle(g, CX, headCy, headR, spec.skin);

  // --- 10. Barba ---
  if (spec.beard !== undefined) {
    inkEllipse(g, CX, headCy + headR * 0.66, headR * 1.6, headR * 1.0, spec.beard, 4);
  }

  // --- 11. Rosto e chapeu ---
  const covers = PROP_BEFORE_FACE.has(spec.prop);
  if (covers) drawProp(g, f, spec.prop, spec.accent, spec.skin);
  drawEyes(g, f, spec.prop === 'greathelm' ? 'glow' : spec.eyes, spec.accent);
  if (spec.beard === undefined && spec.prop !== 'greathelm') drawMouth(g, f, spec.eyes);
  if (spec.extra === 'fangs') drawFangs(g, f);
  if (!covers) drawProp(g, f, spec.prop, spec.accent, spec.skin);
}
