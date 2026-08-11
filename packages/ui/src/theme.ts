import { alphaBase, choicePalette, globalPalette, sand, umrahPalette } from './tokens';

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
  /** Card and panel background. */
  surface: string;
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
  /** rgba base for borders and fills on light. */
  inkRgb: string;
  /** rgba base for text and borders on dark. */
  creamRgb: string;
  /** rgba base for photo scrims. */
  scrimRgb: string;
  /** Card corner radius. Global and Umrah genuinely differ. */
  cardRadius: string;
  /** Card hover lift. They differ here too. */
  cardLift: string;
}

const globalTheme: ThemeRoles = {
  bg: globalPalette.bg,
  surface: globalPalette.surface,
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
  inkRgb: alphaBase.globalInk,
  creamRgb: alphaBase.globalCream,
  scrimRgb: alphaBase.globalScrim,
  cardRadius: '22px',
  cardLift: '-6px',
};

const umrahTheme: ThemeRoles = {
  bg: umrahPalette.bg,
  surface: umrahPalette.surface,
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
  inkRgb: alphaBase.umrahInk,
  creamRgb: alphaBase.umrahCream,
  scrimRgb: alphaBase.umrahScrim,
  cardRadius: '24px',
  cardLift: '-5px',
};

/**
 * Choice is a single dark screen with no light surfaces at all. The light roles are mapped to
 * their nearest sensible dark equivalents rather than left undefined, so a shared component
 * dropped onto the page still renders legibly instead of white-on-white.
 */
const choiceTheme: ThemeRoles = {
  bg: choicePalette.bg,
  surface: choicePalette.bg,
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
  inkRgb: alphaBase.choiceGlass,
  creamRgb: alphaBase.globalCream,
  scrimRgb: alphaBase.choiceGlass,
  cardRadius: '22px',
  cardLift: '-5px',
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
  ];

  return `${header}${blocks.join('\n\n')}\n`;
}
