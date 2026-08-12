import { type Config } from 'tailwindcss';

import {
  breakpoint,
  duration,
  easing,
  fontFamily,
  fontWeight,
  layout,
  minTapTarget,
  mosaic,
  radius,
  type,
} from './tokens';

/**
 * The Tailwind preset every Charva app extends.
 *
 * Colours resolve to `var(--c-*)`, defined per theme in `theme.css`. That is what makes
 * `bg-surface` mean the Global card colour on Global and the Umrah card colour on Umrah with
 * no component ever knowing which site it is on.
 *
 * Breakpoints are max-width, not min-width. The design is desktop-only at 1280 and up and
 * everything below it is ours, so writing desktop first and narrowing matches both the source
 * material and how README §10 describes the behaviour.
 */

const px = (value: number): string => `${String(value)}px`;

/** `--c-x` used as a colour, with Tailwind's opacity modifier still working. */
const themed = (name: string) => `var(--c-${name})`;

const [heroGlobal, heroUmrah, heroChoice] = [type.heroGlobal, type.heroUmrah, type.heroChoice];

type FontSizeValue = [string, { lineHeight: string; letterSpacing: string }];

/** Turns the `[size, lineHeight, tracking]` tuples in tokens.ts into Tailwind's shape. */
function buildFontSizes(): Record<string, FontSizeValue> {
  const sizes: Record<string, FontSizeValue> = {};
  for (const [name, [size, lineHeight, letterSpacing]] of Object.entries(type)) {
    sizes[name] = [px(size), { lineHeight: String(lineHeight), letterSpacing }];
  }
  return sizes;
}

