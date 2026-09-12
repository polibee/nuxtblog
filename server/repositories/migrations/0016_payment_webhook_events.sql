-- Payment webhook events (commerce doc §8.5): verified-then-processed
-- audit trail. Same provider_event_id must be processed only once.

CREATE TABLE `payment_webhook_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`gateway_key` varchar(40) NOT NULL,
	`provider_event_id` varchar(255) NOT NULL,
	`event_type` varchar(120) NOT NULL,
	`signature_verified` boolean NOT NULL DEFAULT false,
	`payload_ciphertext` text,
	`received_at` datetime(6) NOT NULL,
	`processed_at` datetime(6),
	`processing_status` varchar(30) NOT NULL DEFAULT 'received',
	`error_message` varchar(500),
	`created_at` datetime(6) NOT NULL,
	`updated_at` datetime(6) NOT NULL,
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_webhook_events_gateway_event_key` ON `payment_webhook_events` (`gateway_key`,`provider_event_id`);
--> statement-breakpoint
CREATE INDEX `payment_webhook_events_status_idx` ON `payment_webhook_events` (`processing_status`);
