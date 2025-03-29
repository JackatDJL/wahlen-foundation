import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
  wahlen,
} from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import { deleteById } from "../files";
import { deleteChunkProcedure } from "./delete-chunk";
import { type Result, err, ok } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const uuidType = z.string().uuid();

export enum throwIfActiveErrorTypes {
  NotFound = "NotFound",
  InputTypeError = "InputTypeError",
  Active = "ElectionActive",
}

type throwIfActiveError =
  | {
      type: Exclude<
        throwIfActiveErrorTypes,
        throwIfActiveErrorTypes.InputTypeError
      >;
      message: string;
    }
  | {
      type: throwIfActiveErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

/**
 * Validates the provided UUID and ensures the associated question or election is not active.
 *
 * This function first uses a schema to confirm that the given UUID is valid. It then attempts to retrieve
 * the corresponding question from the database. If a question is found, the linked election is queried
 * using the question's election identifier. If either the question or election is missing, or if the election’s
 * status is active (i.e., not "draft", "queued", or "inactive"), the function returns an error Result with
 * a specific error type. Otherwise, it returns a successful Result, indicating that the election is editable.
 *
 * @param id - The UUID identifying a question or election.
 * @returns A Result signifying success if the election is non-active, or an error Result detailing the failure reason.
 */
export async function throwIfActive(
  id: z.infer<typeof uuidType>,
): Promise<Result<void, throwIfActiveError>> {
  const { success, error } = uuidType.safeParse(id);
  if (!success) {
    return err({
      type: throwIfActiveErrorTypes.InputTypeError,
      message: "Input is not a valid UUID",
      zodError: error,
    });
  }

  const { data: questionArray, error: dbQError } = await tc(
    db
      .select()
      .from(questions)
      .where(or(eq(questions.id, id), eq(questions.questionId, id))),
  );

  const question = questionArray ? questionArray[0] : undefined;

  if (!question || !questionArray || dbQError) {
    console.error(dbQError);
    return err({
      type: throwIfActiveErrorTypes.NotFound,
      message: "Question not found",
    });
  }

  if (question) {
    const { data: responseArray, error: dbError } = await tc(
      db.select().from(wahlen).where(eq(wahlen.id, question.wahlId)),
    );
    const response = responseArray ? responseArray[0] : undefined;
    if (!response || !responseArray || dbError) {
      console.error(dbError);
      return err({
        type: throwIfActiveErrorTypes.NotFound,
        message: "Election not found",
      });
    }

    if (
      response.status !== "draft" &&
      response.status !== "queued" &&
      response.status !== "inactive"
    ) {
      return err({
        type: throwIfActiveErrorTypes.Active,
        message: "You cannot edit an active election!!!",
      });
    }
    return ok();
  }

  const { data: electionArray, error: dbError } = await tc(
    db.select().from(wahlen).where(eq(wahlen.id, id)),
  );
  const election = electionArray ? electionArray[0] : undefined;

  if (!election || !electionArray || dbError) {
    console.error(dbError);
    return err({
      type: throwIfActiveErrorTypes.NotFound,
      message: "Election not found",
    });
  }

  if (
    election.status !== "draft" &&
    election.status !== "queued" &&
    election.status !== "inactive"
  ) {
    return err({
      type: throwIfActiveErrorTypes.Active,
      message: "You cannot edit an active election!!!",
    });
  }
  return ok();
}

export enum deleteRootQuestionErrorTypes {
  NotFound = "NotFound",
  InputTypeError = "InputTypeError",
  DeleteFailed = "DeleteFailed",
}

type deleteRootQuestionError =
  | {
      type: Exclude<
        deleteRootQuestionErrorTypes,
        deleteRootQuestionErrorTypes.InputTypeError
      >;
      message: string;
    }
  | {
      type: deleteRootQuestionErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

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
): Promise<Result<typeof questions.$inferSelect, deleteRootQuestionError>> {
  const { success, error } = uuidType.safeParse(id);
  if (!success) {
    return err({
      type: deleteRootQuestionErrorTypes.InputTypeError,
      message: "Input is not a valid UUID",
      zodError: error,
    });
  }

  const { data: responseArray, error: dbError } = await tc(
    db
      .delete(questions)
      .where(or(eq(questions.id, id), eq(questions.questionId, id)))
      .returning(),
  );

  const response = responseArray ? responseArray[0] : undefined;

  if (dbError) {
    console.error(dbError);
    return err({
      type: deleteRootQuestionErrorTypes.DeleteFailed,
      message: "Failed to delete question",
    });
  }

  if (!response || !responseArray) {
    return err({
      type: deleteRootQuestionErrorTypes.NotFound,
      message: "Question not found",
    });
  }

  return ok(response);
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

      const { data: responseArray, error: dbError } = await tc(
        db
          .select()
          .from(questionInfo)
          .where(
            or(eq(questionInfo.id, input), eq(questionInfo.questionId, input)),
          ),
      );
      const response = responseArray ? responseArray[0] : undefined;

      if (dbError) {
        console.error(dbError);
        return err({
          type: deleteQuestionErrorTypes.DeleteFailed,
          message: "Failed to delete question",
        });
      }
      if (!response || !responseArray) {
        return err({
          type: deleteQuestionErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      if (response.image) {
        const dBId = await deleteById(response.image);
        if (dBId.isErr()) {
          return err({
            type: deleteQuestionErrorTypes.DeleteFailed,
            message: "Failed to delete question image",
          });
        }
      }

      const { data: delInternalArray, error: dbError2 } = await tc(
        db
          .delete(questionInfo)
          .where(eq(questionInfo.id, response.id))
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
        if (dRQ.error.type === deleteRootQuestionErrorTypes.NotFound) {
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
        if (dRQ.error.type === deleteRootQuestionErrorTypes.NotFound) {
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
        if (dRQ.error.type === deleteRootQuestionErrorTypes.NotFound) {
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
