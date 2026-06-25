CREATE TABLE `wake_events` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`time` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_wake_events_baby` ON `wake_events` (`baby_id`);--> statement-breakpoint
CREATE INDEX `idx_wake_events_time` ON `wake_events` (`time`);