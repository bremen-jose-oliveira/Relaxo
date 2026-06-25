CREATE TABLE `sleep_pauses` (
	`id` text PRIMARY KEY NOT NULL,
	`sleep_event_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	FOREIGN KEY (`sleep_event_id`) REFERENCES `sleep_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sleep_pauses_event` ON `sleep_pauses` (`sleep_event_id`);--> statement-breakpoint
ALTER TABLE `wake_events` ADD `wake_type` text DEFAULT 'morning' NOT NULL;