ALTER TABLE `babies` ADD `easily_overstimulated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `babies` ADD `high_need` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `daily_chores` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_daily_chores_baby` ON `daily_chores` (`baby_id`);--> statement-breakpoint
CREATE TABLE `daily_chore_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`chore_id` text NOT NULL,
	`date_key` text NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`chore_id`) REFERENCES `daily_chores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_chore_completions_chore` ON `daily_chore_completions` (`chore_id`);--> statement-breakpoint
CREATE INDEX `idx_chore_completions_date` ON `daily_chore_completions` (`date_key`);
