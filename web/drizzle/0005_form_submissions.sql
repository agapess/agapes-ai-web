CREATE TABLE IF NOT EXISTS `form_submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `page_id` text,
  `data` text NOT NULL DEFAULT '{}',
  `submitted_at` integer NOT NULL DEFAULT (unixepoch())
);
