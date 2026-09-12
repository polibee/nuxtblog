CREATE TABLE `deliveries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`order_item_id` bigint NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`reveal_count` int NOT NULL DEFAULT 0,
	`first_revealed_at` datetime(6),
	`last_revealed_at` datetime(6),
	`delivered_at` datetime(6),
	`revoked_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`product_id` bigint NOT NULL,
	`product_alias_snapshot` varchar(120) NOT NULL,
	`product_title_snapshot` varchar(255) NOT NULL,
	`product_type_snapshot` varchar(30) NOT NULL,
	`unit_amount_minor` bigint NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`total_amount_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`fulfillment_status` varchar(30) NOT NULL DEFAULT 'pending',
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_number` varchar(30) NOT NULL,
	`user_id` bigint,
	`email` varchar(255) NOT NULL,
	`locale_id` bigint NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`subtotal_minor` bigint NOT NULL DEFAULT 0,
	`discount_minor` bigint NOT NULL DEFAULT 0,
	`fee_minor` bigint NOT NULL DEFAULT 0,
	`total_minor` bigint NOT NULL DEFAULT 0,
	`status` varchar(30) NOT NULL DEFAULT 'pending_payment',
	`payment_status` varchar(30) NOT NULL DEFAULT 'unpaid',
	`fulfillment_status` varchar(30) NOT NULL DEFAULT 'pending',
	`expires_at` datetime(6),
	`paid_at` datetime(6),
	`fulfilled_at` datetime(6),
	`canceled_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_key` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`transaction_number` varchar(30) NOT NULL,
	`order_id` bigint,
	`payment_attempt_id` bigint,
	`gateway_key` varchar(40),
	`type` varchar(20) NOT NULL,
	`status` varchar(20) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`provider_transaction_id` varchar(255),
	`provider_event_id` varchar(255),
	`occurred_at` datetime(6) NOT NULL,
	`description` varchar(500),
	`created_by` bigint,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `financial_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_transactions_number_key` UNIQUE(`transaction_number`)
);
--> statement-breakpoint
CREATE TABLE `payment_attempts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`gateway_key` varchar(40) NOT NULL,
	`idempotency_key` varchar(120) NOT NULL,
	`provider_order_id` varchar(255),
	`provider_payment_id` varchar(255),
	`provider_capture_id` varchar(255),
	`status` varchar(30) NOT NULL DEFAULT 'created',
	`amount_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`approval_url` varchar(2048),
	`failure_code` varchar(60),
	`failure_message` varchar(500),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `payment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_attempts_idempotency_key` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `payment_gateways` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key` varchar(40) NOT NULL,
	`provider_key` varchar(40) NOT NULL,
	`display_name` varchar(80) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`mode` varchar(20) NOT NULL DEFAULT 'sandbox',
	`sort_order` int NOT NULL DEFAULT 0,
	`config_ciphertext` text,
	`config_nonce` varchar(64),
	`config_auth_tag` varchar(64),
	`key_version` int NOT NULL DEFAULT 1,
	`enabled_currencies` varchar(200),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `payment_gateways_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_gateways_key_key` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `inventory_batches` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`batch_name` varchar(120) NOT NULL,
	`source` varchar(120),
	`imported_count` int NOT NULL DEFAULT 0,
	`valid_count` int NOT NULL DEFAULT 0,
	`duplicate_count` int NOT NULL DEFAULT 0,
	`invalid_count` int NOT NULL DEFAULT 0,
	`created_by` bigint NOT NULL,
	`notes` text,
	`created_at` datetime(6) NOT NULL,
	CONSTRAINT `inventory_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`batch_id` bigint NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'available',
	`secret_ciphertext` text NOT NULL,
	`secret_nonce` varchar(64) NOT NULL,
	`secret_auth_tag` varchar(64) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`reserved_until` datetime(6),
	`order_id` bigint,
	`delivered_at` datetime(6),
	`revoked_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `inventory_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_items_fingerprint_key` UNIQUE(`product_id`,`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `product_prices` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`compare_amount_minor` bigint,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `product_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_prices_product_currency_key` UNIQUE(`product_id`,`currency`)
);
--> statement-breakpoint
CREATE TABLE `product_translations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`locale_id` bigint NOT NULL,
	`title` varchar(255) NOT NULL,
	`short_description` varchar(500),
	`description` text,
	`seo_title` varchar(255),
	`seo_description` varchar(500),
	`cover_media_id` bigint,
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `product_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_translations_product_locale_key` UNIQUE(`product_id`,`locale_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`alias` varchar(120) NOT NULL,
	`product_type` varchar(30) NOT NULL DEFAULT 'card_key',
	`delivery_strategy` varchar(30) NOT NULL DEFAULT 'one_time_reveal',
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`visibility` varchar(20) NOT NULL DEFAULT 'public',
	`is_visible_when_oos` boolean NOT NULL DEFAULT true,
	`max_quantity_per_order` int NOT NULL DEFAULT 1,
	`max_quantity_per_user` int,
	`primary_locale_id` bigint NOT NULL,
	`created_by` bigint NOT NULL,
	`deleted_at` datetime(6),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_alias_key` UNIQUE(`alias`)
);
--> statement-breakpoint
ALTER TABLE `analytics_events` MODIFY COLUMN `path` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `deliveries` ADD CONSTRAINT `deliveries_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveries` ADD CONSTRAINT `deliveries_order_item_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_batch_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_prices` ADD CONSTRAINT `product_prices_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_translations` ADD CONSTRAINT `product_translations_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_translations` ADD CONSTRAINT `product_translations_locale_id_fk` FOREIGN KEY (`locale_id`) REFERENCES `locales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_primary_locale_id_fk` FOREIGN KEY (`primary_locale_id`) REFERENCES `locales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `deliveries_order_idx` ON `deliveries` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE INDEX `financial_transactions_order_idx` ON `financial_transactions` (`order_id`);--> statement-breakpoint
CREATE INDEX `financial_transactions_type_idx` ON `financial_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `payment_attempts_order_idx` ON `payment_attempts` (`order_id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_status_idx` ON `payment_attempts` (`status`);--> statement-breakpoint
CREATE INDEX `payment_gateways_enabled_idx` ON `payment_gateways` (`enabled`);--> statement-breakpoint
CREATE INDEX `inventory_batches_product_idx` ON `inventory_batches` (`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_items_product_status_idx` ON `inventory_items` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `inventory_items_batch_idx` ON `inventory_items` (`batch_id`);--> statement-breakpoint
CREATE INDEX `product_translations_locale_idx` ON `product_translations` (`locale_id`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
CREATE INDEX `products_type_idx` ON `products` (`product_type`);