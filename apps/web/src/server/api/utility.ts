import { or, eq } from "drizzle-orm";
import { type Err, err, type Ok, ok, type Result } from "neverthrow";
import { z } from "zod";
import { tc } from "~/lib/tryCatch";
import { db } from "~/server/db";
import { questions } from "~/server/db/schema/questions";
import { wahlen } from "~/server/db/schema/wahlen";
import { publicProcedure } from "./trpc";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import type {
  PgUpdateBase,
  PgInsertBase,
  PgDeleteBase,
  PgTable,
} from "drizzle-orm/pg-core";

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
  /** Failed upload */
  FailedUpload = "Failed.Upload",
  /** Failed download */
  FailedDownload = "Failed.Download",
  /** Failed missing data */
  FailedMissingData = "Failed.MissingData",
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
        reported: boolean;
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
        reported: boolean;
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
  PartialSuccess = "PartialSuccess", // Added for auto-setting
  /** Partial success with private data */
  PartialSuccessPrivate = "PartialSuccess.Private",
  /** Partial success after completion */
  PartialSuccessPostCompletion = "PartialSuccess.PostCompletion",
  /** Partial success for archived data */
  PartialSuccessArchived = "PartialSuccess.Archived",

  // FailForeward types
  FailForeward = "FailForeward", // Added for auto-setting
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
export type apiResponse<T> = {
  status: apiResponseStatus;
  type?: apiResponseTypes;
  message?: string;
  data?: T extends void | undefined | null ? undefined : T;
  _internal: {
    loggable: boolean;
    logged: boolean;
  };
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

// --- Reporting ---

/** Reports an error to error tracking services if reportable */
export function reportError(error: apiError): apiError {
  // Ensure _internal exists and has reportable/reported properties
  if (
    typeof error._internal?.reportable === "undefined" ||
    typeof error._internal.reported === "undefined"
  ) {
    console.error("Invalid error object structure for reporting:", error);
    return error; // Return original error if structure is invalid
  }

  if (!error._internal.reportable || error._internal.reported) return error;

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

/** Logs/reports a successful response based on its status and internal state */
export function reportResponse<T>(response: apiResponse<T>): apiResponse<T> {
  // Ensure _internal exists and has loggable/logged properties
  if (
    typeof response._internal?.loggable === "undefined" ||
    typeof response._internal.logged === "undefined"
  ) {
    console.log("Invalid response object structure for logging:", response);
    return response; // Return original response if structure is invalid
  }

  if (!response._internal.loggable || response._internal.logged)
    return response;

  switch (response.status) {
    case apiResponseStatus.Success:
      console.info("API Success:", response);
      // Optionally capture info/analytics for success
      break;
    case apiResponseStatus.PartialSuccess:
      console.warn("API Partial Success:", response);
      // Optionally capture warnings/analytics for partial success
      break;
    case apiResponseStatus.FailForeward:
      console.warn("API Fail Foreward:", response);
      // Optionally capture warnings/analytics for fail foreward
      break;
    case apiResponseStatus.Inconsequential:
      console.log("API Inconsequential:", response);
      // Optionally capture info/analytics for inconsequential
      break;
    default:
      console.log("API Response:", response);
  }

  Sentry.captureEvent({
    message: `API Response: ${response.status}`,
    extra: response,
  });

  posthog.capture(`api-log:${response.status}`, {
    ...response,
    _internal: {
      ...response._internal,
      logged: true,
    },
  });

  return {
    ...response,
    _internal: {
      ...response._internal,
      logged: true,
    },
  };
}

/** Alias for reportError // neverthrow.err({}).mapErr(orReport) */
export const orReport = reportError;

/** Alias for reportResponse // neverthrow.ok({}).map(Log) */
export const Log = reportResponse;

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
  // partial because not all status have types
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

// Helper type to filter available type methods based on Status
type FilteredOkTypeMethods<T, Status extends apiResponseStatus> = {
  [K in apiResponseTypes as K extends `${Status}.${infer Rest}`
    ? Rest
    : K extends Status
      ? K
      : never]: () => OkFinalizeChain<T, Status, K>;
};

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
  build(): Awaited<apiOk<T>>; // Always include build on the status chain
} & FilteredOkTypeMethods<T, Status>; // Add filtered type methods

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
  protected status?: apiResponseStatus;
  protected type?: apiResponseTypes;
  protected _message?: string;
  protected _data?: T;
  protected _internal: apiResponse<T>["_internal"] = {
    loggable: false, // Default to not loggable // overwritten in build
    logged: false,
  };
  protected inputType: "chain" | "function" | "object";

  public setStatus(status: apiResponseStatus) {
    this.status = status;
  }

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
      this._internal = input._internal ?? { loggable: false, logged: false };
    } else {
      this.inputType = "chain";
    }
  }

  // Method to set internal logging state (chainable)
  _internalLoggable(loggable = true): OkStatusChain<T, apiResponseStatus> {
    if (this.inputType !== "chain") {
      console.error("Cannot call _internalLoggable on non-chain input");
      return this as unknown as OkStatusChain<T, apiResponseStatus>;
    }
    this._internal.loggable = loggable;
    return this as unknown as OkStatusChain<T, apiResponseStatus>;
  }

  // Method to add chainable type methods based on the selected status
  public addChainableMethods(): void {
    this.message = this.message.bind(this);
    this.data = this.data.bind(this);
    this.build = this.build.bind(this);
    this._internalLoggable = this._internalLoggable.bind(this);

    // Remove existing type methods to avoid conflicts
    for (const type of Object.values(apiResponseTypes)) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;
      delete (this as Record<string, unknown>)[simpleMethodName];
    }

    const types = this.status ? (responseMappings[this.status] ?? []) : [];

    // Add new type methods based on the selected status
    for (const type of types) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;

      (this as Record<string, unknown>)[simpleMethodName] = () => {
        this.type = type;
        if (String(this.type) === String(this.status)) {
          this.type = type;
        }
        return this;
      };

      if (String(type) === String(this.status)) {
        this.type = type;
      }
    }
  }

  message<Status extends apiResponseStatus>(
    msg: string,
  ): OkStatusChain<T, Status> {
    if (this.inputType !== "chain") {
      // This will result in a TypeScript error
      console.error("Cannot call message() on non-chain input");
      return this as unknown as OkStatusChain<T, Status>;
    }
    this._message = msg;
    return this as unknown as OkStatusChain<T, Status>;
  }

  data<Status extends apiResponseStatus>(data: T): OkStatusChain<T, Status> {
    if (this.inputType !== "chain") {
      // This will result in a TypeScript error
      console.error("Cannot call data() on non-chain input");
      return this as unknown as OkStatusChain<T, Status>;
    }
    this._data = data;
    return this as unknown as OkStatusChain<T, Status>;
  }

  build(): Awaited<apiOk<T>> {
    if (this.inputType !== "chain") {
      // This will result in a TypeScript error
      console.error("Cannot call build() on non-chain input");
    }

    const response: apiResponse<T> = {
      status: this.status ?? apiResponseStatus.Inconsequential, // Default status if not set
      type: this.type,
      message: this._message,
      data: this._data as T extends void | undefined | null ? undefined : T, // Cast to correct data type
      _internal: { ...this._internal, logged: false }, // Reset logged state before reporting
    };

    // Report the response before returning
    const reportedResponse = reportResponse(response);

    return ok(reportedResponse);
  }
}

