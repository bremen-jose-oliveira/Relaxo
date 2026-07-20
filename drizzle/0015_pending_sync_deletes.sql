CREATE TABLE `pending_sync_deletes` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`created_at` text NOT NULL
);
