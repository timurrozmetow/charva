-- The moment a Global lead consented to be contacted.
--
-- `umrah_signups` has carried this since the first migration; `leads` did not, because the
-- handoff draws the consent control on the contact form as a styled `<span>` that cannot be
-- checked, and a control nothing records is indistinguishable from no control at all.
--
-- The Global form asks for a name and a telephone number. That is personal data, the visitor
-- is agreeing to be rung about it, and a retention period is counted from a date — so the
-- date has to exist. Nullable rather than defaulted: rows written before this migration were
-- collected under a form that never asked, and back-filling them with a timestamp would be
-- inventing a consent nobody gave.

ALTER TABLE `leads` ADD COLUMN `consent_at` TIMESTAMP NULL AFTER `locale`;