// --- Error Builder Types ---

// Helper type to filter available type methods based on Status
type FilteredErrTypeMethods<Status extends apiErrorStatus> = {
  [K in apiErrorTypes as K extends `${Status}.${infer Rest}`
    ? Rest
    : K extends Status
      ? K
      : never]: () => ErrFinalizeChain<Status, K>;
};

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
  build(): syncNeverOk;
  transaction(): never;
} & FilteredErrTypeMethods<Status>;

/** Transaction Error Type Specification */
type TransactionFunction = {
  transaction(): never;
};

/** Helper type for the final chain of an error response builder */
interface ErrFinalizeChain<
  Status extends apiErrorStatus,
  Type extends apiErrorTypes,
> extends TransactionFunction {
  message(msg: string): ErrFinalizeChain<Status, Type>;
  error(err: unknown): ErrFinalizeChain<Status, Type>;
  build(): syncNeverOk;
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

// -- Builder Implementation ---

/** Builder class for constructing API error responses */
class ErrBuilder {
  protected status?: apiErrorStatus;
  protected type?: apiErrorTypes;
  protected _message?: string;
  protected _error?: unknown;
  protected _internal: apiError["_internal"] = {
    reported: false,
    reportable: true,
  };
  protected inputType: "chain" | "function" | "object";

  public setStatus(status: apiErrorStatus) {
    this.status = status;
  }

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
      this._internal = input._internal ?? { reported: false, reportable: true };
      this.updateInternal();
    } else {
      this.inputType = "chain";
    }
  }

  // Method to add chainable type methods based on the selected status
  public addChainableMethods(): void {
    this.message = this.message.bind(this);
    this.error = this.error.bind(this);
    this.build = this.build.bind(this);
    this.transaction = this.transaction.bind(this);

    for (const type of Object.values(apiErrorTypes)) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;
      delete (this as Record<string, unknown>)[simpleMethodName];
    }

    const types = this.status ? (errorMappings[this.status] ?? []) : [];

    for (const type of types) {
      const methodName = type.split(".").pop()!;
      const simpleMethodName =
        String(type) === String(this.status) ? type : methodName;

      (this as Record<string, unknown>)[simpleMethodName] = () => {
        this.type = type;
        this.updateInternal();
        if (String(this.type) === String(this.status)) {
          this.type = type;
        }
        return this;
      };

      if (String(type) === String(this.status)) {
        this.type = type;
        this.updateInternal();
      }
    }
  }

  message<Status extends apiErrorStatus>(msg: string): ErrStatusChain<Status> {
    if (this.inputType !== "chain") {
      console.error("Cannot call message() on non-chain input");
      return this as unknown as ErrStatusChain<Status>;
    }
    this._message = msg;
    return this as unknown as ErrStatusChain<Status>;
  }

  error<Status extends apiErrorStatus>(err: unknown): ErrStatusChain<Status> {
    if (this.inputType !== "chain") {
      console.error("Cannot call error() on non-chain input");
      return this as unknown as ErrStatusChain<Status>;
    }
    this._error = err;
    return this as unknown as ErrStatusChain<Status>;
  }

  private updateInternal(): void {
    this._internal.reportable = true;

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
    }
  }

  build(): syncNeverOk & TransactionFunction {
    if (this.inputType !== "chain") {
      console.error("Cannot call build() on non-chain input");
    }

    const response: apiError = {
      status: this.status ?? apiErrorStatus.Failed,
      type: this.type ?? apiErrorTypes.FailedUnknown,
      message: this._message ?? "An error occurred",
      error: this._error ?? null,
      _internal: { ...this._internal, reported: false },
    };

    const reportedError = reportError(response);

    const errorResult = err(reportedError);
    // Attach the transaction method to satisfy TransactionFunction
    (errorResult as Err<never, apiError> & TransactionFunction).transaction =
      () => this.transaction();
    return errorResult as syncNeverOk & TransactionFunction;
  }

  transaction(): never {
    if (this.inputType !== "chain") {
      console.error("Cannot call transaction() on non-chain input");
    }

    const errorToThrow: apiError = {
      status: this.status ?? apiErrorStatus.Failed,
      type: this.type ?? apiErrorTypes.FailedUnknown,
      message: this._message ?? "An error occurred during transaction",
      error: this._error ?? null,
      _internal: { ...this._internal, reported: false },
    };

    // Report the error before throwing
    const reportedError = reportError(errorToThrow);

    // Throw the ApiErrorSignal to stop the transaction
    throw new ApiErrorSignal(reportedError);
  }
}

