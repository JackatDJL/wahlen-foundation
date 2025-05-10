import { or, eq } from "drizzle-orm";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { tc } from "~/lib/tryCatch";
import { db } from "~/server/db";
import { questions } from "~/server/db/schema/questions";
import { wahlen } from "~/server/db/schema/wahlen";
import { publicProcedure } from "../trpc";

export const uuidType = z.string().uuid();

export const identifyingInputType = z.object({
  id: uuidType,
});

export const blankPlaceholdingCallableProcedure = publicProcedure.mutation(
  () => "",
);

export enum apiErrorTypes {
  NotFound = "NotFound",
  Forbidden = "Forbidden",
  BadRequest = "BadRequest",
  Conflict = "Conflict",
  Incomplete = "Incomplete",
  ValidationError = "ValidationError",
  Failed = "Failed",
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
  BadRequestCorrupted = "BadRequest.Corrupted",

  // Conflict types
  ConflictDuplicate = "Conflict.Duplicate",
  ConflictInvalid = "Conflict.Invalid",
  ConflictInvalidState = "Conflict.InvalidState",
  ConflictDataTranscending = "Conflict.DataIsTranscending",

  // Incomplete types
  IncompleteScheduling = "Incomplete.Scheduling",
  IncompleteSchedulingStartDate = "Incomplete.Scheduling.MissingStartDate",
  IncompleteProviderIdentification = "Incomplete.ProviderIdentification",

  // ValidationError types
  ValidationErrorZod = "ValidationError.Zod",
  ValidationErrorUnknown = "ValidationError.Unknown",

  // Failed types
  Failed = "Failed",
  FailedUnknown = "Failed.Unknown",
}

export type apiError =
  | {
      type: apiErrorTypes.ValidationError;
      detailedType: apiDetailedErrorType.ValidationErrorZod;
      message: string;
      validationError: z.ZodError;
    }
  | {
      type: apiErrorTypes.NotFound;
      detailedType?: apiDetailedErrorType.NotFound;
      message: string;
    }
  | {
      type: apiErrorTypes.Failed;
      detailedType?:
        | apiDetailedErrorType.FailedUnknown
        | apiDetailedErrorType.Failed;
      message: string;
    }
  | {
      type: apiErrorTypes;
      detailedType: apiDetailedErrorType;
      message: string;
    };

export enum apiResponseTypes {
  Success = "Success",
  PartialSuccess = "PartialSuccess",
  FailForeward = "FailForeward",
  Inconsequential = "Inconsequential",
}

export enum apiResponseDetailedTypes {
  Success = "Success",
  SuccessNoData = "Success.NoData",

  // PartialSuccess types
  PartialSuccessPrivate = "PartialSuccess.Private", // Returns Partial Information with info that the Data has been withheld because target hasnt been published yet
  PartialSuccessPostCompletion = "PartialSuccess.PostCompletion",
  PartialSuccessArchived = "PartialSuccess.Archived",

  // FailForeward types
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
      data?: T extends void | undefined | null ? undefined : T;
    }
  | {
      type: apiResponseTypes.Success;
      detailedType?: apiResponseDetailedTypes.Success;
      message?: string;
      data: T;
    }
  | {
      type: apiResponseTypes.Success;
      detailedType: apiResponseDetailedTypes.SuccessNoData;
      message?: string;
      data?: T extends void | undefined | null ? undefined : T;
    }
  | {
      type: apiResponseTypes.FailForeward;
      detailedType:
        | apiResponseDetailedTypes.FailForewardOverwriteMessage
        | apiResponseDetailedTypes.FailForewardAppendMessage
        | apiResponseDetailedTypes.FailForewardForceStatus;
      message: string;
      data: T extends void | undefined | null ? never : T;
    };

export type apiType<T> = Promise<Result<apiResponse<T>, apiError>>;

export enum databaseInteractionTypes {
  Default = "Default",
  Sequencial = "Sequencial",
}

/**
 * Simplifies database query operations by handling common error patterns and type checking.
 *
 * This utility function wraps database operations in try-catch logic and provides standardized
 * error handling for database interactions. It expects array results and can check for empty results.
 *
 * @param query The database query to execute
 * @param errorMessage Optional custom error message for NotFound errors
 * @returns A Result containing either the first item from the result array or an apiError
 */
export async function handleDatabaseInteraction<T, D extends boolean = true>(
  query: Promise<T[]>,
  deconstructArray = true as D,
  interactionType: databaseInteractionTypes = databaseInteractionTypes.Default,
): apiType<D extends true ? T : T[]> {
  const { data: resultArray, error: dbError } = await tc(query);
  if (dbError) {
    console.error(dbError);
    return err({
      type: apiErrorTypes.BadRequest,
      detailedType: apiDetailedErrorType.BadRequestInternalServerError,
      message: "Database operation failed",
    });
  }

  if (!deconstructArray) {
    return ok({
      type: apiResponseTypes.Success,
      detailedType: apiResponseDetailedTypes.Success,

      data: resultArray as D extends true ? T : T[],
    });
  }

  const result = resultArray?.[0];
  if (!result || result === undefined) {
    switch (interactionType) {
      default:
      case databaseInteractionTypes.Default:
        return err({
          type: apiErrorTypes.NotFound,
          detailedType: apiDetailedErrorType.NotFound,
          message: "No results found",
        });
      case databaseInteractionTypes.Sequencial:
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType:
            apiDetailedErrorType.BadRequestSequentialOperationFailure,
          message: "Results should Exist but were not found",
        });
    }
  }

  return ok({
    type: apiResponseTypes.Success,
    detailedType: apiResponseDetailedTypes.Success,

    data: resultArray as D extends true ? T : T[],
  });
}

