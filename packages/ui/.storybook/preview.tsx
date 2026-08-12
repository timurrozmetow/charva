import { type Decorator, type Preview } from '@storybook/react';
import { useEffect } from 'react';

import '../dist/theme.css';
import '../src/styles.css';

/**
 * The theme is set on `<html>`, exactly as an application sets it, rather than on a wrapper
 * inside the story. That is the whole point of the ambient-theming decision: if a component
 * needed a wrapper here it would need one on the page too.
 */
// Capitalised because it is a component in all but name, and the hooks rule keys off that.
const WithTheme: Decorator = (Story, context) => {
  const theme = String(context.globals['theme'] ?? 'global');
  const surface = String(context.globals['surface'] ?? 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div
      // The surface toggle is not decoration: half of this package's behaviour is that a
      // component renders differently inside a dark section without being told, and that
      // cannot be reviewed unless a dark section is one click away.
      {...(surface === 'dark' ? { 'data-surface': 'dark' } : {})}
      className={
        surface === 'dark'
          ? 'min-h-[240px] bg-dark-alt p-10 text-dark-on [--c-bg:var(--c-dark-alt)]'
          : 'min-h-[240px] bg-bg p-10'
      }
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Brand',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'global', title: 'Charva Travel Global' },
          { value: 'umrah', title: 'Charva Umrah' },
          { value: 'choice', title: 'Choice' },
        ],
        dynamicTitle: true,
      },
    },
    surface: {
      description: 'Section backdrop',
      toolbar: {
        title: 'Surface',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light section' },
          { value: 'dark', title: 'Dark section' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'global', surface: 'light' },
  decorators: [WithTheme],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    a11y: {
      // Report rather than fail the story: the axe gate for the whole site is phase 8, run
      // against real pages. Here it is a signal while a component is being written.
      test: 'todo',
    },
  },
};

export default preview;
