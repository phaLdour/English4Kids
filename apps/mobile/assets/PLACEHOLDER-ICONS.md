# Placeholder icons in this directory

The icon and splash PNGs in this tree are **1x1 transparent placeholders**
emitted by `apps/mobile/scripts/generate-icons.mjs` when the `sharp`
module is not available.

They satisfy the build system (Xcode + Gradle find the files where they
expect them) but **must not ship to the App Store or Play Store**. Any
store review will reject a blank icon.

To produce real icons:

```
pnpm --filter @e4k/mobile add -D sharp
node apps/mobile/scripts/generate-icons.mjs
```

The SVG sources live in `apps/mobile/assets/source/` and are the source
of truth. Edit those, not the rendered PNGs.
