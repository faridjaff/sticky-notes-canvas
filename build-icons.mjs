import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, 'build', 'icon.svg');
const iconsDir = path.join(__dirname, 'build', 'icons');

fs.mkdirSync(iconsDir, { recursive: true });
const svg = fs.readFileSync(svgPath);

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
for (const s of sizes) {
  const out = path.join(iconsDir, `${s}x${s}.png`);
  await sharp(svg, { density: Math.max(72, s) })
    .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

// Also keep the legacy build/icon.png (1024) so window.icon / Mac builds still work.
fs.copyFileSync(
  path.join(iconsDir, '1024x1024.png'),
  path.join(__dirname, 'build', 'icon.png')
);
console.log('wrote build/icon.png (1024)');
