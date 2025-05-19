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

// --- --- Utility Types --- ---

// --- Zod ---

/** UUID validation type using Zod */
export const uuidType = z.string().uuid();

/** Type for objects that contain an ID field */
export const identifyingInputType = z.object({
  id: uuidType,
});

// --- TRPC ---

/** A placeholder procedure that returns an empty string */
export const blankPlaceholdingCallableProcedure = publicProcedure.mutation(
  () => "",
);

// --- --- API Neverthrow Definitions --- ---

// --- Error Types ---

// -- Status and Types --

/** Enum representing different API error status categories */
export enum apiErrorStatus {
  NotFound = "NotFound",
  Forbidden = "Forbidden",
  BadRequest = "BadRequest",
  Conflict = "Conflict",
  Incomplete = "Incomplete",
  ValidationError = "ValidationError",
  Failed = "Failed",
}

/** Detailed error types for API responses */
export enum apiErrorTypes {
  NotFound = "NotFound",

  // Forbidden types
  /** Generic forbidden error */
  Forbidden = "Forbidden",
  /** Authorization-related forbidden error */
  ForbiddenAuthorisation = "Forbidden.Authorisation",
  /** Invalid ownership forbidden error */
  ForbiddenInvalidOwnership = "Forbidden.InvalidOwnership",
  /** Activity state mismatch forbidden error */
  ForbiddenActivityMismatch = "Forbidden.ActivityMismatch",

  // BadRequest types
  /** Unknown bad request error */
  BadRequestUnknown = "BadRequest.Unknown",
  /** Internal server error */
  BadRequestInternalServerError = "BadRequest.InternalServerError",
  /** Sequential operation failure */
  BadRequestSequentialOperationFailure = "BadRequest.SequentialOperationFailure",
  /** Data corruption error */
  BadRequestCorrupted = "BadRequest.Corrupted",

  // Conflict types
  /** Duplicate data conflict */
  ConflictDuplicate = "Conflict.Duplicate",
  /** Invalid data conflict */
  ConflictInvalid = "Conflict.Invalid",
  /** Invalid state conflict */
  ConflictInvalidState = "Conflict.InvalidState",
  /** Data transcending boundaries conflict */
  ConflictDataTranscending = "Conflict.DataIsTranscending",

  // Incomplete types
  /** Scheduling-related incomplete error */
  IncompleteScheduling = "Incomplete.Scheduling",
  /** Missing start date scheduling error */
  IncompleteSchedulingStartDate = "Incomplete.Scheduling.MissingStartDate",
  /** Provider identification incomplete error */
  IncompleteProviderIdentification = "Incomplete.ProviderIdentification",

  // ValidationError types
  /** Zod validation error */
  ValidationErrorZod = "ValidationError.Zod",
  /** Unknown validation error */
  ValidationErrorUnknown = "ValidationError.Unknown",

  // Failed types
  /** Generic failure */
  Failed = "Failed",
  /** Unknown failure */
  FailedUnknown = "Failed.Unknown",
}

// -- Error Response Type --

/** Union type representing all possible API error responses */
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

// --- Response Types ---

// -- Status and Types --

/** Enum representing different API response status categories */
export enum apiResponseStatus {
  /** Operation completed successfully */
  Success = "Success",
  /** Operation completed with partial success */
  PartialSuccess = "PartialSuccess",
  /** Operation failed but can continue */
  FailForeward = "FailForeward",
  /** Operation had no effect */
  Inconsequential = "Inconsequential",
}

/** Detailed response types for API responses */
export enum apiResponseTypes {
  /** Generic success response */
  Success = "Success",
  /** Success response with no data */
  SuccessNoData = "Success.NoData",

  // PartialSuccess types
  /** Partial success with private data */
  PartialSuccessPrivate = "PartialSuccess.Private",
  /** Partial success after completion */
  PartialSuccessPostCompletion = "PartialSuccess.PostCompletion",
  /** Partial success for archived data */
  PartialSuccessArchived = "PartialSuccess.Archived",

  // FailForeward types
  /** Fail forward with message overwrite */
  FailForewardOverwriteMessage = "FailForeward.OverwriteMessage",
  /** Fail forward with appended message */
  FailForewardAppendMessage = "FailForeward.AppendMessage",
  /** Fail forward with forced status */
  FailForewardForceStatus = "FailForeward.ForceStatus",

  /** Operation had no effect */
  Inconsequential = "Inconsequential",
}

// -- Response Type --

/** Generic API response type */
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

// --- --- API Utility Return Type Definitions --- ---

// --- Async Types ---

/** Type alias for API response wrapped in Result type */
export type apiType<T> = Promise<
  Ok<apiResponse<T>, apiError> | Err<never, apiError>
