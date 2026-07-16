ALTER TABLE `daily_chores` ADD `reminder_minutes` integer;
--> statement-breakpoint
UPDATE `daily_chores` SET `reminder_minutes` = 1080 WHERE `recurrence` = 'daily' AND `reminder_minutes` IS NULL;
