ALTER TABLE "eligible" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "stimmen" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "wahlen" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "eligible" ADD CONSTRAINT "eligible_id_unique" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_id_unique" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_id_unique" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "stimmen" ADD CONSTRAINT "stimmen_id_unique" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "wahlen" ADD CONSTRAINT "wahlen_id_unique" UNIQUE("id");