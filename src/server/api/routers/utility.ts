/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
// WIP_LINT: DISABLE THIS
import { or, eq } from "drizzle-orm";
import { type Err, err, type Ok, ok, type Result } from "neverthrow";
import { z } from "zod";
import { tc } from "~/lib/tryCatch";
import { db } from "~/server/db";
import { questions } from "~/server/db/schema/questions";
import { wahlen } from "~/server/db/schema/wahlen";
import { publicProcedure } from "../trpc";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";

export const uuidType = z.string().uuid();

export const identifyingInputType = z.object({
  id: uuidType,
});

export const blankPlaceholdingCallableProcedure = publicProcedure.mutation(
  () => "",
);

export enum apiErrorStatus {
  NotFound = "NotFound",
  Forbidden = "Forbidden",
  BadRequest = "BadRequest",
  Conflict = "Conflict",
  Incomplete = "Incomplete",
  ValidationError = "ValidationError",
  Failed = "Failed",
}

export enum apiErrorTypes {
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
      status: apiErrorStatus.ValidationError;
      type: apiErrorTypes.ValidationErrorZod;
      message: string;
      error: z.ZodError;
      _internal: {
        reported: false;
        reportable: false;
      };
    }
  | {
      status: apiErrorStatus.BadRequest;
      type:
        | apiErrorTypes.BadRequestCorrupted
        | apiErrorTypes.BadRequestInternalServerError
        | apiErrorTypes.BadRequestSequentialOperationFailure
        | apiErrorTypes.BadRequestUnknown;
      message: string;
      error: unknown;
      _internal: {
        reported: boolean;
        reportable: true;
      };
    }
  | {
      status: apiErrorStatus.NotFound;
      type: apiErrorTypes.NotFound;
      message: string;
      error: null;
      _internal: {
        reported: false;
        reportable: false;
      };
    }
  | {
      status: apiErrorStatus.Failed;
      type: apiErrorTypes.FailedUnknown | apiErrorTypes.Failed;
      message: string;
      error?: unknown;
      _internal: {
        reported: boolean;
        reportable: true;
      };
    }
  | {
      status: apiErrorStatus;
      type: apiErrorTypes;
      message: string;
      error?: unknown;
      _internal: {
        reported: boolean;
        reportable: boolean;
      };
    };

export enum apiResponseStatus {
  Success = "Success",
  PartialSuccess = "PartialSuccess",
  FailForeward = "FailForeward",
  Inconsequential = "Inconsequential",
}

