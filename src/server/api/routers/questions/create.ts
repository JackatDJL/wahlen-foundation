import { randomUUID } from "crypto";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema/questions";
import { chunkProcedure } from "./create-chunk";
import { err, ok } from "neverthrow";
import {
  apiErrorStatus,
  apiErrorTypes,
  type apiType,
  databaseInteraction,
  deconstructValue,
  uuidType,
  validateEditability,
} from "../utility";

/**
 * Creates a question record of a specified type and inserts it into the database.
 *
 * This generic helper ensures the associated election (identified by the input's `wahlId`) is inactive, creates a root question record, and transforms it into a type-specific insertable object via the provided callback. It then attempts to persist the question, returning a neverthrow Result that contains the inserted record on success or an error detail if creation fails.
 *
 * @param input - Data for creating the question, which must include a `wahlId` property.
 * @param questionType - The type of question to create; one of "info", "true_false", or "multiple_choice".
 * @param buildInsertable - Callback that builds an insertable object from the root question and the input data.
 * @param table - An interface for the database table exposing an `insert` method with a `returning` function to persist and retrieve the inserted record.
 * @returns A promise resolving to a Result containing the inserted question record or an error of type createError.
 */
export async function createQuestion<
  TTable,
  TInput extends { wahlId: string },
  TOutput,
>({
  input,
  questionType,
  buildInsertable,
  table,
}: {
  input: TInput;
  questionType: "info" | "true_false" | "multiple_choice";
  buildInsertable: (
    rootQuestion: typeof questions.$inferSelect,
    input: TInput,
  ) => TTable;
  table: {
    insert: (values: TTable) => { returning: () => Promise<TOutput[]> };
  };
}): apiType<TOutput> {
  // Get wahlId from input (all input types have wahlId)
  const wahlId = input.wahlId;

  // Check if Wahl is active
  const tIA = await validateEditability(wahlId);
  if (tIA.isErr()) return err(tIA.error);

  // Create root question
  const iRQ = await insertableRootQuestion({
    wahlId,
    type: questionType,
  });
  if (iRQ.isErr()) return err(iRQ.error);

  // Build insertable object specific to question type
  const insertable = buildInsertable(deconstructValue(iRQ).data(), input);

  // Insert into database
  const response = await databaseInteraction(
    table.insert(insertable).returning(),
  );
  if (response.isErr()) return err(response.error);

  return ok(deconstructValue(response));
}

const IRQType = z.object({
  wahlId: uuidType,
  type: z.enum(["info", "true_false", "multiple_choice"]),
});

/**
 * Inserts a new root question record into the database.
 *
 * Before insertion, the function verifies that the election (identified by `wahlId`) is not active, then
 * validates the input using a Zod schema. It constructs a question record with generated UUIDs for its unique
 * identifiers and current timestamps, and attempts to insert it into the database. The function returns a Result
 * wrapping the inserted question on success or an error object detailing the type of failure encountered.
 *
 * @param options - An object containing:
 *  - `wahlId`: The election identifier used to check if the election is active.
 *  - `type`: The type of question (e.g., "info", "true_false", or "multiple_choice") determining validation constraints.
 * @returns A Result containing the inserted question record on success, or an error object on failure.
 */