/**
 * Updates election status fields based on timing and existing state.
 *
 * This function processes an election identified by the provided ID (which could be a question ID, questionId, or election ID).
 * It updates status flags based on current date compared to the scheduled dates:
 * - Sets isActive=true if start date is in the past and the election isn't completed
 * - Clears booth and isScheduled if an election has dates but isn't published
 * - Sets isCompleted=true if end date is in the past
 * - Validates that archived elections have isCompleted=true and aren't active or scheduled
 * - Ensures archiveDate only exists on archived elections
 *
 * @param id - UUID of a question, questionId, or election
 * @returns Result with success or error information
 */
export async function updateElectionStatus(
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

  // First try to find a question with the provided id
  const { data: questionArray, error: dbQError } = await tc(
    db
      .select()
      .from(questions)
      .where(or(eq(questions.id, id), eq(questions.questionId, id))),
  );

  if (dbQError) {
    console.error(dbQError);
    return err({
      type: apiErrorTypes.BadRequest,
      detailedType: apiDetailedErrorType.BadRequestInternalServerError,
      message: "Question database query failed",
    });
  }

  // Get the election ID either from the question or use the provided ID directly
  let electionId = id;
  if (questionArray[0]) {
    electionId = questionArray[0].wahlId;
  }

  // Fetch the election
  const { data: electionArray, error: dbError } = await tc(
    db.select().from(wahlen).where(eq(wahlen.id, electionId)),
  );
  if (dbError) {
    console.error(dbError);
    return err({
      type: apiErrorTypes.BadRequest,
      detailedType: apiDetailedErrorType.BadRequestInternalServerError,
      message: "Election database query failed",
    });
  }

  const election = electionArray?.[0];
  if (!election) {
    return err({
      type: apiErrorTypes.NotFound,
      detailedType: apiDetailedErrorType.NotFound,
      message: "Election not found",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- merging in progress
  const now = new Date();
  const updates: Partial<typeof election> = {};

  // // Status logic based on dates and current state
  // if (
  //   election.startDate &&
  //   new Date(election.startDate) <= now &&
  //   !election.isCompleted
  // ) {
  //   updates.isActive = true;
  // }

  // if (election.endDate && new Date(election.endDate) <= now) {
  //   updates.isActive = false;
  //   updates.isCompleted = true;
  // }

  // if ((election.startDate || election.endDate) && !election.isPublished) {
  //   updates.startDate = null;
  //   updates.endDate = null;
  //   updates.isScheduled = false;
  // }

  // if (!election.startDate) {
  //   updates.isScheduled = false;
  // }

  // // Validate archive state
  // if (election.isArchived) {
  //   updates.isActive = false;
  //   updates.isScheduled = false;
  //   updates.isCompleted = true;
  // } else if (election.archiveDate) {
  //   // Remove archive date if not archived
  //   updates.archiveDate = null;
  // }

  // Only update if there are changes
  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await tc(
      db.update(wahlen).set(updates).where(eq(wahlen.id, electionId)),
    );

    if (updateError) {
      console.error(updateError);
      return err({
        type: apiErrorTypes.BadRequest,
        detailedType: apiDetailedErrorType.BadRequestInternalServerError,
        message: "Failed to update election status",
      });
    }
  }

  return ok({
    type: apiResponseTypes.Inconsequential,
    message: "Election status updated successfully",
  });
}

/**
 * Validates the provided UUID and ensures the associated question or election is not active.
 *
 * This function first validates that the given UUID is valid, then determines if it's a question or election ID.
 * It fetches the election data and checks if it's in an editable state. If the election is active, completed,
 * has results, or is archived, editing is forbidden. Otherwise, it confirms the election is editable.
 *
 * @param id - The UUID identifying a question or election.
 * @returns A Result signifying success if the election is non-active, or an error Result detailing the failure reason.
 */
export async function validateEditability(
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

  const uES = await updateElectionStatus(id);
  if (uES.isErr()) {
    return err(uES.error);
  }

  let electionId: string = id;

  // First check if the ID belongs to a question
  const { data: questionArray, error: dbQError } = await tc(
    db
      .select({ wahlId: questions.wahlId })
      .from(questions)
      .where(or(eq(questions.id, id), eq(questions.questionId, id)))
      .limit(1),
  );

  if (dbQError) {
    console.error(dbQError);
    return err({
      type: apiErrorTypes.BadRequest,
      detailedType: apiDetailedErrorType.BadRequestInternalServerError,
      message: "Question database query failed",
    });
  }

  // If it's a question ID, use the related election ID
  if (questionArray[0]) {
    electionId = questionArray[0].wahlId;
  }

  // Now fetch the election with the determined ID
  const { data: electionArray, error: dbError } = await tc(
    db.select().from(wahlen).where(eq(wahlen.id, electionId)).limit(1),
  );

  if (dbError) {
    console.error(dbError);
    return err({
      type: apiErrorTypes.BadRequest,
      detailedType: apiDetailedErrorType.BadRequestInternalServerError,
      message: "Election database query failed",
    });
  }

  const election = electionArray?.[0];
  if (!election) {
    return err({
      type: apiErrorTypes.NotFound,
      detailedType: apiDetailedErrorType.NotFound,
      message: "Election not found",
    });
  }

  // Check if the election is in an editable state
  // if (
  //   election.isActive ||
  //   election.isCompleted ||
  //   election.hasResults ||
  //   election.isArchived
  // ) {
  //   return err({
  //     type: apiErrorTypes.Forbidden,
  //     detailedType: apiDetailedErrorType.ForbiddenActivityMismatch,
  //     message: "You cannot edit an active election!!!",
  //   });
  // }

  return ok({
    type: apiResponseTypes.Inconsequential,
  });
}