// --- --- Builder Factory --- ---

/** Factory function for creating API response builders */
function constructInternal<T>() {
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

      // Add initial chain methods (status methods) to the builder instance
      for (const status of Object.values(apiResponseStatus)) {
        (builder as unknown as Record<string, unknown>)[status] = () => {
          builder.setStatus(status);
          builder.addChainableMethods();
          return builder;
        };
      }
      // Add chainable methods initially, before a status is selected, so build() is available.
      // TypeScript will handle if required properties are missing when build() is called.
      builder.addChainableMethods();
      return builder as unknown as OkInitialChain<T>;
    },
    err: (
      input?: ErrFunctionInput | ErrObjectInput,
    ): (syncNeverOk & TransactionFunction) | ErrInitialChain => {
      const builder = new ErrBuilder(input);
      if (
        typeof input === "function" ||
        (typeof input === "object" && input !== undefined)
      ) {
        return builder.build();
      }

      // Add initial chain methods (status methods) to the builder instance
      for (const status of Object.values(apiErrorStatus)) {
        (builder as unknown as Record<string, unknown>)[status] = () => {
          builder.setStatus(status);
          // Use public method to update internal state
          builder.addChainableMethods();
          return builder;
        };
      }
      // Add chainable methods initially, before a status is selected, so build() is available.
      // TypeScript will handle if required properties are missing when build() is called.
      builder.addChainableMethods();
      return builder as unknown as ErrInitialChain;
    },
  };
}
// --- Builder Aliases ---

