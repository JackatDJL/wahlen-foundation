import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { questionInfo, questions, wahlen } from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import { deleteById } from "../files";

const uuidType = z.string().uuid();
export async function throwIfActive(id: z.infer<typeof uuidType>) {
  uuidType.parse(id);
  // Try to find the question using id as either questions.id or questions.questionId
  const question = (
    await db
      .select()
      .from(questions)
      .where(or(eq(questions.id, id), eq(questions.questionId, id)))
  )[0];
  if (question) {
    const response = (
      await db.select().from(wahlen).where(eq(wahlen.id, question.wahlId))
    )[0];
    if (!response) {
      throw new Error("Election not found");
    }
    if (
      response.status !== "draft" &&
      response.status !== "queued" &&
      response.status !== "inactive"
    ) {
      throw new Error("You cannot edit an active election!!!");
    }
    return;
  }
  // If not a question, try to find a wahlen record directly
  const election = (await db.select().from(wahlen).where(eq(wahlen.id, id)))[0];
  if (election) {
    if (
      election.status !== "draft" &&
      election.status !== "queued" &&
      election.status !== "inactive"
    ) {
      throw new Error("You cannot edit an active election!!!");
    }
    return;
  }
  throw new Error("Record not found");
}

export const deletionRouter = createTRPCRouter({
  chunk: protectedProcedure.mutation(() => ""),
  info: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      await throwIfActive(input);
      const response = (
        await db
          .select()
          .from(questionInfo)
          .where(
            or(eq(questionInfo.id, input), eq(questionInfo.questionId, input)),
          )
      )[0];
      if (!response) {
        throw new Error("Question info not found");
      }
      if (response.image) {
        await deleteById(response.image);
      }
      const delInternal = (
        await db
          .delete(questionInfo)
          .where(eq(questionInfo.id, response.id))
          .returning()
      )[0];
      if (!delInternal) {
        throw new Error("Failed to delete question info");
      }
      const delRoot = (
        await db
          .delete(questions)
          .where(eq(questions.id, response.questionId))
          .returning()
      )[0];
      if (!delRoot) {
        throw new Error("Failed to delete root question");
      }
      return; // No return because its deleted
    }),
  // TODO: Continue
});
