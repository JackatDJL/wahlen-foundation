import { relations, desc } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { files } from "./files";
import { wahlen } from "./wahlen";
import { stimmen } from "./election";

// Initialise a new PostgreSQL schema for the questions
export const questionSchema = pgSchema("questions");

// -----------------  Enumerators  -----------------

/**
 * Question Types
 *
 * - info: Informative Markdown
 * - true_false: True/False Question
 * - multiple_choice: Multiple Choice Question
 */
export const questionTypeEnum = questionSchema.enum("types", [
  "info",
  "true_false",
  "multiple_choice",
]);

// -----------------  Tables  -----------------

/**
 * Questions Table
 *
 * This table contains all questions for the election.
 *
 * - id: UUID (Primary Key)
 * - wahlId: UUID (Foreign Key to Wahlen)
 *
 * - type: Question Type (Enum)
 * - questionId: UUID (Foreign Key to any one of different question Tables)
 *
 * - createdAt: Timestamp
 * - updatedAt: Timestamp
 */
export const questions = questionSchema.table(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom().unique(),
    wahlId: uuid("wahl_id")
      .notNull()
      .references(() => wahlen.id, { onDelete: "cascade" }),

    type: questionTypeEnum("type").notNull(),
    questionId: uuid("question_id").notNull(),

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

/**
 * Question Info Table
 *
 * This table contains all Questions of type questionInfo.
 *
 * - id: UUID (Primary Key)
 * - questionId: UUID (Foreign Key to Questions)
 *
 * - title: Title of the question
 * - description: Description of the question
 * - image: UUID of the associated image
 *
 * - createdAt: Timestamp of when the question info was created
 * - updatedAt: Timestamp of when the question info was last updated
 */
export const questionInfo = questionSchema.table("info", {
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

// -----------------

/**
 * Question True/False Table
 *
 * This table contains all Questions of type questionTrueFalse.
 *
 * - id: UUID (Primary Key)
 * - questionId: UUID (Foreign Key to Questions)
 * - title: Title of the question
 * - description: Description of the question
 *
 * - o1Id: UUID of the first option
 * - o1Title: Title of the first option
 * - o1Description: Description of the first option
 * - o1Correct: Boolean indicating if the first option is correct
 * - o1Colour: Colour of the first option
 * - o1Image: UUID of the first option's image
 *
 * - o2Id: UUID of the second option
 * - o2Title: Title of the second option
 * - o2Description: Description of the second option
 * - o2Correct: Boolean indicating if the second option is correct
 * - o2Colour: Colour of the second option
 * - o2Image: UUID of the second option's image
 *
 * - createdAt: Timestamp of when the question was created
 * - updatedAt: Timestamp of when the question was last updated
 */
export const questionTrueFalse = questionSchema.table(
  "true-false",
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

// -----------------

/**
 * Question Multiple Choice Table
 *
 * This table contains all Questions of type questionMultipleChoice.
 *
 * - id: UUID (Primary Key)
 * - questionId: UUID (Foreign Key to Questions)
 * - title: Title of the question
 * - description: Description of the question
 *
 * - content: JSONB containing multiple choice options
 *
 * - createdAt: Timestamp of when the question was created
 * - updatedAt: Timestamp of when the question was last updated
 *
 * @type {Array<{
 *   id: string;
 *   title: string;
 *   description?: string;
 *   correct?: boolean;
 *   colour?: string;
 *   image?: string;
 * }>}
 */
export const questionMultipleChoice = questionSchema.table(
  "multiple-choice",
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

// ----------------- Views -----------------

/**
 * Question View
 *
 * This view provides a sorted list of questions based on their last updated timestamp.
 */
export const questionView = questionSchema
  .view("questions-view")
  .as((qb) => qb.select().from(questions).orderBy(desc(questions.updatedAt)));

// -----------------

/**
 * Question Info View
 *
 * This view provides a sorted view of all of the questionInfo questions.
 * It provides a sorted list of questions based on their last updated timestamp.
 */
export const questionInfoView = questionSchema
  .view("info-view")
  .as((qb) =>
    qb.select().from(questionInfo).orderBy(desc(questionInfo.updatedAt)),
  );

// -----------------

/**
 * Question True/False View
 *
 * This view provides a sorted view of all of the questionTrueFalse questions.
 * It provides a sorted list of questions based on their last updated timestamp.
 */
export const questionTrueFalseView = questionSchema
  .view("true-false-view")
  .as((qb) =>
    qb
      .select()
      .from(questionTrueFalse)
      .orderBy(desc(questionTrueFalse.updatedAt)),
  );

// -----------------

/**
 * Question Multiple Choice View
 *
 * This view provides a sorted view of all of the questionMultipleChoice questions.
 * It provides a sorted list of questions based on their last updated timestamp.
 */
export const questionMultipleChoiceView = questionSchema
  .view("multiple-choice-view")
  .as((qb) =>
    qb
      .select()
      .from(questionMultipleChoice)
      .orderBy(desc(questionMultipleChoice.updatedAt)),
  );
