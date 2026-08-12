import {
  alphaBase,
  choicePalette,
  danger,
  globalPalette,
  heroScale,
  onDarkAlpha,
  sand,
  umrahPalette,
} from './tokens';

/**
 * The theme layer.
 *
 * Every colour token is emitted as a CSS custom property scoped by `[data-theme]` on the root
 * element, and the Tailwind preset points at those variables rather than at literals. The
 * consequence is the point: a component in `packages/ui` never takes a `theme` prop and never
 * branches on one. `bg-surface` means the Global card colour on Global and the Umrah card
 * colour on Umrah, resolved by the browser.
 *
 * This file is the single source of the CSS. `scripts/emit-css.mjs` writes it to
 * `dist/theme.css` at build time, so the values exist once — here — and not again in a
 * hand-maintained stylesheet that can drift from `tokens.ts`.
 */

type Vars = Record<string, string>;

/** Roles every theme must define, so a missing one is a type error rather than a blank page. */
interface ThemeRoles {
  /** Page background. */
  bg: string;
  /** Card and panel background — the raised surface. */
  surface: string;
  /**
   * The recessed surface: input and textarea backgrounds.
   *
   * On light this is the page colour, because the design puts `#FAF6EF` fields inside a
   * `#FFFDFA` card. On dark it is a faint cream tint, which is a different relationship to the
   * page background, so it cannot just be `--c-bg`.
   */
  field: string;
  /** Headings and primary text on light. */
  ink: string;
  /** Body text on light. */
  body: string;
  /** Meta, captions, secondary labels. */
  muted: string;
  /** Nav items and idle chip text. */
  nav: string;
  /** The accent. Fill and decoration only on light surfaces. */
  accent: string;
  /** Accent hover. */
  accentHover: string;
  /** Links and eyebrows on light. */
  accentText: string;
  /** Active nav item and active tint-chip text. */
  accentActive: string;
  /** Text on an accent fill. */
  onAccent: string;
  /** The darkest brand surface — footer. */
  dark: string;
  /** The mid dark surface — dark sections and the active filter chip. */
  darkAlt: string;
  /** Text on any dark surface. */
  onDark: string;
  /** Invalid fields and failed submissions, on whichever surface the form is on. */
  danger: string;
  /** The same, for a dark surface. Swapped in by `darkSurface` rather than chosen in code. */
  dangerOnDark: string;
  /** rgba base for shadows. Always the dark brand ink, even on a dark surface — see below. */
  inkRgb: string;
  /**
   * rgba base for borders, rules and tint fills.
   *
   * Separate from `inkRgb` for one reason: on a dark surface a border has to become light
   * while a shadow must stay dark. One variable would force a cream-coloured drop shadow,
   * which reads as a glow.
   */
  borderRgb: string;
  /** rgba base for text and borders on dark. */
  creamRgb: string;
  /** rgba base for photo scrims. */
  scrimRgb: string;
  /**
   * Opacity of a hairline on this brand's surfaces.
   *
   * Global draws card borders at .1 and Umrah at .09. It looks like noise and it is in the
   * design; recording it costs one variable and stops a tidying commit from silently changing
   * both sites.
   */
  lineAlpha: string;
  /** Card corner radius. Global and Umrah genuinely differ. */
  cardRadius: string;
  /** The hover shadow. Global spreads it at -26px, Umrah at -28px. Also real. */
  cardShadow: string;
  /** Card hover lift. They differ here too. */
  cardLift: string;
  /** The hero headline: 82px on Global, 72px on Umrah, 64px on Choice. */
  heroSize: string;
  heroLeading: string;
  heroTracking: string;
}

/**
 * The roles a dark surface redefines.
 *
 * A dark section is not a different theme — it is the same brand on a different backdrop — so
 * it overrides a handful of roles rather than the whole set. `<Section tone="dark">` puts
 * `data-surface="dark"` on its element and everything inside picks these up: headings become
 * cream, borders become light, the eyebrow's link colour switches from the muted sand to the
 * bright one. The alternative is a `tone` prop threaded through every primitive, which is the
 * same mistake as a `theme` prop and this file exists to avoid.
 *
 * Every value here points at another variable rather than at a literal, so one block serves
 * all three themes: `--c-on-dark` already means the Global cream on Global and the Umrah cream
 * on Umrah. No theme-scoped duplicate, no specificity ordering to get wrong.
 */
const darkSurface: Vars = {
  // A sensible default for anything asking for "the page background" inside a dark section.
  // The section paints its own backdrop with `bg-dark` or `bg-dark-alt`; this is for children.
  '--c-bg': 'var(--c-dark-alt)',
  // A panel on a dark section is a barely-lifted tint, not a light card.
  '--c-surface': 'rgba(var(--c-cream-rgb), 0.05)',
  '--c-field': 'rgba(var(--c-cream-rgb), 0.06)',
  '--c-ink': 'var(--c-on-dark)',
  '--c-body': `rgba(var(--c-cream-rgb), ${String(onDarkAlpha.body)})`,
  '--c-muted': `rgba(var(--c-cream-rgb), ${String(onDarkAlpha.muted)})`,
  '--c-nav': `rgba(var(--c-cream-rgb), ${String(onDarkAlpha.body)})`,
  // The muted sand is a link colour on light and unreadable on dark; the bright one is both.
  '--c-accent-text': 'var(--c-accent)',
  '--c-accent-active': 'var(--c-accent-hover)',
  '--c-danger': 'var(--c-danger-on-dark)',
  // Borders flip to light. Shadows do not — `--c-ink-rgb` is untouched on purpose.
  '--c-border-rgb': 'var(--c-cream-rgb)',
  // A .09 cream hairline on a dark section is not there at all.
  '--c-line-alpha': '0.14',
};

