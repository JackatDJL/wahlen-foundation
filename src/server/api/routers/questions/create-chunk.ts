import { z } from "zod";
import { protectedProcedure } from "~/server/api/trpc";
import { randomUUID } from "crypto";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questionTrueFalse,
} from "~/server/db/schema/questions";
import { createQuestion } from "./create";
import { err, ok } from "neverthrow";
import {
  apiErrorStatus,
  apiErrorTypes,
  type apiOk,
  apiResponseStatus,
  apiResponseTypes,
  type apiType,
  orReport,
  uuidType,
} from "../utility";

const createChunkType = z.array(
  z.discriminatedUnion("type", [
    z.object({
      wahlId: uuidType,

      type: z.literal("info"),

      title: z.string().min(3).max(256),
      description: z.string().optional(),
    }),

    z.object({
      wahlId: uuidType,

      type: z.literal("true_false"),

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
    }),

    z.object({
      wahlId: uuidType,

      type: z.literal("multiple_choice"),

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
    }),
  ]),
);

type CreateChunkReturnDataTypes = Awaited<
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect
>;

type CreateChunkReturnType = apiOk<CreateChunkReturnDataTypes>;

type CreateChunkResultTypes = apiType<CreateChunkReturnDataTypes>;

export const chunkProcedure = protectedProcedure
  .input(createChunkType)
  .mutation(async ({ input }): apiType<Awaited<CreateChunkReturnType>[]> => {
    const results: Awaited<CreateChunkResultTypes>[] = [];

    for (const item of input) {
      switch (item.type) {
        case "info": {
          results.push(
            await createQuestion({
              input: item,
              questionType: "info",
              buildInsertable: (rootQuestion, input) => {
                return {
                  id: rootQuestion.id,
                  questionId: rootQuestion.questionId,

                  title: input.title,
                  description: input.description,

                  createdAt: new Date(),
                  updatedAt: new Date(),
                } as typeof questionInfo.$inferInsert;
              },
              table: {
                insert: (values) => ({
                  returning: () =>
                    db.insert(questionInfo).values(values).returning(),
                }),
              },
            }),
          );
          break;
        }

        case "true_false": {
          results.push(
            await createQuestion({
              input: item,
              questionType: "true_false",
              buildInsertable: (rootQuestion, input) => {
                return {
                  id: rootQuestion.id,
                  questionId: rootQuestion.questionId,

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
            }),
          );
          break;
        }

        case "multiple_choice": {
          results.push(
            await createQuestion({
              input: item,
              questionType: "multiple_choice",
              buildInsertable: (rootQuestion, input) => {
                return {
                  id: rootQuestion.id,
                  questionId: rootQuestion.questionId,

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
                    db
                      .insert(questionMultipleChoice)
                      .values(values)
                      .returning(),
                }),
              },
            }),
          );
          break;
        }
      }
    }

    if (results.every((result) => result.isOk())) {
      return ok({
        status: apiResponseStatus.Success,
        type: apiResponseTypes.Success,
        message: "Questions created successfully",
        data: results as Awaited<CreateChunkReturnType>[], // No need to filter, all is Ok<T>
      });
    } else {
      const failedCount = results.filter((result) => result.isErr()).length;
      return err({
        status: apiErrorStatus.Failed,
        type: apiErrorTypes.Failed,
        message: `Failed to create ${failedCount} questions`,
        error: results
          .filter((result) => result.isErr())
          .map((result) => result.error),
      }).mapErr(orReport);
    }
  });
