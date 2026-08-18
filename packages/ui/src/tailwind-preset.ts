import { type Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

import {
  breakpoint,
  choiceScrimGradient,
  heroScrimGradient,
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
      /** The sticky navigation island, behind its backdrop blur. */
      island: themed('island-bg'),
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
        /** The card hairline: .1 on Global, .09 on Umrah, .14 on any dark surface. */
        DEFAULT: 'rgba(var(--c-border-rgb), var(--c-line-alpha))',
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

      /**
       * Photo scrims and the pills that sit on them.
       *
       * Written as an arbitrary value — `bg-[rgba(var(--c-scrim-rgb),0.72)]` — Tailwind cannot
       * infer the type through the `var()` and silently emits nothing. Named here, it works.
       */
      scrim: {
        DEFAULT: 'rgba(var(--c-scrim-rgb), 0.72)',
        soft: 'rgba(var(--c-scrim-rgb), 0.45)',
        strong: 'rgba(var(--c-scrim-rgb), 0.9)',
      },

      /**
       * Cream text and cream fills on a dark surface, at the opacities the design uses.
       *
       * `--c-cream-rgb` is the base, so these follow the theme rather than pinning
       * `253, 249, 243` into a component — Umrah's cream is a different value, and the day a
       * shared component uses one of these on an Umrah dark section it must come out right.
       * The handoff writes this base at ten opacities across the twenty prototypes; naming them
       * is the same trade the `line` scale makes above.
       */
      cream: {
        DEFAULT: 'rgb(var(--c-cream-rgb))',
        /** Body copy on dark — the lead paragraph of each chooser half. */
        body: 'rgba(var(--c-cream-rgb), 0.72)',
        /** Slightly brighter: chip labels, which are short and small. */
        soft: 'rgba(var(--c-cream-rgb), 0.8)',
        muted: 'rgba(var(--c-cream-rgb), 0.55)',
        /** Stat captions and the bottom line of the chooser. */
        faint: 'rgba(var(--c-cream-rgb), 0.45)',
        /** The oversized «01» / «02» behind each half: present, and barely. */
        ghost: 'rgba(var(--c-cream-rgb), 0.05)',
        /** Glass fills — a chip on a photograph, the outline button. */
        fill: 'rgba(var(--c-cream-rgb), 0.06)',
        'fill-strong': 'rgba(var(--c-cream-rgb), 0.07)',
        /** The frame the hero search bar shows through its one-pixel gaps. */
        frame: 'rgba(var(--c-cream-rgb), 0.16)',
      },

      /** The accent as a tint: the selected topic chip and the passed step of the builder. */
      tint: {
        DEFAULT: 'rgba(223, 160, 89, 0.2)',
        soft: 'rgba(223, 160, 89, 0.1)',
        strong: 'rgba(223, 160, 89, 0.16)',
        /**
         * The border of a status badge. Written out rather than `accent/45`, because the
         * opacity modifier needs a colour Tailwind can take apart and `var(--c-accent)` is
         * opaque to it — it would emit the solid accent and say nothing.
         */
        line: 'rgba(223, 160, 89, 0.45)',
        /** A heavier sand border: the outline call to action on the Umrah half. */
        edge: 'rgba(223, 160, 89, 0.6)',
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
        DEFAULT: 'rgba(var(--c-border-rgb), var(--c-line-alpha))',
      },

      /**
       * The two gradients over the chooser's halves.
       *
       * Built from `choiceScrimGradient` so the four stops and the two bases live in `tokens.ts`
       * with everything else, rather than as a hundred-character literal inside a `className`
       * where nothing can find it and no test can check it.
       */
      backgroundImage: {
        'scrim-choice-global': choiceScrimGradient('global'),
        'scrim-choice-umrah': choiceScrimGradient('umrah'),
        /** The homepage hero. Reads `--c-scrim-rgb`, so one class serves both sites. */
        'scrim-hero': heroScrimGradient(),
        /**
         * Umrah's hero runs at 105° rather than vertically.
         *
         * The one genuine difference between the two overlays, and the reason the helper takes
         * a direction: the stops and the base stay shared, so a change to either moves both.
         */
        'scrim-hero-diagonal': heroScrimGradient('105deg'),
      },

      spacing: {
        gutter: px(layout.containerPadding),
        section: px(layout.sectionGap),
        'section-lg': px(layout.footerGap),
        tap: px(minTapTarget),
        /*
         * The step Tailwind's own scale skips.
         *
         * It goes 12 (48px) → 14 (56px), and the panels in this design are padded 52. Ten call
         * sites had already been written as `p-13` and `mt-13`, every one of them producing no
         * rule at all — the enquiry panel on both homepages had no padding whatsoever, and its
         * heading was clipped by the panel's own rounded corner. Adding the step is what those
         * ten call sites always meant.
         */
        13: px(52),
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
        /**
         * A card at rest is flat; this is the hover state. From the theme, because Global
         * spreads it at -26px and Umrah at -28px — two pixels that are in the design and would
         * not survive a cleanup commit written against one site.
         */
        card: 'var(--c-card-shadow)',
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
  plugins: [
    /**
     * `hover:` compiles to `@media (hover: hover) { &:hover }`.
     *
     * On a touch browser a plain `:hover` is applied on tap and stays applied until something
     * else is tapped: a card stays lifted, a chip stays filled, and on the chooser one half of
     * the screen stays expanded after the finger has left it, with no gesture that undoes it.
     * Tailwind made this the default in v4 and offers `future.hoverOnlyWhenSupported` in v3 —
     * but that flag is read from the root config only and is silently dropped when it comes
     * from a preset, which is exactly the kind of quiet no-op D-32 exists to catch. Overriding
     * the variant works from here, because plugins *are* merged out of presets.
     */
    plugin((api) => {
      api.addVariant('hover', '@media (hover: hover) { &:hover }');
    }),
  ],
} satisfies Config;

export default charvaPreset;

/** Re-exported so an app can reference a breakpoint in JS without importing tokens directly. */
export { breakpoint, heroChoice, heroGlobal, heroUmrah };
