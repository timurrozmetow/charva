/**
 * PostCSS for Storybook only.
 *
 * The four applications each run Tailwind over `@charva/ui/styles.css` with their own config;
 * this one exists so the component gallery can do the same without an app around it.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