>;

/** Type alias for API error response */
export type apiErr<T> = Promise<Err<apiResponse<T>, apiError>>;
/** Type alias for API response that can never be successful */
export type apiNeverOk = Promise<Err<never, apiError>>;

/** Type alias for successful API response */
export type apiOk<T> = Promise<Ok<apiResponse<T>, apiError>>;
/** Type alias for API response that can never fail */
export type apiNeverFail<T> = Promise<Ok<apiResponse<T>, never>>;

// --- Synchronous Types ---

/** Helper type to get the resolved type of a Promise */
export type mkSync<T> = Awaited<T>;

/** Synchronous version of apiType */
export type syncType<T> = mkSync<apiType<T>>;

/** Synchronous version of apiErr */
export type syncErr<T> = mkSync<apiErr<T>>;
/** Synchronous version of apiNeverOk */
export type syncNeverOk = mkSync<apiNeverOk>;

/** Synchronous version of apiOk */
export type syncOk<T> = mkSync<apiOk<T>>;
/** Synchronous version of apiNeverFail */
export type syncNeverFail<T> = mkSync<apiNeverFail<T>>;

// --- --- API Neverthrow Function Utilities --- ---

// --- Result Handling ---

/** Deconstructs a Result type into its value or error */
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

/** Passes back a Result type unchanged */
export async function passBack<T>(
  input: Awaited<apiOk<T> | apiErr<T>>,
): apiType<T> {
  if (input.isErr()) {
    return err(input.error);
  }
  return ok(input.value);
}

// --- Error Reporting ---

/** Reports an error to error tracking services if reportable */
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

/** Alias for reportError */
export const orReport = reportError;

// --- --- Builder Pattern Implementation --- ---

// --- Type Mappings ---

/** Generates mappings between status enums and their corresponding type enums */
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

// --- Success Builder Types ---

// -- Chain Types --

/** Helper type for the initial chain of a successful response builder */
type OkInitialChain<T> = {
  [K in keyof typeof apiResponseStatus]: () => OkStatusChain<
    T,
    (typeof apiResponseStatus)[K]
  >;
};

/** Helper type for the status chain of a successful response builder */
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

/** Helper type for the final chain of a successful response builder */
interface OkFinalizeChain<
  T,
  Status extends apiResponseStatus,
  Type extends apiResponseTypes,
> {
  message(msg: string): OkFinalizeChain<T, Status, Type>;
  data(data: T): OkFinalizeChain<T, Status, Type>;
  build(): Awaited<apiOk<T>>;
}

// -- Input Types --

/** Type for the function input of a successful response builder */
type OkFunctionInput<T> = (
  s: typeof apiResponseStatus,
  t: typeof apiResponseTypes,
) => {
  status: apiResponseStatus;
  type?: apiResponseTypes;
  message?: string;
  data?: T;
};

/** Type for the object input of a successful response builder */
type OkObjectInput<T> = Partial<apiResponse<T>>;

// -- Builder Implementation --

/** Builder class for constructing successful API responses */
class OkBuilder<T> {
  private status?: apiResponseStatus;
  private type?: apiResponseTypes;
  private _message?: string;
  private _data?: T;
  private inputType: "chain" | "function" | "object";

