import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * React-specific rules, scoped to the given globs. Layered on top of `baseConfig`,
 * which it deliberately does not include — the base is applied once at the repo root.
 *
 * jsx-a11y runs at `error`, not `warn`. The design prototypes use `<div onClick>` for every
 * filter, tab, slider dot and table row, and `outline: none` on every input. Phase 8 targets
 * Lighthouse Accessibility >= 95, which is not reachable if those are warnings people scroll past.
 *
 * @param {{ files: string[] }} options
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function reactBlock({ files }) {
  return tseslint.config(
    {
      files,
      languageOptions: {
        globals: { ...globals.browser },
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      settings: { react: { version: 'detect' } },
      plugins: {
        react,
        'react-hooks': reactHooks,
        'jsx-a11y': jsxA11y,
      },
      rules: {
        ...react.configs.flat.recommended.rules,
        ...react.configs.flat['jsx-runtime'].rules,
        ...reactHooks.configs.recommended.rules,
        ...jsxA11y.flatConfigs.strict.rules,
        'react/prop-types': 'off',
        'react/jsx-no-target-blank': ['error', { allowReferrer: false }],
      },
    },
    {
      files: ['**/*.stories.tsx'],
      rules: { 'no-console': 'off' },
    },
  );
}

export default reactBlock;
