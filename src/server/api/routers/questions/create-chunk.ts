import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import { randomUUID } from "crypto";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema";

export const chunkProcedure = publicProcedure
  .input(
    z.object({
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
    }),
  )
  .mutation(async ({ input }) => {
    const responses: (
      | typeof questionInfo.$inferSelect
      | typeof questionTrueFalse.$inferSelect
      | typeof questionMultipleChoice.$inferSelect
    )[] = [];
    for (const chunk of input.data) {
      switch (chunk.type) {
        case "info": {
          const rootInfoInsertable: typeof questions.$inferInsert = {
            id: randomUUID(),
            wahlId: input.wahlId,

            type: "info",

            questionId: randomUUID(),

            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.insert(questions).values(rootInfoInsertable);

          const infoInsertable: typeof questionInfo.$inferInsert = {
            id: rootInfoInsertable.questionId ?? "",
            questionId: rootInfoInsertable.id ?? "",

            title: chunk.title,
            description: chunk.description,

            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const InfoResponse = (
            await db.insert(questionInfo).values(infoInsertable).returning()
          )[0];
          if (!InfoResponse) {
            throw new Error("Failed to create question");
          }

          responses.push(InfoResponse);
          break;
        }

        case "true_false": {
          const rootTrueFalseInsertable: typeof questions.$inferInsert = {
            id: randomUUID(),
            wahlId: input.wahlId,

            type: "true_false",

            questionId: randomUUID(),

            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.insert(questions).values(rootTrueFalseInsertable);

          const trueFalseInsertable: typeof questionTrueFalse.$inferInsert = {
            id: rootTrueFalseInsertable.questionId ?? "",
            questionId: rootTrueFalseInsertable.id ?? "",

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

          const trueFalseResponse = (
            await db
              .insert(questionTrueFalse)
              .values(trueFalseInsertable)
              .returning()
          )[0];
          if (!trueFalseResponse) {
            throw new Error("Failed to create question");
          }

          responses.push(trueFalseResponse);
          break;
        }

        case "multiple_choice": {
          const rootMultipleChoiceInsertable: typeof questions.$inferInsert = {
            id: randomUUID(),
            wahlId: input.wahlId,

            type: "multiple_choice",
            questionId: randomUUID(),

            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.insert(questions).values(rootMultipleChoiceInsertable);

          const multipleChoiceInsertable: typeof questionMultipleChoice.$inferInsert =
            {
              id: rootMultipleChoiceInsertable.questionId ?? "",
              questionId: rootMultipleChoiceInsertable.id ?? "",

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

          const multipleChoiceResponse = (
            await db
              .insert(questionMultipleChoice)
              .values(multipleChoiceInsertable)
              .returning()
          )[0];
          if (!multipleChoiceResponse) {
            throw new Error("Failed to create question");
          }

          responses.push(multipleChoiceResponse);
          break;
        }
      }

      return responses;
    }
  });
