import { blendOver, type Hex } from './color';

/**
 * Design tokens for all three Charva front-ends.
 *
 * The prototypes contain no CSS custom properties at all — every colour is an inline literal
 * repeated dozens of times — so this file is authored from the values found in the markup,
 * cross-checked against the handoff README's token table.
 *
 * Five text colours have been darkened from their mockup values because they do not clear
 * WCAG AA. See CONTRAST_CORRECTIONS below: hue and saturation are untouched, only lightness
 * moves, and each correction is the smallest that reaches 4.5:1.
 *
 * Theming is ambient. These values are emitted as CSS custom properties scoped by
 * `[data-theme]`, so no component takes a `theme` prop or branches on one.
 */

// ======================================================================================
// Colour
// ======================================================================================

/** Shared between Global and Umrah — the sand accent is the one thing both brands own. */
export const sand = {
  /** Accent, buttons, active states. Fill and decoration only — never text on a light surface. */
  DEFAULT: '#DFA059',
  /** Accent hover; the far end of the seats-progress gradient. */
  light: '#F0C48E',
  /** Links and eyebrows on light. Corrected from the mockup's #A9722C. */
  dark: '#996728',
  /** Active nav item, active topic chip. Passes as-is. */
  deep: '#8A5A22',
  /** Text on a sand fill. */
  contrast: '#3A2A18',
} as const;

export const globalPalette = {
  sand: sand.DEFAULT,
  sandLight: sand.light,
  sandDark: sand.dark,
  sandDeep: sand.deep,

  /** Footer. */
  brown950: '#241C15',
  /** Dark sections, primary text, active filter chip. */
  brown900: '#33261B',
  /** The video section and the whole video page. */
  brown800: '#2C221A',
  /** Nav items, idle chips, review body. */
  brown700: '#4A382A',
  /** Body text on light. */
  brown500: '#6E594A',
  /** Meta and captions. Corrected from #93806E. */
  brown400: '#7F6E5E',
  /** Empty values in the builder estimate. Corrected from #B7A695 — the largest change. */
  brown300: '#826D58',

  /** Page background. */
  bg: '#FAF6EF',
  /** Cards. The homepage uses #FFFFFF in places; normalised to this. */
  surface: '#FFFDFA',
  /** Text on dark. */
  cream: '#FDF9F3',
  /** Text on the sand button. The homepage uses #201509 in places; normalised. */
  btnText: sand.contrast,
} as const satisfies Record<string, Hex>;

export const umrahPalette = {
  sand: sand.DEFAULT,
  sandLight: sand.light,
  sandDeep: sand.deep,

  /** Footer. */
  green950: '#0B1310',
  /** Hero, the signup CTA block, the summary card. */
  green900: '#0E1714',
  /** Dark sections, package card, the whole program page, active filter chip. */
  green800: '#22322B',
  /** Nav items, current breadcrumb. */
  green700: '#2A3A33',
  /** Body text. Passes at 5.62:1 — left at its mockup value. */
  green500: '#55655C',
  /** Meta and captions. Corrected from #7A8981. */
  green400: '#66736C',

  /** Headings. */
  ink: '#16201C',
  /** Page background. */
  bg: '#F7F4EE',
  /** Cards. */
  surface: '#FFFDFA',
  /** Text on dark. Note it differs from Global's cream by one channel — deliberate. */
  cream: '#FCF9F4',
  /** Links and duration labels. Corrected from #A8752F. */
  link: '#946729',
  btnText: sand.contrast,
} as const satisfies Record<string, Hex>;

export const choicePalette = {
  sand: sand.DEFAULT,
  sandLight: sand.light,

  bg: '#0D0906',
  cream: '#FDF9F3',
  /** Text of the outline button on the Umrah half. */
  creamWarm: '#F6EEE3',
  /** Text on the sand button. */
  btnText: '#20160B',
} as const satisfies Record<string, Hex>;

/**
 * Alpha conventions.
 *
 * The prototypes repeat a handful of rgba bases at a dozen opacities each. Deriving them keeps
 * one source of truth instead of forty literals, and makes the two brands' near-identical but
 * genuinely different values (`90,66,44` against `34,50,43`) impossible to mix up by accident.
 */
