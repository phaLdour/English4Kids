# Screenshot capture guide

This guide is the operator handbook for capturing the 8 store-listing screenshots per platform once a signed build exists. Screenshots are deferred to a real-device capture session (Sprint 6) because store reviewers reject simulator-frame mockups that do not match what end-users actually see. See ADR-0013 for the deferral rationale.

## Required screenshots (8 per platform, in slot order)

Both stores display screenshots in the order uploaded. Slot 1 is the conversion driver. Keep the slot order identical across English and Turkish captures.

| Slot | Scene | Route | Mascot state | What to show |
|---|---|---|---|---|
| 1 | Welcome / onboarding | `/onboarding` | Milo waving, centred | "Tap to begin" CTA visible; cream background; full mascot |
| 2 | Mascot picker | `/onboarding/mascot` | Milo + Luna + Both option | Three large selection cards, no other UI noise |
| 3 | Listen & Tap activity | `/play/unit-2/lesson/1` | Luna observing from corner | Unit 2 fruit lesson (the most colourful); four picture tiles with one highlighted |
| 4 | Speak It! activity | `/play/unit-1/lesson/2` | Milo encouraging, mic active | Mic active state with the green pronunciation ring at roughly 70% fill, mascot speech bubble |
| 5 | Story Time | `/play/unit-3/story/1` | None in panel | One full story panel with the karaoke word highlight mid-sentence |
| 6 | Sing Along | `/play/unit-2/song/1` | Both mascots dancing | Lyrics flowing from bottom, the currently sung word highlighted, music-note motif |
| 7 | Word Garden | `/garden` | None | Multi-stage view: at least one seed, sprout, bud, bloom, and star visible |
| 8 | Parent Dashboard home | `/parent` | None | Stats cards (today, week), thumbnail of word garden, recent lessons list |

Slot 8 is the only parent-facing screenshot. Apple and Google both allow it as long as it is the last slot and the listing's age rating remains accurate.

## Device specifications

Capture every slot at every device class. Both stores upscale-reject low-resolution captures.

| Platform | Device class | Capture resolution | Submit resolution |
|---|---|---|---|
| Apple | iPhone 6.7" (Pro Max) | 1290 × 2796 | 1290 × 2796 |
| Apple | iPad 13" (Pro) | 2064 × 2752 | 2064 × 2752 |
| Google | Android phone | 1080 × 1920 | 1080 × 1920 |
| Google | Android 7" tablet | 1200 × 1920 | 1200 × 1920 |
| Google | Android 10" tablet | 1600 × 2560 | 1600 × 2560 |

Total raw assets: 8 slots × 5 device classes × 2 locales (EN + TR) = **80 PNGs**. Both stores will accept a subset (Apple needs slots from at least one device class; Google needs phone + at least one tablet) but a complete set looks professional and survives device-policy changes.

## Capture mechanics

### iOS (Apple)

1. Open the iOS Simulator from Xcode (`xcrun simctl boot "iPhone 15 Pro Max"`).
2. Install the signed build (`xcrun simctl install booted path/to/app.app`).
3. Launch the app and navigate to the route from the table above.
4. Cmd+S takes a screenshot at the simulator's native resolution and saves to the desktop.
5. For iPad, repeat with `iPad Pro 13-inch (M4)`.

### Android (Google)

1. Boot an Android Studio AVD that matches the target resolution (Pixel 8 Pro for phone, Pixel Tablet for 10").
2. Install the signed APK (`adb install app-release.apk`).
3. Launch and navigate. Use the AVD toolbar's camera button or `adb exec-out screencap -p > slot-N.png`.
4. Verify the file is exactly the AVD's resolution; if Android scales for density, set the AVD to `1080x1920` density-locked mode.

### PWA-equivalent (fallback for slots that depend on web-only flows)

For slots that need browser-only behaviour (e.g. parent dashboard analytics charts that only render with a Plausible domain set):

1. Open Chrome DevTools → Toggle device toolbar.
2. Choose "Responsive" and type the exact target resolution.
3. Set device pixel ratio to 3 for iOS captures, 2 for Android phone, 2 for Android tablet.
4. Use the DevTools "Capture full-size screenshot" command from the Command Palette (Cmd+Shift+P → "screenshot").

The captures must be visually indistinguishable between the simulator path and the DevTools path — same fonts, same colours, same mascot states.

## Annotation style

Minimal overlays. The store reviewers prefer raw UI captures and reject anything that looks like a marketing collage with stock photography or testimonials.

If a slot needs text annotation (only slots 1, 4, and 8 in practice):

- Lingokids-inspired callout boxes: cream background `#FFF8EE`, charcoal outline `#1F1B16` at 3px, rounded corners 12px.
- Amber accent dots `#F4A93C` to point at the UI element.
- Text in the app's headline typeface (Comfortaa for headings, Nunito for body).
- One annotation per slot. Never stack two callouts.
- Annotations stay inside the safe area; never cover a mascot face or a CTA.

No emoji in screenshots. No "trusted by parents worldwide" banners. No fabricated user counts.

## Localization

Capture EN first, then switch the app to TR and re-capture each slot. To switch locale in the app:

1. Boot the build with a clean state.
2. From the splash screen, open Settings (gear icon, top right).
3. Set `ui.locale = tr`.
4. Restart the activity flow from `/onboarding`.

The Word Garden labels, parent dashboard headers, and song lyrics all swap to TR. The mascot speech bubbles use the TR locale's 461-key dictionary. If any string falls back to English, file a bug against the locale package before continuing the capture session.

## File naming convention

```
slot-{NN}-{platform}-{device}-{locale}.png
```

Examples:

- `slot-01-apple-iphone-en.png`
- `slot-04-apple-ipad-tr.png`
- `slot-08-google-phone-en.png`
- `slot-08-google-tablet-10-tr.png`

Drop the final files in `apps/mobile/store-listing/screenshots/` under per-platform subfolders that match the README inventory. The store-upload script (Sprint 6) reads from those folders by glob.

## Pre-upload review checklist

Before pasting the captures into App Store Connect or Play Console, verify each one:

- [ ] No PII visible (no real names, no real emails, no real progress data from a tester's family).
- [ ] No debug overlays (no React DevTools, no axe-core highlights, no version watermark).
- [ ] No notch or status-bar carrier name visible (use the simulator's clean status bar).
- [ ] Mascot is on-model — Milo's tail tip is amber, Luna's eye ring is teal.
- [ ] Word Garden has at least one of each growth stage so the progression is visually obvious.
- [ ] Parent Dashboard screenshot does not show any cloud-sync state that contradicts the privacy nutrition label.
