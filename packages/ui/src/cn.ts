import clsx, { type ClassValue } from 'clsx';

/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately not `tailwind-merge`: this project has no runtime class conflicts to resolve,
 * because theming happens through CSS custom properties scoped by `data-theme` rather than by
 * swapping Tailwind colour classes at runtime (see CLAUDE.md, "Тема — окружение, а не проп").
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
