import { z } from "zod";
import { protectedProcedure } from "~/server/api/trpc";
import { randomUUID } from "crypto";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questionTrueFalse,
} from "~/server/db/schema/questions";
import { insertableRootQuestion } from "./create";
import { throwIfActive } from "./delete";
import { err, ok, type Result } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const createChunkType = z.object({
  wahlId: z.string().uuid(),
  data: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("info"),

        title: z.string().min(3).max(256),
        description: z.string().optional(),
      }),

      z.object({
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
  ),
});

type CreateChunkReturnType =
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect;

enum CreateChunkErrorTypes {
  Failed = "Failed",
}

type CreateChunkError = {
  type: CreateChunkErrorTypes;
  message: string;
};

export const chunkProcedure = protectedProcedure
  .input(createChunkType)
  .mutation(
    async ({
      input,
    }): Promise<Result<CreateChunkReturnType, CreateChunkError>[]> => {
      await throwIfActive(input.wahlId);

      const responses: Result<CreateChunkReturnType, CreateChunkError>[] = [];

      for (const chunk of input.data) {
        switch (chunk.type) {
          case "info": {
            const iRQ = await insertableRootQuestion({
              wahlId: input.wahlId,
              type: "info",
            });
            if (iRQ.isErr()) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            const infoInsertable: typeof questionInfo.$inferInsert = {
              id: iRQ.value.questionId ?? "",
              questionId: iRQ.value.id ?? "",

              title: chunk.title,
              description: chunk.description,

              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const { data: infoResponseArray, error: infoResponseError } =
              await tc(
                db.insert(questionInfo).values(infoInsertable).returning(),
              );
            if (infoResponseError) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            const infoResponse = infoResponseArray
              ? infoResponseArray[0]
              : null;
            if (!infoResponse) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            responses.push(ok(infoResponse));
            break;
          }

          case "true_false": {
            const iRQ = await insertableRootQuestion({
              wahlId: input.wahlId,
              type: "true_false",
            });
            if (iRQ.isErr()) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            const trueFalseInsertable: typeof questionTrueFalse.$inferInsert = {
              id: iRQ.value.questionId ?? "",
              questionId: iRQ.value.id ?? "",

              title: chunk.title,
              description: chunk.description,

              o1Id: randomUUID(),
              o1Title: chunk.content.option1.title,
              o1Description: chunk.content.option1.description,
              o1Correct: chunk.content.option1.correct,
              o1Colour: chunk.content.option1.colour,

              o2Id: randomUUID(),
              o2Title: chunk.content.option2.title,
              o2Description: chunk.content.option2.description,
              o2Correct: chunk.content.option2.correct,
              o2Colour: chunk.content.option2.colour,

              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const {
              data: trueFalseResponseArray,
              error: trueFalseResponseError,
            } = await tc(
              db
                .insert(questionTrueFalse)
                .values(trueFalseInsertable)
                .returning(),
            );
            if (trueFalseResponseError) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            const trueFalseResponse = trueFalseResponseArray
              ? trueFalseResponseArray[0]
              : null;
            if (!trueFalseResponse) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            responses.push(ok(trueFalseResponse));
            break;
          }

          case "multiple_choice": {
            const iRQ = await insertableRootQuestion({
              wahlId: input.wahlId,
              type: "multiple_choice",
            });
            if (iRQ.isErr()) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            const multipleChoiceInsertable: typeof questionMultipleChoice.$inferInsert =
              {
                id: iRQ.value.questionId ?? "",
                questionId: iRQ.value.id ?? "",

                title: chunk.title,
                description: chunk.description,

                content: chunk.content.map((c) => ({
                  id: randomUUID(),
                  title: c.title,
                  description: c.description,
                  correct: c.correct,
                  colour: c.colour,
                })),

                createdAt: new Date(),
                updatedAt: new Date(),
              };

            const {
              data: multipleChoiceResponseArray,
              error: multipleChoiceResponseError,
            } = await tc(
              db
                .insert(questionMultipleChoice)
                .values(multipleChoiceInsertable)
                .returning(),
            );
            if (multipleChoiceResponseError) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            const multipleChoiceResponse = multipleChoiceResponseArray
              ? multipleChoiceResponseArray[0]
              : null;
            if (!multipleChoiceResponse) {
              responses.push(
                err({
                  type: CreateChunkErrorTypes.Failed,
                  message: "Failed to create question",
                }),
              );
              continue;
            }

            responses.push(ok(multipleChoiceResponse));
            break;
          }
        }
      }

      return responses;
    },
  );
