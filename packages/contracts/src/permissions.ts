import { type Site } from './constants';

/**
 * Who may do what in the admin.
 *
 * One table, two consumers, for the same reason the builder's formula lives here (D-11): the SPA
 * hides a button and the API refuses the request, and if the rule is written twice then one day
 * the button stays and the refusal goes. A hidden control is a courtesy; the check on the server
 * is the enforcement — but both have to read the same table.
 */

export const ADMIN_ROLES = ['owner', 'editor', 'manager'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** The site an account is tied to. `null` means both. */
export const ADMIN_SITE_SCOPES = ['global', 'umrah'] as const;
export type AdminSiteScope = (typeof ADMIN_SITE_SCOPES)[number];

/**
 * Capabilities rather than roles, at the point of the check.
 *
 * `can(role, 'passport.reveal')` survives a fourth role being added; `role === 'owner'` scattered
 * across twenty call sites does not.
 */
export const CAPABILITIES = [
  /** See content lists and forms. */
  'content.read',
  /** Edit content: tours, hotels, articles, blocks, departures, programme. */
  'content.write',
  /** Upload and delete files, attach them to slots. */
  'media.write',
  /** The inbox: enquiries and pilgrimage signups. */
  'leads.read',
  /** Status and notes on an enquiry. */
  'leads.write',
  /** Decrypt a passport number. Every use writes a row to `audit_log` — decision D-18. */
  'passport.reveal',
  /** Admin accounts. */
  'users.manage',
  /** Contacts, registration details, builder rates. */
  'settings.write',
  /** The action log. */
  'audit.read',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * The grant table.
 *
 * Passports are the one row chosen by me rather than by the owner: **a manager cannot see them**
 * (question Q-14). The opposite decision is one line here, and it should have to be said out
 * loud, because the manager is the person who processes signups and therefore the person who
 * wants them most often. Until the owner says otherwise, the right to read the most sensitive
 * field in the system stays with the owner.
 */
const GRANTS: Record<AdminRole, readonly Capability[]> = {
  owner: [...CAPABILITIES],
  editor: ['content.read', 'content.write', 'media.write', 'leads.read', 'leads.write'],
  // Reads content so an enquiry about a tour can be answered, but does not edit it.
  manager: ['content.read', 'leads.read', 'leads.write'],
};

export function can(role: AdminRole, capability: Capability): boolean {
  return GRANTS[role].includes(capability);
}

export function capabilitiesOf(role: AdminRole): Capability[] {
  return [...GRANTS[role]];
}

/**
 * Site scope, kept separate from role.
 *
 * An Umrah editor and a Global editor are one role with different rights over a row, so this is
 * a second dimension rather than two more roles. The owner is not scoped: an account holding
 * `users.manage` could grant itself any scope anyway, and pretending otherwise would only make
 * the check look stronger than it is.
 */
export function canTouchSite(
  user: { role: AdminRole; siteScope: AdminSiteScope | null },
  site: Site,
): boolean {
  // `choice` is not an editable site but a chooser: everything on it is interface copy plus
  // figures computed from the other two.
  if (site === 'choice') return user.role === 'owner';
  return user.siteScope === null || user.siteScope === site;
}
