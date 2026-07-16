-- Local sync metadata (household link + last successful sync)
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text,
	`invite_code` text,
	`last_synced_at` text
);
--> statement-breakpoint
INSERT INTO `sync_state` (`id`, `household_id`, `invite_code`, `last_synced_at`)
VALUES ('default', NULL, NULL, NULL);
