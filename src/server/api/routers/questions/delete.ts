import { type z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema/questions";
import { eq, or } from "drizzle-orm";
import { deleteById } from "../files";
import { deleteChunkProcedure } from "./delete-chunk";
import { type Result, err, ok } from "neverthrow";
import { tc } from "~/lib/tryCatch";
import {
  apiErrorTypes,
  apiErrorStatus,
  apiResponseTypes,
  apiResponseStatus,
  type apiType,
  deconstructValue,
  databaseInteraction,
  uuidType,
  validateEditability,
} from "../utility";

/**
 * Deletes a root question from the database by matching its ID or its associated questionId.
 *
 * This function first validates the provided UUID. It then attempts to delete the question record from the database.
 * If the UUID is invalid, if no matching question is found, or if the deletion operation fails, the function
 * returns an error result with a specific error type from deleteRootQuestionErrorTypes.
 *
 * @param id - A valid UUID used to identify the question to delete. The function checks both the question's primary ID
 *             and its related questionId.
 * @returns A Promise that resolves to a Result containing the deleted question record on success, or an error object
 *          detailing the failure reason.
 */
export async function deleteRootQuestion(
  id: z.infer<typeof uuidType>,
): apiType<typeof questions.$inferSelect> {
  const { success, error } = uuidType.safeParse(id);
  if (!success) {
    return err({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
      message: "Input is not a valid UUID",
      zodError: error,
    });
  }

  const response = await databaseInteraction(
    db
      .delete(questions)
      .where(or(eq(questions.id, id), eq(questions.questionId, id)))
      .returning(),
    true,
  );
  if (response.isErr()) {
    return err(response.error);
  }

  return response;
}

export enum deleteQuestionErrorTypes { // No inputtypeerror because auto validation
  NotFound = "NotFound",
  DeleteFailed = "DeleteFailed",
  Forbidden = "Forbidden",
}

type deleteQuestionError = {
  type: deleteQuestionErrorTypes;
  message: string;
};

export const deletionRouter = createTRPCRouter({
  chunk: deleteChunkProcedure,
  info: protectedProcedure
    .input(uuidType)
    .mutation(async ({ input }): apiType<void> => {
      const tIA = await validateEditability(input);
      if (tIA.isErr()) {
        return err(tIA.error);
      }

      const response = await databaseInteraction(
        db
          .select()
          .from(questionInfo)
          .where(
            or(eq(questionInfo.id, input), eq(questionInfo.questionId, input)),
          ),
      );
      if (response.isErr()) {
        return err(response.error);
      }

      const data = deconstructValue(response).data();
      if (data.image) {
        const dBId = await deleteById(data.image);
        if (dBId.isErr()) {
          return err(dBId.error);
        }
      }
      const deleteInternal = await databaseInteraction(
        db.delete(questionInfo).where(eq(questionInfo.id, data.id)).returning(),
      );
      if (deleteInternal.isErr()) {
        return err(deleteInternal.error);
      }

      const dRQ = await deleteRootQuestion(data.questionId);
      if (dRQ.isErr()) {
        return err(dRQ.error);
      }

      return ok({
        status: apiResponseStatus.Success,
        type: apiResponseTypes.SuccessNoData,
        message: "Question deleted successfully",
      });
    }),
  true_false: protectedProcedure
    .input(uuidType)
    .mutation(async ({ input }): Promise<Result<void, deleteQuestionError>> => {
      const tIA = await throwIfActive(input);
      if (tIA.isErr()) {
        if (tIA.error.type === throwIfActiveErrorTypes.Active) {
          return err({
            type: deleteQuestionErrorTypes.Forbidden,
            message: "You cannot delete an active election!!!",
          });
        }
        return err({
          type: deleteQuestionErrorTypes.NotFound,
          message: tIA.error.message,
        });
      }

      const { data: responseArray, error: responseArrayError } = await tc(
        db
          .select()
          .from(questionTrueFalse)
          .where(
            or(
              eq(questionTrueFalse.id, input),
              eq(questionTrueFalse.questionId, input),
            ),
          ),
      );
      if (responseArrayError) {
        console.error(responseArrayError);
        return err({
          type: deleteQuestionErrorTypes.DeleteFailed,
          message: "Failed to delete question",
        });
      }

      const response = responseArray ? responseArray[0] : undefined;
      if (!response) {
        return err({
          type: deleteQuestionErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      const delImgResquested = [response.o1Image, response.o2Image];

      for (const img of delImgResquested) {
        if (img) {
          const dBId = await deleteById(img);
          if (dBId.isErr()) {
            return err({
              type: deleteQuestionErrorTypes.DeleteFailed,
              message: "Failed to delete question image",
            });
          }
        }
      }

      const { data: delInternalArray, error: dbError2 } = await tc(
        db
          .delete(questionTrueFalse)
          .where(eq(questionTrueFalse.id, response.id))
          .returning(),
      );
      if (dbError2) {
        console.error(dbError2);
        return err({
          type: deleteQuestionErrorTypes.DeleteFailed,
          message: "Failed to delete question",
        });
      }

      const delInternal = delInternalArray ? delInternalArray[0] : undefined;
      if (!delInternal || !delInternalArray) {
        return err({
          type: deleteQuestionErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      const dRQ = await deleteRootQuestion(response.questionId);
      if (dRQ.isErr()) {
        if (dRQ.error.status === deleteRootQuestionErrorTypes.NotFound) {
          return err({
            type: deleteQuestionErrorTypes.NotFound,
            message: dRQ.error.message,
          });
        }
        return err({
          type: deleteQuestionErrorTypes.DeleteFailed,
          message: dRQ.error.message,
        });
      }

      return ok();
    }),
  multiple_choice: protectedProcedure
    .input(uuidType)
    .mutation(async ({ input }): Promise<Result<void, deleteQuestionError>> => {
      const tIA = await throwIfActive(input);
      if (tIA.isErr()) {
        if (tIA.error.type === throwIfActiveErrorTypes.Active) {
          return err({
            type: deleteQuestionErrorTypes.Forbidden,
            message: "You cannot delete an active election!!!",
          });
        }
        return err({
          type: deleteQuestionErrorTypes.NotFound,
          message: tIA.error.message,
        });
      }

      const { data: responseArray, error: responseArrayError } = await tc(
        db
          .select()
          .from(questionMultipleChoice)
          .where(
            or(
              eq(questionMultipleChoice.id, input),
              eq(questionMultipleChoice.questionId, input),
            ),
          ),
      );
      if (responseArrayError) {
        console.error(responseArrayError);
        return err({
          type: deleteQuestionErrorTypes.DeleteFailed,
          message: "Failed to delete question",
        });
      }

      const response = responseArray ? responseArray[0] : undefined;
      if (!response) {
        return err({
          type: deleteQuestionErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      if (response.content) {
        const delImgResquested = response.content
          .map((item) => item.image)
          .filter(Boolean);
        for (const img of delImgResquested) {
          if (img) {
            const dBId = await deleteById(img);
            if (dBId.isErr()) {
              return err({
                type: deleteQuestionErrorTypes.DeleteFailed,
                message: "Failed to delete question image",
              });
            }
          }
        }
      }

      const { error: dbError2 } = await tc(
        db
          .delete(questionMultipleChoice)
          .where(eq(questionMultipleChoice.id, response.id))
          .returning(),
      );
      if (dbError2) {
        console.error(dbError2);
        return err({
          type: deleteQuestionErrorTypes.DeleteFailed,
          message: "Failed to delete question",
        });
      }

      const dRQ = await deleteRootQuestion(response.questionId);
      if (dRQ.isErr()) {
        if (dRQ.error.status === deleteRootQuestionErrorTypes.NotFound) {
          return err({
            type: deleteQuestionErrorTypes.NotFound,
            message: dRQ.error.message,
          });
        }
        return err({
          type: deleteQuestionErrorTypes.DeleteFailed,
          message: dRQ.error.message,
        });
      }

      return ok();
    }),
});