export enum apiResponseTypes {
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

// TODO: Neue idee, auch ein _intenal für apiResponse mit auto maping und dass alle apiResponses auch gelogt werden in postgress oder sentry
export type apiResponse<T> =
  | {
      status: apiResponseStatus.Inconsequential;
      type?: apiResponseTypes.Inconsequential;
      message?: string;
      data?: T extends void | undefined | null ? undefined : T;
    }
  | {
      status: apiResponseStatus.Success;
      type?: apiResponseTypes.Success;
      message?: string;
      data: T;
    }
  | {
      status: apiResponseStatus.Success;
      type: apiResponseTypes.SuccessNoData;
      message?: string;
      data?: T extends void | undefined | null ? undefined : T;
    }
  | {
      status: apiResponseStatus.FailForeward;
      type:
        | apiResponseTypes.FailForewardOverwriteMessage
        | apiResponseTypes.FailForewardAppendMessage
        | apiResponseTypes.FailForewardForceStatus;
      message: string;
      data: T extends void | undefined | null ? never : T;
    };

export type apiType<T> = Promise<Result<apiResponse<T>, apiError>>;

export type apiErr<T> = Promise<Err<apiResponse<T>, apiError>>;

export type apiOk<T> = Promise<Ok<apiResponse<T>, apiError>>;

export enum databaseInteractionTypes {
  Default = "Default",
  Sequencial = "Sequencial",
}

export function deconstruct<T>(
  input: Awaited<apiOk<T> | apiErr<T>>,
):
  | (apiResponse<T> & { content(): T })
  | (apiError & { content(): apiError["error"] }) {
  if (input.isErr()) {
    return {
      ...input.error,
      content: () => input.error.error,
    };
  }
  return {
    ...input.value,
    content: () => input.value.data as T,
  };
}

export async function passBack<T>(
  input: Awaited<apiOk<T> | apiErr<T>>,
): apiType<T> {
  if (input.isErr()) {
    return err(input.error);
  }
  return ok(input.value);
}

export function reportError(error: apiError): apiError {
  if (!error._internal.reportable) return error;
  if (error._internal.reported) return error;

  console.error(error);

  Sentry.captureException(error);
  posthog.captureException(error);

  return {
    ...error,
    _internal: {
      ...error._internal,
      reported: true,
    },
  };
}

// alias for return err({}: apiError).mapErr(orReport)
export const orReport = reportError;

function generateTypeMappings<
  StatusEnum extends Record<string, string>,
  TypesEnum extends Record<string, string>,
>(
  statusEnum: StatusEnum,
  typesEnum: TypesEnum,
): Partial<Record<StatusEnum[keyof StatusEnum], TypesEnum[keyof TypesEnum][]>> {
  const mappings: Record<string, string[]> = {};

  const statusValues = Object.values(statusEnum);
  const typeValues = Object.values(typesEnum);

  for (const status of statusValues) {
    mappings[status] = [];
    for (const type of typeValues) {
      // Check if the type name starts with the status name or is exactly the status name
      if (
        type.startsWith(status) &&
        (type === status || type.charAt(status.length) === ".")
      ) {
        mappings[status].push(type);
      }
    }
  }
  return mappings as Partial<
    Record<StatusEnum[keyof StatusEnum], TypesEnum[keyof TypesEnum][]>
  >;
}

const responseMappings = generateTypeMappings(
  apiResponseStatus,
  apiResponseTypes,
);

const errorMappings = generateTypeMappings(apiErrorStatus, apiErrorTypes);

type OkInitialChain<T> = {
  [K in keyof typeof apiResponseStatus]: () => OkStatusChain<
    T,
    (typeof apiResponseStatus)[K]
  >;
};

type OkStatusChain<T, Status extends apiResponseStatus> = {
  message(msg: string): OkStatusChain<T, Status>;
  data(data: T): OkStatusChain<T, Status>;
  build(): Awaited<apiOk<T>>;
} & {
  [K in apiResponseTypes as K extends `${Status}.${infer Rest}`
    ? Rest
    : K]: () => OkFinalizeChain<T, Status, K>;
} & {
  [K in apiResponseTypes as K extends Status
    ? K
    : never]: () => OkFinalizeChain<T, Status, K>;
};

interface OkFinalizeChain<
  T,
  Status extends apiResponseStatus,
  Type extends apiResponseTypes,
> {
  message(msg: string): OkFinalizeChain<T, Status, Type>;
  data(data: T): OkFinalizeChain<T, Status, Type>;
  build(): Awaited<apiOk<T>>;
}

type OkFunctionInput<T> = (
  s: typeof apiResponseStatus,
  t: typeof apiResponseTypes,
) => {
  status: apiResponseStatus;
  type?: apiResponseTypes;
  message?: string;
  data?: T;
};

class OkBuilder<T>
  implements
    OkInitialChain<T>,
    OkStatusChain<T, any>,
    OkFinalizeChain<T, any, any>
{
  private status?: apiResponseStatus;
  private type?: apiResponseTypes;
  private _message?: string;
  private _data?: T;
  private functionInputProvided: boolean;

  constructor(input?: OkFunctionInput<T>) {
    this.functionInputProvided = input !== undefined;

    // Add all response type methods to this instance
    for (const type of Object.values(apiResponseTypes)) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;
      (this as any)[simpleMethodName] = () => {
        this.type = type;
        return this;
      };
    }

    if (!this.functionInputProvided) {
      for (const status of Object.values(apiResponseStatus)) {
        (this as any)[status] = () => {
          this.status = status;
          this.addChainableMethods();
          return this;
        };
      }
    } else {
      const result = input!(apiResponseStatus, apiResponseTypes);
      this.status = result.status;
      this.type = result.type;
      this._message = result.message;
      this._data = result.data;
    }
  }

  private addChainableMethods(): void {
    (this as any)._message = this._message;
    (this as any)._data = this._data;
    (this as any).build = this.build.bind(this);

    // Remove all previous type methods
    for (const type of Object.values(apiResponseTypes)) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;
      delete (this as any)[simpleMethodName];
    }

    // Add only the relevant type methods for the current status
    const types = this.status ? (responseMappings[this.status] ?? []) : [];

    for (const type of types) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;

