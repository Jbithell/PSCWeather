CREATE TABLE `upload_state` (
	`target` text PRIMARY KEY NOT NULL,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`last_error` text
);