export const charvaPreset = {
  content: [],
  theme: {
    screens: {
      lap: { max: px(breakpoint.lap) },
      tab: { max: px(breakpoint.tab) },
      mob: { max: px(breakpoint.mob) },
    },

    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#FFFFFF',
      black: '#000000',

      // Theme roles. The same class means different pixels on different sites.
      bg: themed('bg'),
      surface: themed('surface'),
      /** Inputs and textareas: the page colour on light, a faint cream tint on dark. */
      field: themed('field'),
      ink: themed('ink'),
      body: themed('body'),
      muted: themed('muted'),
      nav: themed('nav'),
      accent: {
        DEFAULT: themed('accent'),
        hover: themed('accent-hover'),
        text: themed('accent-text'),
        active: themed('accent-active'),
        on: themed('on-accent'),
      },
      dark: {
        DEFAULT: themed('dark'),
        alt: themed('dark-alt'),
        on: themed('on-dark'),
      },

      /**
       * Hairlines, rules and tint fills.
       *
       * The prototypes write these as forty rgba literals at seven opacities over two bases.
       * Naming the seven and deriving the base from `--c-border-rgb` means a dark section
       * flips every border in it to light without a single component knowing.
       */
      line: {
        DEFAULT: 'rgba(var(--c-border-rgb), 0.1)',
        soft: 'rgba(var(--c-border-rgb), 0.06)',
        rule: 'rgba(var(--c-border-rgb), 0.12)',
        field: 'rgba(var(--c-border-rgb), 0.14)',
        chip: 'rgba(var(--c-border-rgb), 0.18)',
        strong: 'rgba(var(--c-border-rgb), 0.22)',
        /** The box of a checkbox or radio, which has to read as a control at 17px. */
        control: 'rgba(var(--c-border-rgb), 0.28)',
      },

      /** The one colour the handoff does not contain — see `danger` in tokens.ts. */
      danger: themed('danger'),

      /** The accent as a tint: the selected topic chip and the passed step of the builder. */
      tint: {
        DEFAULT: 'rgba(223, 160, 89, 0.2)',
        soft: 'rgba(223, 160, 89, 0.1)',
        strong: 'rgba(223, 160, 89, 0.16)',
      },
    },

    fontFamily: {
      sans: [fontFamily.sans],
    },

    fontWeight: {
      light: String(fontWeight.light),
      normal: String(fontWeight.regular),
      medium: String(fontWeight.medium),
      semibold: String(fontWeight.semibold),
      bold: String(fontWeight.bold),
      black: String(fontWeight.black),
    },

    fontSize: {
      ...buildFontSizes(),
      /**
       * The hero headline reads its size from the theme, because 82 / 72 / 64 is the one place
       * the three sites genuinely disagree and it is the largest element on each homepage.
       */
      hero: [
        'var(--c-hero-size)',
        { lineHeight: 'var(--c-hero-leading)', letterSpacing: 'var(--c-hero-tracking)' },
      ],
    },

    borderRadius: {
      none: '0',
      xs: px(radius.xs),
      sm: px(radius.sm),
      media: px(radius.media),
      /** The card radius follows the theme: 22px on Global, 24px on Umrah. */
      card: themed('card-radius'),
      panel: px(radius.panel),
      'panel-sm': px(radius.panelSm),
      block: px(radius.block),
      input: px(radius.input),
      full: px(radius.pill),
    },

    extend: {
      /** Overriding `colors` wholesale leaves Tailwind's default border grey unresolvable. */
      borderColor: {
        DEFAULT: 'rgba(var(--c-border-rgb), 0.1)',
      },

      spacing: {
        gutter: px(layout.containerPadding),
        section: px(layout.sectionGap),
        'section-lg': px(layout.footerGap),
        tap: px(minTapTarget),
      },

      maxWidth: {
        container: px(layout.containerMax),
        island: px(layout.navIslandMax),
        'island-choice': px(layout.choiceNavMax),
      },

      gridTemplateColumns: {
        mosaic: `repeat(${String(mosaic.columns)}, minmax(0, 1fr))`,
        /** The tour builder: step rail, panel, sticky estimate. */
        builder: '250px 1fr 320px',
        /** A program day: number, title, description, city. */
        'program-day': '110px 300px 1fr auto',
        /** A facts table row. */
        fact: '190px 1fr',
        /** An Umrah conditions row. */
        spec: '1fr 1.6fr',
        /** A horizontal article card. */
        'article-row': '200px 1fr',
      },

      gridAutoRows: {
        mosaic: px(mosaic.rowHeight),
      },

      transitionTimingFunction: easing,

      transitionDuration: Object.fromEntries(
        Object.entries(duration).map(([name, value]) => [name, `${String(value)}ms`]),
      ),

      boxShadow: {
        /** The sticky nav island. */
        island: '0 16px 44px -22px rgba(var(--c-ink-rgb), 0.3)',
        /** The language dropdown. */
        drop: '0 26px 56px -22px rgba(var(--c-ink-rgb), 0.4)',
        /** A card at rest is flat; this is the hover state. */
        card: '0 26px 50px -26px rgba(var(--c-ink-rgb), 0.34)',
        /** Softer, used on article cards. */
        'card-soft': '0 22px 44px -24px rgba(var(--c-ink-rgb), 0.3)',
        /** The sand CTA in the navbar. */
        cta: '0 8px 20px -10px rgba(176, 118, 43, 0.7)',
      },

      translate: {
        /** Card hover lift, from the theme: -6px on Global, -5px on Umrah. */
        lift: themed('card-lift'),
      },

      keyframes: {
        /** The language dropdown. Consolidates the prototypes' `navdrop` and `cdrop`. */
        dropIn: {
          from: { opacity: '0', transform: 'translateY(-8px) scale(.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        /** The live badge dot. Consolidates `upulse` and `cpulse`. */
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.35' },
        },
        /** The Choice halves on load. The prototypes' `cfade`. */
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },

      animation: {
        'drop-in': `dropIn ${String(duration.drop)}ms ${easing.drop} both`,
        pulse: 'pulse 2s ease-in-out infinite',
        'fade-up': '"fadeUp" 900ms ease both',
      },

      backdropBlur: {
        island: '26px',
        drop: '22px',
        glass: '20px',
        soft: '14px',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default charvaPreset;

/** Re-exported so an app can reference a breakpoint in JS without importing tokens directly. */
export { breakpoint, heroChoice, heroGlobal, heroUmrah };
