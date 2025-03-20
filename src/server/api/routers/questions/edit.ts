import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { editChunkProcedure } from "./edit-chunk";
import { questionInfo } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";

export const editRouter = createTRPCRouter({
  chunk: editChunkProcedure,
  info: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),

        title: z.string().min(3).max(256),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const question = (
        await db
          .select()
          .from(questionInfo)
          .where(eq(questionInfo.id, input.id))
      )[0];
      if (!question) {
        throw new Error("Question not found");
      }
      const response = (
        await db
          .update(questionInfo)
          .set({
            title: input.title,
            description: input.description,
          })
          .where(eq(questionInfo.id, input.id))
          .returning()
      )[0];
      if (!response) {
        throw new Error("Failed to update question");
      }

      return response;
    }),
});
