# Illustration Primitives

Reusable SVG shape templates that all Sprint 4 vocabulary, story, and activity illustrations are composed from. These are NOT files that ship — they are documentation. Copy the snippets into individual concept SVGs and add the defining detail.

Every illustration starts with this root:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none" stroke="#1F2933" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
  <title>{short description}</title>
  ...primitive + defining shapes...
</svg>
```

See `docs/design/illustration-style-guide.md` for the locked palette, stroke rules, and tier prioritization.

---

## face-round

A friendly round face with two dot eyes and a gentle smile. Compose with any body primitive.

```svg
<circle cx="120" cy="100" r="58" fill="#FFC857"/>
<circle cx="100" cy="94" r="5" fill="#1F2933" stroke="none"/>
<circle cx="140" cy="94" r="5" fill="#1F2933" stroke="none"/>
<circle cx="101" cy="92" r="1.5" fill="#FFFFFF" stroke="none"/>
<circle cx="141" cy="92" r="1.5" fill="#FFFFFF" stroke="none"/>
<path d="M105 118 Q120 132 135 118" stroke-width="2.5" fill="none"/>
```

---

## body-oval

Vertical-oval torso with two short arms. Use for greeting characters, family members, story crowd.

```svg
<ellipse cx="120" cy="170" rx="50" ry="50" fill="#3DA9FC"/>
<path d="M75 170 Q60 190 70 215" stroke-width="2.5"/>
<path d="M165 170 Q180 190 170 215" stroke-width="2.5"/>
```

---

## body-quadruped

Four-legged animal base. Used by cat, dog, horse, cow, sheep, pig, hamster (compressed), rabbit (compressed + hop).

```svg
<rect x="60" y="100" width="120" height="70" rx="32" fill="#F08A4B"/>
<rect x="74" y="160" width="16" height="34" rx="6" fill="#F08A4B"/>
<rect x="100" y="160" width="16" height="34" rx="6" fill="#F08A4B"/>
<rect x="124" y="160" width="16" height="34" rx="6" fill="#F08A4B"/>
<rect x="150" y="160" width="16" height="34" rx="6" fill="#F08A4B"/>
```

---

## fruit-ovoid

Vertical ovoid + stem + leaf. Apples, pears, oranges, etc. Recolor for variety.

```svg
<path d="M120 70 Q60 70 60 145 Q60 200 120 200 Q180 200 180 145 Q180 70 120 70 Z" fill="#F08A4B"/>
<path d="M120 70 Q128 52 142 48" stroke-width="3"/>
<path d="M130 60 Q150 45 165 60 Q145 70 130 60 Z" fill="#5FB37C"/>
<circle cx="100" cy="120" r="6" fill="#FFFFFF" opacity="0.65" stroke="none"/>
```

---

## object-base

Rounded square for furniture / generic objects (bed, table, lamp, chair, door, window).

```svg
<rect x="40" y="60" width="160" height="140" rx="18" fill="#FFB5A7"/>
```

Add legs, frame, knob, etc. as a defining detail.

---

## numeral-card

Oversized digit on a cream card, with a cluster of small filled circles in the matching numeral color showing the count.

```svg
<rect x="20" y="20" width="200" height="200" rx="20" fill="#FFF8EE"/>
<text x="80" y="160" font-family="'Fredoka', system-ui, sans-serif" font-size="140" font-weight="700" fill="#3DA9FC" stroke="none">1</text>
<circle cx="180" cy="60" r="10" fill="#3DA9FC" stroke="none"/>
```

For counts >1, arrange dots in a row at the top or a balanced grid. Use the unit colour per numeral (1 sky, 2 leaf, 3 sunflower, 4 fox, 5 lavender, 6 coral, 7 sky-dark, 8 leaf-dark, 9 plum, 10 charcoal-outline only with white dots).

---

## swatch-card

Square color chip with a soft white highlight in the upper-left corner. Used for the 8 color-swatch vocab entries.

```svg
<rect x="30" y="30" width="180" height="180" rx="24" fill="#E04848"/>
<path d="M50 50 Q70 60 90 50 Q70 75 50 90 Z" fill="#FFFFFF" opacity="0.35" stroke="none"/>
```

---

## panel-frame

Story-panel frame: rounded rectangle viewport + thin title strip at top + scene area below. The scene composition is freeform.

```svg
<rect x="10" y="10" width="220" height="220" rx="20" fill="#FFF8EE"/>
<rect x="10" y="10" width="220" height="36" rx="20" fill="#3DA9FC" stroke="none"/>
<rect x="10" y="36" width="220" height="10" fill="#3DA9FC" stroke="none"/>
<text x="120" y="34" text-anchor="middle" font-family="'Fredoka', system-ui, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF" stroke="none">{title}</text>
```

The title strip is optional — many story panels go full-bleed scene. Use it when the panel is the title splash (p1) for that story.

---

## animal-cat

Pointed-ear head with whiskers + body-quadruped base.

```svg
<circle cx="120" cy="100" r="42" fill="#1F2933"/>
<path d="M88 80 L80 50 L106 70 Z" fill="#1F2933"/>
<path d="M152 80 L160 50 L134 70 Z" fill="#1F2933"/>
<circle cx="108" cy="100" r="4" fill="#5FB37C" stroke="none"/>
<circle cx="132" cy="100" r="4" fill="#5FB37C" stroke="none"/>
<path d="M115 115 Q120 120 125 115" stroke-width="1.5"/>
<line x1="80" y1="110" x2="100" y2="112" stroke-width="1.2"/>
<line x1="80" y1="118" x2="100" y2="116" stroke-width="1.2"/>
<line x1="140" y1="112" x2="160" y2="110" stroke-width="1.2"/>
<line x1="140" y1="116" x2="160" y2="118" stroke-width="1.2"/>
```

Body uses `body-quadruped`. Recolor for black/white/orange variants.

---

## animal-dog

Floppy ears + tongue.

```svg
<circle cx="120" cy="100" r="42" fill="#A06A3F"/>
<ellipse cx="85" cy="105" rx="14" ry="26" fill="#A06A3F"/>
<ellipse cx="155" cy="105" rx="14" ry="26" fill="#A06A3F"/>
<circle cx="108" cy="100" r="4" fill="#1F2933" stroke="none"/>
<circle cx="132" cy="100" r="4" fill="#1F2933" stroke="none"/>
<ellipse cx="120" cy="115" rx="6" ry="4" fill="#1F2933" stroke="none"/>
<path d="M115 122 Q120 134 125 122" fill="#FFB5A7"/>
```

---

## animal-fox (Milo lineage)

Triangular ears + pointy snout. Use Fox Orange `#F08A4B`. Matches the Lottie Milo character.

