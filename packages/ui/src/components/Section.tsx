import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';

import { type BlockTag, Container } from './Container';

/**
 * `dark` is a mid dark section — `brown-900` on Global, `green-800` on Umrah.
 * `darkest` is the footer band — `brown-950` / `green-950`.
 */
export type SectionTone = 'page' | 'surface' | 'dark' | 'darkest';

/** Vertical rhythm. The design runs on 100px between sections and 110px before the footer. */
export type SectionSpace = 'lg' | 'md' | 'sm' | 'none';

const TONE: Record<SectionTone, string> = {
  page: '',
  surface: 'bg-surface',
  // The arbitrary property re-points `--c-bg` at this section's own backdrop, so a child
  // asking for the page background gets the dark one rather than the light page underneath.
  dark: 'bg-dark-alt text-dark-on [--c-bg:var(--c-dark-alt)]',
  darkest: 'bg-dark text-dark-on [--c-bg:var(--c-dark)]',
};

const SPACE_TOP: Record<SectionSpace, string> = {
  lg: 'pt-section-lg tab:pt-20 mob:pt-14',
  md: 'pt-section tab:pt-16 mob:pt-12',
  sm: 'pt-16 tab:pt-12 mob:pt-10',
  none: '',
};

const SPACE_BOTTOM: Record<SectionSpace, string> = {
  lg: 'pb-section-lg tab:pb-20 mob:pb-14',
  md: 'pb-section tab:pb-16 mob:pb-12',
  sm: 'pb-16 tab:pb-12 mob:pb-10',
  none: '',
};

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  as?: BlockTag;
  tone?: SectionTone;
  space?: SectionSpace;
  /** Skip the content container — for a full-bleed mosaic, slider or map. */
  bleed?: boolean;
  children?: ReactNode;
}

/**
 * A page section: vertical rhythm, an optional painted backdrop, and the content rail.
 *
 * The two dark tones also set `data-surface="dark"`, and that attribute is the whole reason
 * this component is worth having. It re-points a handful of theme variables — ink, body,
 * muted, the link accent, the border base — so everything inside renders for a dark backdrop
 * without being told. No primitive in this package takes a `tone` prop, exactly as none takes
 * a `theme` prop.
 *
 * Spacing is padding-top only unless the section paints a backdrop. That matches the source:
 * light sections stack with 100px between them, and a section with a colour owns both edges
 * (`background:#33261B; padding:100px 0 110px`). Two stacked light sections that each claimed
 * top and bottom padding would sit 200px apart.
 */
export function Section({
  as: Tag = 'section',
  tone = 'page',
  space = 'md',
  bleed = false,
  className,
  children,
  ...rest
}: SectionProps) {
  const paints = tone !== 'page';
  const isDark = tone === 'dark' || tone === 'darkest';

  return (
    <Tag
      data-surface={isDark ? 'dark' : undefined}
      className={cn(TONE[tone], SPACE_TOP[space], paints && SPACE_BOTTOM[space], className)}
      {...rest}
    >
      {bleed ? children : <Container>{children}</Container>}
    </Tag>
  );
}
