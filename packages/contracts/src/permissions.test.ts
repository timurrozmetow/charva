import { describe, expect, it } from 'vitest';

import { ADMIN_ROLES, can, canTouchSite, CAPABILITIES, capabilitiesOf } from './permissions';

describe('admin permissions', () => {
  it('grants the owner everything', () => {
    expect(capabilitiesOf('owner')).toEqual([...CAPABILITIES]);
  });

  it('does not let a manager decrypt a passport', () => {
    // The default answer to Q-14, chosen by me: the right to read the most sensitive field in
    // the system stays with the owner until the client says otherwise. The test exists so that
    // the opposite decision is a change somebody makes, not a remark somebody drops.
    expect(can('manager', 'passport.reveal')).toBe(false);
    expect(can('editor', 'passport.reveal')).toBe(false);
    expect(can('owner', 'passport.reveal')).toBe(true);
  });

  it('lets nobody but the owner create accounts', () => {
    expect(ADMIN_ROLES.filter((role) => can(role, 'users.manage'))).toEqual(['owner']);
  });

  it('leaves the manager reading content and working the inbox', () => {
    expect(can('manager', 'content.read')).toBe(true);
    expect(can('manager', 'content.write')).toBe(false);
    expect(can('manager', 'leads.read')).toBe(true);
    expect(can('manager', 'leads.write')).toBe(true);
  });

  it('keeps site scope separate from role', () => {
    const umrahEditor = { role: 'editor', siteScope: 'umrah' } as const;
    const bothEditor = { role: 'editor', siteScope: null } as const;

    expect(canTouchSite(umrahEditor, 'umrah')).toBe(true);
    expect(canTouchSite(umrahEditor, 'global')).toBe(false);
    expect(canTouchSite(bothEditor, 'global')).toBe(true);
  });

  it('does not treat the chooser as an editable site', () => {
    // Nothing on it is content: it is interface copy plus figures counted from the other two.
    expect(canTouchSite({ role: 'editor', siteScope: null }, 'choice')).toBe(false);
    expect(canTouchSite({ role: 'owner', siteScope: null }, 'choice')).toBe(true);
  });
});
