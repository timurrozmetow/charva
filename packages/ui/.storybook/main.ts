import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Storybook is the review surface for phase 1.
 *
 * It carries its own Vite config rather than borrowing an app's, because the point is to see
 * these components with nothing else around them: no router, no data, no page. The theme is
 * switched from the toolbar, so every component can be checked on Global, Umrah and Choice
 * without three copies of every story.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), react()],
    // The package's own PostCSS, so the Tailwind preset under test is the one that renders.
    css: { postcss: join(here, '..') },
  }),
};

export default config;