/** Utility function to create neverthrow objects with api type */
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
  return constructInternal<T>().ok() as OkInitialChain<T>;
}

/** Utility function to create neverthrow objects with api type */
function errAlias(): ErrInitialChain;
function errAlias(input: ErrFunctionInput): syncNeverOk & TransactionFunction;
function errAlias(input: ErrObjectInput): syncNeverOk & TransactionFunction;
function errAlias(
  input?: ErrFunctionInput | ErrObjectInput,
): (syncNeverOk & TransactionFunction) | ErrInitialChain {
  if (
    typeof input === "function" ||
    (typeof input === "object" && input !== undefined)
  ) {
    const builder = new ErrBuilder(input);
    return builder.build();
  }
  return constructInternal().err() as ErrInitialChain;
}

export { okAlias as ok, errAlias as err };

/** Constructs the API response builders */
export function construct(): {
  ok: typeof okAlias;
  err: typeof errAlias;
} {
  return {
    ok: okAlias,
    err: errAlias,
  };
}

// --- --- Database Interactions // Transactions --- ---

// --- Types ---

/** Enum for different types of database interactions */
export enum databaseInteractionTypes {
  /** Default database interaction */
  Default = "Default",
  /** Sequential database operation */
  Sequencial = "Sequencial",
}

class ApiErrorSignal extends Error {
  public readonly error: apiError;
  constructor(error: apiError) {
    super(error.message);
    this.name = "ApiErrorSignal";
    this.error = error;
  }
}

type TransactionHelper = <R>(apiCall: apiType<R>) => Promise<R>;

// --- Core Functions ---

import {
  type PgUpdate,
  type PgInsert,
  type PgDelete,
} from "drizzle-orm/pg-core";

/** Type alias for the database instance to avoid circular reference */
type DBInstance = typeof db;

type QueryReturnUnionType =
  | PgUpdate<never, never>
  | PgInsert<never, never>
  | PgDelete<never, never>;

/** Executes a database query and handles errors */
async function databaseInteraction<D extends boolean = true>(
  query: QueryReturnUnionType,
  deconstructArray?: D,
  interactionType?: databaseInteractionTypes,
): apiType<never>;

/** Executes a database query and handles errors */
async function databaseInteraction<T, D extends boolean = true>(
  query: Promise<T[]> | ((db: DBInstance) => Promise<T[]>),
  deconstructArray?: D,
  interactionType?: databaseInteractionTypes,
): apiType<D extends true ? T : T[]>;

/** Executes a database query and handles the response formatting */
async function databaseInteraction<
  T extends Record<string, unknown>,
  D extends boolean = true,
>(
  query:
    | ((
        db: DBInstance,
      ) => Promise<T[]> | Promise<(Record<string, unknown> | undefined)[]>)
    | Promise<T[]>,
  deconstructArray?: D,
  interactionType?: databaseInteractionTypes,
): apiType<D extends true ? T : T[]>;

