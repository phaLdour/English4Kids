# ADR 0010 — Sprint 5 mobile build readiness

- **Status:** Accepted
- **Date:** 2026-05-20
- **Sprint:** 5 (deliverables S5-1 + S5-2)
- **Decision owner:** Mobile Agent
- **Stakeholders:** DevOps Agent, Safety & Privacy Officer, Marketing Agent (Sprint 5 wave B)
- **Supersedes / extends:** ADR 0008 (mobile scaffold)

## Context

End of Sprint 4 left the Capacitor scaffold in `apps/mobile/` with `capacitor.config.ts`, a CI build-check that verifies the Next.js static export works under `E4K_TARGET=mobile`, and a runtime adapter (`apps/web/src/lib/runtime-adapter.ts`) that routes speech recognition to community plugins when running inside a WebView. What was missing for Sprint 5:

1. Native iOS + Android **project templates** — Info.plist keys, AndroidManifest permissions, signing config, ProGuard rules, App Group entitlements, splash + icon assets.
2. **CI build pipelines** for both platforms.
3. **Store-listing prep** — copy stubs, COPPA self-certification, asset inventory.
4. A documented single-command flow so the user goes from fresh clone to buildable Xcode + Android Studio projects without manual file editing.

**User constraint:** the user is not opening Apple Developer / Google Play accounts during Sprint 5. They will open them at the end of the sprint sequence. We must therefore stop short of anything account-gated (signing identities, provisioning profiles, Play upload keys, real screenshots from a built app) but make every account-independent step automatic.

## Decision

Land Sprint 5 deliverables as **templates + idempotent merge scripts**, not as committed `ios/` and `android/` platform projects.

### Why templates, not generated projects

Capacitor's `cap add` generates `ios/App/` and `android/` directories containing Xcode + Gradle project files. Those files are derived from `capacitor.config.ts` and from Capacitor's CLI templates, and Capacitor regenerates them on demand. Two reasons we keep them gitignored and store overrides as templates:

1. **Bundle identifiers and signing keys are user-specific.** If we committed a generated `App.xcodeproj`, the user would have to hand-rewrite the Team ID, Bundle ID, and provisioning profile on first clone — defeating the "single command" goal.
2. **Capacitor upgrades regenerate the platform projects.** Pinning a committed copy of those files would mean a manual merge every time we bump `@capacitor/ios` or `@capacitor/android`. Templates instead get re-applied on top of whatever Capacitor's current scaffold looks like.

### `post-cap-add.sh` design

Each platform has a script under `apps/mobile/templates/{ios,android}/post-cap-add.sh` that runs *after* `cap add` and merges the template values into the freshly-generated project. The scripts are:

