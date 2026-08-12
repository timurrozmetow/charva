import { z } from 'zod';

import { siteSettingsSchema } from './common';
import { umrahTripSchema } from './umrah';

/**
 * The brand chooser at `charva-travel.com`.
 *
 * Almost everything on that page is copy that lives in the repository as translation files, not
 * content anybody edits — decision D-23. Exactly one thing on it is data: the Umrah departure
 * behind the pulsing badge and its countdown.
 *
 * That single field is also why `CountdownTimer` lives in `packages/ui` rather than in
 * `web-umrah`. The prototypes compute the same number twice, with `Math.ceil` here and
 * `Math.floor` on the Umrah homepage, so the chooser and the site it links to disagree about
 * how many days are left — one of the defects this phase exists to make impossible.
 */
export const choiceResponse = z.object({
  umrah: z.object({
    trip: umrahTripSchema.nullable(),
  }),
  /** The footer line, which both halves share. */
  contacts: z.object({
    global: siteSettingsSchema.shape.contacts,
    umrah: siteSettingsSchema.shape.contacts,
  }),
});
