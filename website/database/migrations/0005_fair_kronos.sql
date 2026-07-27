CREATE INDEX `disregarded_observations_timestamp_idx` ON `disregarded_observations` (`timestamp`);--> statement-breakpoint
CREATE INDEX `observations_timestamp_idx` ON `observations` (`timestamp`);--> statement-breakpoint
CREATE INDEX `observations_created_at_idx` ON `observations` (`created_at`);--> statement-breakpoint
CREATE INDEX `observations_pending_export_idx` ON `observations` (`timestamp`) WHERE "observations"."exported_to_r2" = 0;