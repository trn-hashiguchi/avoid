import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    this.load.image('player-cat', 'images/cat.png');
  }

  create() {
    this.createGeneratedTextures();
    this.scene.start('Game');
  }

  private createGeneratedTextures() {
    const g = this.add.graphics();

    // 背景: 明るい水色の水玉模様
    g.clear();
    g.fillStyle(0xe0f7ff, 1);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 4);
    g.fillCircle(48, 48, 4);
    g.generateTexture('grid-64', 64, 64);

    // 障害物（骨）: born.png を参考に動的生成
    g.clear();
    g.fillStyle(0xf5f5f5, 1); // 薄い灰色
    // 頭
    g.fillEllipse(24, 14, 32, 24);
    // 目
    g.fillStyle(0x424242, 1);
    g.fillCircle(18, 14, 5);
    g.fillCircle(30, 14, 5);
    // 体（背骨）
    g.fillStyle(0xf5f5f5, 1);
    g.fillRoundedRect(16, 26, 16, 28, 8);
    // 肋骨
    g.fillRect(8, 30, 32, 5);
    g.fillRect(12, 40, 24, 5);
    g.generateTexture('ob-rect', 48, 56);

    // 障害物（怒った顔）: 以前の ob-dot の代わり
    g.clear();
    g.fillStyle(0xe53935, 1); // 赤
    g.fillRoundedRect(4, 4, 24, 24, 8);
    g.fillStyle(0x000000, 1); // 目
    g.beginPath();
    g.moveTo(10, 12);
    g.lineTo(14, 16);
    g.moveTo(14, 12);
    g.lineTo(10, 16);
    g.moveTo(22, 12);
    g.lineTo(18, 16);
    g.moveTo(18, 12);
    g.lineTo(22, 16);
    g.strokePath();
    g.generateTexture('ob-dot', 32, 32);

    // ライフアイテム: ハート
    g.clear();
    g.fillStyle(0xf06292, 1); // ピンク
    g.beginPath();
    g.moveTo(14, 6);
    g.arc(8, 6, 6, Math.PI, 0, false);
    g.arc(20, 6, 6, Math.PI, 0, false);
    g.lineTo(26, 12);
    g.lineTo(14, 22);
    g.lineTo(2, 12);
    g.closePath();
    g.fillPath();
    g.generateTexture('life', 28, 28);

    // 障害物（おばけ）
    g.clear();
    g.fillStyle(0xff69b4, 0.9); // ピンクに変更
    g.beginPath();
    g.moveTo(4, 30);
    g.lineTo(4, 12);
    g.arc(16, 12, 12, Math.PI, 0, false);
    g.lineTo(28, 30);
    g.lineTo(24, 26);
    g.lineTo(20, 30);
    g.lineTo(16, 26);
    g.lineTo(12, 30);
    g.lineTo(8, 26);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x000000, 1);
    g.fillCircle(12, 12, 3);
    g.fillCircle(20, 12, 3);
    g.generateTexture('ob-ghost', 32, 32);

    // 障害物（バナナ）
    g.clear();
    g.fillStyle(0xffeb3b, 1); // 黄色
    g.beginPath();
    g.moveTo(4, 4);
    g.lineTo(28, 10);
    g.lineTo(26, 16);
    g.lineTo(6, 10);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x6d4c41, 1); // 茶色
    g.fillCircle(5, 5, 2);
    g.generateTexture('ob-banana', 32, 32);

    g.destroy();
  }
}
