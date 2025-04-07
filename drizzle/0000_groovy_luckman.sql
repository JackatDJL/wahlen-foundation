CREATE SCHEMA "election";
--> statement-breakpoint
CREATE SCHEMA "files";
--> statement-breakpoint
CREATE SCHEMA "questions";
--> statement-breakpoint
CREATE SCHEMA "wahlen";
--> statement-breakpoint
CREATE TYPE "election"."eligibility-status-type" AS ENUM('draft', 'queued', 'pending', 'active', 'expired');--> statement-breakpoint
CREATE TYPE "election"."session-status-type" AS ENUM('active', 'ended', 'revoked');--> statement-breakpoint
CREATE TYPE "files"."fileStorage-types" AS ENUM('utfs', 'blob');--> statement-breakpoint
CREATE TYPE "files"."fileTransfer-types" AS ENUM('idle', 'queued', 'in progress');--> statement-breakpoint
CREATE TYPE "files"."file-types" AS ENUM('logo', 'banner', 'candidate');--> statement-breakpoint
CREATE TYPE "questions"."types" AS ENUM('info', 'true_false', 'multiple_choice');--> statement-breakpoint
CREATE TYPE "wahlen"."alert-type" AS ENUM('card', 'info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "wahlen"."status-type" AS ENUM('draft', 'queued', 'active', 'inactive', 'completed', 'results', 'archived');--> statement-breakpoint
CREATE TABLE "election"."eligible" (
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
CREATE TABLE "election"."sessions" (
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
CREATE TABLE "election"."stimmen" (
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
CREATE TABLE "files"."files" (
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
CREATE TABLE "questions"."info" (
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
CREATE TABLE "questions"."multiple-choice" (
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
CREATE TABLE "questions"."true-false" (
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
CREATE TABLE "questions"."questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wahl_id" uuid NOT NULL,
	"type" "questions"."types" NOT NULL,
	"question_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "questions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "wahlen"."wahlen" (
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
ALTER TABLE "election"."eligible" ADD CONSTRAINT "eligible_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election"."sessions" ADD CONSTRAINT "sessions_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election"."sessions" ADD CONSTRAINT "sessions_eligible_id_eligible_id_fk" FOREIGN KEY ("eligible_id") REFERENCES "election"."eligible"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election"."stimmen" ADD CONSTRAINT "stimmen_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election"."stimmen" ADD CONSTRAINT "stimmen_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election"."stimmen" ADD CONSTRAINT "stimmen_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "election"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files"."files" ADD CONSTRAINT "files_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files"."files" ADD CONSTRAINT "files_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions"."info" ADD CONSTRAINT "info_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions"."info" ADD CONSTRAINT "info_image_files_id_fk" FOREIGN KEY ("image") REFERENCES "files"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions"."multiple-choice" ADD CONSTRAINT "multiple-choice_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions"."true-false" ADD CONSTRAINT "true-false_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions"."true-false" ADD CONSTRAINT "true-false_o1_image_files_id_fk" FOREIGN KEY ("o1_image") REFERENCES "files"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions"."true-false" ADD CONSTRAINT "true-false_o2_image_files_id_fk" FOREIGN KEY ("o2_image") REFERENCES "files"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions"."questions" ADD CONSTRAINT "questions_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "wahlen"."wahlen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eligible_wahl_idx" ON "election"."eligible" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX "eligible_email_idx" ON "election"."eligible" USING btree ("email");--> statement-breakpoint
CREATE INDEX "session_wahl_idx" ON "election"."sessions" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX "session_eligible_idx" ON "election"."sessions" USING btree ("eligible_id");--> statement-breakpoint
CREATE INDEX "stimme_wahl_idx" ON "election"."stimmen" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX "stimme_question_idx" ON "election"."stimmen" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "stimme_session_idx" ON "election"."stimmen" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "file_wahl_idx" ON "files"."files" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX "file_question_idx" ON "files"."files" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "file_type_idx" ON "files"."files" USING btree ("fileType");--> statement-breakpoint
CREATE INDEX "file_transfer_status_idx" ON "files"."files" USING btree ("transfer_status");--> statement-breakpoint
CREATE INDEX "q-multiple-choice_question_idx" ON "questions"."multiple-choice" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "q-true-false_question_idx" ON "questions"."true-false" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_wahl_idx" ON "questions"."questions" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX "wahlen_idx" ON "wahlen"."wahlen" USING btree ("id");--> statement-breakpoint
CREATE INDEX "wahlen_owner_idx" ON "wahlen"."wahlen" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "wahlen_shortname_idx" ON "wahlen"."wahlen" USING btree ("shortname");--> statement-breakpoint
CREATE VIEW "election"."eligible-view" AS (select "id", "wahl_id", "email", "status", "uid", "created_at", "updated_at" from "election"."eligible" order by "election"."eligible"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "election"."sessions-view" AS (select "id", "wahl_id", "eligible_id", "publicKey", "status", "created_at", "updated_at", "expires_on" from "election"."sessions" order by "election"."sessions"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "election"."stimmen-view" AS (select "id", "wahl_id", "question_id", "session_id", "answer_id", "signed", "signed_at", "created_at", "updated_at" from "election"."stimmen" order by "election"."stimmen"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "files"."files-view" AS (select "id", "name", "fileType", "dataType", "size", "ufs_key", "blob_path", "url", "stored_in", "target_storage", "transfer_status", "wahl_id", "question_id", "answer_id", "owner", "created_at", "updated_at" from "files"."files" order by "files"."files"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "files"."transcending-files-view" AS (select "id", "name", "fileType", "dataType", "size", "ufs_key", "blob_path", "url", "stored_in", "target_storage", "transfer_status", "wahl_id", "question_id", "answer_id", "owner", "created_at", "updated_at" from "files"."files" where not "files"."files"."transfer_status" = 'idle' order by "files"."files"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "questions"."info-view" AS (select "id", "question_id", "title", "description", "image", "created_at", "updated_at" from "questions"."info" order by "questions"."info"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "questions"."multiple-choice-view" AS (select "id", "question_id", "title", "description", "content", "created_at", "updated_at" from "questions"."multiple-choice" order by "questions"."multiple-choice"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "questions"."true-false-view" AS (select "id", "question_id", "title", "description", "o1_id", "o1_title", "o1_description", "o1_correct", "o1_colour", "o1_image", "o2_id", "o2_title", "o2_description", "o2_correct", "o2_colour", "o2_image", "created_at", "updated_at" from "questions"."true-false" order by "questions"."true-false"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "questions"."questions-view" AS (select "id", "wahl_id", "type", "question_id", "created_at", "updated_at" from "questions"."questions" order by "questions"."questions"."updated_at" desc);--> statement-breakpoint
CREATE VIEW "wahlen"."wahlen-view" AS (select "id", "shortname", "status", "alert", "alert_message", "title", "description", "owner", "start_date", "end_date", "archive_date", "created_at", "updated_at" from "wahlen"."wahlen" order by "wahlen"."wahlen"."updated_at" desc);