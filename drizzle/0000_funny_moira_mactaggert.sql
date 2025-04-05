CREATE SCHEMA "election";
--> statement-breakpoint
CREATE SCHEMA "files";
--> statement-breakpoint
CREATE SCHEMA "questions";
--> statement-breakpoint
CREATE SCHEMA "wahlen";
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "election"."eligibility-status-type" AS ENUM('draft', 'queued', 'pending', 'active', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "election"."session-status-type" AS ENUM('active', 'ended', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "files"."fileStorage-types" AS ENUM('utfs', 'blob');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "files"."fileTransfer-types" AS ENUM('idle', 'queued', 'in progress');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "files"."file-types" AS ENUM('logo', 'banner', 'candidate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "questions"."types" AS ENUM('info', 'true_false', 'multiple_choice');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "wahlen"."alert-type" AS ENUM('card', 'info', 'warning', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "wahlen"."status-type" AS ENUM('draft', 'queued', 'active', 'inactive', 'completed', 'results', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "election"."eligible" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wahl_id" uuid NOT NULL,
	"email" varchar(256) NOT NULL,
	"status" "election"."eligibility-status-type" DEFAULT 'draft' NOT NULL,
	"uid" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eligible_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "election"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wahl_id" uuid NOT NULL,
	"eligible_id" uuid NOT NULL,
	"publicKey" text NOT NULL,
	"status" "election"."session-status-type" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_on" timestamp NOT NULL,
	CONSTRAINT "sessions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "election"."stimmen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wahl_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"answer_id" uuid NOT NULL,
	"signed" text NOT NULL,
	"signed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stimmen_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files"."files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"fileType" "files"."file-types" NOT NULL,
	"dataType" text NOT NULL,
	"size" integer NOT NULL,
	"ufs_key" varchar(48),
	"blob_path" varchar,
	"url" text NOT NULL,
	"stored_in" "files"."fileStorage-types" DEFAULT 'utfs' NOT NULL,
	"target_storage" "files"."fileStorage-types" DEFAULT 'blob' NOT NULL,
	"transfer_status" "files"."fileTransfer-types" DEFAULT 'idle' NOT NULL,
	"wahl_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_id" uuid NOT NULL,
	"owner" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "files_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions"."info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"image" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "info_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions"."multiple-choice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "multiple-choice_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions"."true-false" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"o1_id" uuid NOT NULL,
	"o1_title" varchar(256) NOT NULL,
	"o1_description" text,
	"o1_correct" boolean DEFAULT false NOT NULL,
	"o1_colour" varchar(7),
	"o1_image" uuid,
	"o2_id" uuid NOT NULL,
	"o2_title" varchar(256) NOT NULL,
	"o2_description" text,
	"o2_correct" boolean DEFAULT false NOT NULL,
	"o2_colour" varchar(7),
	"o2_image" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "true-false_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions"."questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wahl_id" uuid NOT NULL,
	"type" "questions"."types" NOT NULL,
	"question_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "questions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wahlen"."wahlen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shortname" varchar(25) NOT NULL,
	"status" "wahlen"."status-type" DEFAULT 'draft' NOT NULL,
	"alert" "wahlen"."alert-type",
	"alert_message" text,
	"title" varchar(256) NOT NULL,
	"description" text,
	"owner" varchar(32) NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"archive_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wahlen_id_unique" UNIQUE("id"),
	CONSTRAINT "wahlen_shortname_unique" UNIQUE("shortname")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "election"."eligible" ADD CONSTRAINT "eligible_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "election"."sessions" ADD CONSTRAINT "sessions_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "election"."sessions" ADD CONSTRAINT "sessions_eligible_id_eligible_id_fk" FOREIGN KEY ("eligible_id") REFERENCES "election"."eligible"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "election"."stimmen" ADD CONSTRAINT "stimmen_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "election"."stimmen" ADD CONSTRAINT "stimmen_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "election"."stimmen" ADD CONSTRAINT "stimmen_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "election"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files"."files" ADD CONSTRAINT "files_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files"."files" ADD CONSTRAINT "files_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions"."info" ADD CONSTRAINT "info_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions"."info" ADD CONSTRAINT "info_image_files_id_fk" FOREIGN KEY ("image") REFERENCES "files"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions"."multiple-choice" ADD CONSTRAINT "multiple-choice_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions"."true-false" ADD CONSTRAINT "true-false_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions"."true-false" ADD CONSTRAINT "true-false_o1_image_files_id_fk" FOREIGN KEY ("o1_image") REFERENCES "files"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions"."true-false" ADD CONSTRAINT "true-false_o2_image_files_id_fk" FOREIGN KEY ("o2_image") REFERENCES "files"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions"."questions" ADD CONSTRAINT "questions_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eligible_wahl_idx" ON "election"."eligible" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eligible_email_idx" ON "election"."eligible" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_wahl_idx" ON "election"."sessions" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_eligible_idx" ON "election"."sessions" USING btree ("eligible_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stimme_wahl_idx" ON "election"."stimmen" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stimme_question_idx" ON "election"."stimmen" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stimme_session_idx" ON "election"."stimmen" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_wahl_idx" ON "files"."files" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_question_idx" ON "files"."files" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_type_idx" ON "files"."files" USING btree ("fileType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_transfer_status_idx" ON "files"."files" USING btree ("transfer_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "q-multiple-choice_question_idx" ON "questions"."multiple-choice" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "q-true-false_question_idx" ON "questions"."true-false" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_wahl_idx" ON "questions"."questions" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wahlen_idx" ON "wahlen"."wahlen" USING btree ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wahlen_owner_idx" ON "wahlen"."wahlen" USING btree ("owner");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wahlen_shortname_idx" ON "wahlen"."wahlen" USING btree ("shortname");