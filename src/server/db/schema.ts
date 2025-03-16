import {
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -----------------  Enumerators  -----------------

/**
 * Types of Questions
 *
 * - info: Informational question
 * - true_false: True or False question
 * - multiple_choice: Multiple choice question
 *
 */
export const questionTypeEnum = pgEnum("question_type", [
  "info",
  "true_false",
  "multiple_choice",
]);

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
export const statusTypeEnum = pgEnum("status_type", [
  "draft",
  "queued",
  "active",
  "inactive",
  "completed",
  "results",
  "archived",
]);

/**
 * Election Homepage Alert Types
 *
 * - card: Card Alert
 * - info: Informational Alert
 * - warning: Warning Alert
 * - error: Error Alert
 */
export const alertTypeEnum = pgEnum("alert_type", [
  "card",
  "info",
  "warning",
  "error",
]);

/**
 * Types of Eligibility Status
 *
 * - draft: Email is saved but Election isnt Public
 * - queued: Cron is Queued to check Email with existing users
 * - pending: Waiting for User with Email to Signup
 * - active: Eligibility is bound to a UserId
 * - expired: Election is Live but user hasnt signed up, right to vote is lost
 */
export const eligibilityStatusTypeEnum = pgEnum("eligibility_status_type", [
  "draft",
  "queued",
  "pending",
  "active",
  "expired",
]);

/**
 * Types of Session Status
 *
 * - active: Session has ben Created is being Used
 * - ended: Past expiration Date or User done voting
 * - revoked: Session has been Revoked
 */
export const sessionStatusTypeEnum = pgEnum("session_status_type", [
  "active",
  "ended",
  "revoked",
]);

// -----------------  Tables  -----------------

/**
 * Election Table
 *
 * - id: Election ID
 * - shortname: Election Shortname (acessible under shortname.wahl.djl.foundation)
 * - status: Election Status @inherit statusTypeEnum
 *#
 * - alert: Election Alert Type @inherit alertTypeEnum
 * - alertMessage: Election Alert Message
 *#
 * - title: Election Title
 * - description: Election Description
 *#
 * - owner: Election Owner userId
 *#
 * - startDate: Election Start Date
 * - endDate: Election End Date
 * - archiveDate: Election Archive Date
 *#
 * - createdAt: Election Created Date
 * - updatedAt: Election Updated Date
 *
 */
export const wahlen = pgTable(
  "wahlen",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    shortname: varchar("shortname", { length: 25 }).notNull().unique(),
    status: statusTypeEnum("status").default("draft").notNull(),

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
}));

// -----------------

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    wahlId: uuid("wahl_id")
      .notNull()
      .references(() => wahlen.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 256 }).notNull(),

    type: questionTypeEnum("type").notNull(),

    options: jsonb("options"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      wahlIdIdx: index("question_wahl_idx").on(table.wahlId),
    };
  },
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  wahl: one(wahlen, {
    fields: [questions.wahlId],
    references: [wahlen.id],
  }),
  stimmen: many(stimmen),
}));

// -----------------

export const eligible = pgTable(
  "eligible",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    wahlId: uuid("wahl_id")
      .notNull()
      .references(() => wahlen.id, { onDelete: "cascade" }),

    email: varchar("email", { length: 256 }).notNull().unique(),

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

export const stimmen = pgTable(
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

    answer: jsonb("answer").notNull(),
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

// -----------------

export const sessions = pgTable(
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
