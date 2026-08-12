import { type Config } from 'tailwindcss';

import { charvaPreset } from './src/tailwind-preset';

/**
 * Tailwind for the component gallery.
 *
 * Scans this package's own source, which is what makes a story render with the same classes
 * the apps will generate. The apps have their own configs pointing at their own `src`.
 */
export default {
  presets: [charvaPreset],
  content: ['./src/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}'],
} satisfies Config;
