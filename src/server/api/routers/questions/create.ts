import { randomUUID } from "crypto";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema";
import { chunkProcedure } from "./create-chunk";
import { throwIfActive } from "./delete";
import { err, ok, type Result } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const uuidType = z.string().uuid();

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
        const tIA = await throwIfActive(input.wahlId);
        if (tIA.isErr()) {
          return err({
            type: createErrorTypes.Disallowed,
            message: "Wahl is active",
          });
        }

        const iRQ = await insertableRootQuestion({
          wahlId: input.wahlId,
          type: "info",
        });
        if (iRQ.isErr()) {
          return err({
            type: createErrorTypes.Failed,
            message: "Failed to create question",
          });
        }

        const qIInsertable: typeof questionInfo.$inferInsert = {
          id: iRQ.value.id,
          questionId: iRQ.value.questionId ?? "",

          title: input.title,
          description: input.description,

          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const { data: insertedArray, error: insertError } = await tc(
          db.insert(questionInfo).values(qIInsertable).returning(),
        );
        if (insertError) {
          return err({
            type: createErrorTypes.Failed,
            message: "Failed to insert question",
          });
        }

        const inserted = insertedArray ? insertedArray[0] : null;
        if (!inserted) {
          return err({
            type: createErrorTypes.NotFound,
            message: "Failed to insert question",
          });
        }

        return ok(inserted);
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
        const tIA = await throwIfActive(input.wahlId);
        if (tIA.isErr()) {
          return err({
            type: createErrorTypes.Disallowed,
            message: "Wahl is active",
          });
        }

        const iRQ = await insertableRootQuestion({
          wahlId: input.wahlId,
          type: "true_false",
        });
        if (iRQ.isErr()) {
          return err({
            type: createErrorTypes.Failed,
            message: "Failed to create question",
          });
        }

        const qInsertable: typeof questionTrueFalse.$inferInsert = {
          id: iRQ.value.id,
          questionId: iRQ.value.questionId ?? "",
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

        const { data: insertedArray, error: insertError } = await tc(
          db.insert(questionTrueFalse).values(qInsertable).returning(),
        );
        if (insertError) {
          return err({
            type: createErrorTypes.Failed,
            message: "Failed to insert question",
          });
        }

        const inserted = insertedArray ? insertedArray[0] : null;
        if (!inserted) {
          return err({
            type: createErrorTypes.NotFound,
            message: "Failed to insert question",
          });
        }

        return ok(inserted);
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
        const tIA = await throwIfActive(input.wahlId);
        if (tIA.isErr()) {
          return err({
            type: createErrorTypes.Disallowed,
            message: "Wahl is active",
          });
        }

        const iRQ = await insertableRootQuestion({
          wahlId: input.wahlId,
          type: "multiple_choice",
        });
        if (iRQ.isErr()) {
          return err({
            type: createErrorTypes.Failed,
            message: "Failed to create question",
          });
        }

        const qInsertable: typeof questionMultipleChoice.$inferInsert = {
          id: iRQ.value.id,
          questionId: iRQ.value.questionId ?? "",
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

        const { data: insertedArray, error: insertError } = await tc(
          db.insert(questionMultipleChoice).values(qInsertable).returning(),
        );
        if (insertError) {
          return err({
            type: createErrorTypes.Failed,
            message: "Failed to insert question",
          });
        }

        const inserted = insertedArray ? insertedArray[0] : null;
        if (!inserted) {
          return err({
            type: createErrorTypes.NotFound,
            message: "Failed to insert question",
          });
        }

        return ok(inserted);
      },
    ),
});
