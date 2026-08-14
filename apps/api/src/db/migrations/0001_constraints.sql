-- Constraints Drizzle Kit cannot express.
--
-- Every rule here is one the application would otherwise merely be trusted to keep. The
-- acceptance criterion for this phase is that the database keeps them: a malformed
-- translation, a negative seat count or a second current departure is rejected by MySQL,
-- not by a code path somebody can forget to call.

-- ---------------------------------------------------------------------------------------
-- Translatable columns are objects with known keys only.
--
-- `additionalProperties: false` is what makes a Turkish string on an Umrah row impossible,
-- and the required key is the site's default language. NULL passes: an untranslated optional
-- field is the normal state for months (Q-3); an object with a `de` key never is.
-- ---------------------------------------------------------------------------------------

ALTER TABLE `tours` ADD CONSTRAINT `tours_title_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `title`));
--> statement-breakpoint
ALTER TABLE `tours` ADD CONSTRAINT `tours_summary_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `summary`));
--> statement-breakpoint
ALTER TABLE `tours` ADD CONSTRAINT `tours_body_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `body`));
--> statement-breakpoint
ALTER TABLE `tours` ADD CONSTRAINT `tours_tag_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `tag`));
--> statement-breakpoint
ALTER TABLE `tour_days` ADD CONSTRAINT `tour_days_title_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `title`));
--> statement-breakpoint
ALTER TABLE `tour_days` ADD CONSTRAINT `tour_days_description_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `description`));
--> statement-breakpoint
ALTER TABLE `tour_days` ADD CONSTRAINT `tour_days_city_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `city`));
--> statement-breakpoint
ALTER TABLE `tour_media` ADD CONSTRAINT `tour_media_caption_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `caption`));
--> statement-breakpoint
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_name_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `name`));
--> statement-breakpoint
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_city_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `city`));
--> statement-breakpoint
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_summary_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `summary`));
--> statement-breakpoint
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_body_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `body`));
--> statement-breakpoint
ALTER TABLE `amenities` ADD CONSTRAINT `amenities_name_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `name`));
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_title_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `title`));
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_summary_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `summary`));
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_body_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `body`));
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_tag_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `tag`));
--> statement-breakpoint
ALTER TABLE `gallery_items` ADD CONSTRAINT `gallery_items_caption_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `caption`));
--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_title_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `title`));
--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_description_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `description`));
--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_body_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `body`));
--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_author_city_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `author_city`));
--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_tour_title_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `tour_title`));
--> statement-breakpoint
ALTER TABLE `places_to_see` ADD CONSTRAINT `places_to_see_name_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `name`));
--> statement-breakpoint
ALTER TABLE `places_to_see` ADD CONSTRAINT `places_to_see_region_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `region`));
--> statement-breakpoint
ALTER TABLE `places_to_see` ADD CONSTRAINT `places_to_see_description_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `description`));
--> statement-breakpoint
ALTER TABLE `umrah_program_days` ADD CONSTRAINT `umrah_program_days_title_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["tm"],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `title`));
--> statement-breakpoint
ALTER TABLE `umrah_program_days` ADD CONSTRAINT `umrah_program_days_description_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `description`));
--> statement-breakpoint
ALTER TABLE `umrah_program_days` ADD CONSTRAINT `umrah_program_days_city_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `city`));
--> statement-breakpoint
ALTER TABLE `ziyarat_places` ADD CONSTRAINT `ziyarat_places_name_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["tm"],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `name`));
--> statement-breakpoint
ALTER TABLE `ziyarat_places` ADD CONSTRAINT `ziyarat_places_description_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `description`));
--> statement-breakpoint
ALTER TABLE `ziyarat_places` ADD CONSTRAINT `ziyarat_places_duration_label_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `duration_label`));
--> statement-breakpoint
ALTER TABLE `umrah_groups` ADD CONSTRAINT `umrah_groups_label_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["tm"],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `label`));
--> statement-breakpoint
ALTER TABLE `umrah_groups` ADD CONSTRAINT `umrah_groups_short_label_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `short_label`));
--> statement-breakpoint
ALTER TABLE `umrah_groups` ADD CONSTRAINT `umrah_groups_description_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `description`));
--> statement-breakpoint
ALTER TABLE `umrah_group_media` ADD CONSTRAINT `umrah_group_media_caption_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `caption`));
--> statement-breakpoint
ALTER TABLE `umrah_trips` ADD CONSTRAINT `umrah_trips_hotel_mekka_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `hotel_mekka`));
--> statement-breakpoint
ALTER TABLE `umrah_trips` ADD CONSTRAINT `umrah_trips_hotel_medina_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"tm":{"type":"string"},"ru":{"type":"string"}}}', `hotel_medina`));
--> statement-breakpoint
ALTER TABLE `builder_steps` ADD CONSTRAINT `builder_steps_title_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `title`));
--> statement-breakpoint
ALTER TABLE `builder_steps` ADD CONSTRAINT `builder_steps_hint_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `hint`));
--> statement-breakpoint
ALTER TABLE `builder_steps` ADD CONSTRAINT `builder_steps_rail_label_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `rail_label`));
--> statement-breakpoint
ALTER TABLE `builder_options` ADD CONSTRAINT `builder_options_name_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":["ru"],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `name`));
--> statement-breakpoint
ALTER TABLE `builder_options` ADD CONSTRAINT `builder_options_note_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"}}}', `note`));
--> statement-breakpoint
ALTER TABLE `faqs` ADD CONSTRAINT `faqs_question_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"},"tm":{"type":"string"}}}', `question`));
--> statement-breakpoint
ALTER TABLE `faqs` ADD CONSTRAINT `faqs_answer_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"},"tm":{"type":"string"}}}', `answer`));
--> statement-breakpoint
ALTER TABLE `content_blocks` ADD CONSTRAINT `content_blocks_key_text_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"},"tm":{"type":"string"}}}', `key_text`));
--> statement-breakpoint
ALTER TABLE `content_blocks` ADD CONSTRAINT `content_blocks_value_text_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"},"tm":{"type":"string"}}}', `value_text`));
--> statement-breakpoint
ALTER TABLE `content_blocks` ADD CONSTRAINT `content_blocks_note_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"},"tm":{"type":"string"}}}', `note`));
--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_alt_i18n` CHECK (JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"},"tm":{"type":"string"}}}', `alt`));
--> statement-breakpoint

-- ---------------------------------------------------------------------------------------
-- Ranges the application must not be trusted with.
-- ---------------------------------------------------------------------------------------

-- A group cannot hold negative pilgrims or more than it has places for. The seats bar
ALTER TABLE `umrah_trips` ADD CONSTRAINT `umrah_trips_seats_range_chk` CHECK (`seats_taken` >= 0 AND `seats_taken` <= `seats_total` AND `seats_total` > 0);
--> statement-breakpoint
-- Returning before departing would make every derived trip status nonsense.
ALTER TABLE `umrah_trips` ADD CONSTRAINT `umrah_trips_dates_order_chk` CHECK (`return_at` > `depart_at`);
--> statement-breakpoint
-- StarRating clamps its input; a row should never be the reason it has to.
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_rating_range_chk` CHECK (`rating` BETWEEN 1 AND 5);
--> statement-breakpoint
-- An editorial hint the packer clamps anyway. Out of range means a typo, not intent.
ALTER TABLE `gallery_items` ADD CONSTRAINT `gallery_items_span_range_chk` CHECK (`span_cols` BETWEEN 1 AND 4 AND `span_rows` BETWEEN 1 AND 4);
--> statement-breakpoint
ALTER TABLE `umrah_group_media` ADD CONSTRAINT `umrah_group_media_span_range_chk` CHECK (`span_cols` BETWEEN 1 AND 4 AND `span_rows` BETWEEN 1 AND 4);
--> statement-breakpoint
-- The catalogue has no one- or two-star hotels, and a camp has no stars at all.
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_stars_range_chk` CHECK (`stars` IS NULL OR `stars` BETWEEN 3 AND 5);
--> statement-breakpoint
-- The contradiction the column pair exists to prevent: a yurt camp displayed as 3 stars.
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_stars_category_chk` CHECK ((`category` = 'hotel' AND `stars` IS NOT NULL) OR (`category` <> 'hotel' AND `stars` IS NULL));
--> statement-breakpoint
ALTER TABLE `tours` ADD CONSTRAINT `tours_days_positive_chk` CHECK (`days` > 0 AND `cities` > 0);
--> statement-breakpoint
ALTER TABLE `tours` ADD CONSTRAINT `tours_price_positive_chk` CHECK (`price_from_minor` >= 0);
--> statement-breakpoint
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_price_positive_chk` CHECK (`price_from_minor` >= 0);
--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_size_positive_chk` CHECK (`size_bytes` > 0);
--> statement-breakpoint
-- Thousandths, so the column stays an integer.
ALTER TABLE `media` ADD CONSTRAINT `media_focal_range_chk` CHECK ((`focal_x` IS NULL OR `focal_x` BETWEEN 0 AND 1000) AND (`focal_y` IS NULL OR `focal_y` BETWEEN 0 AND 1000));
--> statement-breakpoint
ALTER TABLE `umrah_signups` ADD CONSTRAINT `umrah_signups_people_positive_chk` CHECK (`people_count` > 0);
--> statement-breakpoint
ALTER TABLE `builder_options` ADD CONSTRAINT `builder_options_price_positive_chk` CHECK (`price_modifier_minor` IS NULL OR `price_modifier_minor` >= 0);
--> statement-breakpoint
ALTER TABLE `pricing_rules` ADD CONSTRAINT `pricing_rules_value_positive_chk` CHECK (`value_minor` >= 0);
--> statement-breakpoint

-- ---------------------------------------------------------------------------------------
-- At most one departure may be marked current.
--
-- MySQL has no partial index, so the flag is projected into a generated column that is 1
-- when set and NULL otherwise, and NULLs do not collide in a UNIQUE key. Two current trips
-- would leave the countdown, the seats bar and the signup form describing different groups.
-- ---------------------------------------------------------------------------------------

ALTER TABLE `umrah_trips` ADD COLUMN `is_current_key` TINYINT GENERATED ALWAYS AS (IF(`is_current` = 1, 1, NULL)) STORED;
--> statement-breakpoint
ALTER TABLE `umrah_trips` ADD CONSTRAINT `umrah_trips_current_uq` UNIQUE (`is_current_key`);
--> statement-breakpoint

-- ---------------------------------------------------------------------------------------
-- Functional indexes over the translated titles the admin sorts by.
--
-- Without them, ordering a list by name is a filesort with a JSON extraction per
-- comparison. The cast is required: JSON_UNQUOTE returns LONGTEXT, which cannot be indexed.
-- ---------------------------------------------------------------------------------------

ALTER TABLE `tours` ADD INDEX `tours_title_ru_idx` ((CAST(JSON_UNQUOTE(JSON_EXTRACT(`title`, '$.ru')) AS CHAR(160))));
--> statement-breakpoint
ALTER TABLE `hotels` ADD INDEX `hotels_name_ru_idx` ((CAST(JSON_UNQUOTE(JSON_EXTRACT(`name`, '$.ru')) AS CHAR(160))));
--> statement-breakpoint
ALTER TABLE `articles` ADD INDEX `articles_title_ru_idx` ((CAST(JSON_UNQUOTE(JSON_EXTRACT(`title`, '$.ru')) AS CHAR(160))));
--> statement-breakpoint
ALTER TABLE `places_to_see` ADD INDEX `places_to_see_name_ru_idx` ((CAST(JSON_UNQUOTE(JSON_EXTRACT(`name`, '$.ru')) AS CHAR(160))));
--> statement-breakpoint
ALTER TABLE `videos` ADD INDEX `videos_title_ru_idx` ((CAST(JSON_UNQUOTE(JSON_EXTRACT(`title`, '$.ru')) AS CHAR(160))));
--> statement-breakpoint
ALTER TABLE `ziyarat_places` ADD INDEX `ziyarat_places_name_tm_idx` ((CAST(JSON_UNQUOTE(JSON_EXTRACT(`name`, '$.tm')) AS CHAR(160))));
--> statement-breakpoint
ALTER TABLE `umrah_groups` ADD INDEX `umrah_groups_label_tm_idx` ((CAST(JSON_UNQUOTE(JSON_EXTRACT(`label`, '$.tm')) AS CHAR(160))));
--> statement-breakpoint
