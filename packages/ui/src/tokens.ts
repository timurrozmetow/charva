import { HERO_SCRIM_STOPS, heroScrimCss, SCRIM_RGB } from '@charva/contracts';

import { blendOver, type Hex, rgbTripleToHex } from './color';

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
  /** Links and eyebrows on light. From #A9722C, then again for tinted chips. */
  dark: '#906126',
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
  /** Meta and captions. Corrected from #93806E, then again for tinted chips. */
  brown400: '#78685A',
  /** Builder estimate blanks. From #B7A695 — the largest change — then again for chips. */
  brown300: '#74695F',

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
  /** Meta and captions. Corrected from #7A8981, then again for tinted chips. */
  green400: '#606B65',

  /** Headings. */
  ink: '#16201C',
  /** Page background. */
  bg: '#F7F4EE',
  /** Cards. */
  surface: '#FFFDFA',
  /** Text on dark. Note it differs from Global's cream by one channel — deliberate. */
  cream: '#FCF9F4',
  /** Links and duration labels. From #A8752F, then again for tinted chips. */
  link: '#8A6027',
  btnText: sand.contrast,
} as const satisfies Record<string, Hex>;

/**
 * The one colour that is not in the handoff.
 *
 * There is no error state anywhere in the package — no invalid field, no failed submission,
 * no required-field message — because there is not a single working form in it: the checkboxes
 * are styled `<span>`s and the submit buttons are `<a href="#">`. A colour for "this went
 * wrong" has to be invented, so it is invented once, here, measured, and kept warm enough to
 * belong beside both palettes rather than dropped in from a framework.
 *
 * Two values because one cannot serve both surfaces: a red dark enough to read on cream is
 * invisible on `#33261B`. The dark section swaps them through `--c-danger`, so no component
 * chooses between them.
 */
export const danger = {
  /** On any light surface. 6.6:1 on the Global page, 6.4:1 on the Umrah page. */
  DEFAULT: '#A32E20',
  /** On any dark surface. */
  onDark: '#F2A399',
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
  /**
   * Photo scrims, Global — read from contracts rather than restated here.
   *
   * The shell draws this same overlay into the loading splash, where no stylesheet exists yet
   * and no Tailwind class can be used, so the value had to live somewhere both the browser and
   * the server read. `scrim.ts` in contracts says why it is there and not here; this package
   * bundles contracts, so the move costs the browser nothing.
   */
  globalScrim: SCRIM_RGB.global,
  /** Photo scrims, the Global video page. */
  globalVideoScrim: '20, 14, 8',
  /** Photo scrims, Umrah. From contracts, for the same reason as Global's above. */
  umrahScrim: SCRIM_RGB.umrah,
  /** Choice glass and scrims. */
  choiceGlass: '20, 14, 10',
  /** The gradient over the Global half of the chooser. */
  choiceGlobalScrim: '13, 9, 6',
  /**
   * The gradient over the Umrah half — a cooler base than the Global one.
   *
   * Six pixels of offset and a two-hundredth of opacity apart from its neighbour, which looks
   * like noise until you see the two side by side. Written down rather than averaged away, for
   * the same reason the two card shadows are (D-30): a tidying commit that unified them would
   * change the design and nobody would be able to say which commit did it.
   */
  choiceUmrahScrim: '7, 14, 12',
} as const;

/**
 * The four stops both chooser gradients use, and the only difference between them.
 *
 * `to top` from nearly opaque at the bottom, through a clear middle where the photograph shows,
 * back to half-dark at the very top so the floating navigation stays legible over any image.
 */
export const choiceScrim = {
  global: [0.96, 0.74, 0.22, 0.52],
  umrah: [0.96, 0.76, 0.24, 0.54],
} as const;

export function choiceScrimGradient(half: keyof typeof choiceScrim): string {
  const base = half === 'global' ? alphaBase.choiceGlobalScrim : alphaBase.choiceUmrahScrim;
  const [bottom, low, mid, top] = choiceScrim[half];
  return (
    `linear-gradient(to top, rgba(${base}, ${String(bottom)}) 0%, ` +
    `rgba(${base}, ${String(low)}) 34%, ` +
    `rgba(${base}, ${String(mid)}) 68%, ` +
    `rgba(${base}, ${String(top)}) 100%)`
  );
}

/**
 * The hero overlay, bottom to top: opaque enough to read a headline over, clear enough at the
 * top to still see what was photographed.
 *
 * Written against `--c-scrim-rgb` rather than a literal base, so the same class works on the
 * Global hero (`38, 27, 18`) and the Umrah one (`14, 23, 20`) — the two are drawn with two
 * hand-written literals in the handoff. Umrah's runs at 105° instead of vertically, which is a
 * genuine difference and gets its own token when phase 6 needs it.
 */
