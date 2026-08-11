import { SITES } from '@charva/contracts';
import { cn } from '@charva/ui';

/** Phase 0 shell. Phase 7 replaces it with authentication and the CRUD sections. */
export function App() {
  return (
    <main className={cn('charva-shell')}>
      <h1>Charva — админ-панель</h1>
      <p>Управление сайтами. Фаза 7.</p>
      <p>Сайты: {SITES.join(', ')}.</p>
    </main>
  );
}