```svg
<circle cx="120" cy="100" r="44" fill="#F08A4B"/>
<path d="M84 70 L70 40 L102 62 Z" fill="#F08A4B"/>
<path d="M156 70 L170 40 L138 62 Z" fill="#F08A4B"/>
<path d="M84 70 L78 48 L96 64 Z" fill="#FFFFFF" stroke="none"/>
<path d="M156 70 L162 48 L144 64 Z" fill="#FFFFFF" stroke="none"/>
<path d="M100 120 Q120 138 140 120 L140 110 Q120 116 100 110 Z" fill="#FFF8EE"/>
<circle cx="108" cy="98" r="4" fill="#1F2933" stroke="none"/>
<circle cx="132" cy="98" r="4" fill="#1F2933" stroke="none"/>
<ellipse cx="120" cy="125" rx="5" ry="3.5" fill="#1F2933" stroke="none"/>
```

---

## animal-owl (Luna lineage)

Big eye-discs + small ear tufts. Use Owl Lavender `#9D8DF1`. Matches the Lottie Luna character.

```svg
<ellipse cx="120" cy="120" rx="58" ry="64" fill="#9D8DF1"/>
<path d="M82 70 L78 45 L98 66 Z" fill="#9D8DF1"/>
<path d="M158 70 L162 45 L142 66 Z" fill="#9D8DF1"/>
<circle cx="100" cy="115" r="18" fill="#FFFFFF"/>
<circle cx="140" cy="115" r="18" fill="#FFFFFF"/>
<circle cx="100" cy="115" r="7" fill="#1F2933" stroke="none"/>
<circle cx="140" cy="115" r="7" fill="#1F2933" stroke="none"/>
<path d="M112 140 L120 152 L128 140 Z" fill="#FFC857"/>
```

---

## cloud

Three-bump cloud silhouette. Recolor for `white-cloud`, `pink-cloud`, `gray-cloud`.

```svg
<path d="M60 150 Q40 150 40 130 Q40 110 65 110 Q70 90 95 90 Q115 80 135 95 Q160 90 170 115 Q195 110 200 135 Q200 155 175 155 Z" fill="#FFFFFF"/>
```

---

## sun

Disk + 8 rays.

```svg
<circle cx="120" cy="120" r="40" fill="#FFC857"/>
<g stroke="#FFC857" stroke-width="6" stroke-linecap="round">
  <line x1="120" y1="60" x2="120" y2="40"/>
  <line x1="120" y1="180" x2="120" y2="200"/>
  <line x1="60" y1="120" x2="40" y2="120"/>
  <line x1="180" y1="120" x2="200" y2="120"/>
  <line x1="78" y1="78" x2="64" y2="64"/>
  <line x1="162" y1="78" x2="176" y2="64"/>
  <line x1="78" y1="162" x2="64" y2="176"/>
  <line x1="162" y1="162" x2="176" y2="176"/>
</g>
```

---

## wave-hand

Hand silhouette in a friendly wave pose. Used by `img.greeting.waveSmile`, `img.greeting.waveCasual`, `img.greeting.waveGoodbye`.

```svg
<path d="M120 200 Q110 180 110 160 L108 130 Q108 122 116 122 Q124 122 124 130 L124 110 Q124 102 132 102 Q140 102 140 110 L140 105 Q140 96 148 96 Q156 96 156 105 L156 115 Q156 105 164 105 Q172 105 172 113 L172 145 Q172 175 150 195 Q140 205 120 200 Z" fill="#FFC857"/>
```

---

## When to break primitives

Stories and scene panels regularly need custom composition (e.g. picnic blanket + 4 family members + fruit basket). Start from the relevant `panel-frame` and freely add shapes — but keep the palette restraint and outline rule. If you find yourself wanting `<filter>` or `<mask>`, reach for a simpler shape instead. The bundle budget is real.
