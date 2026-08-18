-- An option that cannot be combined with the others on its step.
--
-- The food step is multiple-choice, and its six answers are not all the same kind of thing.
-- «Халяль», «Вегетарианское» and «Без глютена» are restrictions; «Национальная кухня» and
-- «Европейская» are preferences; and «Без питания» is the absence of the question. Nothing
-- stopped a visitor choosing «Без питания» together with «Халяль», which is a request for
-- halal food and for no food.
--
-- Kept as a column rather than a rule about `food_none` in the browser, for the same reason
-- the option codes are stable ASCII (D-10): the builder's vocabulary lives in the database and
-- is edited from the admin, so a seventh option that is also exclusive must not require a
-- deploy. Defaults to false, so every existing row keeps behaving exactly as it did.

ALTER TABLE `builder_options`
  ADD COLUMN `is_exclusive` BOOLEAN NOT NULL DEFAULT FALSE AFTER `modifier_type`;
--> statement-breakpoint
-- «Без питания» is the only one today.
UPDATE `builder_options` SET `is_exclusive` = TRUE WHERE `code` = 'food_none';
