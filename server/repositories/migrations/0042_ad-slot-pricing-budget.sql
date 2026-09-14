ALTER TABLE `ad_slots`
  ADD COLUMN `billing_unit` varchar(10) NOT NULL DEFAULT 'day' AFTER `enabled`,
  ADD COLUMN `price_minor` bigint NOT NULL DEFAULT 0 AFTER `billing_unit`,
  ADD COLUMN `currency` varchar(8) NOT NULL DEFAULT 'USD' AFTER `price_minor`;
--> statement-breakpoint
ALTER TABLE `ad_campaigns`
  ADD COLUMN `spent_minor` bigint NOT NULL DEFAULT 0 AFTER `budget_minor`,
  ADD COLUMN `billing_unit` varchar(10) NOT NULL DEFAULT 'day' AFTER `spent_minor`,
  ADD COLUMN `billing_units` int NOT NULL DEFAULT 1 AFTER `billing_unit`,
  ADD COLUMN `unit_price_minor` bigint NOT NULL DEFAULT 0 AFTER `billing_units`,
  ADD COLUMN `last_billed_at` datetime(6) NULL AFTER `unit_price_minor`;
