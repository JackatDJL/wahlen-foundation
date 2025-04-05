import { eq, not, and, or } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  secureCronProcedure,
} from "~/server/api/trpc";

import { db } from "~/server/db";
import { del, put } from "@vercel/blob";
import {
  questionInfo,
  questionTrueFalse,
  questionMultipleChoice,
  questions,
} from "~/server/db/schema/questions";
import { utapi } from "~/server/uploadthing";
import crypto from "crypto";
import { err, ok, type Result } from "neverthrow";
import { tc } from "~/lib/tryCatch";
import { throwIfActive } from "./questions/delete";
import { files } from "~/server/db/schema/files";

const setInternalQuestionFileType = z.object({
  type: z.enum(["info", "true_false", "multiple_choice"]),
  questionId: z.string().uuid(),
  answerId: z.string().uuid(),
  fileId: z.string().uuid().nullable(),
});

type SetInternalQuestionFileReturnTypes =
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect;

enum SetInternalQuestionFileErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
  InputTypeError = "InputTypeError",
}

type SetInternalQuestionFileError =
  | {
      type: Exclude<
        SetInternalQuestionFileErrorTypes,
        SetInternalQuestionFileErrorTypes.InputTypeError
      >;
      message: string;
    }
  | {
      type: SetInternalQuestionFileErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

/**
 * Associates a file with a question or its answer.
 *
 * The function validates its input against a Zod schema and updates the appropriate database record based on the question type:
 * - For "info" questions, it sets the file as the question's image.
 * - For "true_false" questions, it determines which option to update (o1Image or o2Image) based on the provided answerId.
 * - For "multiple_choice" questions, it updates the image property for the matching answer within the content array.
 *
 * @param params - An object containing:
 *   - type: The question type ("info", "true_false", or "multiple_choice").
 *   - questionId: The UUID of the question.
 *   - answerId: The UUID of the answer to update.
 *   - fileId: The UUID of the file to associate, or null to remove the association.
 * @returns A Promise that resolves to a Result containing either the updated question record or an error that indicates:
 *   - Input validation failure.
 *   - A database update error.
 *   - A not found condition for the question or answer.
 *
 * @remarks
 * This function employs functional error handling with the `Result` type from the neverthrow library, returning errors rather than throwing exceptions.
 */
async function setInternalQuestionFile({
  type,
  questionId,
  answerId,
  fileId,
}: z.infer<typeof setInternalQuestionFileType>): Promise<
  Result<SetInternalQuestionFileReturnTypes, SetInternalQuestionFileError>
> {
  const { success, error } = setInternalQuestionFileType.safeParse({
    type,
    questionId,
    answerId,
    fileId,
  });
  if (!success) {
    return err({
      type: SetInternalQuestionFileErrorTypes.InputTypeError,
      message: "Input is not of valid Type",
      zodError: error,
    });
  }

  switch (type) {
    case "info":
      const { data: iIResArray, error: iIResError } = await tc(
        db
          .update(questionInfo)
          .set({
            image: fileId,

            updatedAt: new Date(),
          })
          .where(eq(questionInfo.questionId, questionId))
          .returning(),
      );
      if (iIResError) {
        console.error(iIResError);
        return err({
          type: SetInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const iIRes = iIResArray ? iIResArray[0] : undefined;

      if (!iIRes) {
        return err({
          type: SetInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }
      return ok(iIRes);
    case "true_false":
      const { data: tFQuestionsArray, error: tFQuestionsError } = await tc(
        db
          .select()
          .from(questionTrueFalse)
          .where(eq(questionTrueFalse.questionId, questionId)),
      );
      if (tFQuestionsError) {
        console.error(tFQuestionsError);
        return err({
          type: SetInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const tFQuestions = tFQuestionsArray ? tFQuestionsArray[0] : undefined;

      if (!tFQuestions) {
        return err({
          type: SetInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      switch (answerId) {
        case tFQuestions.o1Id:
          const { data: tFo1ResArray, error: tFo1ResError } = await tc(
            db
              .update(questionTrueFalse)
              .set({
                o1Image: fileId ?? null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o1Id))
              .returning(),
          );
          if (tFo1ResError) {
            console.error(tFo1ResError);
            return err({
              type: SetInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo1Res = tFo1ResArray ? tFo1ResArray[0] : undefined;

          if (!tFo1Res) {
            return err({
              type: SetInternalQuestionFileErrorTypes.NotFound,
              message: "Answer not found",
            });
          }
          return ok(tFo1Res);
        case tFQuestions.o2Id:
          const { data: tFo2ResArray, error: tFo2ResError } = await tc(
            db
              .update(questionTrueFalse)
              .set({
                o2Image: fileId ?? null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o2Id))
              .returning(),
          );
          if (tFo2ResError) {
            console.error(tFo2ResError);
            return err({
              type: SetInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo2Res = tFo2ResArray ? tFo2ResArray[0] : undefined;

          if (!tFo2Res) {
            return err({
              type: SetInternalQuestionFileErrorTypes.NotFound,
              message: "Answer not found",
            });
          }
          return ok(tFo2Res);
        default:
          return err({
            type: SetInternalQuestionFileErrorTypes.NotFound,
            message: "Answer not found",
          });
      }
    case "multiple_choice":
      const { data: mCQuestionsArray, error: mCQuestionsError } = await tc(
        db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.questionId, questionId)),
      );
      if (mCQuestionsError) {
        console.error(mCQuestionsError);
        return err({
          type: SetInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mCQuestions = mCQuestionsArray ? mCQuestionsArray[0] : undefined;
      if (!mCQuestions?.content) {
        return err({
          type: SetInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      const answerIds = mCQuestions.content.map((a) => a.id);
      if (!answerIds.includes(answerId)) {
        return err({
          type: SetInternalQuestionFileErrorTypes.NotFound,
          message: "Answer not found",
        });
      }

      const editedContent = mCQuestions.content.map((a) => {
        if (a.id === answerId) {
          return {
            ...a,
            image: fileId ?? undefined,
          };
        }
        return a;
      });
      if (!editedContent.length) {
        return err({
          type: SetInternalQuestionFileErrorTypes.NotFound,
          message: "Answer not found",
        });
      }

      const { data: mcResArray, error: mcResError } = await tc(
        db
          .update(questionMultipleChoice)
          .set({
            content: editedContent,

            updatedAt: new Date(),
          })
          .where(eq(questionMultipleChoice.id, mCQuestions.id))
          .returning(),
      );
      if (mcResError) {
        console.error(mcResError);
        return err({
          type: SetInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mcRes = mcResArray ? mcResArray[0] : undefined;

      if (!mcRes) {
        return err({
          type: SetInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      return ok(mcRes);
    default:
      return err({
        type: SetInternalQuestionFileErrorTypes.NotFound,
        message: "Question not found",
      });
  }
}

const deleteInternalQuestionFileType = z.object({
  questionId: z.string().uuid(),
  answerId: z.string().uuid(),
});

type DeleteInternalQuestionFileReturnTypes =
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect;

enum DeleteInternalQuestionFileErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
  InputTypeError = "InputTypeError",
}

type DeleteInternalQuestionFileError =
  | {
      type: Exclude<
        DeleteInternalQuestionFileErrorTypes,
        DeleteInternalQuestionFileErrorTypes.InputTypeError
      >;
      message: string;
    }
  | {
      type: DeleteInternalQuestionFileErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

/**
 * Removes the file reference from a question record.
 *
 * This function validates the input parameters using Zod and updates the corresponding question record in the database
 * based on its type. For "info" questions, it clears the image field; for "true_false" questions, it clears the image
 * for the appropriate answer option; and for "multiple_choice" questions, it clears the image within the answer's content.
 * The operation returns a {@link Result} that encapsulates either the updated question record or an error indicating
 * whether the input was invalid, the question or answer was not found, or the update failed.
 *
 * @param param0 - Object containing:
 *   - questionId: The unique identifier of the question.
 *   - answerId: The unique identifier of the answer whose file reference should be removed.
 *
 * @returns A {@link Result} with the updated question record on success or an error detailing the failure reason.
 */
async function removeInternalQuestionFile({
  questionId,
  answerId,
}: z.infer<typeof deleteInternalQuestionFileType>): Promise<
  Result<DeleteInternalQuestionFileReturnTypes, DeleteInternalQuestionFileError>
> {
  const { success, error } = deleteInternalQuestionFileType.safeParse({
    questionId,
    answerId,
  });
  if (!success) {
    return err({
      type: DeleteInternalQuestionFileErrorTypes.InputTypeError,
      message: "Input is not of valid Type",
      zodError: error,
    });
  }

  const { data: dbresponseArray, error: dbresponseError } = await tc(
    db.select().from(questions).where(eq(questions.id, questionId)),
  );
  if (dbresponseError) {
    console.error(dbresponseError);
    return err({
      type: DeleteInternalQuestionFileErrorTypes.UpdateFailed,
      message: "Failed to update question",
    });
  }

  const dbresponse = dbresponseArray ? dbresponseArray[0] : undefined;
  if (!dbresponse) {
    return err({
      type: DeleteInternalQuestionFileErrorTypes.NotFound,
      message: "Question not found",
    });
  }

  switch (dbresponse.type) {
    case "info":
      const { data: iIResArray, error: iIResError } = await tc(
        db
          .update(questionInfo)
          .set({
            image: null,

            updatedAt: new Date(),
          })
          .where(eq(questionInfo.questionId, questionId))
          .returning(),
      );
      if (iIResError) {
        console.error(iIResError);
        return err({
          type: DeleteInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const iIRes = iIResArray ? iIResArray[0] : undefined;
      if (!iIRes) {
        return err({
          type: DeleteInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      return ok(iIRes);
    case "true_false":
      const tFQuestions = (
        await db
          .select()
          .from(questionTrueFalse)
          .where(eq(questionTrueFalse.questionId, questionId))
      )[0];
      if (!tFQuestions) {
        return err({
          type: DeleteInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }
      switch (answerId) {
        case tFQuestions.o1Id:
          const { data: tFo1ResArray, error: tFo1ResError } = await tc(
            db
              .update(questionTrueFalse)
              .set({
                o1Image: null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o1Id))
              .returning(),
          );
          if (tFo1ResError) {
            console.error(tFo1ResError);
            return err({
              type: DeleteInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo1Res = tFo1ResArray ? tFo1ResArray[0] : undefined;
          if (!tFo1Res) {
            return err({
              type: DeleteInternalQuestionFileErrorTypes.NotFound,
              message: "Answer not found",
            });
          }

          return ok(tFo1Res);
        case tFQuestions.o2Id:
          const { data: tFo2ResArray, error: tFo2ResError } = await tc(
            db
              .update(questionTrueFalse)
              .set({
                o2Image: null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o2Id))
              .returning(),
          );
          if (tFo2ResError) {
            console.error(tFo2ResError);
            return err({
              type: DeleteInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo2Res = tFo2ResArray ? tFo2ResArray[0] : undefined;
          if (!tFo2Res) {
            return err({
              type: DeleteInternalQuestionFileErrorTypes.NotFound,
              message: "Answer not found",
            });
          }

          return ok(tFo2Res);
        default:
          return err({
            type: DeleteInternalQuestionFileErrorTypes.NotFound,
            message: "Answer not found",
          });
      }
    case "multiple_choice":
      const { data: mCQuestionsArray, error: mCQuestionsError } = await tc(
        db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.questionId, questionId)),
      );
      if (mCQuestionsError) {
        console.error(mCQuestionsError);
        return err({
          type: DeleteInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mCQuestions = mCQuestionsArray ? mCQuestionsArray[0] : undefined;
      if (!mCQuestions?.content) {
        return err({
          type: DeleteInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      const answerIds = mCQuestions.content?.map((a) => a.id);
      if (!answerIds?.includes(answerId)) {
        return err({
          type: DeleteInternalQuestionFileErrorTypes.NotFound,
          message: "Answer not found",
        });
      }
      const editedContent = mCQuestions.content?.map((a) => {
        if (a.id === answerId) {
          return {
            ...a,
            image: undefined,
          };
        }
        return a;
      });
      if (!editedContent?.length) {
        return err({
          type: DeleteInternalQuestionFileErrorTypes.NotFound,
          message: "Answer not found",
        });
      }

      const { data: mcResArray, error: mcResError } = await tc(
        db
          .update(questionMultipleChoice)
          .set({
            content: editedContent,

            updatedAt: new Date(),
          })
          .where(eq(questionMultipleChoice.id, mCQuestions.id))
          .returning(),
      );
      if (mcResError) {
        console.error(mcResError);
        return err({
          type: DeleteInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mcRes = mcResArray ? mcResArray[0] : undefined;
      if (!mcRes) {
        return err({
          type: DeleteInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      return ok(mcRes);
    default:
      return err({
        type: DeleteInternalQuestionFileErrorTypes.NotFound,
        message: "Question not found",
      });
  }
}

const uuidType = z.string().uuid();

enum DeleteByIdErrorTypes {
  notFound = "NotFound",
  trancending = "TrancendingServers",
  noProviderIdentifier = "NoProviderIdentifier",
  DeleteFailed = "DeleteFailed",
  InputTypeError = "InputTypeError",
}

type DeleteByIdError =
  | {
      type: Exclude<DeleteByIdErrorTypes, DeleteByIdErrorTypes.InputTypeError>;
      message: string;
    }
  | {
      type: DeleteByIdErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

/**
 * Deletes a file identified by its UUID, removing both its storage record and associated question reference.
 *
 * The function begins by validating the input against the expected UUID format and retrieving the corresponding file
 * record from the database. It then checks the file's transfer status:
 * - If the file is "in progress," deletion is aborted.
 * - If the file is "queued," the status is updated to "idle" before proceeding.
 *
 * Depending on the storage provider (UTFS or blob), it executes the appropriate deletion operation using the provider's
 * identifier (ufsKey for UTFS or blobPath for blob). After successfully deleting the file from external storage, it
 * removes the file reference from the associated question and deletes the file record from the database.
 *
 * @param input - A UUID identifying the file to delete.
 * @returns A result indicating successful deletion or detailing why the deletion failed.
 */
export async function deleteById(
  input: z.infer<typeof uuidType>,
): Promise<Result<void, DeleteByIdError>> {
  const { success, error } = uuidType.safeParse(input);
  if (!success) {
    return err({
      type: DeleteByIdErrorTypes.InputTypeError,
      message: "Input is not a valid UUID",
      zodError: error,
    });
  }

  const { data: fileArray, error: dbGetError } = await tc(
    db
      .select()
      .from(files)
      .where(or(eq(files.answerId, input), eq(files.id, input)))
      .limit(1),
  );
  if (dbGetError) {
    console.error(dbGetError);
    return err({
      type: DeleteByIdErrorTypes.DeleteFailed,
      message: "Failed to Query file",
    });
  }

  let file = fileArray ? fileArray[0] : undefined;
  if (!file) {
    return err({
      type: DeleteByIdErrorTypes.notFound,
      message: "File not found",
    });
  }

  if (file.transferStatus === "in progress") {
    return err({
      type: DeleteByIdErrorTypes.trancending,
      message: "File is currently being transcending Servers",
    });
  }
  if (file.transferStatus === "queued") {
    const { data: newFileArray, error: dbUpdateError } = await tc(
      db
        .update(files)
        .set({
          targetStorage: file.storedIn,
          transferStatus: "idle",
        })
        .where(eq(files.id, input))
        .returning(),
    );
    if (dbUpdateError) {
      console.error(dbUpdateError);
      return err({
        type: DeleteByIdErrorTypes.DeleteFailed,
        message: "Failed to Update file",
      });
    }
    file = newFileArray ? newFileArray[0] : undefined;
    if (!file) {
      return err({
        type: DeleteByIdErrorTypes.notFound,
        message: "File not found",
      });
    }
  }

  switch (file.storedIn) {
    case "utfs":
      if (!file.ufsKey) {
        return err({
          type: DeleteByIdErrorTypes.noProviderIdentifier,
          message: "No UfsKey Provided",
        });
      }
      const deletionResponse = await utapi.deleteFiles(file.ufsKey);
      if (!deletionResponse.success || deletionResponse.deletedCount !== 1) {
        return err({
          type: DeleteByIdErrorTypes.DeleteFailed,
          message: "Failed to delete file",
        });
      }
      break;
    case "blob":
      if (!file.blobPath) {
        return err({
          type: DeleteByIdErrorTypes.noProviderIdentifier,
          message: "No Blob Path Provided",
        });
      }
      const { error: blobDeleteError } = await tc(del(file.blobPath));

      if (blobDeleteError) {
        console.error(blobDeleteError);
        return err({
          type: DeleteByIdErrorTypes.DeleteFailed,
          message: "Failed to delete file",
        });
      }
      break;
  }

  // Update the presentation to remove the file

  const rmIQFResponse = await removeInternalQuestionFile({
    questionId: file.questionId,
    answerId: file.answerId,
  });
  if (rmIQFResponse.isErr()) {
    if (
      rmIQFResponse.error.type ===
      DeleteInternalQuestionFileErrorTypes.InputTypeError
    ) {
      return err({
        type: DeleteByIdErrorTypes.InputTypeError,
        message: "Input is not of valid Type",
        zodError: rmIQFResponse.error.zodError,
      });
    } else if (
      rmIQFResponse.error.type ===
      DeleteInternalQuestionFileErrorTypes.UpdateFailed
    ) {
      return err({
        type: DeleteByIdErrorTypes.DeleteFailed,
        message: "Failed to update question",
      });
    } else if (
      rmIQFResponse.error.type === DeleteInternalQuestionFileErrorTypes.NotFound
    ) {
      return err({
        type: DeleteByIdErrorTypes.notFound,
        message: "Question not found",
      });
    }
  }

  const { data: dbFileResponseArray, error: dbFileError } = await tc(
    db.delete(files).where(eq(files.id, input)).returning(),
  );
  if (dbFileError) {
    console.error(dbFileError);
    return err({
      type: DeleteByIdErrorTypes.DeleteFailed,
      message: "Failed to delete file",
    });
  }

  const dbFileResponse = dbFileResponseArray
    ? dbFileResponseArray[0]
    : undefined;
  if (!dbFileResponse) {
    return err({
      type: DeleteByIdErrorTypes.notFound,
      message: "File not found",
    });
  }

  return ok();
}

const createFileType = z.object({
  name: z.string(),
  fileType: z.enum(["logo", "banner", "candidate"]),
  dataType: z.string(),
  size: z.number().int(),
  ufsKey: z.string().length(48),
  url: z.string().url(),

  questionId: z.string().uuid(),
  answerId: z.string().uuid(),
  owner: z.string().length(32),
});

export type CreateFileReturnTypes = {
  file: typeof files.$inferSelect;
  question: SetInternalQuestionFileReturnTypes;
};

export enum CreateFileErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
  Disallowed = "Disallowed",
}

export type CreateFileError = {
  type: CreateFileErrorTypes;
  message: string;
};

type GetFileReturnTypes = typeof files.$inferSelect;

enum GetFileErrorTypes {
  NotFound = "NotFound",
  RequestFailed = "RequestFailed",
}

type GetFileError = {
  type: GetFileErrorTypes;
  message: string;
};

enum RunFileTransfersErrorTypes {
  NotFound = "NotFound",
  RequestFailed = "RequestFailed",
  TransferFailed = "TransferFailed",
  BlobCorrupted = "BlobCorrupted",
  NoProviderIdentifier = "NoProviderIdentifier",
  UploadFailed = "UploadFailed",
  DeleteFailed = "DeleteFailed",
}

type RunFileTransfersError = {
  type: RunFileTransfersErrorTypes;
  message: string;
};

export const fileRouter = createTRPCRouter({
  create: publicProcedure // only called by server!
    .input(createFileType)
    .query(
      async ({
        input,
      }): Promise<Result<CreateFileReturnTypes, CreateFileError>> => {
        const tIA = await throwIfActive(input.questionId);
        if (tIA.isErr()) {
          return err({
            type: CreateFileErrorTypes.Disallowed,
            message: "Question is currently active",
          });
        }
        const { data: wahlArray, error: wahlError } = await tc(
          db.select().from(questions).where(eq(questions.id, input.questionId)),
        );
        if (wahlError) {
          console.error(wahlError);
          return err({
            type: CreateFileErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const wahl = wahlArray ? wahlArray[0] : undefined;
        if (!wahl) {
          return err({
            type: CreateFileErrorTypes.NotFound,
            message: "Question not found",
          });
        }

        const { data: questionArray, error: questionError } = await tc(
          db.select().from(questions).where(eq(questions.id, input.questionId)),
        );
        if (questionError) {
          console.error(questionError);
          return err({
            type: CreateFileErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const question = questionArray ? questionArray[0] : undefined;
        if (!question) {
          return err({
            type: CreateFileErrorTypes.NotFound,
            message: "Question not found",
          });
        }

        const file: typeof files.$inferInsert = {
          id: crypto.randomUUID(),
          name: input.name,
          fileType: input.fileType,
          dataType: input.dataType,
          size: input.size,

          ufsKey: input.ufsKey,
          url: input.url,

          storedIn: "utfs",
          targetStorage: "utfs",
          transferStatus: "queued",

          wahlId: wahl.id,
          questionId: input.questionId,
          answerId: input.answerId,
          owner: input.owner,

          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const { data: responseArray, error: dbError } = await tc(
          db.insert(files).values(file).returning(),
        );
        if (dbError) {
          console.error(dbError);
          return err({
            type: CreateFileErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const response = responseArray ? responseArray[0] : undefined;
        if (!response) {
          return err({
            type: CreateFileErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const questionMutation = await setInternalQuestionFile({
          type: question.type,
          questionId: input.questionId,
          answerId: input.answerId,
          fileId: response.id,
        });
        if (questionMutation.isErr()) {
          if (
            questionMutation.error.type ===
            SetInternalQuestionFileErrorTypes.InputTypeError
          ) {
            return err({
              type: CreateFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          } else {
            return err({
              type: CreateFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }
        }

        return ok({
          file: response,
          question: questionMutation.value,
        });
      },
    ),
  get: publicProcedure
    .input(uuidType)
    .query(
      async ({ input }): Promise<Result<GetFileReturnTypes, GetFileError>> => {
        const { data: fileArray, error: dbGetError } = await tc(
          db
            .select()
            .from(files)
            .where(or(eq(files.answerId, input), eq(files.id, input)))
            .limit(1),
        );
        if (dbGetError) {
          console.error(dbGetError);
          return err({
            type: GetFileErrorTypes.RequestFailed,
            message: "Failed to Query file",
          });
        }

        const file = fileArray ? fileArray[0] : undefined;
        if (!file) {
          return err({
            type: GetFileErrorTypes.NotFound,
            message: "File not found",
          });
        }

        return ok(file);
      },
    ),

  deleteById: protectedProcedure.input(uuidType).mutation(async ({ input }) => {
    return deleteById(input);
  }),

  transfers: createTRPCRouter({
    run: secureCronProcedure.mutation(
      async (): Promise<Result<void, RunFileTransfersError>> => {
        // SERVER
        // First set all the files wo are idle and storedIn !== targetStorage to queued
        // This will probably only be called if i manually move around files between storage services

        const { error: dbInitiateStatusError } = await tc(
          db
            .update(files)
            .set({
              transferStatus: "queued",

              updatedAt: new Date(),
            })
            .where(
              and(
                eq(files.transferStatus, "idle"),
                not(eq(files.storedIn, files.targetStorage)),
              ),
            ),
        );
        if (dbInitiateStatusError) {
          console.error(dbInitiateStatusError);
          return err({
            type: RunFileTransfersErrorTypes.RequestFailed,
            message: "Failed to update file status",
          });
        }

        const { error: dbResetSameStorageError } = await tc(
          db
            .update(files)
            .set({
              transferStatus: "idle",

              updatedAt: new Date(),
            })
            .where(
              and(
                not(eq(files.transferStatus, "idle")),
                eq(files.storedIn, files.targetStorage),
              ),
            ),
        );
        if (dbResetSameStorageError) {
          console.error(dbResetSameStorageError);
          return err({
            type: RunFileTransfersErrorTypes.RequestFailed,
            message: "Failed to update file status",
          });
        }

        const { data: filesToTransfer, error: filesToTransferError } = await tc(
          db.select().from(files).where(eq(files.transferStatus, "queued")),
        );
        if (filesToTransferError) {
          console.error(filesToTransferError);
          return err({
            type: RunFileTransfersErrorTypes.RequestFailed,
            message: "Failed to retrieve files to transfer",
          });
        }

        for (const file of filesToTransfer) {
          // Set Status
          const { error: SetStatusError } = await tc(
            db
              .update(files)
              .set({
                transferStatus: "in progress",

                updatedAt: new Date(),
              })
              .where(eq(files.id, file.id)),
          );
          if (SetStatusError) {
            console.error(SetStatusError);
            return err({
              type: RunFileTransfersErrorTypes.TransferFailed,
              message: "Failed to update file status",
            });
          }

          const { data: blob, error: FetchError } = await tc(
            fetch(file.url).then((res) => res.blob()),
          );
          if (FetchError) {
            console.error(FetchError);
            return err({
              type: RunFileTransfersErrorTypes.TransferFailed,
              message: "Failed to fetch file blob",
            });
          }

          if (blob.size !== file.size) {
            console.error(
              "Blob is Corrupted (Or Cloudflare making issues again), Aborting transfer",
            );
            const { error: AbortError } = await tc(
              db
                .update(files)
                .set({
                  transferStatus: "idle",

                  updatedAt: new Date(),
                })
                .where(eq(files.id, file.id)),
            );
            if (AbortError) {
              console.error(AbortError);
              return err({
                type: RunFileTransfersErrorTypes.TransferFailed,
                message: "Failed to update file status",
              });
            }
            return err({
              type: RunFileTransfersErrorTypes.BlobCorrupted,
              message: "Blob is corrupted",
            });
          }

          switch (file.targetStorage) {
            case "utfs":
              const { data: up_utfs_response, error: up_utfs_error } = await tc(
                utapi.uploadFilesFromUrl(file.url),
              );
              if (up_utfs_error) {
                console.error(up_utfs_error);
                return err({
                  type: RunFileTransfersErrorTypes.UploadFailed,
                  message: "Failed to upload file",
                });
              }
              if (!up_utfs_response.data?.key) {
                console.error("No Key Provided");
                return err({
                  type: RunFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Key Provided",
                });
              }
              if (!up_utfs_response.data?.ufsUrl) {
                console.error("No URL Provided");
                return err({
                  type: RunFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No URL Provided",
                });
              }

              const { error: dbUpdateFileLocationError } = await tc(
                db
                  .update(files)
                  .set({
                    ufsKey: up_utfs_response.data.key,
                    url: up_utfs_response.data.ufsUrl,

                    updatedAt: new Date(),
                  })
                  .where(eq(files.id, file.id)),
              );
              if (dbUpdateFileLocationError) {
                console.error(dbUpdateFileLocationError);
                return err({
                  type: RunFileTransfersErrorTypes.UploadFailed,
                  message: "Failed to update file location",
                });
              }
              break;
            case "blob":
              const { data: up_blob_response, error: up_blob_error } = await tc(
                put(
                  `wahlen/${process.env.NODE_ENV}/${file.owner}/${file.name}`,
                  blob,
                  {
                    access: "public",
                  },
                ),
              );
              if (up_blob_error) {
                console.error(up_blob_error);
                return err({
                  type: RunFileTransfersErrorTypes.UploadFailed,
                  message: "Failed to upload file",
                });
              }
              if (!up_blob_response.pathname) {
                console.error("No Path Provided");
                return err({
                  type: RunFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Path Provided",
                });
              }
              if (!up_blob_response.url) {
                console.error("No URL Provided");
                return err({
                  type: RunFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No URL Provided",
                });
              }

              const { error: dbUpdateBlobLocationError } = await tc(
                db
                  .update(files)
                  .set({
                    blobPath: up_blob_response.pathname,
                    url: up_blob_response.url,

                    updatedAt: new Date(),
                  })
                  .where(eq(files.id, file.id)),
              );
              if (dbUpdateBlobLocationError) {
                console.error(dbUpdateBlobLocationError);
                return err({
                  type: RunFileTransfersErrorTypes.UploadFailed,
                  message: "Failed to update file location",
                });
              }
              break;
          }

          switch (file.storedIn) {
            case "utfs":
              if (!file.ufsKey) {
                return err({
                  type: RunFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Key Provided",
                });
              }

              const { data: del_utfs_response, error: del_utfs_error } =
                await tc(utapi.deleteFiles(file.ufsKey));
              if (del_utfs_error) {
                console.error(del_utfs_error);
                return err({
                  type: RunFileTransfersErrorTypes.DeleteFailed,
                  message: "Failed to delete file",
                });
              }
              if (
                !del_utfs_response.success ||
                del_utfs_response.deletedCount !== 1
              ) {
                console.error("Failed to delete file");
                return err({
                  type: RunFileTransfersErrorTypes.DeleteFailed,
                  message: "Failed to delete file",
                });
              }

              const { error: dbDelUtfsError } = await tc(
                db
                  .update(files)
                  .set({
                    ufsKey: null,

                    updatedAt: new Date(),
                  })
                  .where(eq(files.id, file.id)),
              );
              if (dbDelUtfsError) {
                console.error(dbDelUtfsError);
                return err({
                  type: RunFileTransfersErrorTypes.DeleteFailed,
                  message: "Failed to delete file",
                });
              }
              break;
            case "blob":
              if (!file.blobPath) {
                return err({
                  type: RunFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Path Provided",
                });
              }

              const { error: del_blob_error } = await tc(del(file.blobPath));
              if (del_blob_error) {
                console.error(del_blob_error);
                return err({
                  type: RunFileTransfersErrorTypes.DeleteFailed,
                  message: "Failed to delete file",
                });
              }

              const { error: dbDelBlobError } = await tc(
                db
                  .update(files)
                  .set({
                    blobPath: null,

                    updatedAt: new Date(),
                  })
                  .where(eq(files.id, file.id)),
              );
              if (dbDelBlobError) {
                console.error(dbDelBlobError);
                return err({
                  type: RunFileTransfersErrorTypes.DeleteFailed,
                  message: "Failed to delete file",
                });
              }

              break;
          }

          const { error: dbUpdateStatusError } = await tc(
            db
              .update(files)
              .set({
                storedIn: file.targetStorage,
                transferStatus: "idle",

                updatedAt: new Date(),
              })
              .where(eq(files.id, file.id)),
          );
          if (dbUpdateStatusError) {
            console.error(dbUpdateStatusError);
            return err({
              type: RunFileTransfersErrorTypes.RequestFailed,
              message: "Failed to update file status",
            });
          }
        }
        return ok();
      },
    ),
  }),
});
