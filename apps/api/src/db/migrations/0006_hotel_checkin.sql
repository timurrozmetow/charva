-- When a guest may arrive and when they must leave.
--
-- Two facts every hotel page in the world carries and this one did not, so a visitor deciding
-- between a morning flight and an evening one had to write and ask.
--
-- `VARCHAR(5)` holding `14:00`, not a TIME: the value is a wall-clock rule printed on a page —
-- «заезд с 14:00» — never a moment, never compared against anything, and never converted
-- between zones. A TIME column would invite all three.
ALTER TABLE `hotels`
  ADD COLUMN `check_in` VARCHAR(5) AFTER `price_currency`,
  ADD COLUMN `check_out` VARCHAR(5) AFTER `check_in`;
--> statement-breakpoint
-- The usual pair in Turkmenistan, and the one every seeded hotel uses. An editor changes it per
-- hotel; what matters is that the page stops being silent about it.
UPDATE `hotels` SET `check_in` = '14:00', `check_out` = '12:00';
