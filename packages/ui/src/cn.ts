import clsx, { type ClassValue } from 'clsx';

/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately not `tailwind-merge`: theming happens through CSS custom properties scoped by
 * `data-theme` rather than by swapping Tailwind colour classes at runtime (see CLAUDE.md,
 * «Тема — окружение, а не проп»), so there are no colour conflicts to resolve.
 *
 * **What that means at every call site.** Passing a utility that conflicts with one the
 * component already sets does not override it — both end up in the attribute, and the winner is
 * whichever Tailwind emitted later in the stylesheet, not whichever was passed last. The hero
 * lost a whole phase to this: `<Carousel className="absolute inset-0">` produced
 * `class="relative absolute inset-0"`, Tailwind orders `relative` after `absolute`, and the
 * slider silently became an in-flow element of zero height — the photographs collapsed to a
 * strip and the white hero text ended up on the cream page background.
 *
 * So: to position a component, wrap it. Do not pass positioning through `className`.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
