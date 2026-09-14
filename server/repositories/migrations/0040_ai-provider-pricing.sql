/* Idempotent repair because some local databases may have received the
   columns manually while recovering from a failed application start. */
CREATE PROCEDURE `__repair_ai_provider_pricing`()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'ai_providers' AND column_name = 'input_price_micros_per_million') THEN ALTER TABLE `ai_providers` ADD `input_price_micros_per_million` bigint NOT NULL DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'ai_providers' AND column_name = 'output_price_micros_per_million') THEN ALTER TABLE `ai_providers` ADD `output_price_micros_per_million` bigint NOT NULL DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'ai_providers' AND column_name = 'cache_hit_price_micros_per_million') THEN ALTER TABLE `ai_providers` ADD `cache_hit_price_micros_per_million` bigint NOT NULL DEFAULT 0; END IF;
END;
--> statement-breakpoint
CALL `__repair_ai_provider_pricing`();
--> statement-breakpoint
DROP PROCEDURE `__repair_ai_provider_pricing`;