      (this as any)[simpleMethodName] = () => {
        this.type = type;
        return this;
      };
    }
  }

  message(msg: string): OkStatusChain<T, any> {
    if (this.functionInputProvided) {
      // TODO: TYPEERROR
      return this as unknown as OkStatusChain<T, any>;
    }
    this._message = msg;
    return this;
  }

  data(data: T): OkStatusChain<T, any> {
    if (this.functionInputProvided) {
      return this as unknown as OkStatusChain<T,any>;
    }
    this._data = data;
    return this as unknown as OkStatusChain<T,any>;
  }

  build(): Awaited<apiOk<T>> {
    const response = {
      status: this.status ?? apiResponseStatus.Inconsequential,
      type: this.type,
      message: this._message,
      data: this._data,
    } as apiResponse<T>; // KEEP THIS THIS SOMEHOW WORKS!!!!!!

    return ok(response);
  }
}

type ErrInitialChain = {
  [K in keyof typeof apiErrorStatus]: () => ErrStatusChain<
    (typeof apiErrorStatus)[K]
  >;
};

type ErrStatusChain<Status extends apiErrorStatus> = {
  message(msg: string): ErrStatusChain<Status>;
  error(err: unknown): ErrStatusChain<Status>;
  build(): Awaited<apiError>;
} & {
  [K in apiErrorTypes as K extends `${Status}.${infer Rest}`
    ? Rest
    : K]: () => ErrFinalizeChain<Status, K>;
} & {
  [K in apiErrorTypes as K extends Status ? K : never]: () => ErrFinalizeChain<
    Status,
    K
  >;
};

interface ErrFinalizeChain<
  Status extends apiErrorStatus,
  Type extends apiErrorTypes,
> {
  message(msg: string): ErrFinalizeChain<Status, Type>;
  error(err: unknown): ErrFinalizeChain<Status, Type>;
  build(): Result<any, apiError>; // Synchronous build, returns Result
}

type ErrFunctionInput = (
  s: typeof apiErrorStatus,
  t: typeof apiErrorTypes,
) => {
  status: apiErrorStatus;
  type: apiErrorTypes;
  message: string;
  error?: unknown;
};

