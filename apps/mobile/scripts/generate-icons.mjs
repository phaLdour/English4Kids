#!/usr/bin/env node
/**
 * English4Kids — icon + splash raster generator (Sprint 5).
 *
 * Walks the source SVGs in apps/mobile/assets/source/ and emits all required
 * raster sizes for iOS and Android.
 *
 * The sandbox where Sprint 5 runs does not ship `sharp` or any other native
 * raster converter, and we can't add it to the lockfile without a Node.js
 * native build step. The script therefore has two modes:
 *
 *   1. **Real mode** — if `sharp` resolves, we use it for crisp downsampling.
 *      Run `pnpm add -D sharp` in apps/mobile/ on a real dev machine; this
 *      script then produces production-quality icons.
 *
 *   2. **Placeholder mode** — if `sharp` is missing, we emit tiny 1x1
 *      transparent PNGs at every target path. The build system finds files
 *      where it expects them, but the user is loudly warned (banner + a
 *      committed PLACEHOLDER-ICONS.md note) that they MUST regenerate with
 *      sharp before shipping to the stores.
 *
 * Either way, the script is deterministic and side-effect-free outside the
 * apps/mobile/assets/{ios,android}/ output trees.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = resolve(__dirname, "..");
const SOURCE_DIR = join(MOBILE_DIR, "assets/source");
const IOS_OUT = join(MOBILE_DIR, "assets/ios/AppIcon.appiconset");
const ANDROID_OUT = join(MOBILE_DIR, "assets/android/res");

const APP_ICON_SVG = join(SOURCE_DIR, "app-icon.svg");
const SPLASH_SVG = join(SOURCE_DIR, "splash-screen.svg");
const ADAPTIVE_FG_SVG = join(SOURCE_DIR, "adaptive-icon-foreground.svg");
const ADAPTIVE_BG_SVG = join(SOURCE_DIR, "adaptive-icon-background.svg");

// ---------------------------------------------------------------------------
// Target tables
// ---------------------------------------------------------------------------

/** iOS AppIcon set — keep in sync with apps/mobile/assets/ios/AppIcon.appiconset/Contents.json */
const IOS_ICONS = [
  { name: "icon-20.png", size: 20 },
  { name: "icon-20@2x.png", size: 40 },
  { name: "icon-20@3x.png", size: 60 },
  { name: "icon-29.png", size: 29 },
  { name: "icon-29@2x.png", size: 58 },
  { name: "icon-29@3x.png", size: 87 },
  { name: "icon-40.png", size: 40 },
  { name: "icon-40@2x.png", size: 80 },
  { name: "icon-40@3x.png", size: 120 },
  { name: "icon-60@2x.png", size: 120 },
  { name: "icon-60@3x.png", size: 180 },
  { name: "icon-76.png", size: 76 },
  { name: "icon-76@2x.png", size: 152 },
  { name: "icon-83.5@2x.png", size: 167 },
  { name: "icon-1024.png", size: 1024 },
];

/** Android per-density mipmap targets. */
const ANDROID_DENSITIES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

/** Adaptive icon foreground/background — square 432px on xxxhdpi, scaled down per density. */
const ADAPTIVE_DENSITIES = [
  { dir: "mipmap-mdpi", size: 108 },
  { dir: "mipmap-hdpi", size: 162 },
  { dir: "mipmap-xhdpi", size: 216 },
  { dir: "mipmap-xxhdpi", size: 324 },
  { dir: "mipmap-xxxhdpi", size: 432 },
];

/** Play Store listing asset. */
const PLAY_FEATURE_GRAPHIC = { width: 1024, height: 500 };
const PLAY_HIGH_RES_ICON = 512;

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

/** Tiny 1x1 transparent PNG used in placeholder mode. */
const TRANSPARENT_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082",
  "hex",
);

let sharp = null;
try {
  const mod = await import("sharp");
  sharp = mod.default || mod;
} catch {
  sharp = null;
}

const MODE = sharp ? "raster" : "placeholder";