export const alphaBase = {
  /** Global, on light: borders, dividers, chip fills. */
  globalInk: '90, 66, 44',
  /** Umrah, on light: the same roles, a cooler base. */
  umrahInk: '34, 50, 43',
  /** Either brand, on dark. */
  white: '255, 255, 255',
  /** Global cream, on dark. */
  globalCream: '253, 249, 243',
  /** Umrah cream, on dark. */
  umrahCream: '252, 249, 244',
  /** The sand accent as a tint. */
  sand: '223, 160, 89',
  /** Photo scrims, Global. */
  globalScrim: '38, 27, 18',
  /** Photo scrims, the Global video page. */
  globalVideoScrim: '20, 14, 8',
  /** Photo scrims, Umrah. */
  umrahScrim: '14, 23, 20',
  /** Choice glass and scrims. */
  choiceGlass: '20, 14, 10',
} as const;

export function alpha(base: keyof typeof alphaBase, opacity: number): string {
  return `rgba(${alphaBase[base]}, ${String(opacity)})`;
}

// ======================================================================================
// Geometry
// ======================================================================================

export const layout = {
  /** Content container. */
  containerMax: 1480,
  containerPadding: 60,
  /** The sticky nav island sits slightly narrower than the content. */
  navIslandMax: 1440,
  navIslandPadding: '18px 40px 0',
  /** Choice has its own, wider-padded nav. */
  choiceNavMax: 1400,
  choiceNavPadding: '26px 44px',
  /** Vertical rhythm between sections; 110 is also the gap before the footer. */
  sectionGap: 100,
  footerGap: 110,
  /** Every prototype page carries this. Phase 8 removes it in favour of the breakpoints. */
  legacyMinWidth: 1280,
} as const;

export const radius = {
  /** Buttons, chips, the nav island, progress tracks. */
  pill: 9999,
  /** Large CTA blocks. */
  block: 30,
  /** Panels, form cards, contact cards. */
  panel: 28,
  panelSm: 26,
  /** Cards and photos. Global sits at 22, Umrah at 24 — a real difference, not noise. */
  cardGlobal: 22,
  cardUmrah: 24,
  media: 20,
  sm: 18,
  xs: 16,
  /** Inputs. */
  input: 12,
} as const;

/**
 * Mosaic row height.
 *
 * The gallery page, the Umrah group mosaic and the handoff README all say 220px; only the
 * Global homepage says 210. Three against one, so 220 it is. Open question Q-8.
 */
export const mosaic = {
  rowHeight: 220,
  columns: 4,
  gap: 16,
} as const;

// ======================================================================================
// Typography
// ======================================================================================

export const fontFamily = {
  sans: "'Stolzl', 'Manrope', sans-serif",
} as const;

/**
 * Five CSS weights from three font files — 500 and 600 both map to Medium, 700 and 800 both
 * map to Bold. That is how the prototypes declare it and how the Bakar project already ships it.
 */
export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 800,
} as const;

/** [size px, line height, letter spacing] */
export const type = {
  heroGlobal: [82, 1.0, '-0.02em'],
  heroUmrah: [72, 1.02, '-0.02em'],
  heroChoice: [64, 1.02, '-0.015em'],
  h1: [63, 1.04, '-0.02em'],
  /** The homepage section headings. The band is 36–50 and this is its top. */
  h2Lg: [50, 1.1, '-0.015em'],
  h2: [44, 1.12, '-0.015em'],
  h2Sm: [36, 1.14, '-0.015em'],
  h3: [33, 1.15, 'normal'],
  cardTitle: [24, 1.22, 'normal'],
  lead: [18, 1.65, 'normal'],
  body: [15, 1.7, 'normal'],
  bodySm: [14, 1.6, 'normal'],
  /** Section eyebrow: 11px/700 uppercase. Not "large text" — needs the full 4.5:1. */
  eyebrow: [11, 1, '0.3em'],
  label: [11, 1, '0.16em'],
  chip: [13, 1, '0.02em'],
  stat: [32, 1, 'normal'],
  /** Countdown digits. Zero-padded to two, but a day count over 99 renders three. */
  countdown: [42, 1, '-0.02em'],
} as const satisfies Record<string, readonly [number, number, string]>;