export async function insertableRootQuestion({
  wahlId,
  type,
}: z.infer<typeof IRQType>): apiType<typeof questions.$inferSelect> {
  const tIA = await validateEditability(wahlId);
  if (tIA.isErr()) return err(tIA.error);

  const error = IRQType.safeParse({
    wahlId,
    type,
  }).error;
  if (error) {
    return err({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
      message: "Invalid input",
      error,
    });
  }

  const insertable: typeof questions.$inferInsert = {
    id: randomUUID(),
    wahlId,

    type,

    questionId: randomUUID(),

    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const response = await databaseInteraction(
    db.insert(questions).values(insertable).returning(),
  );
  if (response.isErr()) return err(response.error);

  return ok(deconstructValue(response));
}

const createInfoQuestionType = z.object({
  wahlId: z.string().uuid(),

  title: z.string().min(3).max(256),
  description: z.string().optional(),
});

const createTrueFalseQuestionType = z.object({
  wahlId: z.string().uuid(),

  title: z.string().min(3).max(256),
  description: z.string().optional(),

  content: z.object({
    option1: z.object({
      title: z.string().min(3).max(256),
      description: z.string().optional(),

      correct: z.boolean().default(false),
      colour: z.string().optional(),
    }),
    option2: z.object({
      title: z.string().min(3).max(256),
      description: z.string().optional(),

      correct: z.boolean().default(false),
      colour: z.string().optional(),
    }),
  }),
});

const createMultipleChoiceQuestionType = z.object({
  wahlId: z.string().uuid(),

  title: z.string().min(3).max(256),
  description: z.string().optional(),

  content: z.array(
    z.object({
      title: z.string().min(3).max(256),
      description: z.string().optional(),

      correct: z.boolean().default(false),
      colour: z.string().optional(),
    }),
  ),
});

export const creationRouter = createTRPCRouter({
  chunk: chunkProcedure,
  info: protectedProcedure
    .input(createInfoQuestionType)
    .mutation(async ({ input }): apiType<typeof questionInfo.$inferSelect> => {
      return createQuestion({
        input,
        questionType: "info",
        buildInsertable: (rootQuestion, input) => {
          return {
            id: rootQuestion.id,
            questionId: rootQuestion.questionId ?? "",

            title: input.title,
            description: input.description,

            createdAt: new Date(),
            updatedAt: new Date(),
          } as typeof questionInfo.$inferInsert;
        },
        table: {
          insert: (values) => ({
            returning: () => db.insert(questionInfo).values(values).returning(),
          }),
        },
      });
    }),
  true_false: protectedProcedure
    .input(createTrueFalseQuestionType)
    .mutation(
      async ({ input }): apiType<typeof questionTrueFalse.$inferSelect> => {
        return createQuestion({
          input,
          questionType: "true_false",
          buildInsertable: (rootQuestion, input) => {
            return {
              id: rootQuestion.id,
              questionId: rootQuestion.questionId ?? "",

              title: input.title,
              description: input.description,

              o1Id: randomUUID(),
              o1Title: input.content.option1.title,
              o1Description: input.content.option1.description,
              o1Correct: input.content.option1.correct,
              o1Colour: input.content.option1.colour,

              o2Id: randomUUID(),
              o2Title: input.content.option2.title,
              o2Description: input.content.option2.description,
              o2Correct: input.content.option2.correct,
              o2Colour: input.content.option2.colour,

              createdAt: new Date(),
              updatedAt: new Date(),
            } as typeof questionTrueFalse.$inferInsert;
          },
          table: {
            insert: (values) => ({
              returning: () =>
                db.insert(questionTrueFalse).values(values).returning(),
            }),
          },
        });
      },
    ),
  multiple_choice: protectedProcedure
    .input(createMultipleChoiceQuestionType)
    .mutation(
      async ({
        input,
      }): apiType<typeof questionMultipleChoice.$inferSelect> => {
        return createQuestion({
          input,
          questionType: "multiple_choice",
          buildInsertable: (rootQuestion, input) => {
            return {
              id: rootQuestion.id,
              questionId: rootQuestion.questionId ?? "",

              title: input.title,
              description: input.description,

              content: input.content.map((item) => ({
                id: randomUUID(),
                title: item.title,
                description: item.description,
                correct: item.correct,
                colour: item.colour,
              })),

              createdAt: new Date(),
              updatedAt: new Date(),
            } as typeof questionMultipleChoice.$inferInsert;
          },
          table: {
            insert: (values) => ({
              returning: () =>
                db.insert(questionMultipleChoice).values(values).returning(),
            }),
          },
        });
      },
    ),
});
