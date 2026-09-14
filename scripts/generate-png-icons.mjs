import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'icon.svg');

async function writePng(size, fileName) {
  await sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, fileName));
}

await writePng(180, 'apple-touch-icon.png');
await writePng(192, 'icon-192.png');
await writePng(512, 'icon-512.png');
console.log('Generated PNG icons in public/.');
