import { DEFAULT_LANG, LANG_NAMES, SITE_LANGS } from '@charva/contracts';
import { cn } from '@charva/ui';

/** Phase 0 shell. Phase 6 replaces it with the six routes. */
export function App() {
  return (
    <main className={cn('charva-shell')}>
      <h1>Charva Umrah</h1>
      <p>Umra ziýaraty. 6-njy tapgyr.</p>
      <p>
        Diller: {SITE_LANGS.umrah.map((lang) => LANG_NAMES[lang]).join(', ')}. Esasy dil{' '}
        {LANG_NAMES[DEFAULT_LANG.umrah]}.
      </p>
    </main>
  );
}
