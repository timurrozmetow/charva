import { Deferred, Skeleton } from '@charva/ui';
import { lazy, Suspense } from 'react';

import { type LeadFormProps } from './LeadForm';

/*
 * The lead form, fetched when the reader is on their way to it rather than on arrival.
 *
 * Weighed from the built chunk: 99 KB before compression, of which Zod is 53 and react-hook-form
 * 33 — against 5 KB of actual form. It sits at the bottom of the homepage, the tour page and the
 * hotel page, and every visitor downloaded all of it while looking at the photograph at the top,
 * over the same connection that photograph was using. Measured on a throttled phone it was the
 * largest of the eleven chunks the homepage pulled and by itself two thirds of their weight.
 *
 * `/contact` and the builder's last step import `LeadForm` directly and should keep doing so:
 * there the form is the reason the page was opened, and deferring it would trade nothing for a
 * delay exactly where it is least welcome.
 *
 * The import is dynamic *here* rather than at the call sites so the three pages that defer it
 * read the same as the two that do not — and so the chunk boundary is one module, not three.
 */
const LeadForm = lazy(async () => {
  const module = await import('./LeadForm');
  return { default: module.LeadForm };
});

/*
 * The placeholder holds the form's own height, measured in a browser at the three widths where
 * the layout changes: 639px from 1024 up, 605 in the tablet band where the panel becomes one
 * column, and 910 below 768 where the fields stack. A placeholder shorter than what replaces it
 * pulls the footer up and drops it back down — deferral bought with layout shift is not a
 * saving, and the site's CLS is currently 0.0003.
 */
function FormSpace() {
  return <Skeleton className="h-[639px] w-full rounded-card tab:h-[605px] mob:h-[910px]" />;
}

export function DeferredLeadForm(props: LeadFormProps) {
  return (
    <Deferred fallback={<FormSpace />}>
      {/*
        Two fallbacks and they are not redundant: `Deferred` decides *whether* to start, and
        `Suspense` covers the moment between starting and arriving. Both draw the same box, so
        the reader sees one placeholder that does not change shape.
      */}
      <Suspense fallback={<FormSpace />}>
        <LeadForm {...props} />
      </Suspense>
    </Deferred>
  );
}