const globalTheme: ThemeRoles = {
  bg: globalPalette.bg,
  surface: globalPalette.surface,
  field: globalPalette.bg,
  ink: globalPalette.brown900,
  body: globalPalette.brown500,
  muted: globalPalette.brown400,
  nav: globalPalette.brown700,
  accent: sand.DEFAULT,
  accentHover: sand.light,
  accentText: sand.dark,
  accentActive: sand.deep,
  onAccent: sand.contrast,
  dark: globalPalette.brown950,
  darkAlt: globalPalette.brown900,
  onDark: globalPalette.cream,
  danger: danger.DEFAULT,
  dangerOnDark: danger.onDark,
  inkRgb: alphaBase.globalInk,
  borderRgb: alphaBase.globalInk,
  creamRgb: alphaBase.globalCream,
  scrimRgb: alphaBase.globalScrim,
  lineAlpha: '0.1',
  cardRadius: '22px',
  cardShadow: '0 26px 50px -26px rgba(var(--c-ink-rgb), 0.34)',
  cardLift: '-6px',
  heroSize: heroScale.global.size,
  heroLeading: heroScale.global.leading,
  heroTracking: heroScale.global.tracking,
};

const umrahTheme: ThemeRoles = {
  bg: umrahPalette.bg,
  surface: umrahPalette.surface,
  field: umrahPalette.bg,
  ink: umrahPalette.ink,
  body: umrahPalette.green500,
  muted: umrahPalette.green400,
  nav: umrahPalette.green700,
  accent: sand.DEFAULT,
  accentHover: sand.light,
  accentText: umrahPalette.link,
  accentActive: sand.deep,
  onAccent: sand.contrast,
  dark: umrahPalette.green950,
  darkAlt: umrahPalette.green800,
  onDark: umrahPalette.cream,
  danger: danger.DEFAULT,
  dangerOnDark: danger.onDark,
  inkRgb: alphaBase.umrahInk,
  borderRgb: alphaBase.umrahInk,
  creamRgb: alphaBase.umrahCream,
  scrimRgb: alphaBase.umrahScrim,
  lineAlpha: '0.09',
  cardRadius: '24px',
  cardShadow: '0 26px 50px -28px rgba(var(--c-ink-rgb), 0.34)',
  cardLift: '-5px',
  heroSize: heroScale.umrah.size,
  heroLeading: heroScale.umrah.leading,
  heroTracking: heroScale.umrah.tracking,
};

/**
 * Choice is a single dark screen with no light surfaces at all. The light roles are mapped to
 * their nearest sensible dark equivalents rather than left undefined, so a shared component
 * dropped onto the page still renders legibly instead of white-on-white.
 */
const choiceTheme: ThemeRoles = {
  bg: choicePalette.bg,
  surface: choicePalette.bg,
  field: `rgba(${alphaBase.globalCream}, 0.07)`,
  ink: choicePalette.cream,
  body: choicePalette.cream,
  muted: choicePalette.creamWarm,
  nav: choicePalette.cream,
  accent: sand.DEFAULT,
  accentHover: sand.light,
  accentText: sand.DEFAULT,
  accentActive: sand.light,
  onAccent: choicePalette.btnText,
  dark: choicePalette.bg,
  darkAlt: choicePalette.bg,
  onDark: choicePalette.cream,
  // Choice is dark everywhere, so its only error colour is the light one.
  danger: danger.onDark,
  dangerOnDark: danger.onDark,
  inkRgb: alphaBase.choiceGlass,
  // Choice has no light surfaces, so its borders are light from the start.
  borderRgb: alphaBase.white,
  creamRgb: alphaBase.globalCream,
  scrimRgb: alphaBase.choiceGlass,
  // Choice draws on near-black, where a .1 hairline is invisible.
  lineAlpha: '0.16',
  cardRadius: '22px',
  cardShadow: '0 18px 50px -24px rgba(0, 0, 0, 0.7)',
  cardLift: '-5px',
  heroSize: heroScale.choice.size,
  heroLeading: heroScale.choice.leading,
  heroTracking: heroScale.choice.tracking,
};

/** camelCase role -> `--c-kebab-case` custom property. */
function toVars(roles: ThemeRoles): Vars {
  const out: Vars = {};
  // Object.entries widens to `[string, any]`; every ThemeRoles value is a string by definition.
  for (const [key, value] of Object.entries(roles) as [string, string][]) {
    out[`--c-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = value;
  }
  return out;
}

export const themes = {
  global: toVars(globalTheme),
  umrah: toVars(umrahTheme),
  choice: toVars(choiceTheme),
} as const;

export type ThemeName = keyof typeof themes;

/** Exported for `theme.test.ts`, which checks every override points at a role that exists. */
export { darkSurface };

function block(selector: string, vars: Vars): string {
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/** The full theme stylesheet. Written to `dist/theme.css` by `scripts/emit-css.mjs`. */
export function buildThemeCss(): string {
  const header = [
    '/*',
    ' * Generated from packages/ui/src/theme.ts — do not edit by hand.',
    ' * Regenerate with: pnpm --filter @charva/ui build',
    ' */',
    '',
  ].join('\n');

  // Global is also the default, so a page that forgets the attribute still renders.
  const blocks = [
    block(':root, [data-theme="global"]', themes.global),
    block('[data-theme="umrah"]', themes.umrah),
    block('[data-theme="choice"]', themes.choice),
    block('[data-surface="dark"]', darkSurface),
  ];

  return `${header}${blocks.join('\n\n')}\n`;
}
