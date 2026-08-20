-- What a tour's price covers, what it does not, and what it costs a party of one, two or four.
--
-- A tour carried a single `price_from_minor` and nothing else, so the detail page could print one
-- number and then had to say, in effect, «ask the manager» about everything that number means.
-- The two tables here are the two questions every tour sheet in this business answers on paper
-- and the site could not answer at all: what is included, and what does it cost my group.
--
-- `tour_inclusions` is one table with a `kind`, not `tour_includes` beside `tour_excludes`. The
-- two lists are the same shape, print side by side, and are edited in one sitting; splitting them
-- would double the admin screens to encode a distinction that a two-value enum already carries.
--
-- `tour_prices` has no currency column on purpose. The tour has one, and a tour whose tiers could
-- disagree with its own `price_currency` is a tour that would eventually quote a party of two in
-- dollars and a party of three in manat. The per-person price falls as the party grows because a
-- guide and a car cost the same whether they carry one traveller or four — which is why `pax` is
-- a party size, never a number of rooms.

CREATE TABLE `tour_inclusions` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `tour_id` INT NOT NULL,
  `kind` ENUM('included','excluded') NOT NULL,
  `text` JSON NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  CONSTRAINT `tour_inclusions_id` PRIMARY KEY(`id`),
  CONSTRAINT `tour_inclusions_text_chk` CHECK (JSON_SCHEMA_VALID(
    '{"type":"object","properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}},"additionalProperties":false}',
    `text`
  ))
);
--> statement-breakpoint
CREATE INDEX `tour_inclusions_tour_idx` ON `tour_inclusions` (`tour_id`,`kind`,`sort_order`);
--> statement-breakpoint
ALTER TABLE `tour_inclusions`
  ADD CONSTRAINT `tour_inclusions_tour_fk` FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
CREATE TABLE `tour_prices` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `tour_id` INT NOT NULL,
  `pax` TINYINT NOT NULL,
  `price_minor` BIGINT NOT NULL,
  CONSTRAINT `tour_prices_id` PRIMARY KEY(`id`),
  -- One price per party size. Two rows for «2 persons» is the mistake that puts two different
  -- numbers on one page, and it is cheaper to refuse than to reconcile.
  CONSTRAINT `tour_prices_pax_uq` UNIQUE(`tour_id`,`pax`),
  CONSTRAINT `tour_prices_pax_chk` CHECK (`pax` BETWEEN 1 AND 60),
  CONSTRAINT `tour_prices_price_chk` CHECK (`price_minor` >= 0)
);
--> statement-breakpoint
-- No `sort_order`: the tiers are read in the order a party grows, and that order is the `pax`
-- column itself. A hand-sortable list here could only ever be sorted wrong.
CREATE INDEX `tour_prices_tour_idx` ON `tour_prices` (`tour_id`,`pax`);
--> statement-breakpoint
ALTER TABLE `tour_prices`
  ADD CONSTRAINT `tour_prices_tour_fk` FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON DELETE CASCADE;
