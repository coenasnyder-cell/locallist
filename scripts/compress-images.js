/* eslint-env node */
/**
 * Compress large hub images in assets/images/ and public/.
 *
 * Usage:  node scripts/compress-images.js
 *
 * - Converts oversized PNGs to high-quality JPEG (quality 80, ~100-200 KB)
 * - Resizes to max 1200px wide (plenty for mobile cards)
 * - Backs up originals to assets/images/originals/ before overwriting
 * - Updates matching files in public/ too
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'images');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKUP_DIR = path.join(ASSETS_DIR, 'originals');

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 80;

// Images to compress (the big ones)
const TARGETS = [
  'serviceshub.png',
  'jobhub.png',
  'pethub.png',
  'eventshub.png',
  'yardsale.png',
  'communityhub.png',
  'businsshub.png',
  'listhub.png',
  'listhub copy.png',
  'lost-pet-bg.jpg',
  'found-pet-bg.jpg',
  'adoption-bg.jpg',
  'welcomeprof.png',
];

async function compressImage(srcPath, destPath) {
  const image = sharp(srcPath);
  const meta = await image.metadata();

  let pipeline = image;

  if (meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  // Output as JPEG regardless of input format
  await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(destPath + '.tmp');

  // Replace original
  fs.renameSync(destPath + '.tmp', destPath);
}

async function main() {
  // Create backup dir
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  let totalBefore = 0;
  let totalAfter = 0;

  for (const filename of TARGETS) {
    const assetsPath = path.join(ASSETS_DIR, filename);
    const publicPath = path.join(PUBLIC_DIR, filename);

    // Work with whichever copy exists
    const srcPath = fs.existsSync(assetsPath) ? assetsPath : fs.existsSync(publicPath) ? publicPath : null;
    if (!srcPath) {
      console.log(`  SKIP  ${filename} (not found)`);
      continue;
    }

    const beforeSize = fs.statSync(srcPath).size;
    totalBefore += beforeSize;

    // Backup original
    const backupPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(srcPath, backupPath);
    }

    // Compressed output keeps .png extension so require() paths still work
    // but the actual bytes are JPEG (React Native Image handles this fine)
    if (fs.existsSync(assetsPath)) {
      await compressImage(assetsPath, assetsPath);
      const afterSize = fs.statSync(assetsPath).size;
      totalAfter += afterSize;
      console.log(
        `  OK  ${filename}: ${(beforeSize / 1024).toFixed(0)} KB → ${(afterSize / 1024).toFixed(0)} KB  (${Math.round((1 - afterSize / beforeSize) * 100)}% smaller)`
      );

      // Also update public/ copy if it exists
      if (fs.existsSync(publicPath)) {
        fs.copyFileSync(assetsPath, publicPath);
      }
    } else if (fs.existsSync(publicPath)) {
      await compressImage(publicPath, publicPath);
      const afterSize = fs.statSync(publicPath).size;
      totalAfter += afterSize;
      console.log(
        `  OK  ${filename}: ${(beforeSize / 1024).toFixed(0)} KB → ${(afterSize / 1024).toFixed(0)} KB  (${Math.round((1 - afterSize / beforeSize) * 100)}% smaller)`
      );
    }
  }

  console.log('');
  console.log(`Total: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(totalAfter / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Saved: ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Originals backed up to: assets/images/originals/`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
