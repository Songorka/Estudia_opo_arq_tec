CREATE TABLE `examAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examSessionId` int NOT NULL,
	`questionId` int NOT NULL,
	`userId` int NOT NULL,
	`selectedOption` enum('A','B','C','D','blank') NOT NULL,
	`isCorrect` boolean NOT NULL,
	`answeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `examAnswers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `examSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`topicIds` json DEFAULT ('[]'),
	`source` varchar(32) DEFAULT 'all',
	`totalQuestions` int NOT NULL DEFAULT 0,
	`penaltyPerError` varchar(16) DEFAULT '0.25',
	`correctAnswers` int NOT NULL DEFAULT 0,
	`wrongAnswers` int NOT NULL DEFAULT 0,
	`blankAnswers` int NOT NULL DEFAULT 0,
	`rawScore` varchar(16),
	`finalScore` varchar(16),
	`status` enum('in_progress','finished') NOT NULL DEFAULT 'in_progress',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `examSessions_id` PRIMARY KEY(`id`)
);
