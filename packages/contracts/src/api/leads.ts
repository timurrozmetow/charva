import { z } from 'zod';

import { builderSelectionSchema } from './builder';

/**
 * The two forms, and the five layers standing behind them.
 *
 * Neither form exists in the handoff: the submit buttons are `<a href="#">` and the consent
 * checkbox is a styled `<span>`. All of this is designed rather than transcribed.
 *
 * No third-party captcha — decision D-19. A form that receives single-digit genuine traffic a
 * day does not warrant a dependency on Cloudflare, whose reachability from Turkmenistan nobody
 * has checked and whose consent surface would have to be explained on both sites. Instead, five
 * stateless layers, of which only one is visible to anyone:
 *
 *   1. rate limit, five submissions per address per ten minutes
 *   2. honeypot — a field a person cannot see and a bot fills in
 *   3. HMAC time trap — the signed moment the form was rendered
 *   4. duplicate suppression, fifteen minutes on `hash(endpoint + phone)`
 *   5. phone validation, which also stops a lead nobody can ring back
 */

/**
 * The honeypot field.
 *
 * Named `website` because that is what a form-filling bot expects to find and eagerly fills;
 * it is hidden from people and from screen readers, so an empty value is the only value a
 * genuine submission ever has. When it arrives filled, the API answers 204 and writes nothing —
 * never an error, because an error message is a lesson.
 */
export const HONEYPOT_FIELD = 'website';

/**
 * The five interest chips the contact form offers, as codes.
 *
 * The handoff stores them as the Russian labels themselves — `TOPICS = ['Готовый тур', …]` —
 * which means a lead recorded today cannot be read once the page is translated, and a chip
 * cannot be renamed without rewriting history. Decision D-10, the same rule the builder's
 * option codes follow.
 *
 * The schema below stays a permissive `string`: the inbox has to keep whatever a lead was
 * filed under, including codes retired since. This list is what the site *offers*.
 */
export const LEAD_TOPICS = [
  'ready_tour',
  'custom_route',
  'hotel_only',
  'visa',
  'transfer',
] as const;

export type LeadTopic = (typeof LEAD_TOPICS)[number];

const honeypot = z.string().max(200).optional();

/** The signed timestamp from `GET /forms/token`. Anti-spam layer three. */
const formToken = z.string().min(8).max(200);

const phone = z.string().min(4).max(32);

export const formTokenResponse = z.object({
  token: z.string(),
  /** So a form can quietly refresh itself before it expires rather than lose what was typed. */
  expiresInSeconds: z.number().int(),
});

// ----------------------------------------------------------------------------------------
// Global — the contact page and the builder's final step
// ----------------------------------------------------------------------------------------

export const leadRequest = z
  .object({
    /** The two tabs on `/contact`, plus the builder's ninth step. */
    kind: z.enum(['tour', 'question', 'builder']).default('question'),
    name: z.string().min(2).max(120),
    phone,
    email: z.string().email().max(190).optional(),
    guests: z.number().int().min(1).max(60).optional(),
    /** Interest codes, never the translated labels the chips display — D-10. */
    topics: z.array(z.string().max(40)).max(12).optional(),
    message: z.string().max(4000).optional(),
    /**
     * The builder selection, by option code.
     *
     * The price is deliberately absent. The server recalculates it from the database and stores
     * that in `quote_snapshot`; a total that arrived from a browser is a total the sender chose.
     */
    selection: builderSelectionSchema.optional(),
    /**
     * Must be `true`, and the moment it arrives is stored.
     *
     * The handoff draws this control on the contact form as a styled `<span>` — it cannot be
     * checked, and nothing would have recorded it if it could. A name and a telephone number
     * given so somebody can ring back is personal data, and a retention period is counted from
     * a date, so the date has to exist. Same reasoning as the Umrah form below.
     */
    consent: z.literal(true),
    formToken,
    [HONEYPOT_FIELD]: honeypot,
  })
  .strict();

export type LeadRequest = z.infer<typeof leadRequest>;

export const leadResponse = z.object({
  leadId: z.number().int(),
  /**
   * True when this collapsed into a submission made in the last fifteen minutes.
   *
   * The client shows the same confirmation either way — a double-tapped button is not an error
   * and does not deserve to look like one. It is here so the form can avoid re-running whatever
   * analytics it fires on a genuinely new lead.
   */
  isDuplicate: z.boolean(),
});

// ----------------------------------------------------------------------------------------
// Umrah — the signup form
// ----------------------------------------------------------------------------------------

export const ROOM_TYPES = ['single', 'double', 'triple', 'quad'] as const;

export const umrahSignupRequest = z
  .object({
    fullName: z.string().min(2).max(160),
    phone,
    /**
     * Encrypted before it reaches the column — AES-256-GCM, decision D-18.
     *
     * Optional here because the manager can take it by phone, and asking for a passport number
     * in a web form before anyone has spoken to the pilgrim is a decision the owner has not
     * made. The retention period and the wording of the consent are question Q-13.
     */
    passportNumber: z.string().min(4).max(40).optional(),
    peopleCount: z.number().int().min(1).max(20).default(1),
    /** A code, so the chip label can be translated without changing what was booked. */
    roomType: z.enum(ROOM_TYPES).optional(),
    comment: z.string().max(2000).optional(),
    /**
     * Must be `true`, and the moment it arrives is stored.
     *
     * A retention policy is counted from a date, so the date has to exist. In the prototype the
     * consent control is a styled `<span>` that cannot be checked at all.
     */
    consent: z.literal(true),
    formToken,
    [HONEYPOT_FIELD]: honeypot,
  })
  .strict();

export type UmrahSignupRequest = z.infer<typeof umrahSignupRequest>;

export const umrahSignupResponse = z.object({
  signupId: z.number().int(),
  isDuplicate: z.boolean(),
});

export type FormTokenResponse = z.infer<typeof formTokenResponse>;
export type LeadResponse = z.infer<typeof leadResponse>;
export type UmrahSignupResponse = z.infer<typeof umrahSignupResponse>;
export type RoomType = (typeof ROOM_TYPES)[number];