async function databaseInteraction<T, D extends boolean = true>(
  query:
    | QueryReturnUnionType
    | Promise<T[]>
    | ((
        db: DBInstance,
      ) => Promise<T[]> | Promise<(Record<string, unknown> | undefined)[]>),
  deconstructArray: D = true as D,
  interactionType: databaseInteractionTypes = databaseInteractionTypes.Default,
): apiType<D extends true ? T : T[]> {
  let promise: Promise<T[] | (Record<string, unknown> | undefined)[]>;

  if (
    typeof query !== "function" &&
    typeof (query as QueryReturnUnionType).toSQL === "function"
  ) {
    promise = (query as QueryReturnUnionType).execute() as Promise<
      T[] | (Record<string, unknown> | undefined)[]
    >;
  } else if (typeof query === "function") {
    promise = (await query(db)) as unknown as Promise<
      T[] | (Record<string, unknown> | undefined)[]
    >;
  } else {
    promise = query;
  }

  const { data: resultArray, error: dbError } = await tc(promise);
  if (dbError) {
    return errAlias({
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "Database operation failed",
      error: dbError,
    });
  }

  if (!Array.isArray(resultArray)) {
    return okAlias<never>().Success().NoData().build();
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

export { databaseInteraction };

export async function databaseTransaction<T>(
  generator: (
    _: TransactionHelper,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => AsyncGenerator<Promise<unknown>, T | apiType<T> | syncType<T>, unknown>,
): apiType<T> {
  try {
    const transactionResultSync: syncType<T> = await db.transaction(
      async (tx) => {
        // Helper bound to this transaction instance
        const _ = async <R>(apiCall: apiType<R>): Promise<R> => {
          const result = await apiCall;
          if (result.isErr()) {
            throw new ApiErrorSignal(result.error);
          }
          return deconstruct(result).content() as R;
        };

        const gen = generator(_, tx);

        let next: IteratorResult<
          Promise<unknown>,
          T | apiType<T> | syncType<T>
        >;
        let lastValue: unknown;

        next = await gen.next();

        while (!next.done) {
          lastValue = await next.value;
          next = await gen.next(lastValue);
        }

        const finalGeneratorResult = next.value;

        // Ensure the final result from the generator is a syncType<T> (Result object)
        if (
          typeof finalGeneratorResult === "object" &&
          finalGeneratorResult !== null &&
          ("isErr" in finalGeneratorResult || "isOk" in finalGeneratorResult)
        ) {
          // It's already a Result-like object. Check if it's a Promise (apiType) or direct Result (syncType).
          if (finalGeneratorResult instanceof Promise) {
            return await finalGeneratorResult; // Resolve apiType<T> to syncType<T>
          } else {
            return finalGeneratorResult as
              | Err<never, apiError>
              | Ok<apiResponse<T>, apiError>;
          }
        } else {
          // It's a raw T, convert it to syncType<T>
          return okAlias((s, t) => ({
            status: s.Success,
            type: t.Success,
            data: finalGeneratorResult as T,
          })) as Ok<apiResponse<T>, apiError>;
        }
      },
    );

    return Promise.resolve(transactionResultSync);
  } catch (e) {
    if (e instanceof ApiErrorSignal) {
      return err(e.error);
    }
    console.error("Unexpected error in databaseTransaction:", e);
    return errAlias({
      status: apiErrorStatus.BadRequest,
      type: apiErrorTypes.BadRequestInternalServerError,
      message: "An unexpected error occurred during the transaction",
      error: e,
    });
  }
}

// --- Election Management ---

/**
 * Updates the status of an election based on current date and state using a database transaction.
 *
 * @param id - The UUID of the election or a related question.
 * @returns An apiType<void> indicating success or failure.
 */
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

  return databaseTransaction<void>(async function* (_, tx) {
    const question = await _(
      databaseInteraction(
        tx
          .select()
          .from(questions)
          .where(or(eq(questions.id, id), eq(questions.questionId, id))),
      ),
    );

    let electionId = id;
    if (question) {
      electionId = question.wahlId;
    }

    // Hole die Wahl mit dem _ Helfer
    const election = await _(
      databaseInteraction(
        tx.select().from(wahlen).where(eq(wahlen.id, electionId)),
      ),
    );

    if (!election) {
      errAlias((s, t) => ({
        status: s.NotFound,
        type: t.NotFound,
        message: "Election not found",
      }));
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

    if (election.isArchived) {
      updates.isActive = false;
      updates.isScheduled = false;
      updates.isCompleted = true;
    } else if (election.archiveDate) {
      updates.archiveDate = null;
    }

    if (Object.keys(updates).length > 0) {
      await _(
        databaseInteraction(
          tx
            .update(wahlen)
            .set(updates)
            .where(eq(wahlen.id, electionId))
            .returning(),
        ),
      );
    }

    return;
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

  return databaseTransaction<void>(async function* (_, tx) {
    await _(updateElectionStatus(id));

    let electionId = id;

    const question = await _(
      databaseInteraction(
        tx
          .select({ wahlId: questions.wahlId })
          .from(questions)
          .where(or(eq(questions.id, id), eq(questions.questionId, id)))
          .limit(1),
      ),
    );

    if (question) {
      electionId = question.wahlId;
    }

    const election = await _(
      databaseInteraction(
        tx.select().from(wahlen).where(eq(wahlen.id, electionId)).limit(1),
      ),
    );

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

    return okAlias<void>().Inconsequential().build();
  });
}