/**
 * The hero headline, which is the one type role where the three sites genuinely disagree:
 * 82px on Global, 72px on Umrah, 64px on Choice, each with its own leading and tracking.
 *
 * Rather than a `site` prop on the most prominent element of every homepage, these become
 * theme variables — `--c-hero-size` and friends — so `<Heading size="hero">` renders the right
 * one by virtue of which document it is in.
 *
 * The value is a `clamp()` because the prototypes are fixed-width at 1280 and an 82px headline
 * on a 375px phone overflows on the second word. The upper bound is pinned above ~1170px, so
 * at every width the design was drawn for the number is exactly the one in the mockup, and
 * below that it scales rather than wraps into six lines.
 */
export const heroScale = {
  global: { size: 'clamp(38px, 7vw, 82px)', leading: '1', tracking: '-0.02em' },
  umrah: { size: 'clamp(34px, 6.2vw, 72px)', leading: '1.02', tracking: '-0.02em' },
  choice: { size: 'clamp(32px, 5.5vw, 64px)', leading: '1.02', tracking: '-0.015em' },
} as const;

/**
 * Text opacities on a dark surface.
 *
 * The prototypes use ten of them between 1 and .4. Three carry text, and only those three are
 * named here; everything fainter is decoration — rules, disabled states, scrim edges — and is
 * written inline where it is used. `tokens.test.ts` flattens these against every dark surface
 * in the system and holds them to the same AA bar as the opaque pairs.
 */
export const onDarkAlpha = {
  /** Body copy on a dark section. */
  body: 0.72,
  /** Meta, captions, footer links. */
  muted: 0.55,
  /** Decoration only — this one does not clear AA and must never carry text. */
  faint: 0.4,
} as const;

// ======================================================================================
// Motion
// ======================================================================================

export const easing = {
  /** Card lift. */
  lift: 'cubic-bezier(.22, .8, .2, 1)',
  /** Slider cross-fade and indicator width. */
  slide: 'cubic-bezier(.4, 0, .2, 1)',
  /** Dropdown open. */
  drop: 'cubic-bezier(.2, .9, .2, 1)',
  /** Caret rotation. */
  caret: 'cubic-bezier(.3, .9, .2, 1)',
  /** The Choice half expanding. */
  expand: 'cubic-bezier(.16, 1, .3, 1)',
} as const;

export const duration = {
  chip: 240,
  colour: 260,
  option: 220,
  lift: 320,
  drop: 260,
  caret: 300,
  indicator: 500,
  packSlide: 1000,
  heroSlide: 1200,
  choiceExpand: 1100,
} as const;

export const interval = {
  /** Hero sliders on both homepages. */
  hero: 6500,
  /** The Umrah package slider. */
  packageSlider: 5000,
  /** The countdown ticks every second; Choice re-reads the clock every thirty. */
  countdownTick: 1000,
  choiceDayTick: 30_000,
} as const;

/** Card hover lift. Global and Umrah genuinely differ — do not unify. */
export const lift = {
  global: -6,
  umrah: -5,
} as const;

// ======================================================================================
// Breakpoints
// ======================================================================================

/**
 * Max-width breakpoints, matching the handoff README §10 bands. The design is desktop-only at
 * 1280 and up; everything below is our own work.
 */
export const breakpoint = {
  /** 1024–1279: grids 3 -> 2, gallery 4 -> 3, the builder rail becomes a horizontal strip. */
  lap: 1279,
  /** 768–1023: nav collapses to a burger, hero drops to 70vh. */
  tab: 1023,
  /** Below 768: single column, the Choice split becomes vertical. */
  mob: 767,
} as const;

/** Minimum tap target, from README §10. */
export const minTapTarget = 44;

// ======================================================================================
// The contrast contract
// ======================================================================================

