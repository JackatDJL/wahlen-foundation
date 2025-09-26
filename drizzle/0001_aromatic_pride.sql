DROP VIEW "wahlen"."wahlen-view";--> statement-breakpoint
ALTER TABLE "questions"."questions" ALTER COLUMN "question_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "wahlen"."wahlen" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wahlen"."wahlen" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wahlen"."wahlen" ADD COLUMN "is_scheduled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wahlen"."wahlen" ADD COLUMN "is_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wahlen"."wahlen" ADD COLUMN "has_results" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wahlen"."wahlen" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wahlen"."wahlen" DROP COLUMN "status";--> statement-breakpoint
CREATE VIEW "wahlen"."wahlen-view" AS (select "id", "shortname", "is_active", "is_published", "is_scheduled", "is_completed", "has_results", "is_archived", "alert", "alert_message", "title", "description", "owner", "start_date", "end_date", "archive_date", "created_at", "updated_at" from "wahlen"."wahlen" order by "wahlen"."wahlen"."updated_at" desc);--> statement-breakpoint
DROP TYPE "wahlen"."status-type";