- **Idempotent.** Every plist write uses `plutil`/`PlistBuddy` set-or-add semantics. Manifest merges grep for a marker before splicing. Build.gradle edits replace a named block if it exists, otherwise insert.
- **Failure-loud.** If they can't find the expected file (because `cap add` failed first), they bail with a clear error.
- **Platform-correct.** The iOS script refuses to run on non-Darwin hosts (since `plutil` isn't portable); the Android script runs on macOS + Linux.

We wire them into `apps/mobile/package.json` so `pnpm cap:add:ios` runs the post-script automatically. The user never types `bash post-cap-add.sh` by hand.

### Icon placeholder strategy

The sandbox where Sprint 5 runs doesn't have `sharp` (no native compiler chain) or any other raster converter. Real icon generation needs SVG-to-PNG with proper anti-aliasing, which is a hard requirement we can't meet in CI.

We solved this with a two-mode generator (`apps/mobile/scripts/generate-icons.mjs`):

- **Raster mode** (when `sharp` is installed): produces real icons.
- **Placeholder mode** (sandbox + CI default): emits 1x1 transparent PNGs at every expected output path so the build system finds files where it expects them. The script writes `apps/mobile/assets/PLACEHOLDER-ICONS.md` to warn the user, and the file is committed so the warning persists.

This keeps the build pipeline shape valid in CI (gradle and xcodebuild don't fail on "missing icon" errors) while making the placeholder state visible and self-documenting.

### CI workflows: continue-on-error rationale

Both `mobile-ios-build.yml` and `mobile-android-build.yml` are marked `continue-on-error: true`. Their archive / `bundleRelease` steps require credentials the user hasn't created yet (Apple signing identity, Android keystore). Until those exist, the workflows:

1. **Validate the steps before signing** — install, static export, cap add, post-cap-add merge, cap sync. If any of those break we want a failed run notification.
2. **Attempt the build step anyway** — so the workflow log shows exactly which Xcode/Gradle error appears, making the eventual signing setup straightforward.
3. **Upload whatever artifact exists** with `if-no-files-found: warn` (not `error`), so a successful intermediate (e.g., the `.xcarchive` from an unsigned archive attempt) is preserved.

Once the user adds the GitHub Actions secrets (`ANDROID_KEYSTORE_BASE64`, `APPLE_TEAM_ID`, etc.) they flip `continue-on-error: false` and the workflows become real CI gates.

### The single command at the end

After this ADR lands, the user's entire mobile-build journey is:

```bash
# One-time, after opening Apple Developer + Google Play accounts:
pnpm install
pnpm --filter @e4k/mobile cap:add:ios
pnpm --filter @e4k/mobile cap:add:android

# Edit one file per platform (signing.properties on Android; Team ID in Xcode UI).

# Per-build:
pnpm --filter @e4k/mobile build:local both
```

That's it. No more "now copy this key into Info.plist", no more "merge this ProGuard rule by hand".

## Consequences

**Positive**

- User onboarding is two commands. The platform-folder regeneration story stays clean (Capacitor upgrades don't break us).
- Templates are reviewable in PR diffs. Future Safety Officer review of mic strings / permission lists happens against committed `.template` files, not generated Xcode internals.
- CI workflows are shaped now; they only need credentials to go live.
- Placeholder icons mean the build never fails on "missing asset" — only on signing.

**Negative**

- Templates lag behind Capacitor scaffold changes. If Capacitor 8 changes the Info.plist layout, the merge scripts need updating. Mitigation: the scripts use `PlistBuddy`/grep markers, not byte offsets, so most changes are absorbed automatically.
- Placeholder icons require an extra step (`pnpm add -D sharp`) before shipping. Mitigation: `PLACEHOLDER-ICONS.md` documents the step inline, and the generator script prints the instruction on every placeholder run.
- The user does still need to open Apple + Google accounts and create a keystore before they can ship — no amount of code can pre-empt those.

**Deferrals**

- **Screenshots.** Need a built signed app + device captures. Defer to Sprint 6 (after first signed build).
- **Real icons.** `sharp` installation deferred to the user's local environment. CI keeps placeholder mode.
- **TR store-listing copy.** Marketing Agent owns translation in Sprint 5 wave B.
- **Production safe-harbor (kidSAFE) enrolment.** Defer to Sprint 7+ (post-launch).
- **App Store / Play upload automation (Fastlane).** Defer to Sprint 6 once a manual upload has happened and we know the exact metadata mapping the user wants.

## Validation

- `pnpm --filter @e4k/mobile icons:generate` runs and emits placeholder PNGs to every expected path (verified locally in placeholder mode).
- `bash apps/mobile/templates/ios/post-cap-add.sh` refuses cleanly on non-Darwin systems.
- `bash apps/mobile/templates/android/post-cap-add.sh` runs without `cap add` having executed yet — fails fast with a clear message instead of corrupting files.
- `.github/workflows/mobile-{ios,android}-build.yml` parses as valid YAML and references only secrets that exist optionally.
- `apps/mobile/store-listing/README.md` enumerates every field both stores require, with sources noted.
