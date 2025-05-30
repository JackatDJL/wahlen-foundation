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
import { throwIfActive } from "./delete";
import { err, ok, type Result } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const uuidType = z.string().uuid();
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
async function createQuestion<TTable, TInput, TOutput>({
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
}): Promise<Result<TOutput, createError>> {
  // Get wahlId from input (all input types have wahlId)
  const wahlId = (input as unknown as { wahlId: string }).wahlId;

  // Check if Wahl is active
  const tIA = await throwIfActive(wahlId);
  if (tIA.isErr()) {
    return err({
      type: createErrorTypes.Disallowed,
      message: "Wahl is active",
    });
  }

  // Create root question
  const iRQ = await insertableRootQuestion({
    wahlId,
    type: questionType,
  });
  if (iRQ.isErr()) {
    return err({
      type: createErrorTypes.Failed,
      message: "Failed to create question",
    });
  }

  // Build insertable object specific to question type
  const insertable = buildInsertable(iRQ.value, input);

  // Insert into database
  const { data: insertedArray, error: insertError } = await tc(
    table.insert(insertable).returning(),
  );
  if (insertError) {
    return err({
      type: createErrorTypes.Failed,
      message: "Failed to insert question",
    });
  }

  // Check if insertion was successful
  const inserted = insertedArray ? insertedArray[0] : null;
  if (!inserted) {
    return err({
      type: createErrorTypes.NotFound,
      message: "Failed to insert question",
    });
  }

  return ok(inserted);
}

const IRQType = z.object({
  wahlId: uuidType,
  type: z.enum(["info", "true_false", "multiple_choice"]),
});

enum IRQErrorTypes {
  InputTypeError = "InputTypeError",
  NotFound = "NotFound",
  Disallowed = "Disallowed",
  Failed = "Failed",
}

type IRQError =
  | {
      type: Exclude<IRQErrorTypes, IRQErrorTypes.InputTypeError>;
      message: string;
    }
  | {
      type: IRQErrorTypes.InputTypeError;
      message: string;
      error: z.ZodError;
    };

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
}: z.infer<typeof IRQType>): Promise<
  Result<typeof questions.$inferSelect, IRQError>
> {
  const tIA = await throwIfActive(wahlId);
  if (tIA.isErr()) {
    return err({
      type: IRQErrorTypes.Disallowed,
      message: "Wahl is active",
    });
  }

  const { success, error } = IRQType.safeParse({
    wahlId,
    type,
  });
  if (!success) {
    return err({
      type: IRQErrorTypes.InputTypeError,
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

  const { data: insertedArray, error: insertError } = await tc(
    db.insert(questions).values(insertable).returning(),
  );
  if (insertError) {
    return err({
      type: IRQErrorTypes.Failed,
      message: "Failed to insert question",
    });
  }

  const inserted = insertedArray ? insertedArray[0] : null;
  if (!inserted) {
    return err({
      type: IRQErrorTypes.NotFound,
      message: "Failed to insert question",
    });
  }

  return ok(inserted);
}

enum createErrorTypes {
  NotFound = "NotFound",
  Failed = "Failed",
  Disallowed = "Disallowed",
}

type createError = {
  type: createErrorTypes;
  message: string;
};

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
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof questionInfo.$inferSelect, createError>> => {
        return createQuestion({
          input,
          questionType: "info",
          buildInsertable: (rootQuestion, input) => {
            const insertable: typeof questionInfo.$inferInsert = {
              id: rootQuestion.id,
              questionId: rootQuestion.questionId ?? "",
              title: input.title,
              description: input.description,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return insertable;
          },
          table: {
            insert: (values) => ({
              returning: () =>
                db.insert(questionInfo).values(values).returning(),
            }),
          },
        });
      },
    ),
  true_false: protectedProcedure
    .input(createTrueFalseQuestionType)
    .mutation(
      async ({
        input,
      }): Promise<
        Result<typeof questionTrueFalse.$inferSelect, createError>
      > => {
        return createQuestion({
          input,
          questionType: "true_false",
          buildInsertable: (rootQuestion, input) => {
            const insertable: typeof questionTrueFalse.$inferInsert = {
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
            };
            return insertable;
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
      }): Promise<
        Result<typeof questionMultipleChoice.$inferSelect, createError>
      > => {
        return createQuestion({
          input,
          questionType: "multiple_choice",
          buildInsertable: (rootQuestion, input) => {
            const insertable: typeof questionMultipleChoice.$inferInsert = {
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
            };
            return insertable;
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
