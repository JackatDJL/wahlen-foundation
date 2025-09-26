import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questionTrueFalse,
} from "~/server/db/schema/questions";
import { deleteById } from "../files";
import { randomUUID } from "crypto";
import { err, ok } from "neverthrow";
import {
  type apiError,
  apiErrorStatus,
  apiErrorTypes,
  type apiOk,
  apiResponseStatus,
  apiResponseTypes,
  type apiType,
  databaseInteraction,
  deconstruct,
  orReport,
} from "../utility";
import { type Result } from "neverthrow";

// Helper function to process multiple choice content updates
async function processMultipleChoiceContent(
  currentContent: NonNullable<
    (typeof questionMultipleChoice.$inferSelect)["content"]
  >,
  updates: Extract<
    z.infer<typeof editChunkType>[number],
    { type: "multiple_choice" }
  >["content"],
): Promise<
  Result<
    NonNullable<(typeof questionMultipleChoice.$inferSelect)["content"]>,
    apiError
  >
> {
  let updatedContent = [...currentContent];

  // Handle deletions first
  for (const item of updates) {
    if (item.type === "delete") {
      const target = updatedContent.find((c) => c.id === item.id);
      if (target?.image) {
        const deleteResult = await deleteById(target.image);
        if (deleteResult.isErr()) {
          return err({
            status: apiErrorStatus.Failed,
            type: apiErrorTypes.Failed,
            message: "Failed to delete image",
            error: deleteResult.error,
          });
        }
      }
      updatedContent = updatedContent.filter((c) => c.id !== item.id);
    }
  }

  // Handle edits
  for (const item of updates) {
    if (item.type === "edit") {
      updatedContent = updatedContent.map((c) => {
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
  }

  // Handle additions
  for (const item of updates) {
    if (item.type === "add") {
      updatedContent.push({
        id: randomUUID(),
        title: item.title,
        description: item.description,
        correct: item.correct,
        colour: item.colour,
      });
    }
  }

  return ok(updatedContent);
}

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

type EditChunkReturnDataTypes = Awaited<
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect
>;

type EditChunkReturnType = apiOk<EditChunkReturnDataTypes>;

type EditChunkResultTypes = apiType<EditChunkReturnDataTypes>;

export const editChunkProcedure = protectedProcedure
  .input(editChunkType)
  .mutation(async ({ input }): apiType<Awaited<EditChunkReturnType>[]> => {
    const results: Awaited<EditChunkResultTypes>[] = [];

    for (const item of input) {
      switch (item.type) {
        case "info": {
          const editInfoResponse = await databaseInteraction(
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
          if (editInfoResponse.isErr()) {
            results.push(err(editInfoResponse.error));
            continue;
          }

          break;
        }
        case "true_false": {
          const editTrueFalseResponse = await databaseInteraction(
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
          if (editTrueFalseResponse.isErr()) {
            results.push(err(editTrueFalseResponse.error));
            continue;
          }

          break;
        }
        case "multiple_choice": {
          const editMultipleChoiceData = await databaseInteraction(
            db
              .select()
              .from(questionMultipleChoice)
              .where(eq(questionMultipleChoice.id, item.id)),
          );
          if (editMultipleChoiceData.isErr()) {
            results.push(err(editMultipleChoiceData.error));
            continue;
          }

          const currentData = deconstruct(editMultipleChoiceData).data();
          const processResult = await processMultipleChoiceContent(
            currentData.content ?? [],
            item.content,
          );

          if (processResult.isErr()) {
            results.push(err(processResult.error));
            continue;
          }

          const editMultipleChoiceResponse = await databaseInteraction(
            db
              .update(questionMultipleChoice)
              .set({
                title: item.title,
                description: item.description,
                content: processResult.value,
                updatedAt: new Date(),
              })
              .where(eq(questionMultipleChoice.id, item.id))
              .returning(),
          );
          if (editMultipleChoiceResponse.isErr()) {
            results.push(err(editMultipleChoiceResponse.error));
            continue;
          }

          break;
        }
      }

      results.push(
        ok({
          status: apiResponseStatus.Success,
          type: apiResponseTypes.SuccessNoData,
          message: `${item.type.toUpperCase()} Question edited successfully`,
        }),
      );
    }

    if (results.every((result) => result.isOk())) {
      return ok({
        status: apiResponseStatus.Success,
        type: apiResponseTypes.Success,
        message: "Questions edit successfully",
        data: results as Awaited<EditChunkReturnType>[], // No need to filter, all is Ok<T>
      });
    } else {
      const failedCount = results.filter((result) => result.isErr()).length;
      return err({
        status: apiErrorStatus.Failed,
        type: apiErrorTypes.Failed,
        message: `Failed to edit ${failedCount} questions`,
        error: results
          .filter((result) => result.isErr())
          .map((result) => result.error),
      }).mapErr(orReport);
    }
  });
