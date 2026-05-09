/**
 * Génère une version paddée de Concorde.png pour l'icône Android adaptive.
 *
 * Pourquoi: Android applique un zoom de ~150% sur le foreground (zone safe ~66%).
 * Un logo plein cadre apparaît alors énorme et est rogné. On ajoute ~20% de marge
 * transparente autour du logo pour qu'il s'affiche à une taille normale.
 */
const Jimp = require('jimp-compact');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'Concorde.png');
const OUT_ICON = path.join(__dirname, '..', 'assets', 'icon-padded.png');
const OUT_ADAPTIVE = path.join(__dirname, '..', 'assets', 'adaptive-foreground.png');

// Marge en pourcentage de la taille de la canvas (chaque côté).
// 22% de marge = logo occupe 56% au centre, ce qui est conforme à la safe zone Android.
const PADDING_RATIO = 0.22;
const CANVAS_SIZE = 1024;

(async () => {
  const src = await Jimp.read(SRC);

  const innerSize = Math.round(CANVAS_SIZE * (1 - PADDING_RATIO * 2));
  src.contain(innerSize, innerSize);

  const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, 0x00000000);
  const offset = Math.round((CANVAS_SIZE - innerSize) / 2);
  canvas.composite(src, offset, offset);

  await canvas.writeAsync(OUT_ICON);
  await canvas.writeAsync(OUT_ADAPTIVE);

  console.log('Generated:', OUT_ICON);
  console.log('Generated:', OUT_ADAPTIVE);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
