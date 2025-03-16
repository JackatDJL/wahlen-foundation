import { randomUUID } from "crypto";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { questions } from "~/server/db/schema";
import { chunkProcedure } from "./create-chunk";

export const creationRouter = createTRPCRouter({
  chunk: chunkProcedure,
  info: publicProcedure
    .input(
      z.object({
        wahlId: z.string().uuid(),

        title: z.string().min(3).max(256),

        markdown: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const insertable: typeof questions.$inferInsert = {
        id: randomUUID(),
        wahlId: input.wahlId,

        title: input.title,

        type: "info",

        options: {
          markdown: input.markdown,
        },

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = await db
        .insert(questions)
        .values(insertable)
        .returning();

      if (!response[0]) {
        throw new Error("Failed to create question");
      }

      return response[0];
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

        title: input.title,

        type: "true_false",

        options: {
          description: input.description,
          content: {
            option1: {
              title: input.content.option1.title,
              description: input.content.option1.description,
              correct: input.content.option1.correct,
              colour: input.content.option1.colour,
            },
            option2: {
              title: input.content.option2.title,
              description: input.content.option2.description,
              correct: input.content.option2.correct,
              colour: input.content.option2.colour,
            },
          },
        },

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = await db
        .insert(questions)
        .values(insertable)
        .returning();

      if (!response[0]) {
        throw new Error("Failed to create question");
      }

      return response[0];
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

        title: input.title,

        type: "multiple_choice",

        options: {
          content: input.content.map((option) => ({
            title: option.title,
            description: option.description,
            correct: option.correct,
            colour: option.colour,
          })),
        },

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = await db
        .insert(questions)
        .values(insertable)
        .returning();

      if (!response[0]) {
        throw new Error("Failed to create question");
      }

      return response[0];
    }),
});
