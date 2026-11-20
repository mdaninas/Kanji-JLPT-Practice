import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svg = await readFile(path.join(publicDir, 'icon.svg'), 'utf8');
const artwork = Buffer.from(svg);
const background = '#f9efdc';

async function writePng(size, fileName, padding = 0) {
  const artworkSize = size - 2 * padding;
  const icon = sharp(artwork).resize(artworkSize, artworkSize);
  if (padding > 0) {
    icon.flatten({ background }).extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background,
    });
  }
  await icon.png({ compressionLevel: 9 }).toFile(path.join(publicDir, fileName));
}

await Promise.all([
  writePng(180, 'apple-touch-icon.png', 8),
  writePng(192, 'icon-192.png'),
  writePng(192, 'kanji-study-logo.png'),
  writePng(512, 'icon-512.png'),
  // Keep the entire badge inside the maskable safe zone.
  writePng(512, 'icon-maskable-512.png', 48),
  ...[192, 512].map((size) =>
    writeFile(
      path.join(publicDir, `icon-${size}.svg`),
      svg.replace('<svg ', `<svg width="${size}" height="${size}" `),
    ),
  ),
]);
console.log('Generated Kanji Study icons in public/.');