export const heroScrim = HERO_SCRIM_STOPS;

export function heroScrimGradient(direction = 'to top'): string {
  // The variable rather than a literal base: one rule serves both sites, because `--c-scrim-rgb`
  // is redirected per theme. The server calls the same builder with the site's own triple, so
  // the splash and the hero are the same overlay rather than two that look alike.
  return heroScrimCss('var(--c-scrim-rgb)', direction);
}

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
  /** The nav island sits slightly narrower than the content. */
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
 *
 * Choice is the exception, and it is the only page in the system that has to be: the two
 * homepages scroll, so their headline is bound by width alone and a tall block simply pushes
 * the next section down. The chooser fills the window and has nothing below it, so its binding
 * axis is **height** — and a size that reads only `vw` cannot know the window is short. On a
 * 1366x768 laptop the Umrah column wanted 745px inside 760, and the difference came off the
 * top: the eyebrow behind the nav island and the first line of the headline gone. `min()` of
 * the two axes is what makes the headline shrink when the window is short rather than when it
 * is narrow, and that is what the owner was looking at.
 */
export const heroScale = {
  global: { size: 'clamp(38px, 7vw, 82px)', leading: '1', tracking: '-0.02em' },
  umrah: { size: 'clamp(34px, 6.2vw, 72px)', leading: '1.02', tracking: '-0.02em' },
  choice: { size: 'clamp(28px, min(4.5vw, 7.2vh), 58px)', leading: '1.04', tracking: '-0.015em' },
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
  /**
   * Meta, captions, footer links.
   *
   * .55 on a plain dark section is 5.0:1 and fine. It was also .55 on a panel inside a dark
   * section, where the backdrop has two six-percent cream fills on it and the same text falls
   * to 4.16:1 — which is where Lighthouse found it, in the builder. .62 clears 4.5 on the
   * deepest stack the design builds and leaves the plain section brighter than it was, which
   * is the direction a legibility fix is allowed to move.
   */
  muted: 0.62,
  /** Decoration only — this one does not clear AA and must never carry text. */
  faint: 0.4,
} as const;

/**
 * The cream fills, which is what a panel on a dark section is made of.
 *
 * These were literals in the Tailwind preset — `rgba(var(--c-cream-rgb), 0.06)` — a second copy
 * of numbers that belong beside the opacities above, and the reason the contrast contract could
 * not see what the builder actually paints. The preset reads them from here now.
 */
export const creamFillAlpha = 0.06;

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
  /**
   * Anything answering a pointer directly: a hover colour, a press.
   *
   * A strong ease-out, because the moment the reader is watching is the beginning. The curve
   * this replaced on buttons and chips was `cubic-bezier(.4, 0, .2, 1)` — Material's standard
   * curve, which is an ease-*in*-out and therefore starts slowly, delaying the one frame that
   * says «I heard you».
   */
  press: 'cubic-bezier(.23, 1, .32, 1)',
} as const;

