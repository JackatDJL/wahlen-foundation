import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  jsonb,
  index,
  integer,
  pgView,
} from "drizzle-orm/pg-core";
import { desc, eq, not, or, relations } from "drizzle-orm";

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

/**
 * File Types
 */
export const file_types = pgEnum("file_types", ["logo", "banner", "candidate"]);

/**
 * Storage Providers
 */
export const fileStorage_types = pgEnum("fileStorage_types", [
  "utfs", // Uploadthing // utfs.io
  "blob", // Vercel Blob
  // Possibly s3 in the future
]);

/**
 * Storage Transfer Types
 */
export const fileTransfer_types = pgEnum("fileTransfer_types", [
  "idle",
  "queued",
  "in progress",
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
  files: many(files),
}));

// -----------------

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    wahlId: uuid("wahl_id")
      .notNull()
      .references(() => wahlen.id, { onDelete: "cascade" }),

    type: questionTypeEnum("type").notNull(),
    questionId: uuid("question_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    wahlIdIdx: index("question_wahl_idx").on(table.wahlId),
  }),
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  wahl: one(wahlen, {
    fields: [questions.wahlId],
    references: [wahlen.id],
  }),
  questionInfo: one(questionInfo),
  questionTrueFalse: one(questionTrueFalse),
  questionMultipleChoice: one(questionMultipleChoice),

  stimmen: many(stimmen),
}));

// -----------------

export const questionInfo = pgTable("q-info", {
  id: uuid("id").primaryKey().defaultRandom().unique(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),

  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  image: uuid("image").references(() => files.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const questionInfoRelations = relations(questionInfo, ({ one }) => ({
  question: one(questions, {
    fields: [questionInfo.questionId],
    references: [questions.id],
  }),
  files: one(files, {
    fields: [questionInfo.image],
    references: [files.id],
  }),
}));

export const questionTrueFalse = pgTable(
  "q-true-false",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),

    o1Id: uuid("o1_id").notNull(),
    o1Title: varchar("o1_title", { length: 256 }).notNull(),
    o1Description: text("o1_description"),
    o1Correct: boolean("o1_correct").default(false).notNull(),
    o1Colour: varchar("o1_colour", { length: 7 }),
    o1Image: uuid("o1_image").references(() => files.id, {
      onDelete: "set null",
    }),

    o2Id: uuid("o2_id").notNull(),
    o2Title: varchar("o2_title", { length: 256 }).notNull(),
    o2Description: text("o2_description"),
    o2Correct: boolean("o2_correct").default(false).notNull(),
    o2Colour: varchar("o2_colour", { length: 7 }),
    o2Image: uuid("o2_image").references(() => files.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    questionIdIdx: index("q-true-false_question_idx").on(table.questionId),
  }),
);

export const questionTrueFalseRelations = relations(
  questionTrueFalse,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionTrueFalse.questionId],
      references: [questions.id],
    }),
  }),
);

export const questionMultipleChoice = pgTable(
  "q-multiple-choice",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),

    content: jsonb("content").$type<
      {
        id: string;
        title: string;
        description?: string;
        correct?: boolean;
        colour?: string;
        image?: string;
      }[]
    >(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    questionIdIdx: index("q-multiple-choice_question_idx").on(table.questionId),
  }),
);

export const questionMultipleChoiceRelations = relations(
  questionMultipleChoice,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionMultipleChoice.questionId],
      references: [questions.id],
    }),
  }),
);

// -----------------

export const eligible = pgTable(
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

// -----------------

export const files = pgTable("files", {
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

export const wahlenView = pgView("wahlen_view").as((qb) =>
  qb.select().from(wahlen).orderBy(desc(wahlen.updatedAt)),
);

// -----------------

export const questionView = pgView("question_view").as((qb) =>
  qb.select().from(questions).orderBy(desc(questions.updatedAt)),
);

export const questionInfoView = pgView("question_info_view").as((qb) =>
  qb.select().from(questionInfo).orderBy(desc(questionInfo.updatedAt)),
);

export const questionTrueFalseView = pgView("question_true_false_view").as(
  (qb) =>
    qb
      .select()
      .from(questionTrueFalse)
      .orderBy(desc(questionTrueFalse.updatedAt)),
);

export const questionMultipleChoiceView = pgView(
  "question_multiple_choice_view",
).as((qb) =>
  qb
    .select()
    .from(questionMultipleChoice)
    .orderBy(desc(questionMultipleChoice.updatedAt)),
);

// -----------------

export const eligibleView = pgView("eligible_view").as((qb) =>
  qb.select().from(eligible).orderBy(desc(eligible.updatedAt)),
);

// -----------------

export const sessionsView = pgView("sessions_view").as((qb) =>
  qb.select().from(sessions).orderBy(desc(sessions.updatedAt)),
);

// -----------------

export const stimmenView = pgView("stimmen_view").as((qb) =>
  qb.select().from(stimmen).orderBy(desc(stimmen.updatedAt)),
);

// -----------------

export const filesView = pgView("files_view").as((qb) =>
  qb.select().from(files).orderBy(desc(files.updatedAt)),
);

export const transcendingFilesView = pgView("transcending_files_view").as(
  (qb) =>
    qb
      .select()
      .from(files)
      .where(not(eq(files.transferStatus, "idle")))
      .orderBy(desc(files.updatedAt)),
);
