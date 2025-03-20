ALTER TABLE "files" ALTER COLUMN "question_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "answer_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "q-info" ADD COLUMN "image" uuid;--> statement-breakpoint
ALTER TABLE "q-true-false" ADD COLUMN "o1_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "q-true-false" ADD COLUMN "o2_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "question_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "q-info" ADD CONSTRAINT "q-info_image_files_id_fk" FOREIGN KEY ("image") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
