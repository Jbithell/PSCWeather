CREATE TABLE `heartbeats` (
	`hour_start_timestamp` integer PRIMARY KEY NOT NULL,
	`ping_count` integer DEFAULT 0 NOT NULL
);
