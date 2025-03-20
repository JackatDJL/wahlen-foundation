import { randomUUID } from "crypto";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema";
import { chunkProcedure } from "./create-chunk";

export const creationRouter = createTRPCRouter({
  chunk: chunkProcedure,
  info: publicProcedure
    .input(
      z.object({
        wahlId: z.string().uuid(),

        title: z.string().min(3).max(256),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const insertable: typeof questions.$inferInsert = {
        id: randomUUID(),
        wahlId: input.wahlId,

        type: "info",

        questionId: randomUUID(),

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(questions).values(insertable);

      const qInsertable: typeof questionInfo.$inferInsert = {
        id: insertable.questionId ?? "",
        questionId: insertable.id ?? "",

        title: input.title,
        description: input.description,

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = (
        await db.insert(questionInfo).values(qInsertable).returning()
      )[0];
      if (!response) {
        throw new Error("Failed to create question");
      }

      return response;
    }),
  true_false: publicProcedure
    .input(
      z.object({
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
      }),
    )
    .mutation(async ({ input }) => {
      const insertable: typeof questions.$inferInsert = {
        id: randomUUID(),
        wahlId: input.wahlId,

        type: "true_false",
        questionId: randomUUID(),

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(questions).values(insertable);

      const qInsertable: typeof questionTrueFalse.$inferInsert = {
        id: insertable.questionId ?? "",
        questionId: insertable.id ?? "",
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

      const response = (
        await db.insert(questionTrueFalse).values(qInsertable).returning()
      )[0];
      if (!response) {
        throw new Error("Failed to create question");
      }
      return response;
    }),
  multiple_choice: publicProcedure
    .input(
      z.object({
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
      }),
    )
    .mutation(async ({ input }) => {
      const insertable: typeof questions.$inferInsert = {
        id: randomUUID(),
        wahlId: input.wahlId,

        type: "multiple_choice",
        questionId: randomUUID(),

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(questions).values(insertable);

      const qInsertable: typeof questionMultipleChoice.$inferInsert = {
        id: insertable.questionId ?? "",
        questionId: insertable.id ?? "",
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

      const response = (
        await db.insert(questionMultipleChoice).values(qInsertable).returning()
      )[0];
      if (!response) {
        throw new Error("Failed to create question");
      }
      return response;
    }),
});