/**
 * Text colours darkened from their mockup values, and why.
 *
 * Only lightness moves; hue and saturation are preserved, and each correction is the smallest
 * that reaches 4.5:1 against the lightest surface the token is used on. This is the one place
 * where the implementation knowingly departs from "pixel-perfect" — decision D-3, question Q-7.
 *
 * `#55655C` (Umrah body text) was reported as failing at 4.29:1 during planning. Re-measured,
 * it is 5.62:1 and passes; it is left at its mockup value.
 */
export const CONTRAST_CORRECTIONS = [
  {
    token: 'globalPalette.brown300',
    mockup: '#B7A695',
    corrected: '#826D58',
    was: 2.19,
    now: 4.56,
    on: '#FAF6EF',
    note: 'Empty values in the builder estimate. The largest change of the five and the most visible; at 2.19:1 the mockup value was barely legible.',
  },
  {
    token: 'globalPalette.brown400',
    mockup: '#93806E',
    corrected: '#7F6E5E',
    was: 3.51,
    now: 4.54,
    on: '#FAF6EF',
    note: 'Meta lines and captions across Global.',
  },
  {
    token: 'sand.dark',
    mockup: '#A9722C',
    corrected: '#996728',
    was: 3.8,
    now: 4.51,
    on: '#FAF6EF',
    note: 'Links and 11px/700 eyebrows. At 34px statistic numbers the mockup value already passed the 3:1 large-text bar; one corrected value serves both.',
  },
  {
    token: 'umrahPalette.green400',
    mockup: '#7A8981',
    corrected: '#66736C',
    was: 3.34,
    now: 4.52,
    on: '#F7F4EE',
    note: 'Meta lines and captions across Umrah.',
  },
  {
    token: 'umrahPalette.link',
    mockup: '#A8752F',
    corrected: '#946729',
    was: 3.64,
    now: 4.52,
    on: '#F7F4EE',
    note: 'Links and the duration labels on ziyarat cards.',
  },
] as const;

/**
 * Every text colour paired with every surface it actually appears on.
 *
 * `tokens.test.ts` walks this list on every build. Adding a colour without adding its pair here
 * is how the mockup's 2.19:1 got as far as a handoff in the first place.
 */
export interface ContrastPair {
  fg: Hex;
  bg: Hex;
  /** Font size in px at the smallest place this pair appears. */
  size: number;
  bold?: boolean;
  where: string;
}

/** Every dark surface in the system, with the cream its brand puts on top. */
export const DARK_SURFACES: readonly { bg: Hex; cream: Hex; where: string }[] = [
  { bg: globalPalette.brown950, cream: globalPalette.cream, where: 'the Global footer' },
  { bg: globalPalette.brown900, cream: globalPalette.cream, where: 'Global dark sections' },
  { bg: globalPalette.brown800, cream: globalPalette.cream, where: 'the Global video page' },
  { bg: umrahPalette.green950, cream: umrahPalette.cream, where: 'the Umrah footer' },
  { bg: umrahPalette.green900, cream: umrahPalette.cream, where: 'the Umrah hero' },
  { bg: umrahPalette.green800, cream: umrahPalette.cream, where: 'Umrah dark sections' },
  { bg: choicePalette.bg, cream: choicePalette.cream, where: 'Choice' },
];

/**
 * The translucent creams, flattened.
 *
 * Generated rather than typed out: fourteen pairs written by hand would be fourteen chances to
 * paste the wrong backdrop, and the whole point is that the number is measured.
 */