console.log(`English4Kids icon generator — running in ${MODE} mode.`);
if (MODE === "placeholder") {
  console.log("");
  console.log("  No `sharp` module found. Emitting 1x1 placeholder PNGs.");
  console.log("  Before shipping to App Store or Play Store, run:");
  console.log("");
  console.log("      pnpm --filter @e4k/mobile add -D sharp");
  console.log("      node apps/mobile/scripts/generate-icons.mjs");
  console.log("");
  console.log("  This produces production-quality icons from the SVG sources.");
  console.log("");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

async function writePng(outPath, svgPath, sizeOrDims) {
  ensureDir(dirname(outPath));
  if (MODE === "placeholder") {
    writeFileSync(outPath, TRANSPARENT_PNG);
    return;
  }
  const svg = readFileSync(svgPath);
  const opts =
    typeof sizeOrDims === "number"
      ? { width: sizeOrDims, height: sizeOrDims }
      : sizeOrDims;
  await sharp(svg).resize(opts).png().toFile(outPath);
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

async function main() {
  // Verify sources exist (these are static SVGs in the repo).
  for (const path of [APP_ICON_SVG, SPLASH_SVG, ADAPTIVE_FG_SVG, ADAPTIVE_BG_SVG]) {
    if (!existsSync(path)) {
      console.error(`Source not found: ${path}`);
      process.exit(1);
    }
  }

  ensureDir(IOS_OUT);
  ensureDir(ANDROID_OUT);

  // -- iOS app icons ---------------------------------------------------------
  for (const { name, size } of IOS_ICONS) {
    await writePng(join(IOS_OUT, name), APP_ICON_SVG, size);
  }
  console.log(`  iOS: wrote ${IOS_ICONS.length} app icons to ${IOS_OUT}`);

  // -- Android launcher icons -----------------------------------------------
  for (const { dir, size } of ANDROID_DENSITIES) {
    const densityDir = join(ANDROID_OUT, dir);
    await writePng(join(densityDir, "ic_launcher.png"), APP_ICON_SVG, size);
    await writePng(join(densityDir, "ic_launcher_round.png"), APP_ICON_SVG, size);
  }
  console.log(`  Android: wrote launcher icons across ${ANDROID_DENSITIES.length} densities`);

  // -- Android adaptive icons (foreground + background) --------------------
  for (const { dir, size } of ADAPTIVE_DENSITIES) {
    const densityDir = join(ANDROID_OUT, dir);
    await writePng(join(densityDir, "ic_launcher_foreground.png"), ADAPTIVE_FG_SVG, size);
    await writePng(join(densityDir, "ic_launcher_background.png"), ADAPTIVE_BG_SVG, size);
  }
  console.log(`  Android: wrote adaptive icon foreground+background across ${ADAPTIVE_DENSITIES.length} densities`);

  // -- Play Store listing assets -------------------------------------------
  const storeOut = join(MOBILE_DIR, "store-listing/assets");
  ensureDir(storeOut);
  await writePng(join(storeOut, "play-icon-512.png"), APP_ICON_SVG, PLAY_HIGH_RES_ICON);
  await writePng(join(storeOut, "play-feature-graphic.png"), SPLASH_SVG, PLAY_FEATURE_GRAPHIC);
  console.log(`  Play Store: wrote 512px icon + 1024x500 feature graphic to ${storeOut}`);

  // -- Splash screens (Capacitor expects a small set of sizes) -------------
  const splashOut = join(MOBILE_DIR, "assets/splash");
  ensureDir(splashOut);
  for (const size of [2732, 1242, 828]) {
    await writePng(join(splashOut, `splash-${size}.png`), SPLASH_SVG, size);
  }
  console.log(`  Splash: wrote 3 sizes to ${splashOut}`);

  if (MODE === "placeholder") {
    const note = join(MOBILE_DIR, "assets/PLACEHOLDER-ICONS.md");
    if (!existsSync(note)) {
      writeFileSync(
        note,
        `# Placeholder icons in this directory

The icon and splash PNGs in this tree are **1x1 transparent placeholders**
emitted by \`apps/mobile/scripts/generate-icons.mjs\` when the \`sharp\`
module is not available.

They satisfy the build system (Xcode + Gradle find the files where they
expect them) but **must not ship to the App Store or Play Store**. Any
store review will reject a blank icon.

To produce real icons:

\`\`\`
pnpm --filter @e4k/mobile add -D sharp
node apps/mobile/scripts/generate-icons.mjs
\`\`\`

The SVG sources live in \`apps/mobile/assets/source/\` and are the source
of truth. Edit those, not the rendered PNGs.
`,
      );
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
