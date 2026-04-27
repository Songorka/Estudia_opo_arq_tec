ALTER TABLE `examSessions` MODIFY COLUMN `status` varchar(16) NOT NULL DEFAULT 'in_progress';--> statement-breakpoint
ALTER TABLE `documents` ADD `topicId` int;