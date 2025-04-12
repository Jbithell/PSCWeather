CREATE TABLE `DisregardedObservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`data` text,
	`disregardReasonFriendly` text NOT NULL,
	`disregardReasonDetailed` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`data` text
);
