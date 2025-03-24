import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questionTrueFalse,
} from "~/server/db/schema";
import { deleteById } from "../files";
import { randomUUID } from "crypto";
import { err, ok, type Result } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const editChunkType = z.array(
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("info"),

      id: z.string().uuid(),

      title: z.string().min(3).max(256),
      description: z.string().optional(),
    }),

    z.object({
      type: z.literal("true_false"),

      id: z.string().uuid(),

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
    }),
  ]),
);

type EditChunkReturnType =
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect;

enum EditChunkErrorTypes {
  NotFound = "NotFound",
  EditFailed = "EditFailed",
}

type EditChunkError = {
  type: EditChunkErrorTypes;
  message: string;
};

export const editChunkProcedure = protectedProcedure
  .input(editChunkType)
  .mutation(
    async ({
      input,
    }): Promise<Result<EditChunkReturnType, EditChunkError>[]> => {
      const responses: Result<EditChunkReturnType, EditChunkError>[] = [];

      for (const item of input) {
        switch (item.type) {
          case "info": {
            const {
              data: editInfoResponseArray,
              error: editInfoResponseError,
            } = await tc(
              db
                .update(questionInfo)
                .set({
                  title: item.title,
                  description: item.description,

                  updatedAt: new Date(),
                })
                .where(eq(questionInfo.id, item.id))
                .returning(),
            );
            if (editInfoResponseError) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.EditFailed,
                  message: "Failed to update info question",
                }),
              );
              continue;
            }

            const editInfoResponse = editInfoResponseArray
              ? editInfoResponseArray[0]
              : null;
            if (!editInfoResponse) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.NotFound,
                  message: "Failed to update info question",
                }),
              );
              continue;
            }

            responses.push(ok(editInfoResponse));
            break;
          }
          case "true_false": {
            const {
              data: editTrueFalseResponseArray,
              error: editTrueFalseResponseError,
            } = await tc(
              db
                .update(questionTrueFalse)
                .set({
                  title: item.title,
                  description: item.description,

                  o1Title: item.content.option1.title,
                  o1Description: item.content.option1.description,
                  o1Correct: item.content.option1.correct,
                  o1Colour: item.content.option1.colour,

                  o2Title: item.content.option2.title,
                  o2Description: item.content.option2.description,
                  o2Correct: item.content.option2.correct,
                  o2Colour: item.content.option2.colour,

                  updatedAt: new Date(),
                })
                .where(eq(questionTrueFalse.id, item.id))
                .returning(),
            );
            if (editTrueFalseResponseError) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.EditFailed,
                  message: "Failed to update true/false question",
                }),
              );
              continue;
            }

            const editTrueFalseResponse = editTrueFalseResponseArray
              ? editTrueFalseResponseArray[0]
              : null;
            if (!editTrueFalseResponse) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.NotFound,
                  message: "Failed to update true/false question",
                }),
              );
              continue;
            }

            responses.push(ok(editTrueFalseResponse));
            break;
          }
          case "multiple_choice": {
            const {
              data: editMultipleChoiceContentArray,
              error: editMultipleChoiceContentError,
            } = await tc(
              db
                .select()
                .from(questionMultipleChoice)
                .where(eq(questionMultipleChoice.id, item.id)),
            );
            if (editMultipleChoiceContentError) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.EditFailed,
                  message: "Failed to update multiple choice question",
                }),
              );
              continue;
            }

            let editMultipleChoiceContent = editMultipleChoiceContentArray
              ? editMultipleChoiceContentArray[0]?.content
              : [];
            if (!editMultipleChoiceContent) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.NotFound,
                  message: "Failed to get multiple choice question",
                }),
              );
              continue;
            }

            const { addRequest, editRequest, deleteRequest } =
              item.content.reduce<{
                addRequest: Array<
                  Extract<(typeof item.content)[number], { type: "add" }>
                >;
                editRequest: Array<
                  Extract<(typeof item.content)[number], { type: "edit" }>
                >;
                deleteRequest: Array<
                  Extract<(typeof item.content)[number], { type: "delete" }>
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
              const target = editMultipleChoiceContent.find(
                (c) => c.id === item.id,
              );
              if (target?.image) {
                const dBId = await deleteById(target.image);
                if (dBId.isErr()) {
                  responses.push(
                    err({
                      type: EditChunkErrorTypes.EditFailed,
                      message: "Failed to delete image",
                    }),
                  );
                  continue;
                }
              }
              editMultipleChoiceContent = editMultipleChoiceContent.filter(
                (c) => c.id !== item.id,
              );
            }

            for (const item of editRequest) {
              editMultipleChoiceContent = editMultipleChoiceContent.map((c) => {
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
              editMultipleChoiceContent.push({
                id: randomUUID(),
                title: item.title,
                description: item.description,
                correct: item.correct,
                colour: item.colour,
              });
            }

            const {
              data: editMultipleChoiceResponseArray,
              error: editMultipleChoiceResponseError,
            } = await tc(
              db
                .update(questionMultipleChoice)
                .set({
                  title: item.title,
                  description: item.description,
                  content: editMultipleChoiceContent,

                  updatedAt: new Date(),
                })
                .where(eq(questionMultipleChoice.id, item.id))
                .returning(),
            );
            if (editMultipleChoiceResponseError) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.EditFailed,
                  message: "Failed to update multiple choice question",
                }),
              );
              continue;
            }

            const editMultipleChoiceResponse = editMultipleChoiceResponseArray
              ? editMultipleChoiceResponseArray[0]
              : null;
            if (!editMultipleChoiceResponse) {
              responses.push(
                err({
                  type: EditChunkErrorTypes.NotFound,
                  message: "Failed to update multiple choice question",
                }),
              );
              continue;
            }

            responses.push(ok(editMultipleChoiceResponse));
            break;
          }
        }
      }

      return responses;
    },
  );
