import charvaPreset from '@charva/ui/tailwind-preset';
import { type Config } from 'tailwindcss';

export default {
  presets: [charvaPreset],
  // packages/ui is scanned too: its components carry the classes this app renders.
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
