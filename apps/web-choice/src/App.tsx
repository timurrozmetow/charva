import { DEFAULT_LANG, LANG_NAMES, SITE_LANGS } from '@charva/contracts';
import { cn } from '@charva/ui';

/**
 * Phase 0 shell. Phase 4 replaces it with the split screen.
 *
 * It reads the shared constants on purpose: rendering them proves the workspace wiring —
 * package resolution, cross-package types and the build — rather than asserting it in a README.
 */
export function App() {
  return (
    <main className={cn('charva-shell')}>
      <h1>Charva Travel</h1>
      <p>Страница выбора направления. Фаза 4.</p>
      <p>
        Языки: {SITE_LANGS.choice.map((lang) => LANG_NAMES[lang]).join(', ')}. По умолчанию{' '}
        {LANG_NAMES[DEFAULT_LANG.choice]}.
      </p>
    </main>
  );
}
