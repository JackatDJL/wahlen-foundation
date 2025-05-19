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

export type apiType<T> = Promise<
  Ok<apiResponse<T>, apiError> | Err<never, apiError>
>;

export type apiErr<T> = Promise<Err<apiResponse<T>, apiError>>;
export type apiNeverOk = Promise<Err<never, apiError>>;

export type apiOk<T> = Promise<Ok<apiResponse<T>, apiError>>;
export type apiNeverFail<T> = Promise<Ok<apiResponse<T>, never>>;

export type mkSync<T> = Awaited<T>;

export type syncType<T> = mkSync<apiType<T>>;

export type syncErr<T> = mkSync<apiErr<T>>;
export type syncNeverOk = mkSync<apiNeverOk>;

export type syncOk<T> = mkSync<apiOk<T>>;
export type syncNeverFail<T> = mkSync<apiNeverFail<T>>;

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

type OkObjectInput<T> = Partial<apiResponse<T>>;

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

type ErrInitialChain = {
  [K in keyof typeof apiErrorStatus]: () => ErrStatusChain<
    (typeof apiErrorStatus)[K]
  >;
};

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

interface ErrFinalizeChain<
  Status extends apiErrorStatus,
  Type extends apiErrorTypes,
> {
  message(msg: string): ErrFinalizeChain<Status, Type>;
  error(err: unknown): ErrFinalizeChain<Status, Type>;
  build(): Awaited<apiNeverOk>;
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

type ErrObjectInput = Partial<apiError>;

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
