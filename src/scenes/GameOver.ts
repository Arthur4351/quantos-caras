import Phaser from 'phaser';
export class GameOver extends Phaser.Scene {
  constructor(){ super('GameOver'); }
  create(){ this.add.text(960,540,'GameOver',{fontSize:'32px', color:'#fff'}).setOrigin(0.5); }
}
