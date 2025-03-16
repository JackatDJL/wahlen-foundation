import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import { randomUUID } from "crypto";
import { db } from "~/server/db";
import { questions } from "~/server/db/schema";

export const chunkProcedure = publicProcedure
  .input(
    z.object({
      wahlId: z.string().uuid(),
      data: z.array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("info"),
            title: z.string().min(3).max(256),
            markdown: z.string().optional(),
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
    }),
  )
  .mutation(async ({ input }) => {
    const now = new Date();
    const insertables = input.data.map((item) => {
      switch (item.type) {
        case "info":
          return {
            id: randomUUID(),
            wahlId: input.wahlId,
            title: item.title,
            type: "info" as const,
            options: {
              markdown: item.markdown,
            },
            createdAt: now,
            updatedAt: now,
          };
        case "true_false":
          return {
            id: randomUUID(),
            wahlId: input.wahlId,
            title: item.title,
            type: "true_false" as const,
            options: {
              description: item.description,
              content: {
                option1: {
                  title: item.content.option1.title,
                  description: item.content.option1.description,
                  correct: item.content.option1.correct,
                  colour: item.content.option1.colour,
                },
                option2: {
                  title: item.content.option2.title,
                  description: item.content.option2.description,
                  correct: item.content.option2.correct,
                  colour: item.content.option2.colour,
                },
              },
            },
            createdAt: now,
            updatedAt: now,
          };
        case "multiple_choice":
          return {
            id: randomUUID(),
            wahlId: input.wahlId,
            title: item.title,
            type: "multiple_choice" as const,
            options: {
              description: item.description,
              content: item.content.map((option) => ({
                title: option.title,
                description: option.description,
                correct: option.correct,
                colour: option.colour,
              })),
            },
            createdAt: now,
            updatedAt: now,
          };
        default:
          throw new Error("Unsupported question type");
      }
    });

    const responses = await db
      .insert(questions)
      .values(insertables)
      .returning();

    if (responses.length === 0) {
      throw new Error("Failed to create questions");
    }

    return responses;
  });
