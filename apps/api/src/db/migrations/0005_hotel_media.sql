-- A hotel's photographs, beside its cover.
--
-- Tours have had `tour_media` since the schema was written; hotels had a cover and nothing else,
-- so a hotel page showed one picture of a building and no rooms, no restaurant, no view.
--
-- A second table rather than one shared table with a `kind` column, for the same reason the
-- amenities are their own: the foreign key is what makes «every photograph of this hotel» one
-- index lookup, and a polymorphic parent column cannot have a foreign key at all.
--
-- The twelve-photograph ceiling is not here. A CHECK cannot count rows in another table, and a
-- trigger to do it would put the rule somewhere nobody reading the admin would find it — so it
-- lives in the one endpoint that writes the set, next to everything else that endpoint refuses.

CREATE TABLE `hotel_media` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `hotel_id` INT NOT NULL,
  `media_id` INT NOT NULL,
  `caption` JSON,
  `sort_order` INT NOT NULL DEFAULT 0,
  CONSTRAINT `hotel_media_id` PRIMARY KEY(`id`),
  -- The same photograph twice in one gallery is a mistake every time.
  CONSTRAINT `hotel_media_uq` UNIQUE(`hotel_id`,`media_id`),
  CONSTRAINT `hotel_media_caption_chk` CHECK (`caption` IS NULL OR JSON_SCHEMA_VALID(
    '{"type":"object","properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}},"additionalProperties":false}',
    `caption`
  ))
);
--> statement-breakpoint
CREATE INDEX `hotel_media_order_idx` ON `hotel_media` (`hotel_id`,`sort_order`);
--> statement-breakpoint
ALTER TABLE `hotel_media`
  ADD CONSTRAINT `hotel_media_hotel_fk` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `hotel_media`
  ADD CONSTRAINT `hotel_media_media_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE CASCADE;
