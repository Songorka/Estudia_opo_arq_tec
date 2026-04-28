ALTER TABLE `practiceSessions` ADD `aiSource` enum('topics','external');--> statement-breakpoint
ALTER TABLE `topics` ADD `hidden` boolean DEFAULT false NOT NULL;