import { or, eq } from "drizzle-orm";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { tc } from "~/lib/tryCatch";
import { db } from "~/server/db";
import { questions } from "~/server/db/schema/questions";
import { wahlen } from "~/server/db/schema/wahlen";

export const uuidType = z.string().uuid();
export enum apiErrorTypes {
  NotFound = "NotFound",
  Forbidden = "Forbidden",
  BadRequest = "BadRequest",
  Conflict = "Conflict",
  ValidationError = "ValidationError",
}

export enum apiDetailedErrorType {
  NotFound = "NotFound",

  // Forbidden types
  Forbidden = "Forbidden",
  ForbiddenAuthorisation = "Forbidden.Authorisation",
  ForbiddenInvalidOwnership = "Forbidden.InvalidOwnership",
  ForbiddenActivityMismatch = "Forbidden.ActivityMismatch",

  // BadRequest types
  BadRequestUnknown = "BadRequest.Unknown",
  BadRequestInternalServerError = "BadRequest.InternalServerError",
  BadRequestSequentialOperationFailure = "BadRequest.SequentialOperationFailure",

  // Conflict types
  ConflictDuplicate = "Conflict.Duplicate",
  ConflictInvalid = "Conflict.Invalid",

  // ValidationError types
  ValidationErrorZod = "ValidationError.Zod",
  ValidationErrorUnknown = "ValidationError.Unknown",
}

export type apiError =
  | {
      type: apiErrorTypes.ValidationError;
      detailedType: apiDetailedErrorType.ValidationErrorZod;
      message: string;
      validationError: z.ZodError;
    }
  | {
      type: apiErrorTypes;
      detailedType: apiDetailedErrorType;
      message: string;
    };

export enum apiResponseTypes {
  Success = "Success",
  FailForeward = "FailForeward",
  Inconsequential = "Inconsequential",
}

export enum apiResponseDetailedTypes {
  Success = "Success",
  FailForewardOverwriteMessage = "FailForeward.OverwriteMessage",
  FailForewardAppendMessage = "FailForeward.AppendMessage",
  FailForewardForceStatus = "FailForeward.ForceStatus",
  Inconsequential = "Inconsequential",
}

export type apiResponse<T> =
  | {
      type: apiResponseTypes.Inconsequential;
      detailedType?: apiResponseDetailedTypes.Inconsequential;
      message?: string;
      data?: T extends void | undefined ? undefined : T;
    }
  | {
      type: apiResponseTypes.Success;
      detailedType?: apiResponseDetailedTypes.Success;
      message?: string;
      data: T extends void | undefined ? undefined : T;
    }
  | {
      type: apiResponseTypes.FailForeward;
      detailedType:
        | apiResponseDetailedTypes.FailForewardOverwriteMessage
        | apiResponseDetailedTypes.FailForewardAppendMessage
        | apiResponseDetailedTypes.FailForewardForceStatus;
      message: string;
      data: T extends void | undefined ? undefined : T;
    };

export type apiType<T> = Promise<Result<apiResponse<T>, apiError>>;

/**
 * Validates the provided UUID and ensures the associated question or election is not active.
 *
 * This function first uses a schema to confirm that the given UUID is valid. It then attempts to retrieve
 * the corresponding question from the database. If a question is found, the linked election is queried
 * using the question's election identifier. If either the question or election is missing, or if the election's
 * status is active (i.e., not "draft", "queued", or "inactive"), the function returns an error Result with
 * a specific error type. Otherwise, it returns a successful Result, indicating that the election is editable.
 *
 * @param id - The UUID identifying a question or election.
 * @returns A Result signifying success if the election is non-active, or an error Result detailing the failure reason.
 */
export async function throwIfActive(
  id: z.infer<typeof uuidType>,
): apiType<void> {
  const { success, error } = uuidType.safeParse(id);
  if (!success) {
    return err({
      type: apiErrorTypes.ValidationError,
      detailedType: apiDetailedErrorType.ValidationErrorZod,
      message: "Input is not a valid UUID",
      validationError: error,
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
      type: apiErrorTypes.NotFound,
      detailedType: apiDetailedErrorType.NotFound,
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
        type: apiErrorTypes.BadRequest,
        detailedType: apiDetailedErrorType.BadRequestSequentialOperationFailure,
        message: "Database Call within Sequential Operation failed",
      });
    }

    if (
      response.isActive ||
      response.isCompleted ||
      response.hasResults ||
      response.isArchived
    ) {
      return err({
        type: apiErrorTypes.Forbidden,
        detailedType: apiDetailedErrorType.ForbiddenActivityMismatch,
        message: "You cannot edit an active election!!!",
      });
    }
    return ok({
      type: apiResponseTypes.Inconsequential,
    });
  }

  const { data: electionArray, error: dbError } = await tc(
    db.select().from(wahlen).where(eq(wahlen.id, id)),
  );
  const election = electionArray ? electionArray[0] : undefined;

  if (!election || !electionArray || dbError) {
    console.error(dbError);
    return err({
      type: apiErrorTypes.NotFound,
      detailedType: apiDetailedErrorType.NotFound,
      message: "Election not found",
    });
  }

  if (
    election.isActive ||
    election.isCompleted ||
    election.hasResults ||
    election.isArchived
  ) {
    return err({
      type: apiErrorTypes.Forbidden,
      detailedType: apiDetailedErrorType.ForbiddenActivityMismatch,
      message: "You cannot edit an active election!!!",
    });
  }
  return ok({
    type: apiResponseTypes.Inconsequential,
  });
}
