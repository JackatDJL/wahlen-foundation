DO $$ BEGIN
 CREATE TYPE "public"."alert_type" AS ENUM('card', 'info', 'warning', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."eligibility_status_type" AS ENUM('draft', 'queued', 'pending', 'active', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."question_type" AS ENUM('info', 'true_false', 'multiple_choice');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."session_status_type" AS ENUM('active', 'ended', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."status_type" AS ENUM('draft', 'queued', 'active', 'inactive', 'completed', 'results', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eligible" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wahl_id" uuid NOT NULL,
	"email" varchar(256) NOT NULL,
	"status" "eligibility_status_type" DEFAULT 'draft' NOT NULL,
	"uid" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eligible_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wahl_id" uuid NOT NULL,
	"title" varchar(256) NOT NULL,
	"type" "question_type" NOT NULL,
	"options" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wahl_id" uuid NOT NULL,
	"eligible_id" uuid NOT NULL,
	"publicKey" text NOT NULL,
	"status" "session_status_type" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_on" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stimmen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wahl_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"answer" jsonb NOT NULL,
	"signed" text NOT NULL,
	"signed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wahlen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shortname" varchar(25) NOT NULL,
	"status" "status_type" DEFAULT 'draft' NOT NULL,
	"alert" "alert_type",
	"alert_message" text,
	"title" varchar(256) NOT NULL,
	"description" text,
	"owner" varchar(32) NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"archive_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wahlen_shortname_unique" UNIQUE("shortname")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eligible" ADD CONSTRAINT "eligible_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "public"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "public"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "public"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_eligible_id_eligible_id_fk" FOREIGN KEY ("eligible_id") REFERENCES "public"."eligible"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stimmen" ADD CONSTRAINT "stimmen_wahl_id_wahlen_id_fk" FOREIGN KEY ("wahl_id") REFERENCES "public"."wahlen"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stimmen" ADD CONSTRAINT "stimmen_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stimmen" ADD CONSTRAINT "stimmen_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eligible_wahl_idx" ON "eligible" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eligible_email_idx" ON "eligible" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_wahl_idx" ON "questions" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_wahl_idx" ON "sessions" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_eligible_idx" ON "sessions" USING btree ("eligible_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stimme_wahl_idx" ON "stimmen" USING btree ("wahl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stimme_question_idx" ON "stimmen" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stimme_session_idx" ON "stimmen" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wahlen_idx" ON "wahlen" USING btree ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wahlen_owner_idx" ON "wahlen" USING btree ("owner");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wahlen_shortname_idx" ON "wahlen" USING btree ("shortname");