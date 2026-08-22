-- The slider on both homepages becomes a thing an editor can point at.
--
-- Until now there was no such thing as a hero slide. Global's four slides were the first four rows
-- of `places_to_see` and Umrah's three were the first three of `ziyarat_places`, with the caption
-- taken from the place's name and the photograph taken from the place's cover *or*, failing that,
-- from a `g-hero-N` content slot. That arrangement was mine and it was wrong in three ways at once:
-- the photograph had two possible sources, so which one an upload landed in depended on facts the
-- editor could not see; the caption lived in a foreign entity, so renaming a slide meant renaming a
-- place on `/turkmenistan`; and the order of the slides was the order of the places.
--
-- The design had it right the whole time. The export carries a `SLIDES` array — a label, a brief
-- and a slot key per slide — beside the separate `places` array, and Umrah's third slide is
-- «Topar», a group photograph that is not a ziyarat place at all and therefore could never be
-- reached through one. Folding that list into the places was a decision the export did not make.
--
-- `brief` moves here with it. The art direction for a hero photograph describes that slide and
-- nothing else, so leaving it in `content_slots` would keep the two sources this table exists to
-- collapse — an editor could still upload into `g-hero-1` and watch nothing happen. The seven
-- corresponding slots leave the photographic checklist as these seven rows join it.
--
-- Structure only, no rows. A content migration passes on an empty test database and then collides
-- with the seeder that inserts the same rows a moment later (D-123). The seeder fills a fresh
-- database; a one-off script fills the owner's live one.

CREATE TABLE `hero_slides` (
  `id` INT AUTO_INCREMENT NOT NULL,
  -- No `choice`: the chooser is two static halves, and a site enum that admits a value no code
  -- can render is an invitation to create a slide that appears nowhere.
  `site` ENUM('global','umrah') NOT NULL,
  `title` JSON NOT NULL,
  -- Art direction while the photograph does not exist, and the text `db:stock` matches a subject
  -- against. Nullable because a slide added by hand from the admin already has its picture.
  `brief` TEXT,
  `media_id` INT,
  `is_published` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT (now()),
  `updated_at` TIMESTAMP NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `hero_slides_id` PRIMARY KEY(`id`),
  -- All four languages, because one table serves a three-language site and a two-language one.
  -- The narrowing to `{ru,en,tr}` and `{tm,ru}` is the API's job, where the site is known.
  CONSTRAINT `hero_slides_title_i18n` CHECK (JSON_SCHEMA_VALID(
    '{"type":"object","additionalProperties":false,"required":[],"properties":{"ru":{"type":"string"},"en":{"type":"string"},"tr":{"type":"string"},"tm":{"type":"string"}}}',
    `title`
  ))
);
--> statement-breakpoint
CREATE INDEX `hero_slides_site_idx` ON `hero_slides` (`site`,`is_published`,`sort_order`);
--> statement-breakpoint
-- `SET NULL` rather than `CASCADE`: deleting a photograph must empty the slide, never delete it.
-- A hero that silently loses a slide when somebody tidies the media library is worse than one
-- that shows a placeholder and says which brief is unfilled.
ALTER TABLE `hero_slides`
  ADD CONSTRAINT `hero_slides_media_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE SET NULL;
