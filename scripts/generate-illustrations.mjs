#!/usr/bin/env node
// One-shot generator for Sprint 4 illustration set.
// - Color-noun activity items (Unit 1) get small composed SVGs.
// - Unit 2 + Unit 3 vocab concepts get simple iconic SVGs.
// - Story panels (Unit 2 + Unit 3) get labelled placeholder cards.
// - Anything we don't recognise falls through to a labelled placeholder.
//
// Run with `node scripts/generate-illustrations.mjs`. Idempotent: it overwrites.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const IMG = path.join(ROOT, "apps/web/public/img");

const UNIT_01 = "01-me-and-my-world";
const UNIT_02 = "02-home-and-food";
const UNIT_03 = "03-animals-and-actions";

const CATEGORY_UNIT = {
  greeting: UNIT_01,
  family: UNIT_01,
  numeral: UNIT_01,
  count: UNIT_01,
  color: UNIT_01,
  room: UNIT_02,
  furniture: UNIT_02,
  fruit: UNIT_02,
  meal: UNIT_02,
  drink: UNIT_02,
  expression: UNIT_02,
  pet: UNIT_03,
  farm: UNIT_03,
  action: UNIT_03,
  ability: UNIT_03,
  mixed: UNIT_03,
  minPair: UNIT_03,
};

const STORY_UNIT = {
  miloHello: UNIT_01,
  familyPicnic: UNIT_01,
  tenLittleDucks: UNIT_01,
  houseTour: UNIT_02,
  beaTriesPear: UNIT_02,
  threeMeals: UNIT_02,
  pipMeetsPets: UNIT_03,
  theQuietestAnimal: UNIT_03,
  whatCanYouDo: UNIT_03,
};

const COLOR_HEX = {
  red: "#E04848",
  blue: "#3DA9FC",
  yellow: "#FFC857",
  green: "#5FB37C",
  orange: "#F08A4B",
  purple: "#7A4CA0",
  black: "#1F2933",
  white: "#FFFFFF",
  pink: "#E26F8E",
  gray: "#B7BEC9",
  grey: "#B7BEC9",
  brown: "#A06A3F",
};

