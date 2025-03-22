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

export const editChunkProcedure = protectedProcedure
  .input(
    z.array(
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
    ),
  )
  .mutation(async ({ input }) => {
    const responses: (
      | typeof questionInfo.$inferSelect
      | typeof questionTrueFalse.$inferSelect
      | typeof questionMultipleChoice.$inferSelect
    )[] = [];

    for (const item of input) {
      switch (item.type) {
        case "info": {
          const editInfoResponse = (
            await db
              .update(questionInfo)
              .set({
                title: item.title,
                description: item.description,

                updatedAt: new Date(),
              })
              .where(eq(questionInfo.id, item.id))
              .returning()
          )[0];
          if (!editInfoResponse) {
            throw new Error("Failed to update info question");
          }

          responses.push(editInfoResponse);
          break;
        }
        case "true_false": {
          const editTrueFalseResponse = (
            await db
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
              .returning()
          )[0];

          if (!editTrueFalseResponse) {
            throw new Error("Failed to update true/false question");
          }

          responses.push(editTrueFalseResponse);
          break;
        }
        case "multiple_choice": {
          let editMultipleChoiceContent = (
            await db
              .select()
              .from(questionMultipleChoice)
              .where(eq(questionMultipleChoice.id, item.id))
          )[0]?.content;
          if (!editMultipleChoiceContent) {
            throw new Error("Failed to get multiple choice question");
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
              await deleteById(target.image);
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

          const editMultipleChoiceResponse = (
            await db
              .update(questionMultipleChoice)
              .set({
                title: item.title,
                description: item.description,
                content: editMultipleChoiceContent,

                updatedAt: new Date(),
              })
              .where(eq(questionMultipleChoice.id, item.id))
              .returning()
          )[0];
          if (!editMultipleChoiceResponse) {
            throw new Error("Failed to update multiple choice question");
          }
          responses.push(editMultipleChoiceResponse);
          break;
        }
      }
    }

    return responses;
  });
