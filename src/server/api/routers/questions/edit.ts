import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { editChunkProcedure } from "./edit-chunk";
import {
  questions,
  questionInfo,
  questionTrueFalse,
  questionMultipleChoice,
} from "~/server/db/schema/questions";
import { eq, or } from "drizzle-orm";
import { db } from "~/server/db";
import { randomUUID } from "crypto";
import { deleteById } from "../files";
import { err, ok } from "neverthrow";
import {
  apiErrorStatus,
  apiErrorTypes,
  databaseInteraction,
  deconstruct,
  validateEditability,
  type apiType,
} from "../utility";

const uuidType = z.string().uuid();

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
): apiType<typeof questions.$inferSelect> {
  const { success, error } = uuidType.safeParse(questionId);

  if (!success) {
    return err({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
      message: "Input is not a valid UUID",
      zodError: error,
    });
  }

  const response = await databaseInteraction(
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
  if (response.isErr()) return err(response.error);

  return ok(deconstruct(response));
}

const editInfoType = z.object({
  id: z.string().uuid(),

  title: z.string().min(3).max(256),
  description: z.string().optional(),
});

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
    .mutation(async ({ input }): apiType<typeof questionInfo.$inferSelect> => {
      const tIA = await validateEditability(input.id);
      if (tIA.isErr()) return err(tIA.error);

      const sUDOQ = await setUpdateDateOnQuestion(input.id);
      if (sUDOQ.isErr()) return err(sUDOQ.error);

      const response = await databaseInteraction(
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
      if (response.isErr()) return err(response.error);

      return ok(deconstruct(response));
    }),
  true_false: protectedProcedure
    .input(editTrueFalseType)
    .mutation(
      async ({ input }): apiType<typeof questionTrueFalse.$inferSelect> => {
        const tIA = await validateEditability(input.id);
        if (tIA.isErr()) return err(tIA.error);

        const sUDOQ = await setUpdateDateOnQuestion(input.id);
        if (sUDOQ.isErr()) return err(sUDOQ.error);

        const response = await databaseInteraction(
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
        if (response.isErr()) return err(response.error);

        return ok(deconstruct(response));
      },
    ),
  multiple_choice: protectedProcedure
    .input(editMultipleChoiceType)
    .mutation(
      async ({
        input,
      }): apiType<typeof questionMultipleChoice.$inferSelect> => {
        const tIA = await validateEditability(input.id);
        if (tIA.isErr()) return err(tIA.error);

        const sUDOQ = await setUpdateDateOnQuestion(input.id);
        if (sUDOQ.isErr()) return err(sUDOQ.error);

        const data = await databaseInteraction(
          db
            .select()
            .from(questionMultipleChoice)
            .where(eq(questionMultipleChoice.id, input.id)),
        );
        if (data.isErr()) return err(data.error);

        let content = deconstruct(data).data().content ?? [];

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
            if (dBId.isErr()) return err(dBId.error);
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

        const response = await databaseInteraction(
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
        if (response.isErr()) return err(response.error);

        return ok(deconstruct(response));
      },
    ),
});
