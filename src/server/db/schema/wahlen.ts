import {
  text,
  timestamp,
  uuid,
  varchar,
  index,
  pgSchema,
  boolean,
} from "drizzle-orm/pg-core";

import { desc, relations } from "drizzle-orm";
import { files } from "./files";
import { questions } from "./questions";
import { eligible, stimmen, sessions } from "./election";

// Initialise a new PostgreSQL schema for the elections
export const wahlenSchema = pgSchema("wahlen");

// -----------------  Enumerators  -----------------

/**
 * Election Homepage Alert Types
 *
 * - card: Card Alert
 * - info: Informational Alert
 * - warning: Warning Alert
 * - error: Error Alert
 */
export const alertTypeEnum = wahlenSchema.enum("alert-type", [
  "card",
  "info",
  "warning",
  "error",
]);

// -----------------  Tables  -----------------

/**
 * Election Table
 *
 * This table contains all elections and their metadata.
 *
 * - id: Election ID
 * - shortname: Election Shortname (accessible under shortname.wahl.djl.foundation)
 * - status: Election Status typeof statusTypeEnum
 *
 * - alert: Election Alert Type typeof alertTypeEnum
 * - alertMessage: Election Alert Message
 *
 * - title: Election Title
 * - description: Election Description
 *
 * - owner: Election Owner userId
 *
 * - startDate: Election Start Date
 * - endDate: Election End Date
 * - archiveDate: Election Archive Date
 *
 * - createdAt: Election Created Date
 * - updatedAt: Election Updated Date
 *
 */
export const wahlen = wahlenSchema.table(
  "wahlen",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    shortname: varchar("shortname", { length: 25 }).notNull().unique(),

    isActive: boolean("is_active").default(false).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    isScheduled: boolean("is_scheduled").default(false).notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    hasResults: boolean("has_results").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),

    alert: alertTypeEnum("alert"),
    alertMessage: text("alert_message"),

    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),

    owner: varchar("owner", { length: 32 }).notNull(),

    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    archiveDate: timestamp("archive_date"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    idIdx: index("wahlen_idx").on(table.id),
    ownerIdx: index("wahlen_owner_idx").on(table.owner),
    shortnameIdx: index("wahlen_shortname_idx").on(table.shortname),
  }),
);

export const wahlenRelations = relations(wahlen, ({ many }) => ({
  questions: many(questions),
  eligible: many(eligible),
  stimmen: many(stimmen),
  sessions: many(sessions),
  files: many(files),
}));

// ----------------- Views -----------------

/**
 * Election View
 *
 * This view provides a sorted list of elections based on their last updated timestamp.
 */
export const wahlenView = wahlenSchema
  .view("wahlen-view")
  .as((qb) => qb.select().from(wahlen).orderBy(desc(wahlen.updatedAt)));
