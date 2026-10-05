CREATE TABLE `todos` (
	`id` text PRIMARY KEY,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT `fk_todos_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "todos_completed_at_iff_done" CHECK(("done" = 1) = ("completed_at" is not null))
);
--> statement-breakpoint
CREATE INDEX `todos_owner_id_idx` ON `todos` (`owner_id`);