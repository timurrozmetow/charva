CREATE TABLE `builder_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`step_id` int NOT NULL,
	`code` varchar(60) NOT NULL,
	`name` json NOT NULL,
	`note` json,
	`numeric_value` int,
	`price_modifier_minor` bigint,
	`modifier_type` enum('per_night','per_item','flat','none') NOT NULL DEFAULT 'none',
	`is_published` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `builder_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `builder_options_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `builder_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`kind` enum('single','multi','form') NOT NULL DEFAULT 'single',
	`title` json NOT NULL,
	`hint` json,
	`rail_label` json,
	`is_required` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `builder_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `builder_steps_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key_name` varchar(60) NOT NULL,
	`value_minor` bigint NOT NULL,
	`unit` enum('minor','count') NOT NULL DEFAULT 'minor',
	`currency` enum('USD','TMT') NOT NULL DEFAULT 'USD',
	`note` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_rules_key_uq` UNIQUE(`key_name`)
);
--> statement-breakpoint
CREATE TABLE `amenities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(60) NOT NULL,
	`name` json NOT NULL,
	`icon` varchar(40),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `amenities_id` PRIMARY KEY(`id`),
	CONSTRAINT `amenities_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` json NOT NULL,
	`summary` json,
	`body` json,
	`tag` json,
	`read_minutes` tinyint,
	`cover_media_id` int,
	`is_featured` boolean NOT NULL DEFAULT false,
	`published_at` timestamp,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site` enum('choice','global','umrah') NOT NULL DEFAULT 'global',
	`question` json NOT NULL,
	`answer` json NOT NULL,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faqs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gallery_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`media_id` int NOT NULL,
	`caption` json,
	`category` varchar(40) NOT NULL,
	`span_cols` tinyint NOT NULL DEFAULT 1,
	`span_rows` tinyint NOT NULL DEFAULT 1,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gallery_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hotel_amenities` (
	`hotel_id` int NOT NULL,
	`amenity_id` int NOT NULL,
	CONSTRAINT `hotel_amenities_hotel_id_amenity_id_pk` PRIMARY KEY(`hotel_id`,`amenity_id`)
);
--> statement-breakpoint
CREATE TABLE `hotels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` json NOT NULL,
	`summary` json,
	`body` json,
	`city` json NOT NULL,
	`stars` tinyint,
	`category` enum('hotel','boutique','camp') NOT NULL DEFAULT 'hotel',
	`price_from_minor` bigint NOT NULL,
	`price_currency` enum('USD','TMT') NOT NULL DEFAULT 'USD',
	`cover_media_id` int,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hotels_id` PRIMARY KEY(`id`),
	CONSTRAINT `hotels_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `places_to_see` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` json NOT NULL,
	`region` json,
	`description` json,
	`cover_media_id` int,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `places_to_see_id` PRIMARY KEY(`id`),
	CONSTRAINT `places_to_see_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`author_name` varchar(120) NOT NULL,
	`author_city` json,
	`avatar_media_id` int,
	`rating` tinyint NOT NULL,
	`body` json NOT NULL,
	`visited_on` date,
	`tour_id` int,
	`tour_title` json,
	`status` enum('pending','published','rejected') NOT NULL DEFAULT 'pending',
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tour_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tour_id` int NOT NULL,
	`day_number` tinyint NOT NULL,
	`title` json NOT NULL,
	`description` json,
	`city` json,
	`media_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tour_days_id` PRIMARY KEY(`id`),
	CONSTRAINT `tour_days_number_uq` UNIQUE(`tour_id`,`day_number`)
);
--> statement-breakpoint
CREATE TABLE `tour_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tour_id` int NOT NULL,
	`media_id` int NOT NULL,
	`caption` json,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `tour_media_id` PRIMARY KEY(`id`),
	CONSTRAINT `tour_media_uq` UNIQUE(`tour_id`,`media_id`)
);
--> statement-breakpoint
CREATE TABLE `tours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` json NOT NULL,
	`summary` json,
	`body` json,
	`tag` json,
	`category` varchar(40) NOT NULL,
	`days` tinyint NOT NULL,
	`cities` tinyint NOT NULL,
	`hotel_stars` tinyint,
	`price_from_minor` bigint NOT NULL,
	`price_currency` enum('USD','TMT') NOT NULL DEFAULT 'USD',
	`cover_media_id` int,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tours_id` PRIMARY KEY(`id`),
	CONSTRAINT `tours_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` json NOT NULL,
	`description` json,
	`kind` enum('file','youtube','vimeo') NOT NULL DEFAULT 'file',
	`media_id` int,
	`external_id` varchar(60),
	`poster_media_id` int,
	`duration_sec` int,
	`view_count` int NOT NULL DEFAULT 0,
	`category` varchar(40),
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `videos_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('tour','question','builder') NOT NULL DEFAULT 'question',
	`name` varchar(120) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`email` varchar(190),
	`guests` smallint,
	`topics` json,
	`message` text,
	`locale` varchar(5) NOT NULL DEFAULT 'ru',
	`selection` json,
	`quote_snapshot` json,
	`dedupe_hash` varchar(64),
	`status` enum('new','in_progress','won','lost','spam') NOT NULL DEFAULT 'new',
	`admin_notes` text,
	`ip_hash` varchar(64),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `umrah_signups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trip_id` int NOT NULL,
	`full_name` varchar(160) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`passport_number` varchar(512),
	`people_count` smallint NOT NULL DEFAULT 1,
	`room_type` varchar(20),
	`comment` text,
	`locale` varchar(5) NOT NULL DEFAULT 'tm',
	`consent_at` timestamp,
	`dedupe_hash` varchar(64),
	`status` enum('new','contacted','confirmed','cancelled','spam') NOT NULL DEFAULT 'new',
	`admin_notes` text,
	`ip_hash` varchar(64),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `umrah_signups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_refresh_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`family_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`ip_hash` varchar(64),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_refresh_tokens_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(190) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` enum('owner','editor','manager') NOT NULL DEFAULT 'editor',
	`site_scope` enum('global','umrah'),
	`is_active` boolean NOT NULL DEFAULT true,
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` timestamp,
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`actor_id` int,
	`action` varchar(40) NOT NULL,
	`entity` varchar(60) NOT NULL,
	`entity_id` varchar(60),
	`before` json,
	`after` json,
	`ip_hash` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site` enum('choice','global','umrah') NOT NULL,
	`block_code` varchar(60) NOT NULL,
	`key_text` json,
	`value_text` json,
	`note` json,
	`icon` varchar(40),
	`media_id` int,
	`is_featured` boolean NOT NULL DEFAULT false,
	`meta` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site` enum('choice','global','umrah') NOT NULL,
	`page` varchar(60) NOT NULL,
	`slot_key` varchar(80) NOT NULL,
	`brief` text NOT NULL,
	`recommended_width` int,
	`recommended_height` int,
	`media_id` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_slots_key_uq` UNIQUE(`site`,`page`,`slot_key`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storage_key` varchar(255) NOT NULL,
	`mime` varchar(100) NOT NULL,
	`width` int,
	`height` int,
	`size_bytes` bigint NOT NULL,
	`duration_sec` int,
	`checksum` varchar(64) NOT NULL,
	`lqip` text,
	`focal_x` smallint,
	`focal_y` smallint,
	`alt` json,
	`source` enum('upload','stock','external') NOT NULL DEFAULT 'upload',
	`attribution` varchar(255),
	`license` varchar(120),
	`is_placeholder` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_checksum_uq` UNIQUE(`checksum`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site` enum('choice','global','umrah') NOT NULL,
	`setting_key` varchar(80) NOT NULL,
	`value` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_key_uq` UNIQUE(`site`,`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `umrah_group_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`group_id` int NOT NULL,
	`kind` enum('photo','video') NOT NULL DEFAULT 'photo',
	`media_id` int NOT NULL,
	`poster_media_id` int,
	`caption` json,
	`duration_sec` int,
	`span_cols` tinyint NOT NULL DEFAULT 1,
	`span_rows` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `umrah_group_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `umrah_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`trip_id` int,
	`departed_on` date,
	`pilgrims_count` smallint,
	`label` json NOT NULL,
	`short_label` json,
	`description` json,
	`cover_media_id` int,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `umrah_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `umrah_groups_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `umrah_program_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day_number` tinyint NOT NULL,
	`title` json NOT NULL,
	`description` json,
	`city` json,
	`media_id` int,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `umrah_program_days_id` PRIMARY KEY(`id`),
	CONSTRAINT `umrah_program_days_number_uq` UNIQUE(`day_number`)
);
--> statement-breakpoint
CREATE TABLE `umrah_trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depart_at` datetime NOT NULL,
	`return_at` datetime NOT NULL,
	`signup_closes_at` datetime,
	`seats_total` smallint NOT NULL,
	`seats_taken` smallint NOT NULL DEFAULT 0,
	`duration_days` tinyint NOT NULL,
	`hotel_mekka` json,
	`hotel_medina` json,
	`status` enum('draft','open','full','closed','departed','completed') NOT NULL DEFAULT 'draft',
	`is_current` boolean NOT NULL DEFAULT false,
	`price_minor` bigint,
	`price_currency` enum('USD','TMT') NOT NULL DEFAULT 'TMT',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `umrah_trips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ziyarat_places` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` json NOT NULL,
	`description` json,
	`city` enum('mekge','medine','bedir','jidda') NOT NULL,
	`duration_label` json,
	`cover_media_id` int,
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ziyarat_places_id` PRIMARY KEY(`id`),
	CONSTRAINT `ziyarat_places_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `builder_options_step_idx` ON `builder_options` (`step_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `articles_published_idx` ON `articles` (`is_published`,`published_at`);--> statement-breakpoint
CREATE INDEX `faqs_site_idx` ON `faqs` (`site`,`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `gallery_published_idx` ON `gallery_items` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `gallery_category_idx` ON `gallery_items` (`category`,`is_published`);--> statement-breakpoint
CREATE INDEX `hotel_amenities_amenity_idx` ON `hotel_amenities` (`amenity_id`);--> statement-breakpoint
CREATE INDEX `hotels_published_idx` ON `hotels` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `hotels_category_idx` ON `hotels` (`category`,`stars`);--> statement-breakpoint
CREATE INDEX `places_to_see_published_idx` ON `places_to_see` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `reviews_status_idx` ON `reviews` (`status`,`visited_on`);--> statement-breakpoint
CREATE INDEX `reviews_rating_idx` ON `reviews` (`rating`);--> statement-breakpoint
CREATE INDEX `reviews_tour_idx` ON `reviews` (`tour_id`);--> statement-breakpoint
CREATE INDEX `tour_media_order_idx` ON `tour_media` (`tour_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `tours_published_idx` ON `tours` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `tours_category_idx` ON `tours` (`category`,`is_published`);--> statement-breakpoint
CREATE INDEX `tours_featured_idx` ON `tours` (`is_featured`,`is_published`);--> statement-breakpoint
CREATE INDEX `videos_published_idx` ON `videos` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `leads_dedupe_idx` ON `leads` (`dedupe_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `umrah_signups_trip_idx` ON `umrah_signups` (`trip_id`,`status`);--> statement-breakpoint
CREATE INDEX `umrah_signups_created_idx` ON `umrah_signups` (`created_at`);--> statement-breakpoint
CREATE INDEX `umrah_signups_dedupe_idx` ON `umrah_signups` (`dedupe_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_refresh_tokens_family_idx` ON `admin_refresh_tokens` (`family_id`);--> statement-breakpoint
CREATE INDEX `admin_refresh_tokens_user_idx` ON `admin_refresh_tokens` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `content_blocks_code_idx` ON `content_blocks` (`site`,`block_code`,`sort_order`);--> statement-breakpoint
CREATE INDEX `content_slots_page_idx` ON `content_slots` (`site`,`page`,`sort_order`);--> statement-breakpoint
CREATE INDEX `content_slots_media_idx` ON `content_slots` (`media_id`);--> statement-breakpoint
CREATE INDEX `media_placeholder_idx` ON `media` (`is_placeholder`);--> statement-breakpoint
CREATE INDEX `umrah_group_media_idx` ON `umrah_group_media` (`group_id`,`kind`,`sort_order`);--> statement-breakpoint
CREATE INDEX `umrah_group_media_media_idx` ON `umrah_group_media` (`media_id`);--> statement-breakpoint
CREATE INDEX `umrah_groups_departed_idx` ON `umrah_groups` (`departed_on`);--> statement-breakpoint
CREATE INDEX `umrah_groups_published_idx` ON `umrah_groups` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `umrah_trips_status_idx` ON `umrah_trips` (`status`,`depart_at`);--> statement-breakpoint
CREATE INDEX `umrah_trips_depart_idx` ON `umrah_trips` (`depart_at`);--> statement-breakpoint
CREATE INDEX `ziyarat_places_city_idx` ON `ziyarat_places` (`city`,`is_published`);--> statement-breakpoint
CREATE INDEX `ziyarat_places_published_idx` ON `ziyarat_places` (`is_published`,`sort_order`);