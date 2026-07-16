ALTER TABLE `sleep_events` ADD `extension` text;
--> statement-breakpoint
CREATE TABLE `day_context_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`date_key` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_day_context_tags_baby` ON `day_context_tags` (`baby_id`);
--> statement-breakpoint
CREATE INDEX `idx_day_context_tags_date` ON `day_context_tags` (`date_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_day_context_tags_unique` ON `day_context_tags` (`baby_id`,`date_key`,`tag`);
