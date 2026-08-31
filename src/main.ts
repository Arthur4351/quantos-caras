import Phaser from 'phaser';
import { phaserConfig } from './config';
import './styles.css';

/**
 * Espera a webfont Baloo 2 resolver antes de instanciar o jogo — o Phaser mede
 * texto no canvas e um fallback tardio quebraria todo o alinhamento da UI.
 * Timeout curto garante que o jogo abre mesmo offline (cai no fallback).
 */
function start(): void {
  const game = new Phaser.Game(phaserConfig);
  // exposto para os testes de arte/E2E inspecionarem cena ativa e estado
  (window as any).game = game;
  document.documentElement.dataset.gameReady = 'true';
  document.getElementById('loading-screen')?.setAttribute('hidden', '');
}

const fonts = (document as any).fonts;
if (fonts && typeof fonts.load === 'function') {
  Promise.race([
    Promise.all([
      fonts.load('800 40px "Baloo 2"'),
      fonts.load('700 40px "Baloo 2"')
    ]),
    new Promise(res => setTimeout(res, 1200))
  ]).then(start).catch(start);
} else {
  start();
}
