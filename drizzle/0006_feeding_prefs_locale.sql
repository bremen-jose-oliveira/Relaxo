ALTER TABLE `babies` ADD `track_feeding_duration` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
INSERT INTO `app_settings` (`id`, `locale`) VALUES ('default', 'system');