const root = (title, body, opts = {}) => {
  const bg = opts.bg ?? "#FFF8EE";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none" stroke="#1F2933" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
  <title>${title}</title>
  <rect x="0" y="0" width="240" height="240" fill="${bg}" stroke="none"/>
${body}
</svg>
`;
};

// --- Object primitives -------------------------------------------------------

const apple = (fill = "#E04848") => `  <path d="M120 80 Q60 80 60 150 Q60 200 120 200 Q180 200 180 150 Q180 80 120 80 Z" fill="${fill}"/>
  <path d="M120 80 Q128 64 142 60" stroke-width="3"/>
  <path d="M130 70 Q150 56 165 70 Q145 80 130 70 Z" fill="#5FB37C"/>
  <ellipse cx="100" cy="118" rx="7" ry="10" fill="#FFFFFF" opacity="0.55" stroke="none"/>`;

const pear = (fill = "#5FB37C") => `  <path d="M120 70 Q100 70 96 100 Q70 130 80 170 Q90 210 120 210 Q150 210 160 170 Q170 130 144 100 Q140 70 120 70 Z" fill="${fill}"/>
  <path d="M120 70 Q124 58 138 56" stroke-width="3"/>
  <path d="M124 64 Q138 52 150 64 Q138 72 124 64 Z" fill="#5FB37C"/>
  <ellipse cx="104" cy="140" rx="6" ry="10" fill="#FFFFFF" opacity="0.55" stroke="none"/>`;

const orangeFruit = () => `  <circle cx="120" cy="130" r="68" fill="#F08A4B"/>
  <path d="M120 62 Q126 50 138 50" stroke-width="3"/>
  <path d="M118 70 Q132 56 144 68 Q132 76 118 70 Z" fill="#5FB37C"/>
  <circle cx="100" cy="118" r="6" fill="#FFFFFF" opacity="0.55" stroke="none"/>
  <path d="M120 80 L120 180 M70 130 L170 130 M86 90 L154 170 M154 90 L86 170" stroke="#FFF8EE" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>`;

const banana = () => `  <path d="M40 130 Q70 60 170 80 Q200 96 198 116 Q186 110 178 102 Q160 110 130 110 Q90 110 60 142 Q44 156 40 130 Z" fill="#FFC857"/>
  <path d="M40 130 Q44 156 60 142" stroke-width="1.8"/>`;

const grape = (fill = "#7A4CA0") => `  <g fill="${fill}" stroke="#1F2933" stroke-width="1.8">
    <circle cx="120" cy="90" r="16"/>
    <circle cx="96" cy="116" r="16"/>
    <circle cx="144" cy="116" r="16"/>
    <circle cx="80" cy="146" r="16"/>
    <circle cx="120" cy="146" r="16"/>
    <circle cx="160" cy="146" r="16"/>
    <circle cx="100" cy="176" r="16"/>
    <circle cx="140" cy="176" r="16"/>
    <circle cx="120" cy="200" r="16"/>
  </g>
  <path d="M120 80 Q124 60 140 56" stroke-width="3"/>
  <path d="M126 64 Q138 52 152 64 Q138 72 126 64 Z" fill="#5FB37C"/>`;

const strawberry = () => `  <path d="M120 80 L160 88 L180 110 Q180 170 120 210 Q60 170 60 110 L80 88 Z" fill="#E04848"/>
  <path d="M80 88 L120 70 L160 88 Q150 76 120 72 Q90 76 80 88 Z" fill="#5FB37C"/>
  <g fill="#FFC857" stroke="#1F2933" stroke-width="1">
    <circle cx="100" cy="120" r="2.4"/><circle cx="120" cy="120" r="2.4"/><circle cx="140" cy="120" r="2.4"/>
    <circle cx="90" cy="148" r="2.4"/><circle cx="110" cy="148" r="2.4"/><circle cx="130" cy="148" r="2.4"/><circle cx="150" cy="148" r="2.4"/>
    <circle cx="100" cy="176" r="2.4"/><circle cx="120" cy="176" r="2.4"/><circle cx="140" cy="176" r="2.4"/>
  </g>`;

const sun = (fill = "#FFC857") => `  <circle cx="120" cy="120" r="46" fill="${fill}"/>
  <g stroke="${fill}" stroke-width="6" stroke-linecap="round">
    <line x1="120" y1="60" x2="120" y2="36"/>
    <line x1="120" y1="180" x2="120" y2="204"/>
    <line x1="60" y1="120" x2="36" y2="120"/>
    <line x1="180" y1="120" x2="204" y2="120"/>
    <line x1="76" y1="76" x2="58" y2="58"/>
    <line x1="164" y1="76" x2="182" y2="58"/>
    <line x1="76" y1="164" x2="58" y2="182"/>
    <line x1="164" y1="164" x2="182" y2="182"/>
  </g>
  <circle cx="106" cy="114" r="3.5" fill="#1F2933" stroke="none"/>
  <circle cx="134" cy="114" r="3.5" fill="#1F2933" stroke="none"/>
  <path d="M104 132 Q120 142 136 132" stroke-width="2"/>`;

const cloud = (fill = "#FFFFFF") => `  <path d="M50 160 Q30 160 30 138 Q30 116 58 116 Q62 90 92 90 Q116 78 138 96 Q166 90 178 118 Q208 114 210 142 Q210 164 184 164 Z" fill="${fill}"/>`;

const sky = (fill = "#3DA9FC") => `  <rect x="0" y="0" width="240" height="240" fill="${fill}" stroke="none"/>
  <path d="M50 80 Q70 70 90 80 Q70 88 50 80 Z" fill="#FFFFFF" opacity="0.85" stroke="none"/>
  <path d="M150 130 Q176 116 200 130 Q176 142 150 130 Z" fill="#FFFFFF" opacity="0.85" stroke="none"/>
  <path d="M40 180 Q70 168 100 180 Q70 192 40 180 Z" fill="#FFFFFF" opacity="0.85" stroke="none"/>`;

const leaf = (fill = "#5FB37C") => `  <path d="M50 200 Q50 80 200 60 Q160 180 70 210 Q60 206 50 200 Z" fill="${fill}"/>
  <path d="M70 210 Q120 160 200 60" stroke-width="2.5"/>
  <path d="M100 168 Q90 172 76 184" stroke-width="1.5"/>
  <path d="M130 140 Q120 144 110 156" stroke-width="1.5"/>
  <path d="M160 116 Q150 120 140 132" stroke-width="1.5"/>`;

const carrot = () => `  <path d="M120 60 Q100 60 90 90 L60 200 Q120 220 180 200 L150 90 Q140 60 120 60 Z" fill="#F08A4B"/>
  <path d="M120 60 Q110 40 96 36 L100 60 Q86 44 80 36 L86 60 Q72 50 68 40" stroke="#5FB37C" stroke-width="4" fill="none"/>
  <path d="M120 60 Q132 40 148 36 L142 60 Q156 44 164 36 L158 60 Q172 50 176 40" stroke="#5FB37C" stroke-width="4" fill="none"/>
  <path d="M90 110 L150 110 M84 140 L156 140 M78 170 L162 170" stroke="#1F2933" stroke-width="1.5" fill="none"/>`;

const catSilhouette = (fill = "#1F2933") => `  <circle cx="120" cy="140" r="50" fill="${fill}"/>
  <path d="M82 120 L74 80 L106 110 Z" fill="${fill}"/>
  <path d="M158 120 L166 80 L134 110 Z" fill="${fill}"/>
  <circle cx="104" cy="138" r="5" fill="#5FB37C" stroke="none"/>
  <circle cx="136" cy="138" r="5" fill="#5FB37C" stroke="none"/>
  <path d="M114 156 Q120 162 126 156" stroke-width="1.5" stroke="#FFC857"/>
  <line x1="76" y1="148" x2="100" y2="150" stroke="#FFFFFF" stroke-width="1.2"/>
  <line x1="76" y1="156" x2="100" y2="154" stroke="#FFFFFF" stroke-width="1.2"/>
  <line x1="140" y1="150" x2="164" y2="148" stroke="#FFFFFF" stroke-width="1.2"/>
  <line x1="140" y1="154" x2="164" y2="156" stroke="#FFFFFF" stroke-width="1.2"/>`;

const hat = (fill = "#1F2933") => `  <ellipse cx="120" cy="190" rx="84" ry="14" fill="${fill}"/>
  <path d="M62 190 Q60 110 120 100 Q180 110 178 190 Z" fill="${fill}"/>
  <rect x="62" y="170" width="116" height="14" fill="#FFC857" stroke="#1F2933" stroke-width="1.5"/>`;

const bed = () => `  <rect x="30" y="120" width="180" height="80" rx="14" fill="#E04848"/>
  <rect x="30" y="100" width="80" height="60" rx="14" fill="#FFFFFF"/>
  <rect x="36" y="200" width="14" height="30" fill="#A06A3F"/>
  <rect x="190" y="200" width="14" height="30" fill="#A06A3F"/>
  <line x1="40" y1="160" x2="200" y2="160" stroke-width="1.5"/>`;

const shoe = (fill = "#3DA9FC") => `  <path d="M30 170 L30 150 Q30 120 80 110 Q120 110 130 130 Q150 140 200 140 Q220 142 220 160 L220 180 Q220 196 200 196 L46 196 Q30 196 30 184 Z" fill="${fill}"/>
  <path d="M80 110 L80 130" stroke-width="2"/>
  <path d="M100 116 L100 130" stroke-width="2"/>
  <path d="M120 122 L120 134" stroke-width="2"/>
  <line x1="30" y1="170" x2="220" y2="170" stroke-width="1.5"/>
  <line x1="200" y1="140" x2="200" y2="160" stroke-width="1.5"/>`;

const tape = (fill = "#7A4CA0") => `  <rect x="30" y="80" width="180" height="40" rx="6" fill="${fill}"/>
  <rect x="30" y="80" width="180" height="40" rx="6" fill="none" stroke-dasharray="6 6"/>
  <path d="M60 120 L90 160 L210 160" fill="none" stroke="#1F2933" stroke-width="2.5"/>
  <rect x="60" y="130" width="160" height="30" rx="3" fill="${fill}" opacity="0.6"/>`;

const bear = (fill = "#A06A3F") => `  <circle cx="80" cy="80" r="22" fill="${fill}"/>
  <circle cx="160" cy="80" r="22" fill="${fill}"/>
  <circle cx="80" cy="80" r="10" fill="#FFB5A7" stroke="none"/>
  <circle cx="160" cy="80" r="10" fill="#FFB5A7" stroke="none"/>
  <circle cx="120" cy="130" r="56" fill="${fill}"/>
  <circle cx="100" cy="124" r="5" fill="#1F2933" stroke="none"/>
  <circle cx="140" cy="124" r="5" fill="#1F2933" stroke="none"/>
  <ellipse cx="120" cy="146" rx="14" ry="10" fill="#FFB5A7"/>
  <circle cx="120" cy="142" r="3" fill="#1F2933" stroke="none"/>
  <path d="M120 148 L120 156" stroke-width="1.5"/>
  <path d="M110 158 Q120 166 130 158" stroke-width="2"/>`;

const placeholder = (title, slug, accent = "#3DA9FC") => root(
  title,
  `  <rect x="20" y="20" width="200" height="200" rx="22" fill="#FFF8EE" stroke="${accent}" stroke-width="3" stroke-dasharray="6 6"/>
  <circle cx="120" cy="96" r="18" fill="${accent}" stroke="none" opacity="0.25"/>
  <text x="120" y="140" text-anchor="middle" font-family="'Fredoka', system-ui, sans-serif" font-size="13" font-weight="700" fill="${accent}" stroke="none">${slug}</text>
  <text x="120" y="170" text-anchor="middle" font-family="'Fredoka', system-ui, sans-serif" font-size="10" fill="#5B524A" stroke="none">placeholder</text>`,
  { bg: "#FFFFFF" },
);

// --- High-level concept rendering -------------------------------------------

function renderConcept(conceptId) {
  if (conceptId.startsWith("img.color.")) return renderColorNoun(conceptId);
  if (conceptId.startsWith("img.fruit.")) return renderFruit(conceptId);
  if (conceptId.startsWith("img.drink.")) return renderDrink(conceptId);
  if (conceptId.startsWith("img.meal.")) return renderMeal(conceptId);
  if (conceptId.startsWith("img.room.")) return renderRoom(conceptId);
  if (conceptId.startsWith("img.furniture.")) return renderFurniture(conceptId);
  if (conceptId.startsWith("img.expression.")) return renderExpression(conceptId);
  if (conceptId.startsWith("img.pet.")) return renderPet(conceptId);
  if (conceptId.startsWith("img.farm.")) return renderFarm(conceptId);
  if (conceptId.startsWith("img.action.")) return renderAction(conceptId);
  if (conceptId.startsWith("img.ability.")) return renderAbility(conceptId);
  if (conceptId.startsWith("img.mixed.")) return renderAbility(conceptId.replace("img.mixed.", "img.ability."));
  if (conceptId.startsWith("img.minPair.")) return renderMinPair(conceptId);
  if (conceptId.startsWith("img.story.")) return renderStoryPlaceholder(conceptId);
  return null;
}

function renderColorNoun(id) {
  // img.color.{adjective}{Noun}
  const tail = id.slice("img.color.".length); // e.g. "redApple"
  const m = tail.match(/^([a-z]+)([A-Z][a-zA-Z]*)$/);
  if (!m) return null;
  const color = m[1];
  const noun = m[2][0].toLowerCase() + m[2].slice(1);
  const fill = COLOR_HEX[color] ?? "#3DA9FC";
  const title = `A ${color} ${noun.replace(/([A-Z])/g, " $1").toLowerCase()}`;
  let body = "";
  switch (noun) {
    case "apple": body = apple(fill); break;
    case "pear": body = pear(fill); break;
    case "grape": body = grape(fill); break;
    case "leaf": body = leaf(fill); break;
    case "sun": body = sun(fill); break;
    case "sky": body = sky(fill); return root(title, "", { bg: fill }).replace("</svg>", `  ${sky(fill).split('\n').slice(1).join('\n')}\n</svg>`);
    case "cloud": body = cloud(fill); break;
    case "cat": body = catSilhouette(fill); break;
    case "hat": body = hat(fill); break;
    case "bed": body = bed().replace('fill="#E04848"', `fill="${fill}"`); break;
    case "shoe": body = shoe(fill); break;
    case "tape": body = tape(fill); break;
    case "bear": body = bear(fill); break;
    case "crowd": body = `  <g>
    <circle cx="60" cy="120" r="22" fill="${fill}"/>
    <circle cx="120" cy="110" r="24" fill="${fill}"/>
    <circle cx="180" cy="120" r="22" fill="${fill}"/>
    <circle cx="55" cy="116" r="2" fill="#1F2933" stroke="none"/>
    <circle cx="65" cy="116" r="2" fill="#1F2933" stroke="none"/>
    <circle cx="115" cy="106" r="2" fill="#1F2933" stroke="none"/>
    <circle cx="125" cy="106" r="2" fill="#1F2933" stroke="none"/>
    <circle cx="175" cy="116" r="2" fill="#1F2933" stroke="none"/>
    <circle cx="185" cy="116" r="2" fill="#1F2933" stroke="none"/>
    <ellipse cx="60" cy="180" rx="26" ry="32" fill="${fill}"/>
    <ellipse cx="120" cy="180" rx="28" ry="34" fill="${fill}"/>
    <ellipse cx="180" cy="180" rx="26" ry="32" fill="${fill}"/>
  </g>`; break;
    case "son": // typo for "sun"
    case "queen": // typo: queenLeaf -> green leaf
      return renderColorNoun(`img.color.${color}Leaf`);
    default: return placeholder(title, `${color}-${noun}`, fill);
  }
  return root(title, body);
}

function renderFruit(id) {
  const noun = id.slice("img.fruit.".length);
  switch (noun) {
    case "apple": return root("A red apple with a green leaf", apple("#E04848"));
    case "pear": return root("A green pear with a leaf", pear("#5FB37C"));
    case "orange": return root("An orange fruit", orangeFruit());
    case "banana": return root("A yellow banana", banana());
    case "grape": return root("A bunch of purple grapes", grape("#7A4CA0"));
    case "strawberry": return root("A red strawberry", strawberry());
    default: return placeholder("Fruit: " + noun, "fruit-" + noun);
  }
}

function renderDrink(id) {
  const noun = id.slice("img.drink.".length);
  const cup = (liquid, label) => root(`A glass of ${label}`,
    `  <path d="M70 60 L170 60 L160 200 Q160 220 140 220 L100 220 Q80 220 80 200 Z" fill="#FFFFFF"/>
  <path d="M82 90 L158 90 L150 200 Q150 210 140 210 L100 210 Q90 210 90 200 Z" fill="${liquid}"/>
  <ellipse cx="120" cy="90" rx="38" ry="6" fill="${liquid}" stroke="#1F2933" stroke-width="1.5"/>
  <ellipse cx="105" cy="100" rx="6" ry="3" fill="#FFFFFF" opacity="0.7" stroke="none"/>`);
  switch (noun) {
    case "water": return cup("#3DA9FC", "water");
    case "milk": return cup("#FFFFFF", "milk").replace('fill="#FFFFFF"/>', 'fill="#FFF8EE"/>');
    case "juice": return cup("#FFC857", "juice");
    default: return placeholder("Drink: " + noun, "drink-" + noun);
  }
}

function renderMeal(id) {
  const meal = id.slice("img.meal.".length);
  const plate = (label, items) => root(`A plate for ${label}`,
    `  <ellipse cx="120" cy="160" rx="100" ry="20" fill="#1F2933" opacity="0.08" stroke="none"/>
  <circle cx="120" cy="140" r="80" fill="#FFFFFF"/>
  <circle cx="120" cy="140" r="64" fill="#FFF8EE"/>
${items}
  <text x="120" y="220" text-anchor="middle" font-family="'Fredoka', system-ui, sans-serif" font-size="18" font-weight="700" fill="#1F2933" stroke="none">${label}</text>`);
  switch (meal) {
    case "breakfast":
      return plate("breakfast",
        `  <circle cx="100" cy="130" r="22" fill="#FFC857"/>
  <circle cx="100" cy="130" r="9" fill="#F08A4B"/>
  <rect x="120" y="120" width="40" height="20" rx="4" fill="#A06A3F"/>
  <rect x="124" y="118" width="32" height="6" fill="#FFC857"/>`);
    case "lunch":
      return plate("lunch",
        `  <path d="M70 110 L170 110 L160 170 L80 170 Z" fill="#FFC857"/>
  <circle cx="100" cy="135" r="8" fill="#E04848"/>
  <circle cx="140" cy="135" r="8" fill="#E04848"/>
  <path d="M85 150 L155 150" stroke="#5FB37C" stroke-width="3"/>`);
    case "dinner":
      return plate("dinner",
        `  <ellipse cx="120" cy="140" rx="44" ry="20" fill="#A06A3F"/>
  <ellipse cx="120" cy="138" rx="40" ry="16" fill="#F08A4B"/>
  <circle cx="92" cy="130" r="5" fill="#5FB37C"/>
  <circle cx="120" cy="130" r="5" fill="#5FB37C"/>
  <circle cx="148" cy="130" r="5" fill="#5FB37C"/>`);
    default: return placeholder("Meal: " + meal, "meal-" + meal);
  }
}

function renderRoom(id) {
  const room = id.slice("img.room.".length);
  const card = (label, body, bg = "#FFF8EE") => root(`The ${label}`,
    `  <rect x="20" y="20" width="200" height="200" rx="14" fill="${bg}" stroke="#1F2933" stroke-width="2.5"/>
  <rect x="20" y="20" width="200" height="36" fill="#3DA9FC" stroke="none"/>
  <text x="120" y="46" text-anchor="middle" font-family="'Fredoka', system-ui, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF" stroke="none">${label}</text>
${body}`);
  switch (room) {
    case "bedroom":
      return card("bedroom",
        `  <rect x="40" y="130" width="160" height="60" rx="10" fill="#9D8DF1"/>
  <rect x="40" y="110" width="60" height="40" rx="8" fill="#FFFFFF"/>
  <rect x="34" y="190" width="14" height="20" fill="#A06A3F"/>
  <rect x="192" y="190" width="14" height="20" fill="#A06A3F"/>`);
    case "kitchen":
      return card("kitchen",
        `  <rect x="40" y="120" width="160" height="80" rx="6" fill="#FFC857"/>
  <rect x="40" y="120" width="160" height="14" fill="#A06A3F" stroke="none"/>
  <rect x="60" y="146" width="40" height="40" fill="#FFFFFF"/>
  <rect x="140" y="146" width="40" height="40" fill="#FFFFFF"/>
  <circle cx="80" cy="166" r="6" fill="#3DA9FC"/>
  <circle cx="160" cy="166" r="6" fill="#3DA9FC"/>`);
    case "bathroom":
      return card("bathroom",
        `  <rect x="40" y="160" width="160" height="40" rx="20" fill="#3DA9FC"/>
  <rect x="40" y="160" width="160" height="14" rx="6" fill="#FFFFFF"/>
  <path d="M120 100 L120 160" stroke-width="3"/>
  <circle cx="120" cy="100" r="14" fill="#B7BEC9"/>
  <path d="M114 100 Q120 110 126 100" stroke-width="2" stroke="#FFFFFF" fill="none"/>`);
    case "livingRoom":
      return card("living room",
        `  <rect x="40" y="150" width="160" height="50" rx="14" fill="#FFB5A7"/>
  <rect x="40" y="130" width="40" height="40" rx="8" fill="#FFB5A7"/>
  <rect x="160" y="130" width="40" height="40" rx="8" fill="#FFB5A7"/>
  <rect x="90" y="100" width="60" height="36" rx="4" fill="#1F2933"/>
  <rect x="94" y="104" width="52" height="28" fill="#3DA9FC"/>`);
    default: return placeholder("Room: " + room, "room-" + room);
  }
}

function renderFurniture(id) {
  const f = id.slice("img.furniture.".length);
  switch (f) {
    case "bed": return root("A bed with a pillow", bed());
    case "chair": return root("A wooden chair",
      `  <rect x="70" y="60" width="100" height="120" rx="6" fill="#A06A3F"/>
  <rect x="70" y="120" width="100" height="20" fill="#A06A3F"/>
  <rect x="60" y="140" width="120" height="20" rx="4" fill="#A06A3F"/>
  <rect x="70" y="160" width="14" height="60" fill="#A06A3F"/>
  <rect x="156" y="160" width="14" height="60" fill="#A06A3F"/>
  <rect x="80" y="70" width="80" height="40" rx="6" fill="#FFB5A7" stroke="#1F2933" stroke-width="2"/>`);
    case "table": return root("A wooden table",
      `  <rect x="30" y="100" width="180" height="20" rx="6" fill="#A06A3F"/>
  <rect x="40" y="120" width="14" height="80" fill="#A06A3F"/>
  <rect x="186" y="120" width="14" height="80" fill="#A06A3F"/>
  <rect x="50" y="106" width="160" height="6" fill="#FFC857" opacity="0.5" stroke="none"/>`);
    case "lamp": return root("A lamp with a yellow shade",
      `  <path d="M80 60 L160 60 L170 110 L70 110 Z" fill="#FFC857"/>
  <rect x="116" y="110" width="8" height="80" fill="#A06A3F"/>
  <ellipse cx="120" cy="195" rx="34" ry="8" fill="#A06A3F"/>
  <circle cx="120" cy="100" r="6" fill="#FFFFFF" opacity="0.7" stroke="none"/>`);
    case "door": return root("A wooden door",
      `  <rect x="64" y="40" width="112" height="180" rx="4" fill="#A06A3F"/>
  <rect x="74" y="50" width="92" height="160" rx="3" fill="none" stroke-width="1.5"/>
  <circle cx="156" cy="130" r="5" fill="#FFC857" stroke="#1F2933" stroke-width="1.5"/>`);
    case "window": return root("A window with a sky view",
      `  <rect x="40" y="50" width="160" height="140" rx="6" fill="#A06A3F"/>
  <rect x="50" y="60" width="140" height="120" fill="#3DA9FC"/>
  <line x1="120" y1="60" x2="120" y2="180" stroke-width="3"/>
  <line x1="50" y1="120" x2="190" y2="120" stroke-width="3"/>
  <circle cx="170" cy="80" r="10" fill="#FFC857"/>`);
    default: return placeholder("Furniture: " + f, "furniture-" + f);
  }
}

function renderExpression(id) {
  const tail = id.slice("img.expression.".length);
  const isThumbs = tail.startsWith("thumbsUp");
  const isShake = tail.startsWith("gentleShake");
  const fruitSuffix = tail.replace(/^(thumbsUp|gentleShake)/, "").toLowerCase();
  const food = fruitSuffix === "apple" ? "red apple" : fruitSuffix === "pear" ? "green pear" : fruitSuffix === "onion" ? "purple onion" : "";
  if (tail === "thumbsUp") return root("A thumbs-up of approval",
    `  <path d="M70 200 L70 130 Q70 122 78 122 L108 122 L108 80 Q108 60 128 60 Q148 60 144 86 L138 116 L172 116 Q186 116 186 130 L182 184 Q180 200 164 200 Z" fill="#FFC857"/>`);
  if (tail === "gentleShake") return root("A gentle head shake",
    `  <circle cx="120" cy="110" r="56" fill="#FFC857"/>
  <circle cx="100" cy="104" r="5" fill="#1F2933" stroke="none"/>
  <circle cx="140" cy="104" r="5" fill="#1F2933" stroke="none"/>
  <path d="M104 130 L136 130" stroke-width="3"/>
  <path d="M40 200 L80 196 Q60 186 40 188 Z" fill="#3DA9FC"/>
  <path d="M200 200 L160 196 Q180 186 200 188 Z" fill="#3DA9FC"/>`);
  if (isThumbs) {
    const fruit = food.includes("apple") ? apple("#E04848")
      : food.includes("pear") ? pear("#5FB37C")
      : `  <ellipse cx="160" cy="120" rx="34" ry="44" fill="#9D8DF1"/>
  <path d="M160 76 Q166 60 178 56" stroke-width="3"/>`;
    return root(`Thumbs up to a ${food}`,
      `  <g transform="translate(-30,40) scale(0.6)">
    <path d="M70 200 L70 130 Q70 122 78 122 L108 122 L108 80 Q108 60 128 60 Q148 60 144 86 L138 116 L172 116 Q186 116 186 130 L182 184 Q180 200 164 200 Z" fill="#FFC857"/>
  </g>
${fruit}`);
  }
  if (isShake) {
    const fruit = food.includes("apple") ? apple("#E04848")
      : food.includes("pear") ? pear("#5FB37C")
      : `  <ellipse cx="160" cy="120" rx="34" ry="44" fill="#7A4CA0"/>
  <path d="M160 76 Q166 60 178 56" stroke-width="3"/>`;
    return root(`A polite "no thanks" to a ${food || "food"}`,
      `  <g transform="translate(-40,30) scale(0.5)">
    <circle cx="120" cy="110" r="56" fill="#FFC857"/>
    <circle cx="100" cy="104" r="5" fill="#1F2933" stroke="none"/>
    <circle cx="140" cy="104" r="5" fill="#1F2933" stroke="none"/>
    <path d="M104 130 L136 130" stroke-width="3"/>
  </g>
  <path d="M40 70 Q60 64 80 70" stroke="#3DA9FC" stroke-width="3" fill="none"/>
${fruit}`);
  }
  return placeholder("Expression: " + tail, "expression-" + tail);
}

function renderPet(id) {
  const tail = id.slice("img.pet.".length);
  const m = tail.match(/^([a-z]+)([A-Z][a-zA-Z]*)$/);
  const base = m ? m[2][0].toLowerCase() + m[2].slice(1) : tail;
  const colorPrefix = m ? m[1] : null;
  const fillMap = { black: "#1F2933", white: "#FFFFFF", brown: "#A06A3F", grey: "#B7BEC9", gray: "#B7BEC9", orange: "#F08A4B", blue: "#3DA9FC", yellow: "#FFC857", red: "#E04848" };
  const fill = colorPrefix ? (fillMap[colorPrefix] ?? "#F08A4B") : null;
  const animals = {
    cat: (c = "#1F2933") => `  <circle cx="120" cy="120" r="52" fill="${c}"/>
  <path d="M82 96 L74 56 L106 86 Z" fill="${c}"/>
  <path d="M158 96 L166 56 L134 86 Z" fill="${c}"/>
  <circle cx="104" cy="118" r="5" fill="#5FB37C" stroke="none"/>
  <circle cx="136" cy="118" r="5" fill="#5FB37C" stroke="none"/>
  <ellipse cx="120" cy="138" rx="6" ry="3" fill="#FFB5A7" stroke="none"/>
  <path d="M114 146 Q120 152 126 146" stroke-width="1.5"/>
  <line x1="74" y1="128" x2="100" y2="130" stroke-width="1.2"/>
  <line x1="74" y1="138" x2="100" y2="136" stroke-width="1.2"/>
  <line x1="140" y1="130" x2="166" y2="128" stroke-width="1.2"/>
  <line x1="140" y1="136" x2="166" y2="138" stroke-width="1.2"/>
  <ellipse cx="120" cy="190" rx="44" ry="22" fill="${c}"/>`,
    dog: (c = "#A06A3F") => `  <circle cx="120" cy="120" r="48" fill="${c}"/>
  <ellipse cx="80" cy="124" rx="16" ry="28" fill="${c}"/>
  <ellipse cx="160" cy="124" rx="16" ry="28" fill="${c}"/>
  <circle cx="106" cy="118" r="5" fill="#1F2933" stroke="none"/>
  <circle cx="134" cy="118" r="5" fill="#1F2933" stroke="none"/>
  <ellipse cx="120" cy="138" rx="8" ry="5" fill="#1F2933" stroke="none"/>
  <path d="M114 146 Q120 158 126 146" fill="#FFB5A7"/>
  <ellipse cx="120" cy="194" rx="46" ry="22" fill="${c}"/>`,
    rabbit: (c = "#FFFFFF") => `  <circle cx="120" cy="140" r="42" fill="${c}"/>
  <ellipse cx="100" cy="80" rx="10" ry="30" fill="${c}"/>
  <ellipse cx="140" cy="80" rx="10" ry="30" fill="${c}"/>
  <ellipse cx="100" cy="80" rx="4" ry="20" fill="#FFB5A7" stroke="none"/>
  <ellipse cx="140" cy="80" rx="4" ry="20" fill="#FFB5A7" stroke="none"/>
  <circle cx="108" cy="138" r="4" fill="#1F2933" stroke="none"/>
  <circle cx="132" cy="138" r="4" fill="#1F2933" stroke="none"/>
  <path d="M116 154 L120 158 L124 154" stroke-width="2"/>
  <ellipse cx="120" cy="200" rx="44" ry="22" fill="${c}"/>`,
    fish: (c = "#F08A4B") => `  <path d="M60 120 Q90 70 160 80 Q200 100 200 130 Q200 160 160 180 Q90 190 60 140 Z" fill="${c}"/>
  <path d="M60 120 L20 80 L30 130 L20 180 Z" fill="${c}"/>
  <circle cx="170" cy="120" r="6" fill="#FFFFFF"/>
  <circle cx="170" cy="120" r="3" fill="#1F2933" stroke="none"/>
  <path d="M120 130 Q140 140 120 150" stroke-width="1.5"/>
  <path d="M90 110 Q100 120 90 130" stroke-width="1.5"/>`,
    bird: (c = "#3DA9FC") => `  <ellipse cx="120" cy="140" rx="50" ry="44" fill="${c}"/>
  <circle cx="120" cy="90" r="32" fill="${c}"/>
  <path d="M148 86 L172 80 L154 96 Z" fill="#FFC857"/>
  <circle cx="116" cy="86" r="4" fill="#1F2933" stroke="none"/>
  <path d="M70 130 Q40 110 50 90 L80 120 Z" fill="${c}"/>
  <path d="M120 184 L110 200 M120 184 L130 200" stroke-width="3"/>`,
    hamster: (c = "#A06A3F") => `  <ellipse cx="120" cy="130" rx="60" ry="48" fill="${c}"/>
  <circle cx="80" cy="110" r="14" fill="${c}"/>
  <circle cx="160" cy="110" r="14" fill="${c}"/>
  <circle cx="80" cy="110" r="6" fill="#FFB5A7" stroke="none"/>
  <circle cx="160" cy="110" r="6" fill="#FFB5A7" stroke="none"/>
  <circle cx="104" cy="128" r="4" fill="#1F2933" stroke="none"/>
  <circle cx="136" cy="128" r="4" fill="#1F2933" stroke="none"/>
  <ellipse cx="120" cy="148" rx="6" ry="4" fill="#1F2933" stroke="none"/>
  <path d="M114 158 Q120 164 126 158" stroke-width="1.5"/>`,
  };
  if (animals[base]) {
    const c = fill ?? (base === "cat" ? "#1F2933" : base === "dog" ? "#A06A3F" : base === "rabbit" ? "#FFFFFF" : base === "fish" ? "#F08A4B" : base === "bird" ? "#3DA9FC" : "#A06A3F");
    const label = colorPrefix ? `A ${colorPrefix} ${base}` : `A ${base}`;
    return root(label, animals[base](c));
  }
  return placeholder("Pet: " + tail, "pet-" + tail);
}

function renderFarm(id) {
  const noun = id.slice("img.farm.".length);
  const farm = {
    cow: `  <ellipse cx="120" cy="160" rx="76" ry="42" fill="#FFFFFF"/>
  <circle cx="120" cy="100" r="38" fill="#FFFFFF"/>
  <ellipse cx="120" cy="120" rx="18" ry="12" fill="#FFB5A7"/>
  <circle cx="110" cy="120" r="2.5" fill="#1F2933" stroke="none"/>
  <circle cx="130" cy="120" r="2.5" fill="#1F2933" stroke="none"/>
  <circle cx="100" cy="94" r="3" fill="#1F2933" stroke="none"/>
  <circle cx="140" cy="94" r="3" fill="#1F2933" stroke="none"/>
  <ellipse cx="90" cy="80" rx="12" ry="6" fill="#FFB5A7"/>
  <ellipse cx="150" cy="80" rx="12" ry="6" fill="#FFB5A7"/>
  <ellipse cx="80" cy="150" rx="14" ry="10" fill="#1F2933" stroke="none"/>
  <ellipse cx="160" cy="170" rx="20" ry="12" fill="#1F2933" stroke="none"/>
  <rect x="84" y="200" width="14" height="22" fill="#FFFFFF"/>
  <rect x="142" y="200" width="14" height="22" fill="#FFFFFF"/>`,
    sheep: `  <circle cx="78" cy="130" r="18" fill="#FFFFFF"/>
  <circle cx="100" cy="118" r="20" fill="#FFFFFF"/>
  <circle cx="124" cy="116" r="22" fill="#FFFFFF"/>
  <circle cx="148" cy="118" r="20" fill="#FFFFFF"/>
  <circle cx="170" cy="130" r="18" fill="#FFFFFF"/>
  <circle cx="120" cy="150" r="34" fill="#FFFFFF"/>
  <circle cx="60" cy="160" r="24" fill="#1F2933"/>
  <circle cx="52" cy="156" r="3" fill="#FFFFFF" stroke="none"/>
  <circle cx="68" cy="156" r="3" fill="#FFFFFF" stroke="none"/>
  <ellipse cx="60" cy="172" rx="8" ry="4" fill="#FFB5A7"/>
  <rect x="74" y="184" width="10" height="24" fill="#1F2933"/>
  <rect x="154" y="184" width="10" height="24" fill="#1F2933"/>`,
    pig: `  <ellipse cx="120" cy="140" rx="64" ry="48" fill="#FFB5A7"/>
  <circle cx="120" cy="120" r="36" fill="#FFB5A7"/>
  <ellipse cx="120" cy="138" rx="20" ry="14" fill="#E26F8E"/>
  <circle cx="114" cy="138" r="3" fill="#1F2933" stroke="none"/>
  <circle cx="126" cy="138" r="3" fill="#1F2933" stroke="none"/>
  <circle cx="106" cy="108" r="3" fill="#1F2933" stroke="none"/>
  <circle cx="134" cy="108" r="3" fill="#1F2933" stroke="none"/>
  <path d="M102 86 L116 96 L100 102 Z" fill="#FFB5A7"/>
  <path d="M138 86 L124 96 L140 102 Z" fill="#FFB5A7"/>
  <path d="M180 150 Q200 144 196 162 Q188 168 184 158" stroke-width="2.5" fill="none"/>`,
    horse: `  <ellipse cx="120" cy="160" rx="70" ry="34" fill="#A06A3F"/>
  <ellipse cx="170" cy="110" rx="22" ry="32" fill="#A06A3F"/>
  <path d="M168 80 L178 60 L184 78 Z" fill="#A06A3F"/>
  <path d="M180 80 L190 60 L196 78 Z" fill="#A06A3F"/>
  <circle cx="170" cy="106" r="3" fill="#1F2933" stroke="none"/>
  <ellipse cx="174" cy="130" rx="4" ry="3" fill="#1F2933" stroke="none"/>
  <path d="M150 100 L130 90 L132 124" fill="#1F2933"/>
  <rect x="80" y="190" width="12" height="30" fill="#A06A3F"/>
  <rect x="160" y="190" width="12" height="30" fill="#A06A3F"/>
  <path d="M60 170 Q40 180 50 200" stroke-width="3" fill="none"/>`,
    chicken: `  <ellipse cx="120" cy="160" rx="50" ry="40" fill="#FFFFFF"/>
  <circle cx="120" cy="100" r="28" fill="#FFFFFF"/>
  <path d="M120 76 L114 60 L120 72 L126 60 L120 76" stroke="#E04848" stroke-width="3" fill="#E04848"/>
  <path d="M134 100 L150 96 L140 108 Z" fill="#FFC857"/>
  <circle cx="124" cy="98" r="3" fill="#1F2933" stroke="none"/>
  <path d="M116 110 L122 116 L116 122" stroke="#E04848" stroke-width="1.5"/>
  <rect x="106" y="200" width="6" height="16" fill="#FFC857"/>
  <rect x="128" y="200" width="6" height="16" fill="#FFC857"/>`,
    duck: `  <ellipse cx="120" cy="160" rx="50" ry="36" fill="#FFC857"/>
  <circle cx="148" cy="116" r="26" fill="#FFC857"/>
  <path d="M166 110 L190 104 L174 124 Z" fill="#F08A4B"/>
  <circle cx="148" cy="112" r="3" fill="#1F2933" stroke="none"/>
  <path d="M140 200 L134 218 L146 218 Z" fill="#F08A4B"/>
  <path d="M160 200 L154 218 L166 218 Z" fill="#F08A4B"/>
  <path d="M76 156 Q60 152 60 168 Q68 170 78 162" fill="#FFC857"/>`,
  };
  if (farm[noun]) return root("A farm " + noun, farm[noun]);
  return placeholder("Farm: " + noun, "farm-" + noun);
}

function renderAction(id) {
  const verb = id.slice("img.action.".length);
  const body = (label, scene) => root(`A ${label}`, scene);
  switch (verb) {
    case "run":
      return body("character running",
        `  <circle cx="100" cy="100" r="30" fill="#F08A4B"/>
  <circle cx="92" cy="96" r="4" fill="#1F2933" stroke="none"/>
  <circle cx="108" cy="96" r="4" fill="#1F2933" stroke="none"/>
  <path d="M92 110 Q100 116 108 110" stroke-width="1.5"/>
  <path d="M84 134 Q80 162 70 188 L60 220" stroke-width="6" fill="none"/>
  <path d="M116 134 Q140 152 170 144" stroke-width="6" fill="none"/>
  <path d="M90 220 L120 200" stroke-width="6" fill="none"/>
  <path d="M160 60 Q180 70 200 60" stroke="#3DA9FC" stroke-width="3" stroke-dasharray="2 4" fill="none"/>
  <path d="M150 90 Q180 100 210 90" stroke="#3DA9FC" stroke-width="3" stroke-dasharray="2 4" fill="none"/>`);
    case "jump":
      return body("character jumping",
        `  <circle cx="120" cy="70" r="30" fill="#FFC857"/>
  <circle cx="112" cy="66" r="4" fill="#1F2933" stroke="none"/>
  <circle cx="128" cy="66" r="4" fill="#1F2933" stroke="none"/>
  <path d="M112 80 Q120 88 128 80" stroke-width="1.5"/>
  <path d="M90 100 L80 140" stroke-width="6"/>
  <path d="M150 100 L160 140" stroke-width="6"/>
  <path d="M100 100 L100 150" stroke-width="6"/>
  <path d="M140 100 L140 150" stroke-width="6"/>
  <ellipse cx="120" cy="200" rx="60" ry="6" fill="#1F2933" opacity="0.15" stroke="none"/>
  <path d="M50 160 Q70 156 60 170" stroke-width="2.5" fill="none"/>
  <path d="M170 160 Q190 156 180 170" stroke-width="2.5" fill="none"/>`);
    case "fly":
      return body("character flying",
        `  <path d="M0 240 L240 240 L240 200 L0 200 Z" fill="#5FB37C" stroke="none"/>
  <ellipse cx="120" cy="120" rx="48" ry="34" fill="#3DA9FC"/>
  <circle cx="120" cy="100" r="26" fill="#3DA9FC"/>
  <path d="M40 110 Q90 100 110 130 Q70 130 40 130 Z" fill="#9D8DF1"/>
  <path d="M200 110 Q150 100 130 130 Q170 130 200 130 Z" fill="#9D8DF1"/>
  <path d="M142 96 L160 92 L148 104 Z" fill="#FFC857"/>
  <circle cx="118" cy="96" r="3" fill="#1F2933" stroke="none"/>`);
    case "swim":
      return body("character swimming",
        `  <rect x="0" y="100" width="240" height="140" fill="#3DA9FC"/>
  <path d="M0 130 Q60 124 120 130 Q180 136 240 130" stroke="#FFFFFF" stroke-width="2" fill="none"/>
  <path d="M0 170 Q60 164 120 170 Q180 176 240 170" stroke="#FFFFFF" stroke-width="2" fill="none"/>
  <circle cx="120" cy="130" r="22" fill="#FFC857"/>
  <circle cx="112" cy="126" r="3" fill="#1F2933" stroke="none"/>
  <circle cx="128" cy="126" r="3" fill="#1F2933" stroke="none"/>
  <path d="M112 138 Q120 144 128 138" stroke-width="1.5"/>
  <path d="M70 150 Q90 144 100 156" stroke-width="6" fill="none"/>
  <path d="M170 150 Q150 144 140 156" stroke-width="6" fill="none"/>`);
    case "sleep":
      return body("character sleeping",
        `  <ellipse cx="120" cy="170" rx="80" ry="20" fill="#FFB5A7"/>
  <ellipse cx="120" cy="150" rx="50" ry="32" fill="#FFC857"/>
  <path d="M100 144 Q108 144 116 144" stroke-width="2.5"/>
  <path d="M124 144 Q132 144 140 144" stroke-width="2.5"/>
  <path d="M108 162 Q120 168 132 162" stroke-width="2"/>
  <text x="170" y="80" font-family="'Fredoka', system-ui, sans-serif" font-size="36" font-weight="700" fill="#9D8DF1" stroke="none">Zz</text>
  <text x="150" y="120" font-family="'Fredoka', system-ui, sans-serif" font-size="20" font-weight="700" fill="#9D8DF1" stroke="none">z</text>`);
    case "walk":
      return body("character walking",
        `  <circle cx="120" cy="80" r="28" fill="#5FB37C"/>
  <circle cx="112" cy="76" r="4" fill="#1F2933" stroke="none"/>
  <circle cx="128" cy="76" r="4" fill="#1F2933" stroke="none"/>
  <path d="M112 90 Q120 96 128 90" stroke-width="1.5"/>
  <path d="M120 108 L120 170" stroke-width="6"/>
  <path d="M100 130 L80 150" stroke-width="6"/>
  <path d="M140 130 L160 150" stroke-width="6"/>
  <path d="M120 170 L100 220" stroke-width="6"/>
  <path d="M120 170 L140 220" stroke-width="6"/>`);
    default: return placeholder("Action: " + verb, "action-" + verb);
  }
}

function renderAbility(id) {
  const tail = id.slice("img.ability.".length);
  const m = tail.match(/^([a-z]+)([A-Z][a-zA-Z]*)$/);
  if (!m) return placeholder("Ability: " + tail, "ability-" + tail);
  const animal = m[1];
  const action = m[2][0].toLowerCase() + m[2].slice(1);
  const isImpossible = tail.endsWith("X");
  const cleanAction = action.replace(/X$/, "");
  const animalFill = { bird: "#3DA9FC", cat: "#1F2933", fish: "#F08A4B", dog: "#A06A3F", hamster: "#A06A3F", rabbit: "#FFFFFF", horse: "#A06A3F", duck: "#FFC857" }[animal] ?? "#F08A4B";
  const titleAdj = isImpossible ? "tries to" : "can";
  const title = `A ${animal} ${titleAdj} ${cleanAction}`;
  const animalIcon = `  <circle cx="120" cy="110" r="40" fill="${animalFill}"/>
  <circle cx="108" cy="106" r="4" fill="#1F2933" stroke="none"/>
  <circle cx="132" cy="106" r="4" fill="#1F2933" stroke="none"/>
  <path d="M108 122 Q120 130 132 122" stroke-width="1.5"/>
  <text x="120" y="190" text-anchor="middle" font-family="'Fredoka', system-ui, sans-serif" font-size="16" font-weight="700" fill="#1F2933" stroke="none">${animal} + ${cleanAction}</text>`;
  const overlay = isImpossible ? `  <circle cx="180" cy="60" r="28" fill="#E04848"/>
  <text x="180" y="70" text-anchor="middle" font-family="'Fredoka', system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF" stroke="none">X</text>` : `  <circle cx="180" cy="60" r="28" fill="#5FB37C"/>
  <path d="M168 62 L176 70 L194 50" stroke="#FFFFFF" stroke-width="4" fill="none"/>`;
  return root(title, animalIcon + "\n" + overlay);
}

function renderMinPair(id) {
  const noun = id.slice("img.minPair.".length);
  switch (noun) {
    case "cap": return root("A baseball cap",
      `  <path d="M40 150 Q60 100 120 96 Q180 100 200 150 Q210 158 200 168 L40 168 Q30 158 40 150 Z" fill="#3DA9FC"/>
  <path d="M120 96 Q120 70 130 60" stroke-width="3"/>
  <circle cx="120" cy="56" r="6" fill="#FFC857" stroke="#1F2933" stroke-width="2"/>`);
    case "dish": return root("A dish or plate",
      `  <ellipse cx="120" cy="130" rx="92" ry="20" fill="#FFFFFF"/>
  <ellipse cx="120" cy="130" rx="70" ry="14" fill="#FFF8EE"/>
  <ellipse cx="120" cy="148" rx="86" ry="6" fill="#1F2933" opacity="0.15" stroke="none"/>`);
    case "log": return root("A wooden log",
      `  <ellipse cx="60" cy="120" rx="20" ry="40" fill="#A06A3F"/>
  <rect x="60" y="80" width="140" height="80" fill="#A06A3F"/>
  <ellipse cx="200" cy="120" rx="20" ry="40" fill="#A06A3F"/>
  <ellipse cx="60" cy="120" rx="14" ry="30" fill="#FFC857" opacity="0.5" stroke="#1F2933" stroke-width="1.5"/>
  <circle cx="60" cy="120" r="6" fill="#A06A3F" stroke="#1F2933" stroke-width="1.5"/>
  <line x1="60" y1="84" x2="200" y2="84" stroke-width="1.5"/>
  <line x1="60" y1="156" x2="200" y2="156" stroke-width="1.5"/>`);
    default: return placeholder("Min pair: " + noun, "min-pair-" + noun);
  }
}

function renderStoryPlaceholder(id) {
  // img.story.<slug>.<panel> -> labelled placeholder
  const parts = id.split(".");
  const story = parts[2];
  const panel = parts.slice(3).join("-");
  return placeholder(`${humanise(story)} - ${panel}`, `${kebab(story)}-${panel}`);
}

function humanise(s) {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
}

function kebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}

// --- Path computation --------------------------------------------------------

function conceptToFilePath(conceptId) {
  const parts = conceptId.split(".");
  if (parts[0] !== "img" || parts.length < 3) return null;
  const category = parts[1];
  if (category === "story") {
    const story = parts[2];
    const panel = parts.slice(3).join("-");
    const unit = STORY_UNIT[story];
    if (!unit) return null;
    return path.join(IMG, unit, `story-${kebab(story)}-${panel}.svg`);
  }
  const unit = CATEGORY_UNIT[category];
  if (!unit) return null;
  const slug = parts.slice(1).map(kebab).join("-");
  return path.join(IMG, unit, `${slug}.svg`);
}

// --- Discover concepts -------------------------------------------------------

function discoverConcepts() {
  const concepts = new Set();
  const dirs = [
    "content/units/01-me-and-my-world/manifest.json",
    "content/units/02-home-and-food/manifest.json",
    "content/units/03-animals-and-actions/manifest.json",
    "content/vocab/unit-01.json",
    "content/vocab/unit-02.json",
    "content/vocab/unit-03.json",
  ];
  for (const f of dirs) {
    const content = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of content.matchAll(/"imageConcept(?:Id)?"\s*:\s*"([^"]+)"/g)) {
      concepts.add(m[1]);
    }
  }
  for (const f of fs.readdirSync(path.join(ROOT, "content/stories"))) {
    const content = fs.readFileSync(path.join(ROOT, "content/stories", f), "utf8");
    for (const m of content.matchAll(/"imageConcept(?:Id)?"\s*:\s*"([^"]+)"/g)) {
      concepts.add(m[1]);
    }
  }
  return [...concepts].sort();
}

// --- Main --------------------------------------------------------------------

const skipManual = new Set([
  // Manually authored Tier 1 — do not overwrite.
  "img.greeting.waveSmile", "img.greeting.askQuestion", "img.greeting.sunriseSmile", "img.greeting.thumbsUp",
  "img.greeting.waveCasual", "img.greeting.waveGoodbye", "img.greeting.moonWave",
  "img.family.mommy", "img.family.daddy", "img.family.grandma", "img.family.grandpa", "img.family.sister", "img.family.brother",
  "img.color.redSwatch", "img.color.blueSwatch", "img.color.yellowSwatch", "img.color.greenSwatch", "img.color.orangeSwatch", "img.color.purpleSwatch", "img.color.blackSwatch", "img.color.whiteSwatch",
  "img.numeral.1", "img.numeral.2", "img.numeral.3", "img.numeral.4", "img.numeral.5", "img.numeral.6", "img.numeral.7", "img.numeral.8", "img.numeral.9", "img.numeral.10",
  "img.count.ducks.1", "img.count.ducks.2", "img.count.ducks.3", "img.count.ducks.4", "img.count.ducks.5", "img.count.ducks.6", "img.count.ducks.7", "img.count.ducks.8", "img.count.ducks.9", "img.count.ducks.10",
  "img.story.miloHello.p1", "img.story.miloHello.p2", "img.story.miloHello.p3", "img.story.miloHello.p4",
  "img.story.familyPicnic.p1", "img.story.familyPicnic.p2", "img.story.familyPicnic.p3", "img.story.familyPicnic.p4",
  "img.story.tenLittleDucks.p1", "img.story.tenLittleDucks.p2", "img.story.tenLittleDucks.p3", "img.story.tenLittleDucks.p4", "img.story.tenLittleDucks.p5", "img.story.tenLittleDucks.p6",
]);

let written = 0, skipped = 0, placeholdered = 0;
const allConcepts = discoverConcepts();
for (const id of allConcepts) {
  if (skipManual.has(id)) {
    skipped++;
    continue;
  }
  const target = conceptToFilePath(id);
  if (!target) {
    console.warn("no path for", id);
    continue;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let svg = renderConcept(id);
  if (!svg) {
    svg = placeholder(humanise(id.replace(/^img\./, "")), id.replace(/^img\./, "").replace(/\./g, "-"));
    placeholdered++;
  }
  fs.writeFileSync(target, svg);
  written++;
}

console.log(`Discovered ${allConcepts.length} concepts.`);
console.log(`Wrote: ${written}  Skipped (Tier 1 manual): ${skipped}  Pure placeholders: ${placeholdered}`);
