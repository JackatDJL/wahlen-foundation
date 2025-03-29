import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { editChunkProcedure } from "./edit-chunk";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import { db } from "~/server/db";
import { randomUUID } from "crypto";
import { deleteById } from "../files";
import { throwIfActive, throwIfActiveErrorTypes } from "./delete";
import { type Result, err, ok } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const uuidType = z.string().uuid();

export enum UpdateDateOnQuestionErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
  InputTypeError = "InputTypeError",
}
type UpdateDateOnQuestionError =
  | {
      type: Exclude<
        UpdateDateOnQuestionErrorTypes,
        UpdateDateOnQuestionErrorTypes.InputTypeError
      >;
      message: string;
    }
  | {
      type: UpdateDateOnQuestionErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

/**
 * Updates the "updatedAt" timestamp for a question identified by its UUID.
 *
 * The function validates the provided question ID using a UUID schema. If the validation fails, it returns an error result indicating an input type error.
 * On successful validation, it attempts to update the question’s "updatedAt" field to the current time.
 * If the update fails or no matching question is found, an error result with an update failure type is returned.
 *
 * @param questionId - The UUID of the question to update.
 * @returns A promise that resolves to a Result containing the updated question data on success, or an UpdateDateOnQuestionError on failure.
 */
export async function setUpdateDateOnQuestion(
  questionId: z.infer<typeof uuidType>,
): Promise<Result<typeof questions.$inferSelect, UpdateDateOnQuestionError>> {
  const { success, error } = uuidType.safeParse(questionId);

  if (!success) {
    return err({
      type: UpdateDateOnQuestionErrorTypes.InputTypeError,
      message: "Input is not a valid UUID",
      zodError: error,
    });
  }

  const { data: response, error: dberr } = await tc(
    db
      .update(questions)
      .set({
        updatedAt: new Date(),
      })
      .where(
        or(eq(questions.id, questionId), eq(questions.questionId, questionId)),
      )
      .returning(),
  );

  if (!response?.[0] || dberr) {
    console.error(dberr);

    return err({
      type: UpdateDateOnQuestionErrorTypes.UpdateFailed,
      message: "Failed to update question date",
    });
  }

  return ok(response[0]);
}

const editInfoType = z.object({
  id: z.string().uuid(),

  title: z.string().min(3).max(256),
  description: z.string().optional(),
});

enum editErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
  Disallowed = "Disallowed",
}

type editError = {
  type: editErrorTypes;
  message: string;
};

const editTrueFalseType = z.object({
  id: z.string().uuid(),

  title: z.string().min(3).max(256),
  description: z.string().optional(),

  content: z.object({
    option1: z.object({
      title: z.string().min(3).max(256),
      description: z.string().optional(),

      correct: z.boolean(),
      colour: z.string().optional(),
    }),
    option2: z.object({
      title: z.string().min(3).max(256),
      description: z.string().optional(),

      correct: z.boolean(),
      colour: z.string().optional(),
    }),
  }),
});

const editMultipleChoiceType = z.object({
  id: z.string().uuid(),

  title: z.string().min(3).max(256),
  description: z.string().optional(),

  content: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("add"),

        title: z.string().min(3).max(256),
        description: z.string().optional(),

        correct: z.boolean().default(false),
        colour: z.string().optional(),
      }),

      z.object({
        type: z.literal("edit"),
        id: z.string().uuid(),

        title: z.string().min(3).max(256),
        description: z.string().optional(),

        correct: z.boolean().default(false),
        colour: z.string().optional(),
      }),

      z.object({
        type: z.literal("delete"),

        id: z.string().uuid(),
      }),
    ]),
  ),
});

