import {
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { relations, desc, not, eq } from "drizzle-orm";
import { wahlen } from "./wahlen";
import { questions } from "./questions";

// Initialise a new PostgreSQL schema for the files
export const fileSchema = pgSchema("files");

// -----------------  Enumerators  -----------------

/**
 * File Types
 *
 * - logo: Logo (image)
 * - banner: Banner (image)
 * - candidate: Candidate (image)
 */
export const file_types = fileSchema.enum("file-types", [
  "logo",
  "banner",
  "candidate",
]);

/**
 * Storage Providers
 *
 * - utfs: Uploadthing
 * - blob: Vercel Blob
 *
 * Possibly s3 in the future
 */
export const fileStorage_types = fileSchema.enum("fileStorage-types", [
  "utfs",
  "blob",
]);

/**
 * File Transfer Status Types
 *
 * - idle: No transfer in progress
 * - queued: Transfer is queued
 * - in progress: Transfer is in progress
 */
export const fileTransfer_types = fileSchema.enum("fileTransfer-types", [
  "idle",
  "queued",
  "in progress",
]);

// -----------------  Tables  -----------------

/**
 * Files Table
 *
 * This table stores all files uploaded to our plattform.
 *
 * - id: UUID of the file
 * - name: Name of the file
 * - fileType: typeof file_types
 * - dataType: datatypes (the complicated long one)
 * - size: Size of the file in bytes
 *
 * - ufsKey: Uploadthing Key
 * - blobPath: Vercel Blob Path
 * - url: URL of the file
 *
 * - storedIn: typeof fileStorage_types
 * - targetStorage: typeof fileStorage_types
 * - transferStatus: typeof fileTransfer_types
 *
 * - wahlId: UUID of the election
 * - questionId: UUID of the question
 * - answerId: UUID of the answer
 * - owner: Owner of the file
 *
 * - createdAt: Timestamp of when the file was created
 * - updatedAt: Timestamp of when the file was last updated
 */
export const files = fileSchema.table("files", {
  id: uuid("id").primaryKey().defaultRandom().unique(),
  name: text("name").notNull(),
  fileType: file_types("fileType").notNull(),
  dataType: text("dataType").notNull(),
  size: integer("size").notNull(),

  ufsKey: varchar("ufs_key", { length: 48 }),
  blobPath: varchar("blob_path"),
  url: text("url").notNull(),

  storedIn: fileStorage_types("stored_in").notNull().default("utfs"),
  targetStorage: fileStorage_types("target_storage").notNull().default("blob"),
  transferStatus: fileTransfer_types("transfer_status")
    .notNull()
    .default("idle"),

  wahlId: uuid("wahl_id")
    .references(() => wahlen.id)
    .notNull(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id),
  answerId: uuid("answer_id").notNull(),
  owner: varchar("owner", { length: 32 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const filesRelations = relations(files, ({ one }) => ({
  wahl: one(wahlen, {
    fields: [files.wahlId],
    references: [wahlen.id],
  }),
  question: one(questions, {
    fields: [files.questionId],
    references: [questions.id],
  }),
}));

// ----------------- Views -----------------

/**
 * Files View
 *
 * This view shows all files uploaded to our plattform.
 * It provides a sorted list of files based on their last updated timestamp.
 */
export const filesView = fileSchema
  .view("files-view")
  .as((qb) => qb.select().from(files).orderBy(desc(files.updatedAt)));

// -----------------

/**
 * Transcending Files View
 *
 * This view shows all files that are not in idle state.
 * It provides a sorted list of files based on their last updated timestamp.
 */
export const transcendingFilesView = fileSchema
  .view("transcending-files-view")
  .as((qb) =>
    qb
      .select()
      .from(files)
      .where(not(eq(files.transferStatus, "idle")))
      .orderBy(desc(files.updatedAt)),
  );
