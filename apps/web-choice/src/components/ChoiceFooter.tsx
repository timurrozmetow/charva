import { type Lang } from '@charva/contracts';

import { COPY, fill } from '../i18n';

export interface ChoiceFooterProps {
  lang: Lang;
  /** From `settings.global.legal`. Still the prototype's `TM-1428` — question Q-12. */
  license: string | null;
}

/**
 * The bottom line: licence on the left, a hint on the right.
 *
 * The element is in the prototype's markup and completely empty, with the content described
 * only in the README — the same signature the missing numerals had, and restored for the same
 * reason (D-1). The numerals themselves are gone at the owner's request (D-128); this line
 * stays, because it carries the licence number rather than a decoration.
 *
 * Like the nav, it takes no pointer events. It spans both halves, and a strip that swallowed
 * the cursor would collapse whichever half it crossed.
 */
export function ChoiceFooter({ lang, license }: ChoiceFooterProps) {
  const copy = COPY[lang].footer;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 px-[46px] pb-[22px] text-[11px] font-bold uppercase tracking-[.16em] text-cream-faint tab:px-6 mob:px-4 mob:text-[10px]">
      {/* Rendered only when there is a licence number to render — never an empty «Лицензия». */}
      <span>{license === null ? '' : fill(copy.license, { license })}</span>
      <span className="mob:hidden">{copy.hint}</span>
    </div>
  );
}