export const editRouter = createTRPCRouter({
  chunk: editChunkProcedure,
  info: protectedProcedure
    .input(editInfoType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof questionInfo.$inferSelect, editError>> => {
        const tIA = await throwIfActive(input.id);
        if (tIA.isErr()) {
          if (tIA.error.type === throwIfActiveErrorTypes.Active) {
            return err({
              type: editErrorTypes.Disallowed,
              message: "Cannot edit question while active",
            });
          } else if (tIA.error.type === throwIfActiveErrorTypes.NotFound) {
            return err({
              type: editErrorTypes.NotFound,
              message: "Question not found",
            });
          } else {
            return err({
              type: editErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }
        }

        const sUDOQ = await setUpdateDateOnQuestion(input.id);
        if (sUDOQ.isErr()) {
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const { data: responseArray, error: responseArrayError } = await tc(
          db
            .update(questionInfo)
            .set({
              title: input.title,
              description: input.description,

              updatedAt: new Date(),
            })
            .where(eq(questionInfo.id, input.id))
            .returning(),
        );
        if (responseArrayError) {
          console.error(responseArrayError);
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const response = responseArray ? responseArray[0] : null;
        if (!response) {
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        return ok(response);
      },
    ),
  true_false: protectedProcedure
    .input(editTrueFalseType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof questionTrueFalse.$inferSelect, editError>> => {
        const tIA = await throwIfActive(input.id);
        if (tIA.isErr()) {
          if (tIA.error.type === throwIfActiveErrorTypes.Active) {
            return err({
              type: editErrorTypes.Disallowed,
              message: "Cannot edit question while active",
            });
          } else if (tIA.error.type === throwIfActiveErrorTypes.NotFound) {
            return err({
              type: editErrorTypes.NotFound,
              message: "Question not found",
            });
          } else {
            return err({
              type: editErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }
        }

        const sUDOQ = await setUpdateDateOnQuestion(input.id);
        if (sUDOQ.isErr()) {
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const { data: responseArray, error: responseArrayError } = await tc(
          db
            .update(questionTrueFalse)
            .set({
              title: input.title,
              description: input.description,

              o1Title: input.content.option1.title,
              o1Description: input.content.option1.description,
              o1Correct: input.content.option1.correct,
              o1Colour: input.content.option1.colour,

              o2Title: input.content.option2.title,
              o2Description: input.content.option2.description,
              o2Correct: input.content.option2.correct,
              o2Colour: input.content.option2.colour,

              updatedAt: new Date(),
            })
            .where(eq(questionTrueFalse.id, input.id))
            .returning(),
        );
        if (responseArrayError) {
          console.error(responseArrayError);
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const response = responseArray ? responseArray[0] : null;
        if (!response) {
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        return ok(response);
      },
    ),
  multiple_choice: protectedProcedure
    .input(editMultipleChoiceType)
    .mutation(
      async ({
        input,
      }): Promise<
        Result<typeof questionMultipleChoice.$inferSelect, editError>
      > => {
        const tIA = await throwIfActive(input.id);
        if (tIA.isErr()) {
          if (tIA.error.type === throwIfActiveErrorTypes.Active) {
            return err({
              type: editErrorTypes.Disallowed,
              message: "Cannot edit question while active",
            });
          } else if (tIA.error.type === throwIfActiveErrorTypes.NotFound) {
            return err({
              type: editErrorTypes.NotFound,
              message: "Question not found",
            });
          } else {
            return err({
              type: editErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }
        }

        const sUDOQ = await setUpdateDateOnQuestion(input.id);
        if (sUDOQ.isErr()) {
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const { data: contentArray, error: contentArrayError } = await tc(
          db
            .select()
            .from(questionMultipleChoice)
            .where(eq(questionMultipleChoice.id, input.id)),
        );
        if (contentArrayError) {
          console.error(contentArrayError);
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        let content = contentArray ? contentArray[0]?.content : null;
        if (!content) {
          return err({
            type: editErrorTypes.NotFound,
            message: "Content not found",
          });
        }

        const { addRequest, editRequest, deleteRequest } =
          input.content.reduce<{
            addRequest: Array<
              Extract<(typeof input.content)[number], { type: "add" }>
            >;
            editRequest: Array<
              Extract<(typeof input.content)[number], { type: "edit" }>
            >;
            deleteRequest: Array<
              Extract<(typeof input.content)[number], { type: "delete" }>
            >;
          }>(
            (acc, item) => {
              if (item.type === "add") {
                acc.addRequest.push(item);
              } else if (item.type === "edit") {
                acc.editRequest.push(item);
              } else if (item.type === "delete") {
                acc.deleteRequest.push(item);
              }
              return acc;
            },
            { addRequest: [], editRequest: [], deleteRequest: [] },
          );

        for (const item of deleteRequest) {
          const target = content.find((c) => c.id === item.id);
          if (target?.image) {
            const dBId = await deleteById(target.image);
            if (dBId.isErr()) {
              return err({
                type: editErrorTypes.UpdateFailed,
                message: "Failed to delete image for multiple_choice question",
              });
            }
          }
          content = content.filter((c) => c.id !== item.id);
        }

        for (const item of editRequest) {
          content = content.map((c) => {
            if (c.id === item.id) {
              return {
                ...c,
                title: item.title,
                description: item.description,
                correct: item.correct,
                colour: item.colour,
              };
            }
            return c;
          });
        }

        for (const item of addRequest) {
          content.push({
            id: randomUUID(),
            title: item.title,
            description: item.description,
            correct: item.correct,
            colour: item.colour,
          });
        }

        const { data: responseArray, error: responseArrayError } = await tc(
          db
            .update(questionMultipleChoice)
            .set({
              title: input.title,
              description: input.description,

              content,
              updatedAt: new Date(),
            })
            .where(eq(questionMultipleChoice.id, input.id))
            .returning(),
        );
        if (responseArrayError) {
          console.error(responseArrayError);
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const response = responseArray ? responseArray[0] : null;
        if (!response) {
          return err({
            type: editErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        return ok(response);
      },
    ),
});