const onDarkPairs: ContrastPair[] = DARK_SURFACES.flatMap(({ bg, cream, where }) => [
  { fg: blendOver(cream, bg, onDarkAlpha.body), bg, size: 15, where: `body text on ${where}` },
  { fg: blendOver(cream, bg, onDarkAlpha.muted), bg, size: 12, where: `meta on ${where}` },
]);

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // --- Global on light ---
  { fg: globalPalette.brown900, bg: globalPalette.bg, size: 15, where: 'headings and body' },
  { fg: globalPalette.brown700, bg: globalPalette.bg, size: 14, where: 'nav items, idle chips' },
  { fg: globalPalette.brown500, bg: globalPalette.bg, size: 15, where: 'body text' },
  { fg: globalPalette.brown500, bg: globalPalette.surface, size: 15, where: 'body on cards' },
  { fg: globalPalette.brown400, bg: globalPalette.bg, size: 12, where: 'meta and captions' },
  { fg: globalPalette.brown400, bg: globalPalette.surface, size: 12, where: 'meta on cards' },
  { fg: globalPalette.brown300, bg: globalPalette.bg, size: 15, where: 'empty estimate values' },
  { fg: sand.dark, bg: globalPalette.bg, size: 11, bold: true, where: 'links and eyebrows' },
  { fg: sand.deep, bg: globalPalette.bg, size: 14, where: 'active nav item' },

  // --- Global on dark ---
  { fg: globalPalette.cream, bg: globalPalette.brown900, size: 15, where: 'text on dark sections' },
  { fg: globalPalette.cream, bg: globalPalette.brown800, size: 15, where: 'the video page' },
  { fg: globalPalette.cream, bg: globalPalette.brown950, size: 14, where: 'footer text' },
  { fg: sand.DEFAULT, bg: globalPalette.brown900, size: 11, bold: true, where: 'eyebrows on dark' },
  { fg: sand.DEFAULT, bg: globalPalette.brown800, size: 15, where: 'links on the video page' },
  { fg: sand.DEFAULT, bg: globalPalette.brown950, size: 11, bold: true, where: 'footer titles' },
  { fg: sand.contrast, bg: sand.DEFAULT, size: 13, bold: true, where: 'text on the sand button' },

  // --- Umrah on light ---
  { fg: umrahPalette.ink, bg: umrahPalette.bg, size: 15, where: 'headings' },
  { fg: umrahPalette.green700, bg: umrahPalette.bg, size: 14, where: 'nav items' },
  { fg: umrahPalette.green500, bg: umrahPalette.bg, size: 15, where: 'body text' },
  { fg: umrahPalette.green500, bg: umrahPalette.surface, size: 15, where: 'body on cards' },
  { fg: umrahPalette.green400, bg: umrahPalette.bg, size: 12, where: 'meta and captions' },
  { fg: umrahPalette.green400, bg: umrahPalette.surface, size: 12, where: 'meta on cards' },
  { fg: umrahPalette.link, bg: umrahPalette.bg, size: 12, bold: true, where: 'links, durations' },
  { fg: sand.deep, bg: umrahPalette.bg, size: 14, where: 'active nav item' },

  // --- Umrah on dark ---
  { fg: umrahPalette.cream, bg: umrahPalette.green800, size: 15, where: 'dark sections' },
  { fg: umrahPalette.cream, bg: umrahPalette.green900, size: 15, where: 'hero text' },
  { fg: umrahPalette.cream, bg: umrahPalette.green950, size: 14, where: 'footer text' },
  { fg: sand.DEFAULT, bg: umrahPalette.green800, size: 11, bold: true, where: 'eyebrows on dark' },
  { fg: sand.DEFAULT, bg: umrahPalette.green900, size: 11, bold: true, where: 'countdown label' },
  { fg: sand.DEFAULT, bg: umrahPalette.green950, size: 11, bold: true, where: 'footer titles' },

  // --- Choice ---
  { fg: choicePalette.cream, bg: choicePalette.bg, size: 17, where: 'headline and lead' },
  { fg: choicePalette.creamWarm, bg: choicePalette.bg, size: 13, bold: true, where: 'outline CTA' },
  { fg: sand.DEFAULT, bg: choicePalette.bg, size: 29, where: 'stat values' },
  { fg: choicePalette.btnText, bg: sand.DEFAULT, size: 13, bold: true, where: 'sand CTA' },

  // --- The translucent creams, resolved against each dark surface ---
  ...onDarkPairs,
];

/**
 * Colours that must never carry text on a light surface.
 *
 * `sand` on `bg` is 2.1:1. It is the brand accent and it will be reached for; this list plus
 * the test that walks it is what stops that becoming a shipped page. Fills, borders, rules and
 * icons are all fine — text is not.
 */
export const FILL_ONLY_ON_LIGHT = [sand.DEFAULT, sand.light] as const;
