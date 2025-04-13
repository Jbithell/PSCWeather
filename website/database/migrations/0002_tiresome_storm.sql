PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`data` text NOT NULL,
	`exported_to_r2` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_observations`("id", "timestamp", "created_at", "data", "exported_to_r2") SELECT "id", "timestamp", "created_at", "data", "exported_to_r2" FROM `observations`;--> statement-breakpoint
DROP TABLE `observations`;--> statement-breakpoint
ALTER TABLE `__new_observations` RENAME TO `observations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;