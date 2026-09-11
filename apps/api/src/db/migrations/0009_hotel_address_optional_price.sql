-- Where the hotel is, and the end of the compulsory price.
--
-- Both arrive with the sixteen real hotels being brought over from the operator's older site.
-- They carry a street address and they do not carry a nightly rate, and the schema could hold
-- neither: there was no address column, and `price_from_minor` was `NOT NULL`.
--
-- Written by hand, like every migration in this directory after the first. `drizzle-kit
-- generate` cannot be used here: `meta/_journal.json` only ever knew about `0000_initial`, so
-- the generator diffs the current schema against that snapshot and produces a migration that
-- recreates half the database. It did exactly that when asked, and the file was deleted rather
-- than applied — `migrate.ts` reads this directory itself and would have run it on the next
-- deploy. Whoever reaches for the generator next should read this paragraph first.
ALTER TABLE `hotels`
  ADD COLUMN `address` JSON AFTER `city`;
--> statement-breakpoint
-- Null means «по запросу», and that is the whole reason for the change.
--
-- A required price made «от N $» the only thing a card could say, so a hotel whose rate nobody
-- has quoted had to be given an invented one — the trap D-109 named when the same question came
-- up for room prices, and the same answer the owner gave for the tour builder on 2026-09-11: an
-- operator quotes, the site does not.
--
-- Nought is not the fallback. A zero price renders as a genuine offer of nothing, which is a
-- worse lie than an honest blank.
ALTER TABLE `hotels`
  MODIFY COLUMN `price_from_minor` BIGINT NULL;