export const duration = {
  /**
   * A control acknowledging a pointer.
   *
   * Short on purpose. Buttons and chips ran their hover at 260ms and had no press state at all,
   * which mattered far more than it sounds: `hover:` is compiled to `@media (hover: hover)` on
   * purpose (D-51), so on a phone — most of this audience — a tap produced no visual response
   * whatsoever between the finger landing and the next page arriving. On a connection out of
   * Ashgabat that is a second or more of a screen that looks broken.
   */
  press: 160,
  chip: 240,
  colour: 260,
  option: 220,
  lift: 320,
  drop: 260,
  caret: 300,
  indicator: 500,
  packSlide: 1000,
  heroSlide: 1200,
  /**
   * The chooser half expanding under the pointer. The prototype says 1100ms.
   *
   * Halved, and the reason is not taste. This is a `flex-grow` transition on an element the size
   * of half the window with a full-bleed photograph inside it, so every frame of it is a layout,
   * a paint and a composite — the most expensive animation either site has, on the first thing
   * anybody touches. 1100ms is sixty-odd such frames; 520 is thirty. And it is a *response to a
   * pointer*: at 1100ms the half is still moving a second after the cursor arrived, which is
   * long past the point where the reader has stopped connecting the movement to their own hand.
   *
   * 520 rather than something shorter because the thing being moved is enormous, and the design's
   * unhurried feel is the point of the screen. It is the top of the 200–500ms range for a drawer,
   * which is the closest thing to this that has a budget.
   */
  choiceExpand: 520,
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
  /**
   * Where the navigation island gives up and becomes a burger.
   *
   * Its own number rather than `tab`, because the island runs out of room long before the page
   * does: seven Russian labels, a logo, a language switcher and a call to action on one row. At
   * 1240 «Сборщик туров» wrapped to two lines and the bar grew to 65px; below 1180 the logo —
   * the only shrinkable flex child — was squeezed to nothing, and at 1024 it was 0px wide. The
   * burger used to arrive at 1023, two hundred pixels after it was needed.
   */
  navbar: 1239,
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
 * The tinted chip, flattened — and the surface every correction below is now measured against.
 *
 * Text does not only sit on the page and on cards. It sits on chips: a filter pill, a facet
 * count, a tag, the little `bg-line-soft` rounded box. That fill is the brand's ink at six
 * percent, so the chip is *darker* than the page it lies on, and dark text on it has less
 * contrast than the same text one pixel outside it.
 *
 * That is how five colours corrected to 4.51–4.56:1 in phase 1 came to fail an audit in phase 9.
 * Each was measured against `bg` — the lightest surface it appears on — and cleared the bar by
 * four hundredths. Any tint at all was going to take it back, and a six percent tint took about
 * half a point. The rule here is now the opposite one: measure against the *darkest* light
 * surface a token is allowed on, because that is the one that decides whether it is legible.
 *
 * Lighthouse found two of the five from the outside, on the live site, which is the part worth
 * remembering: `CONTRAST_PAIRS` had listed the pairs somebody thought of rather than the pairs
 * that occur.
 */
export const CHIP_GLOBAL: Hex = blendOver(
  rgbTripleToHex(alphaBase.globalInk),
  globalPalette.bg,
  0.06,
);
export const CHIP_UMRAH: Hex = blendOver(rgbTripleToHex(alphaBase.umrahInk), umrahPalette.bg, 0.06);

/**
 * Text colours darkened from their mockup values, and why.
 *
 * Only lightness moves; hue and saturation are preserved, and each correction is the smallest
 * that reaches 4.5:1 against the darkest light surface the token is used on — see `CHIP_GLOBAL`
 * above for why that is not the page background. This is the one place where the implementation
 * knowingly departs from "pixel-perfect" — decision D-3, question Q-7.
 *
 * `#55655C` (Umrah body text) was reported as failing at 4.29:1 during planning. Re-measured,
 * it is 5.62:1 and passes even on a chip; it is left at its mockup value.
 */
export const CONTRAST_CORRECTIONS = [
  {
    token: 'globalPalette.brown300',
    mockup: '#B7A695',
    corrected: '#74695F',
    was: 1.99,
    now: 4.5,
    on: CHIP_GLOBAL,
    note: 'Empty values in the builder estimate. The largest change of the five and the most visible; at 2.19:1 the mockup value was barely legible.',
  },
  {
    token: 'globalPalette.brown400',
    mockup: '#93806E',
    corrected: '#78685A',
    was: 3.19,
    now: 4.51,
    on: CHIP_GLOBAL,
    note: 'Meta lines and captions across Global.',
  },
  {
    token: 'sand.dark',
    mockup: '#A9722C',
    corrected: '#906126',
    was: 3.45,
    now: 4.51,
    on: CHIP_GLOBAL,
    note: 'Links and 11px/700 eyebrows. At 34px statistic numbers the mockup value already passed the 3:1 large-text bar; one corrected value serves both.',
  },
  {
    token: 'umrahPalette.green400',
    mockup: '#7A8981',
    corrected: '#606B65',
    was: 2.99,
    now: 4.52,
    on: CHIP_UMRAH,
    note: 'Meta lines and captions across Umrah.',
  },
  {
    token: 'umrahPalette.link',
    mockup: '#A8752F',
    corrected: '#8A6027',
    was: 3.26,
    now: 4.53,
    on: CHIP_UMRAH,
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
  /**
   * A border, a ring, an icon — not text.
   *
   * WCAG 1.4.11 asks 3:1 of these whatever their size, where text is judged by how large it is.
   * The focus ring is the reason the flag exists: it was drawn in the accent, which is 2.09:1 on
   * cream, and no font size would have made that acceptable.
   */
  nonText?: boolean;
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
const onDarkPairs: ContrastPair[] = DARK_SURFACES.flatMap(({ bg, cream, where }) => {
  /*
   * The panel, and the card inside the panel.
   *
   * A dark section is not the darkest thing text sits on — it is the lightest. The builder puts
   * a `bg-cream-fill` panel on the section and `bg-cream-fill` cards inside the panel, so the
   * same six percent cream is applied twice and the backdrop rises by about eleven percent of
   * the way to white. Translucent cream text on that has correspondingly less to work with, and
   * `cream-muted` at .55 landed on 4.16:1 there — which Lighthouse found on the live site and
   * this list did not, because it only ever modelled one fill.
   *
   * Two levels and not more: two is what the design stacks, and a list that modelled three
   * would be guarding a thing nobody built.
   */
  const panel = blendOver(cream, bg, creamFillAlpha);
  const inPanel = blendOver(cream, panel, creamFillAlpha);

  return [
    { fg: blendOver(cream, bg, onDarkAlpha.body), bg, size: 15, where: `body text on ${where}` },
    { fg: blendOver(cream, bg, onDarkAlpha.muted), bg, size: 12, where: `meta on ${where}` },
    {
      fg: blendOver(cream, inPanel, onDarkAlpha.muted),
      bg: inPanel,
      size: 12,
      where: `meta on a panel on ${where}`,
    },
    {
      fg: blendOver(cream, inPanel, onDarkAlpha.body),
      bg: inPanel,
      size: 15,
      where: `body text on a panel on ${where}`,
    },
  ];
});

/**
 * Every corrected text colour, on the tinted chip it also appears on.
 *
 * The second half of the same lesson: `onDarkPairs` above models the fills that stack on dark,
 * and this models the one that darkens on light. Generated rather than typed out, so a colour
 * cannot be corrected against the page and quietly forgotten against the chip — which is
 * precisely what happened to all five of them.
 */
const onChipPairs: ContrastPair[] = [
  { fg: globalPalette.brown300, bg: CHIP_GLOBAL, size: 15, where: 'estimate blanks on a chip' },
  { fg: globalPalette.brown400, bg: CHIP_GLOBAL, size: 11, where: 'meta on a chip' },
  { fg: globalPalette.brown500, bg: CHIP_GLOBAL, size: 15, where: 'body text on a chip' },
  { fg: globalPalette.brown700, bg: CHIP_GLOBAL, size: 14, where: 'an idle filter chip' },
  { fg: sand.dark, bg: CHIP_GLOBAL, size: 11, bold: true, where: 'an eyebrow on a chip' },
  { fg: umrahPalette.green400, bg: CHIP_UMRAH, size: 11, where: 'meta on a chip, Umrah' },
  { fg: umrahPalette.green500, bg: CHIP_UMRAH, size: 15, where: 'body text on a chip, Umrah' },
  { fg: umrahPalette.link, bg: CHIP_UMRAH, size: 11, bold: true, where: 'a step number, Umrah' },
];

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
  { fg: sand.deep, bg: globalPalette.bg, size: 14, nonText: true, where: 'focus ring on cream' },
  {
    fg: sand.deep,
    bg: globalPalette.surface,
    size: 14,
    nonText: true,
    where: 'focus ring on a card',
  },

  // --- Global on dark ---
  { fg: globalPalette.cream, bg: globalPalette.brown900, size: 15, where: 'text on dark sections' },
  { fg: globalPalette.cream, bg: globalPalette.brown800, size: 15, where: 'the video page' },
  { fg: globalPalette.cream, bg: globalPalette.brown950, size: 14, where: 'footer text' },
  { fg: sand.DEFAULT, bg: globalPalette.brown900, size: 11, bold: true, where: 'eyebrows on dark' },
  {
    fg: sand.DEFAULT,
    bg: globalPalette.brown900,
    size: 14,
    nonText: true,
    where: 'focus ring on a dark section',
  },
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

  // --- The error colour, on every surface a form appears on ---
  { fg: danger.DEFAULT, bg: globalPalette.bg, size: 13, where: 'field errors, Global' },
  { fg: danger.DEFAULT, bg: globalPalette.surface, size: 13, where: 'field errors on a card' },
  { fg: danger.DEFAULT, bg: umrahPalette.bg, size: 13, where: 'field errors, Umrah' },
  { fg: danger.DEFAULT, bg: umrahPalette.surface, size: 13, where: 'field errors on a card' },
  { fg: danger.onDark, bg: globalPalette.brown900, size: 13, where: 'field errors on dark' },
  { fg: danger.onDark, bg: umrahPalette.green900, size: 13, where: 'signup errors on dark' },
  { fg: danger.onDark, bg: umrahPalette.green800, size: 13, where: 'field errors on dark' },

  // --- The translucent creams, resolved against each dark surface ---
  ...onDarkPairs,
  ...onChipPairs,
];

/**
 * Colours that must never carry text on a light surface.
 *
 * `sand` on `bg` is 2.1:1. It is the brand accent and it will be reached for; this list plus
 * the test that walks it is what stops that becoming a shipped page. Fills, borders, rules and
 * icons are all fine — text is not.
 */
export const FILL_ONLY_ON_LIGHT = [sand.DEFAULT, sand.light] as const;
