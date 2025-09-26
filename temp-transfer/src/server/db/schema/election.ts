import {
  index,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { wahlen } from "./wahlen";
import { relations, desc } from "drizzle-orm";
import { questions } from "./questions";

// Initialise a new PostgreSQL schema for all the election backend tables
export const electionSchema = pgSchema("election");

// -----------------  Enumerators  -----------------

/**
 * Election Status Types
 *
 * - draft: Election is Drafted and Private
 * - queued: Election is Public and has a Startdate
 * - active: Election is Live
 * - inactive: Election is Inactive
 * - completed: Election is Completed
 * - results: Election Results are Published
 * - archived: Election is Archived
 */
export const eligibilityStatusTypeEnum = electionSchema.enum(
  "eligibility-status-type",
  ["draft", "queued", "pending", "active", "expired"],
);

/**
 * Session Status Types
 *
 * - active: Session is Active
 * - ended: Session has Ended
 * - revoked: Session has been Revoked
 */
export const sessionStatusTypeEnum = electionSchema.enum(
  "session-status-type",
  ["active", "ended", "revoked"],
);

// -----------------  Tables  -----------------

/**
 * Session Table
 *
 * This table contains all sessions for the election.
 *
 * - id: UUID (Primary Key)
 * - wahlId: UUID (Foreign Key to Wahlen)
 * - eligibleId: UUID (Foreign Key to Eligible)
 *
 * - publicKey: Public Key (String)
 * - status: Session Status (Enum)
 *
 * - createdAt: Timestamp
 * - updatedAt: Timestamp
 * - expiresOn: Timestamp
 */
export const sessions = electionSchema.table(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    wahlId: uuid("wahl_id")
      .notNull()
      .references(() => wahlen.id, { onDelete: "cascade" }),
    eligibleId: uuid("eligible_id")
      .notNull()
      .references(() => eligible.id, { onDelete: "cascade" }), // Foreign Key zu Eligible

    publicKey: text("publicKey").notNull(),
    status: sessionStatusTypeEnum("status").default("active").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresOn: timestamp("expires_on").notNull(),
  },
  (table) => {
    return {
      wahlIdIdx: index("session_wahl_idx").on(table.wahlId),
      eligibleIdIdx: index("session_eligible_idx").on(table.eligibleId), // Index für die Eligibility
    };
  },
);

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  wahl: one(wahlen, {
    fields: [sessions.wahlId],
    references: [wahlen.id],
  }),
  eligible: one(eligible, {
    fields: [sessions.eligibleId],
    references: [eligible.id],
  }),
  stimmen: many(stimmen),
}));

// -----------------

/**
 * Eligible Table
 *
 * This table contains all eligible voters for the election.
 *
 * - id: UUID (Primary Key)
 * - wahlId: UUID (Foreign Key to Wahlen)
 *
 * - email: Email Address
 *
 * - status: Eligibility Status (Enum)
 *
 * - uid: UID (String)
 *
 * - createdAt: Timestamp
 * - updatedAt: Timestamp
 */

export const eligible = electionSchema.table(
  "eligible",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    wahlId: uuid("wahl_id")
      .notNull()
      .references(() => wahlen.id, { onDelete: "cascade" }),

    email: varchar("email", { length: 256 }).notNull(), // Only unique within one election

    status: eligibilityStatusTypeEnum("status").default("draft").notNull(),

    uid: varchar("uid", { length: 32 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      wahlIdIdx: index("eligible_wahl_idx").on(table.wahlId),
      emailIdx: index("eligible_email_idx").on(table.email),
    };
  },
);

export const eligibleRelations = relations(eligible, ({ one, many }) => ({
  wahl: one(wahlen, {
    fields: [eligible.wahlId],
    references: [wahlen.id],
  }),
  sessions: many(sessions),
}));

// -----------------

/**
 * Stimmen Table
 *
 * This table contains all votes for the election.
 *
 * - id: UUID (Primary Key)
 * - wahlId: UUID (Foreign Key to Wahlen)
 *
 * - questionId: UUID (Foreign Key to Questions)
 * - sessionId: UUID (Foreign Key to Sessions)
 *
 * - answerId: UUID (Foreign Key to Answers)
 * - signed: Signed Vote (String)
 * - signedAt: Signed At (Timestamp)
 *
 * - createdAt: Timestamp
 * - updatedAt: Timestamp
 */
export const stimmen = electionSchema.table(
  "stimmen",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    wahlId: uuid("wahl_id")
      .notNull()
      .references(() => wahlen.id, { onDelete: "cascade" }),

    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }), // Foreign Key zur Session

    answerId: uuid("answer_id").notNull(),
    signed: text("signed").notNull(),
    signedAt: timestamp("signed_at").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      wahlIdIdx: index("stimme_wahl_idx").on(table.wahlId),
      questionIdIdx: index("stimme_question_idx").on(table.questionId),
      sessionIdIdx: index("stimme_session_idx").on(table.sessionId), // Index für die Session
    };
  },
);

export const stimmenRelations = relations(stimmen, ({ one }) => ({
  wahl: one(wahlen, {
    fields: [stimmen.wahlId],
    references: [wahlen.id],
  }),
  question: one(questions, {
    fields: [stimmen.questionId],
    references: [questions.id],
  }),
  session: one(sessions, {
    fields: [stimmen.sessionId],
    references: [sessions.id],
  }),
}));

// ----------------- Views -----------------

/**
 * Eligibility View
 *
 *  This view contains all eligible voters for the election.
 *  This view provides a sorted list of eligible voters based on their last updated timestamp.
 */
export const eligibleView = electionSchema
  .view("eligible-view")
  .as((qb) => qb.select().from(eligible).orderBy(desc(eligible.updatedAt)));

// -----------------

/**
 * Sessions View
 *
 * This view provides a sorted list of all sessions based on their last updated timestamp.
 */
export const sessionsView = electionSchema
  .view("sessions-view")
  .as((qb) => qb.select().from(sessions).orderBy(desc(sessions.updatedAt)));

// -----------------

/**
 * Stimmen View
 *
 * This view provides a sorted list of all votes based on their last updated timestamp.
 */
export const stimmenView = electionSchema
  .view("stimmen-view")
  .as((qb) => qb.select().from(stimmen).orderBy(desc(stimmen.updatedAt)));
