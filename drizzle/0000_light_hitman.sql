CREATE TABLE IF NOT EXISTS `babies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birth_date` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `diaper_events` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`diaper_type` text NOT NULL,
	`time` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diaper_events_baby` ON `diaper_events` (`baby_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diaper_events_time` ON `diaper_events` (`time`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `feeding_events` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`feed_type` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`side` text,
	`amount` real,
	`unit` text,
	`notes` text,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_feeding_events_baby` ON `feeding_events` (`baby_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_feeding_events_start` ON `feeding_events` (`start_time`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sleep_events` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`type` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sleep_events_baby` ON `sleep_events` (`baby_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sleep_events_start` ON `sleep_events` (`start_time`);
