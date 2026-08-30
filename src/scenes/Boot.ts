import Phaser from 'phaser';
import { validateDudes, validateWaves, fallbackDudes } from '../utils/validate';
import dudesData from '../data/dudes.json';
import wavesData from '../data/waves.json';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // Use missing.png as placeholder for all sprites initially
    this.load.image('missing', 'assets/sprites/missing.png');
    this.load.on('loaderror', (file: any) => {
      console.warn('loaderror', file.key, file.src);
    });
  }
  create() {
    try {
      validateDudes(dudesData);
      validateWaves(wavesData);
      this.cache.json.add('dudes', dudesData as any);
      this.cache.json.add('waves', wavesData as any);
    } catch (e) {
      console.error('Validation failed, using fallback', e);
      this.cache.json.add('dudes', fallbackDudes as any);
      this.cache.json.add('waves', wavesData as any);
    }

    // ensure missing texture exists even if load failed
    if (!this.textures.exists('missing')) {
      const g = this.add.graphics();
      g.fillStyle(0xff00ff, 1);
      g.fillRect(0, 0, 64, 64);
      g.generateTexture('missing', 64, 64);
      g.destroy();
    }

    this.scene.start('Menu');
  }
}