  constructor(input?: OkFunctionInput<T> | OkObjectInput<T>) {
    if (typeof input === "function") {
      this.inputType = "function";
      const result = input(apiResponseStatus, apiResponseTypes);
      this.status = result.status;
      this.type = result.type;
      this._message = result.message;
      this._data = result.data;
    } else if (
      input !== undefined &&
      typeof input === "object" &&
      input !== null
    ) {
      this.inputType = "object";
      this.status = input.status;
      this.type = input.type;
      this._message = input.message;
      this._data = input.data;
    } else {
      this.inputType = "chain";
      for (const type of Object.values(apiResponseTypes)) {
        const methodName = type.split(".").pop()!;
        const simpleMethodName =
          String(type) === String(this.status) ? type : methodName;
        (this as any)[simpleMethodName] = () => {
          this.type = type;
          return this;
        };
      }
      for (const status of Object.values(apiResponseStatus)) {
        (this as any)[status] = () => {
          this.status = status;
          this.addChainableMethods();
          return this;
        };
      }
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
    if (this.inputType !== "chain") {
      // TODO: TYPEERROR
      return this as unknown as OkStatusChain<T, any>;
    }
    this._message = msg;
    return this as unknown as OkStatusChain<T, any>;
  }

  data(data: T): OkStatusChain<T, any> {
    if (this.inputType !== "chain") {
      return this as unknown as OkStatusChain<T, any>;
    }
    this._data = data;
    return this as unknown as OkStatusChain<T, any>;
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

// --- Error Builder Types ---

// -- Chain Types --

/** Helper type for the initial chain of an error response builder */
type ErrInitialChain = {
  [K in keyof typeof apiErrorStatus]: () => ErrStatusChain<
    (typeof apiErrorStatus)[K]
  >;
};

/** Helper type for the status chain of an error response builder */
type ErrStatusChain<Status extends apiErrorStatus> = {
  message(msg: string): ErrStatusChain<Status>;
  error(err: unknown): ErrStatusChain<Status>;
  build(): Awaited<apiNeverOk>;
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

/** Helper type for the final chain of an error response builder */
interface ErrFinalizeChain<
  Status extends apiErrorStatus,
  Type extends apiErrorTypes,
> {
  message(msg: string): ErrFinalizeChain<Status, Type>;
  error(err: unknown): ErrFinalizeChain<Status, Type>;
  build(): Awaited<apiNeverOk>;
}

// -- Input Types --

/** Type for the function input of an error response builder */
type ErrFunctionInput = (
  s: typeof apiErrorStatus,
  t: typeof apiErrorTypes,
) => {
  status: apiErrorStatus;
  type: apiErrorTypes;
  message: string;
  error?: unknown;
};

/** Type for the object input of an error response builder */
type ErrObjectInput = Partial<apiError>;

// -- Builder Implementation --

/** Builder class for constructing API error responses */
class ErrBuilder {
  private status?: apiErrorStatus;
  private type?: apiErrorTypes;
  private _message?: string;
  private _error?: unknown;
  private _internal: apiError["_internal"] = {
    reported: false,
    reportable: true,
  };
  private inputType: "chain" | "function" | "object";

  constructor(input?: ErrFunctionInput | ErrObjectInput) {
    if (typeof input === "function") {
      this.inputType = "function";
      const result = input(apiErrorStatus, apiErrorTypes);
      this.status = result.status;
      this.type = result.type;
      this._message = result.message;
      this._error = result.error;
      this.updateInternal();
    } else if (input !== undefined) {
      this.inputType = "object";
      this.status = input.status;
      this.type = input.type;
      this._message = input.message;
      this._error = input.error;
      this.updateInternal();
    } else {
      this.inputType = "chain";
      for (const status of Object.values(apiErrorStatus)) {
        (this as any)[status] = () => {
          this.status = status;
          this.updateInternal();
          this.addChainableMethods();
          return this;
        };
      }
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
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;

      (this as any)[simpleMethodName] = () => {
        this.type = type;
        this.updateInternal();
        return this;
      };
    }
  }

  message(msg: string): ErrStatusChain<any> {
    if (this.inputType !== "chain") {
      // TODO: TYPEERROR
      return this as unknown as ErrStatusChain<any>;
    }
    this._message = msg;
    return this as unknown as ErrStatusChain<any>;
  }

  error(err: unknown): ErrStatusChain<any> {
    if (this.inputType !== "chain") {
      // TODO: TYPEERROR
      return this as unknown as ErrStatusChain<any>;
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

  build(): Awaited<apiNeverOk> {
    const response = {
      status: this.status,
      type: this.type,
      message: this._message ?? "An error occurred",
      error: this._error ?? null,
      _internal: { ...this._internal, reported: false },
    } as apiError;

    return err(response).mapErr(orReport) as Awaited<apiNeverOk>;
  }
}

// --- --- Builder Factory --- ---

/** Factory function for creating API response builders */
export function construct<T>() {
  return {
    ok: (
      input?: OkFunctionInput<T> | OkObjectInput<T>,
    ): Result<apiResponse<T>, apiError> | OkInitialChain<T> => {
      const builder = new OkBuilder<T>(input);
      if (
        typeof input === "function" ||
        (typeof input === "object" && input !== undefined)
      ) {
        return builder.build();
      }
      return builder as unknown as OkInitialChain<T>;
    },
    err: (
      input?: ErrFunctionInput | ErrObjectInput,
    ): Awaited<apiNeverOk> | ErrInitialChain => {
      const builder = new ErrBuilder(input);
      if (
        typeof input === "function" ||
        (typeof input === "object" && input !== undefined)
      ) {
        return builder.build();
      }
      return builder as unknown as ErrInitialChain;
    },
  };
}

// --- Builder Aliases ---

/** Alias function for creating successful API responses */
function okAlias<T>(): OkInitialChain<T>;
function okAlias<T>(input: OkFunctionInput<T>): syncType<T>;
function okAlias<T>(input: OkObjectInput<T>): syncType<T>;
function okAlias<T>(
  input?: OkFunctionInput<T> | OkObjectInput<T>,
): syncType<T> | OkInitialChain<T> {
  if (
    typeof input === "function" ||
    (typeof input === "object" && input !== undefined)
  ) {
    const builder = new OkBuilder<T>(input);
    return builder.build();
  }
  return construct<T>().ok() as OkInitialChain<T>;
}

/** Alias function for creating API error responses */
function errAlias(): ErrInitialChain;
function errAlias(input: ErrFunctionInput): syncNeverOk;
function errAlias(input: ErrObjectInput): syncNeverOk;
function errAlias(
  input?: ErrFunctionInput | ErrObjectInput,
): syncNeverOk | ErrInitialChain {
  if (
    typeof input === "function" ||
    (typeof input === "object" && input !== undefined)
  ) {
    const builder = new ErrBuilder(input);
    return builder.build();
  }
  return construct().err() as ErrInitialChain;
}

export { okAlias as ok, errAlias as err };

// --- --- Database Interactions --- ---

// --- Types ---

/** Enum for different types of database interactions */
export enum databaseInteractionTypes {
  /** Default database interaction */
  Default = "Default",
  /** Sequential database operation */
  Sequencial = "Sequencial",
}

// --- Core Functions ---

/** Executes a database query and handles the response formatting */
export async function databaseInteraction<T, D extends boolean = true>(
  query: Promise<T[]>,
  deconstructArray = true as D,
  interactionType: databaseInteractionTypes = databaseInteractionTypes.Default,
): apiType<D extends true ? T : T[]> {
  const { data: resultArray, error: dbError } = await tc(query);
  if (dbError) {
    return errAlias({
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "Database operation failed",
      error: dbError,
    });
  }

  if (!deconstructArray) {
    return okAlias((s, t) => ({
      status: s.Success,
      type: t.Success,
      data: resultArray as D extends true ? T : T[],
    }));
  }

  const result = resultArray?.[0];
  if (!result || result === undefined) {
    switch (interactionType) {
      default:
      case databaseInteractionTypes.Default:
        return errAlias({
          status: apiErrorStatus.NotFound,
          type: apiErrorTypes.NotFound,
          message: "No results found",
        });
      case databaseInteractionTypes.Sequencial:
        return errAlias({
          status: apiErrorStatus.BadRequest,
          type: apiErrorTypes.BadRequestSequentialOperationFailure,
          message: "Results should Exist but were not found",
        });
    }
  }

  return okAlias((s, t) => ({
    status: s.Success,
    type: t.Success,

    data: resultArray as D extends true ? T : T[],
  }));
}

// --- Election Management ---

/** Updates the status of an election based on current date and state */
export async function updateElectionStatus(
  id: z.infer<typeof uuidType>,
): apiType<void> {
  const { success, error } = uuidType.safeParse(id);
  if (!success) {
    return errAlias({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,

      message: "Input is not a valid UUID",
      error: error,
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
    return errAlias()
      .BadRequest()
      .InternalServerError()
      .message("Question database query failed")
      .build();
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
    return errAlias({
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "Election database query failed",
    });
  }

  const election = electionArray?.[0];
  if (!election) {
    return errAlias({
      status: apiErrorStatus.NotFound,
      type: apiErrorTypes.NotFound,
      message: "Election not found",
    });
  }

  const now = new Date();
  const updates: Partial<typeof election> = {};

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
      return errAlias({
        status: apiErrorStatus.BadRequest,
        type: apiErrorTypes.BadRequestInternalServerError,
        message: "Failed to update election status",
      });
    }
  }

  return okAlias({
    status: apiResponseStatus.Inconsequential,
    message: "Election status updated successfully",
  });
}

/** Validates the provided UUID and ensures the associated question or election is not active */
export async function validateEditability(
  id: z.infer<typeof uuidType>,
): apiType<void> {
  const { success, error } = uuidType.safeParse(id);
  if (!success) {
    return errAlias({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
      message: "Input is not a valid UUID",
      error: error,
    });
  }

  const uES = await updateElectionStatus(id);
  if (uES.isErr()) return passBack(uES);

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
    return errAlias()
      .BadRequest()
      .InternalServerError()
      .message("Question database query failed")
      .build();
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
    return errAlias({
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "Election database query failed",
    });
  }

  const election = electionArray?.[0];
  if (!election) {
    return errAlias({
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
    return errAlias({
      status: apiErrorStatus.Forbidden,
      type: apiErrorTypes.ForbiddenActivityMismatch,
      message: "You cannot edit an active election!!!",
    });
  }

  return okAlias().Inconsequential().build();
}
