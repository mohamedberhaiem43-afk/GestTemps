/**
 * Génère les variantes de l'icône Android adaptive à partir de la nouvelle
 * identité visuelle Concorde Workly (assets/concorde-workly-logo.jpg).
 *
 * Pourquoi : Android applique un zoom de ~150% sur le foreground (zone safe ~66%).
 * Un logo plein cadre apparaît alors énorme et est rogné. On ajoute ~20% de marge
 * transparente autour du logo pour qu'il s'affiche à une taille normale, nette
 * et lisible en tant qu'icône.
 *
 * Sorties :
 *   - assets/concorde-workly-logo.png  — version PNG nette du logo source (1024×1024)
 *   - assets/icon-padded.png           — icône iOS/Android (paddée)
 *   - assets/adaptive-foreground.png   — foreground adaptive Android (paddé)
 */
const Jimp = require('jimp-compact');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'concorde-workly-logo.jpg');
const OUT_LOGO_PNG = path.join(__dirname, '..', 'assets', 'concorde-workly-logo.png');
const OUT_ICON = path.join(__dirname, '..', 'assets', 'icon-padded.png');
const OUT_ADAPTIVE = path.join(__dirname, '..', 'assets', 'adaptive-foreground.png');

// 22% de marge = logo occupe 56% au centre, conforme à la safe zone Android.
const PADDING_RATIO = 0.22;
const CANVAS_SIZE = 1024;

(async () => {
  const src = await Jimp.read(SRC);

  // 1) Version PNG carrée et nette du logo source (utilisée par splash, lock,
  //    BackgroundShield et notifications — partout où on veut le logo plein cadre).
  const square = src.clone();
  // contain garde le ratio, ajoute des bords transparents pour atteindre 1024×1024.
  square.contain(CANVAS_SIZE, CANVAS_SIZE);
  await square.writeAsync(OUT_LOGO_PNG);

  // 2) Versions paddées pour l'icône applicative.
  const innerSize = Math.round(CANVAS_SIZE * (1 - PADDING_RATIO * 2));
  const inner = src.clone().contain(innerSize, innerSize);
  const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, 0x00000000);
  const offset = Math.round((CANVAS_SIZE - innerSize) / 2);
  canvas.composite(inner, offset, offset);

  await canvas.writeAsync(OUT_ICON);
  await canvas.writeAsync(OUT_ADAPTIVE);

  console.log('Generated:', OUT_LOGO_PNG);
  console.log('Generated:', OUT_ICON);
  console.log('Generated:', OUT_ADAPTIVE);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
