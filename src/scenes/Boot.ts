import Phaser from 'phaser';
export class Boot extends Phaser.Scene {
  constructor(){ super('Boot'); }
  create(){ this.add.text(960,540,'Boot',{fontSize:'32px', color:'#fff'}).setOrigin(0.5); }
}
