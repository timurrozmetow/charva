import { DEFAULT_LANG, LANG_NAMES, SITE_LANGS } from '@charva/contracts';
import { cn } from '@charva/ui';

/** Phase 0 shell. Phase 5 replaces it with the nine routes and their detail pages. */
export function App() {
  return (
    <main className={cn('charva-shell')}>
      <h1>Charva Travel Global</h1>
      <p>Туризм по Туркменистану. Фаза 5.</p>
      <p>
        Языки: {SITE_LANGS.global.map((lang) => LANG_NAMES[lang]).join(', ')}. По умолчанию{' '}
        {LANG_NAMES[DEFAULT_LANG.global]}.
      </p>
    </main>
  );
}
