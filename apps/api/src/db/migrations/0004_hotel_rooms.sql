-- The kinds of room a hotel offers, and what each one costs there.
--
-- A hotel had one price and nothing else: «от 96 $ за ночь», with no way to say that the duplex
-- is not the single and the suite is neither. `room_types` is the vocabulary — «1-комнатный»,
-- «Дуплекс», «Люкс» — and `hotel_rooms` is what a particular hotel has of it.
--
-- A dictionary rather than free text for the same reason amenities are a table: the name is
-- translated, and two editors typing «люкс» and «Люкс» produce two kinds of room that no filter
-- can put back together. The code is what everything else holds and never changes after the
-- first row references it (D-10).
--
-- `price_minor` is nullable on purpose and means «the hotel's own nightly price». Most hotels
-- quote one number, and forcing a price onto every room would let the catalogue's «от 96 $»
-- disagree with the list of rooms printed underneath it.

CREATE TABLE `room_types` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` JSON NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  CONSTRAINT `room_types_id` PRIMARY KEY(`id`),
  CONSTRAINT `room_types_code_uq` UNIQUE(`code`),
  CONSTRAINT `room_types_name_chk` CHECK (JSON_SCHEMA_VALID(
    '{"type":"object","properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}},"additionalProperties":false}',
    `name`
  ))
);
--> statement-breakpoint
CREATE TABLE `hotel_rooms` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `hotel_id` INT NOT NULL,
  `room_type_id` INT NOT NULL,
  `capacity` TINYINT NOT NULL DEFAULT 2,
  `price_minor` BIGINT,
  `size_sqm` SMALLINT,
  `description` JSON,
  `cover_media_id` INT,
  `sort_order` INT NOT NULL DEFAULT 0,
  CONSTRAINT `hotel_rooms_id` PRIMARY KEY(`id`),
  -- Two people in a room is the floor; a room for nobody is a row nobody meant to write.
  CONSTRAINT `hotel_rooms_capacity_chk` CHECK (`capacity` BETWEEN 1 AND 12),
  CONSTRAINT `hotel_rooms_price_chk` CHECK (`price_minor` IS NULL OR `price_minor` >= 0)
);
--> statement-breakpoint
CREATE INDEX `hotel_rooms_hotel_idx` ON `hotel_rooms` (`hotel_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `hotel_rooms_type_idx` ON `hotel_rooms` (`room_type_id`);
--> statement-breakpoint
ALTER TABLE `hotel_rooms`
  ADD CONSTRAINT `hotel_rooms_hotel_fk` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
-- Restricted, not cascaded: deleting a kind of room out from under the hotels that offer it is
-- a mistake the database should refuse rather than perform.
ALTER TABLE `hotel_rooms`
  ADD CONSTRAINT `hotel_rooms_type_fk` FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`);
--> statement-breakpoint
INSERT INTO `room_types` (`code`, `name`, `sort_order`) VALUES
  ('single', '{"ru":"Одноместный","en":"Single","tr":"Tek kişilik"}', 10),
  ('double', '{"ru":"Двухместный","en":"Double","tr":"Çift kişilik"}', 20),
  ('one_room', '{"ru":"1-комнатный","en":"One-room","tr":"Tek odalı"}', 30),
  ('two_room', '{"ru":"2-комнатный","en":"Two-room","tr":"İki odalı"}', 40),
  ('duplex', '{"ru":"Дуплекс","en":"Duplex","tr":"Dubleks"}', 50),
  ('junior_suite', '{"ru":"Полулюкс","en":"Junior suite","tr":"Junior suit"}', 60),
  ('suite', '{"ru":"Люкс","en":"Suite","tr":"Suit"}', 70),
  ('family', '{"ru":"Семейный","en":"Family","tr":"Aile odası"}', 80),
  ('yurt', '{"ru":"Юрта","en":"Yurt","tr":"Yurt"}', 90);