class ErrBuilder
  implements ErrInitialChain, ErrStatusChain<any>, ErrFinalizeChain<any, any>
{
  private status?: apiErrorStatus;
  private type?: apiErrorTypes;
  private _message?: string;
  private _error?: unknown;
  private _internal: apiError["_internal"] = {
    reported: false,
    reportable: true,
  };
  private functionInputProvided: boolean;

  constructor(input?: ErrFunctionInput) {
    this.functionInputProvided = input !== undefined;

    for (const type of Object.values(apiErrorTypes)) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;
      (this as any)[simpleMethodName] = () => {
        this.type = type;
        return this;
      };
    }

    if (!this.functionInputProvided) {
      for (const status of Object.values(apiErrorStatus)) {
        (this as any)[status] = () => {
          this.status = status;
          this.updateInternal();
          this.addChainableMethods();
          return this;
        };
      }
    } else {
      const result = input!(apiErrorStatus, apiErrorTypes);
      this.status = result.status;
      this.type = result.type;
      this._message = result.message;
      this._error = result.error;
      this.updateInternal();
    }
  }

  private addChainableMethods(): void {
    (this as any).message = (msg: string) => {
      this._message = msg;
      return this;
    };
    (this as any).error = (err: unknown) => {
      this._error = err;
      return this;
    };
    (this as any).build = this.build.bind(this);

    for (const type of Object.values(apiErrorTypes)) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;
      delete (this as any)[simpleMethodName];
    }

    const types = this.status ? (errorMappings[this.status] ?? []) : [];

    for (const type of types) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName = type === this.status ? type : methodName;

      (this as any)[simpleMethodName] = () => {
        this.type = type;
        this.updateInternal();
        return this;
      };
    }
  }

  message(msg: string): ErrStatusChain<any> {
    if (this.functionInputProvided) {
      // TODO: TYPEERROR
      return this as unknown as ErrStatusChain<any>;
    }
    this._message = msg;
    return this as unknown as ErrStatusChain<any>;
  }

  error(err: unknown): ErrStatusChain<any> {
    if (this.functionInputProvided) {
      // TODO: TYPEERROR
      return this as unknown as ErrStatusChain<any>>;
    }
    this._error = err;
    return this as unknown as ErrStatusChain<any>;
  }

  private updateInternal(): void {
    if (
      this.status === apiErrorStatus.ValidationError &&
      this.type === apiErrorTypes.ValidationErrorZod
    ) {
      this._internal.reportable = false;
    } else if (
      this.status === apiErrorStatus.NotFound &&
      this.type === apiErrorTypes.NotFound
    ) {
      this._internal.reportable = false;
    } else {
      this._internal.reportable = true; // Default for most errors
    }
  }

  build(): Result<any, apiError> {
    const response = {
      status: this.status,
      type: this.type,
      message: this.message || "An error occurred",
      error: this.error,
      _internal: { ...this._internal, reported: false },
    } as apiError;

    return err(response).mapErr(orReport);
  }
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
export async function databaseInteraction<T, D extends boolean = true>(
  query: Promise<T[]>,
  deconstructArray = true as D,
  interactionType: databaseInteractionTypes = databaseInteractionTypes.Default,
): apiType<D extends true ? T : T[]> {
  const { data: resultArray, error: dbError } = await tc(query);
  if (dbError) {
    return err({
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "Database operation failed",
      error: dbError,
    }).mapErr(orReport);
  }

  if (!deconstructArray) {
    return ok({
      status: apiResponseStatus.Success,
      type: apiResponseTypes.Success,

      data: resultArray as D extends true ? T : T[],
    });
  }

  const result = resultArray?.[0];
  if (!result || result === undefined) {
    switch (interactionType) {
      default:
      case databaseInteractionTypes.Default:
        return err({
          status: apiErrorStatus.NotFound,
          type: apiErrorTypes.NotFound,
          message: "No results found",
        });
      case databaseInteractionTypes.Sequencial:
        return err({
          status: apiErrorStatus.BadRequest,
          type: apiErrorTypes.BadRequestSequentialOperationFailure,
          message: "Results should Exist but were not found",
        }).mapErr(orReport);
    }
  }

  return ok({
    status: apiResponseStatus.Success,
    type: apiResponseTypes.Success,

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
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
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
    return err({
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
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
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "Election database query failed",
    });
  }

  const election = electionArray?.[0];
  if (!election) {
    return err({
      status: apiErrorStatus.NotFound,
      type: apiErrorTypes.NotFound,
      message: "Election not found",
    });
  }

  const now = new Date();
  const updates: Partial<typeof election> = {};

  // Status logic based on dates and current state
  if (
    election.startDate &&
    new Date(election.startDate) <= now &&
    !election.isCompleted
  ) {
    updates.isActive = true;
  }

  if (election.endDate && new Date(election.endDate) <= now) {
    updates.isActive = false;
    updates.isCompleted = true;
  }

  if ((election.startDate || election.endDate) && !election.isPublished) {
    updates.startDate = null;
    updates.endDate = null;
    updates.isScheduled = false;
  }

  if (!election.startDate) {
    updates.isScheduled = false;
  }

  // Validate archive state
  if (election.isArchived) {
    updates.isActive = false;
    updates.isScheduled = false;
    updates.isCompleted = true;
  } else if (election.archiveDate) {
    // Remove archive date if not archived
    updates.archiveDate = null;
  }

  // Only update if there are changes
  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await tc(
      db.update(wahlen).set(updates).where(eq(wahlen.id, electionId)),
    );

    if (updateError) {
      console.error(updateError);
      return err({
        status: apiErrorStatus.BadRequest,
        type: apiErrorTypes.BadRequestInternalServerError,
        message: "Failed to update election status",
      });
    }
  }

  return ok({
    status: apiResponseStatus.Inconsequential,
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
 * @alias throwIfActive
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
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
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
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
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
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "Election database query failed",
    });
  }

  const election = electionArray?.[0];
  if (!election) {
    return err({
      status: apiErrorStatus.NotFound,
      type: apiErrorTypes.NotFound,
      message: "Election not found",
    });
  }

  // Check if the election is in an editable state
  if (
    election.isActive ||
    election.isCompleted ||
    election.hasResults ||
    election.isArchived
  ) {
    return err({
      status: apiErrorStatus.Forbidden,
      type: apiErrorTypes.ForbiddenActivityMismatch,
      message: "You cannot edit an active election!!!",
    });
  }

  return ok({
    status: apiResponseStatus.Inconsequential,
  });
}
