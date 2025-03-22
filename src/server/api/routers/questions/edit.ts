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

const uuidType = z.string().uuid();
export async function setUpdateDateOnQuestion(
  questionId: z.infer<typeof uuidType>,
) {
  uuidType.parse(questionId);

  const response = (
    await db
      .update(questions)
      .set({
        updatedAt: new Date(),
      })
      .where(
        or(eq(questions.id, questionId), eq(questions.questionId, questionId)),
      )
      .returning()
  )[0];

  if (!response) {
    throw new Error("Failed to update question date");
  }

  return response;
}

export const editRouter = createTRPCRouter({
  chunk: editChunkProcedure,
  info: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),

        title: z.string().min(3).max(256),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await setUpdateDateOnQuestion(input.id);
      const response = (
        await db
          .update(questionInfo)
          .set({
            title: input.title,
            description: input.description,

            updatedAt: new Date(),
          })
          .where(eq(questionInfo.id, input.id))
          .returning()
      )[0];
      if (!response) {
        throw new Error("Failed to update question");
      }

      return response;
    }),
  true_false: protectedProcedure
    .input(
      z.object({
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
      }),
    )
    .mutation(async ({ input }) => {
      await setUpdateDateOnQuestion(input.id);
      const response = (
        await db
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
          .returning()
      )[0];

      if (!response) {
        throw new Error("Failed to update true/false question");
      }

      return response;
    }),
  multiple_choice: protectedProcedure
    .input(
      z.object({
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
    )
    .mutation(async ({ input }) => {
      await setUpdateDateOnQuestion(input.id);
      let content = (
        await db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.id, input.id))
      )[0]?.content;
      if (!content) {
        throw new Error("Failed to get question");
      }

      const { addRequest, editRequest, deleteRequest } = input.content.reduce<{
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
          await deleteById(target.image);
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

      const response = (
        await db
          .update(questionMultipleChoice)
          .set({ content, updatedAt: new Date() })
          .where(eq(questionMultipleChoice.id, input.id))
          .returning()
      )[0];
      if (!response) {
        throw new Error("Failed to update question");
      }

      return response;
    }),
});
