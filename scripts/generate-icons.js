#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'icons');

const sizes = [16, 32, 48, 64, 128];

async function generate() {
  if (!fs.existsSync(iconsDir)) {
    console.error('icons directory missing:', iconsDir);
    process.exit(2);
  }

  const svgs = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));
  if (!svgs.length) {
    console.error('no svg files found in', iconsDir);
    process.exit(2);
  }

  for (const svg of svgs) {
    const svgPath = path.join(iconsDir, svg);
    const svgBuffer = fs.readFileSync(svgPath);
    const base = path.basename(svg, '.svg');
    for (const size of sizes) {
      const outName = `${base}-${size}.png`;
      const outPath = path.join(iconsDir, outName);
      try {
        await sharp(svgBuffer)
          .resize(size, size, { fit: 'contain' })
          .png({ quality: 90 })
          .toFile(outPath);
        console.log('wrote', outPath);
      } catch (err) {
        console.error('error writing', outPath, err && err.message);
      }
    }
  }
}

generate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
