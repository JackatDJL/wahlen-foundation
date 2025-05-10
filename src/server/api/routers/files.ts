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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used in JSDOC
import { err, ok, type Result } from "neverthrow";
import { tc } from "~/lib/tryCatch";
import { databaseInteraction, validateEditability } from "./utility";
import { files } from "~/server/db/schema/files";
import {
  apiErrorTypes,
  apiErrorStatus,
  apiResponseTypes,
  apiResponseStatus,
  type apiType,
  uuidType,
} from "./utility";

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
}: z.infer<
  typeof setInternalQuestionFileType
>): apiType<SetInternalQuestionFileReturnTypes> {
  const { success, error } = setInternalQuestionFileType.safeParse({
    type,
    questionId,
    answerId,
    fileId,
  });
  if (!success) {
    return err({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
      message: "Input is not of valid Type",

      zodError: error,
    });
  }

  switch (type) {
    case "info":
      const iIRes = await databaseInteraction(
        db
          .update(questionInfo)
          .set({
            image: fileId,

            updatedAt: new Date(),
          })
          .where(eq(questionInfo.questionId, questionId))
          .returning(),
        true,
      );
      if (iIRes.isErr()) {
        return err(iIRes.error);
      }

      return ok({
        status: apiResponseStatus.Success,

        data: iIRes.value.data!,
      });

    case "true_false":
      const tFQ = await databaseInteraction(
        db
          .select()
          .from(questionTrueFalse)
          .where(eq(questionTrueFalse.questionId, questionId)),
        true,
      );
      if (tFQ.isErr()) {
        return err(tFQ.error);
      }
      const tFQuestions = tFQ.value.data!;

      switch (answerId) {
        case tFQuestions.o1Id:
          const tFo1 = await databaseInteraction(
            db
              .update(questionTrueFalse)
              .set({
                o1Image: fileId ?? null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o1Id))
              .returning(),
            true,
          );
          if (tFo1.isErr()) {
            return err(tFo1.error);
          }

          return ok({
            status: apiResponseStatus.Success,

            data: tFo1.value.data!,
          });

        case tFQuestions.o2Id:
          const tFo2 = await databaseInteraction(
            db
              .update(questionTrueFalse)
              .set({
                o2Image: fileId ?? null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o2Id))
              .returning(),
          );
          if (tFo2.isErr()) {
            return err(tFo2.error);
          }

          return ok({
            status: apiResponseStatus.Success,

            data: tFo2.value.data!,
          });

        default:
          return err({
            status: apiErrorStatus.NotFound,

            message: "Answer not found",
          });
      }

    case "multiple_choice":
      const mCQ = await databaseInteraction(
        db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.questionId, questionId)),
        true,
      );
      if (mCQ.isErr()) {
        return err(mCQ.error);
      }
      const mCQuestions = mCQ.value.data!;

      const answerIds = mCQuestions.content?.map((a) => a.id);
      if (!answerIds?.includes(answerId)) {
        return err({
          status: apiErrorStatus.NotFound,
          message: "Answer not found",
        });
      }

      const editedContent = mCQuestions.content?.map((a) => {
        if (a.id === answerId) {
          return {
            ...a,
            image: fileId ?? undefined,
          };
        }
        return a;
      });
      if (!editedContent?.length) {
        return err({
          status: apiErrorStatus.NotFound,
          message: "Answer not found",
        });
      }

      const mcRes = await databaseInteraction(
        db
          .update(questionMultipleChoice)
          .set({
            content: editedContent,

            updatedAt: new Date(),
          })
          .where(eq(questionMultipleChoice.id, mCQuestions.id))
          .returning(),
        true,
      );
      if (mcRes.isErr()) {
        return err(mcRes.error);
      }

      return ok({
        status: apiResponseStatus.Success,

        data: mcRes.value.data!,
      });

    default:
      return err({
        status: apiErrorStatus.NotFound,
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
}: z.infer<
  typeof deleteInternalQuestionFileType
>): apiType<DeleteInternalQuestionFileReturnTypes> {
  const { success, error } = deleteInternalQuestionFileType.safeParse({
    questionId,
    answerId,
  });
  if (!success) {
    return err({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
      message: "Input is not of valid Type",

      zodError: error,
    });
  }

  const response = await databaseInteraction(
    db.select().from(questions).where(eq(questions.id, questionId)).limit(1),
    true,
  );
  if (response.isErr()) {
    return err(response.error);
  }
  const question = response.value.data!;

  switch (question.type) {
    case "info":
      const iIRes = await databaseInteraction(
        db
          .update(questionInfo)
          .set({
            image: null,

            updatedAt: new Date(),
          })
          .where(eq(questionInfo.questionId, questionId))
          .returning(),
        true,
      );
      if (iIRes.isErr()) {
        return err(iIRes.error);
      }

      return ok({
        status: apiResponseStatus.Success,

        data: iIRes.value.data!,
      });

    case "true_false":
      const tFQ = await databaseInteraction(
        db
          .select()
          .from(questionTrueFalse)
          .where(eq(questionTrueFalse.questionId, questionId)),
        true,
      );
      if (tFQ.isErr()) {
        return err(tFQ.error);
      }

      const tFQuestions = tFQ.value.data!;

      switch (answerId) {
        case tFQuestions.o1Id:
          const tFo1 = await databaseInteraction(
            db
              .update(questionTrueFalse)
              .set({
                o1Image: null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o1Id))
              .returning(),
            true,
          );
          if (tFo1.isErr()) {
            return err(tFo1.error);
          }

          return ok({
            status: apiResponseStatus.Success,

            data: tFo1.value.data!,
          });

        case tFQuestions.o2Id:
          const tFo2 = await databaseInteraction(
            db
              .update(questionTrueFalse)
              .set({
                o2Image: null,

                updatedAt: new Date(),
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o2Id))
              .returning(),
            true,
          );
          if (tFo2.isErr()) {
            return err(tFo2.error);
          }

          return ok({
            status: apiResponseStatus.Success,

            data: tFo2.value.data!,
          });

        default:
          return err({
            status: apiErrorStatus.NotFound,
            message: "Answer not found",
          });
      }

    case "multiple_choice":
      const mCQ = await databaseInteraction(
        db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.questionId, questionId)),
        true,
      );
      if (mCQ.isErr()) {
        return err(mCQ.error);
      }

      const mCQuestions = mCQ.value.data!;

      const answerIds = mCQuestions.content?.map((a) => a.id);
      if (!answerIds?.includes(answerId)) {
        return err({
          status: apiErrorStatus.NotFound,
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
          status: apiErrorStatus.NotFound,
          message: "Answer not found",
        });
      }

      const mcRes = await databaseInteraction(
        db
          .update(questionMultipleChoice)
          .set({
            content: editedContent,

            updatedAt: new Date(),
          })
          .where(eq(questionMultipleChoice.id, mCQuestions.id))
          .returning(),
        true,
      );
      if (mcRes.isErr()) {
        return err(mcRes.error);
      }

      return ok({
        status: apiResponseStatus.Success,

        data: mcRes.value.data!,
      });

    default:
      return err({
        status: apiErrorStatus.NotFound,
        message: "Question not found",
      });
  }
}

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
): apiType<void> {
  const { success, error } = uuidType.safeParse(input);
  if (!success) {
    return err({
      status: apiErrorStatus.ValidationError,
      type: apiErrorTypes.ValidationErrorZod,
      message: "Input is not of valid Type",
      zodError: error,
    });
  }

  const f = await databaseInteraction(
    db
      .select()
      .from(files)
      .where(or(eq(files.answerId, input), eq(files.id, input)))
      .limit(1),
    true,
  );
  if (f.isErr()) {
    return err(f.error);
  }

  let file = f.value.data!;

  if (file.transferStatus === "in progress") {
    return err({
      status: apiErrorStatus.Conflict,
      type: apiErrorTypes.ConflictDataTranscending,
      message: "File is currently being transferred",
    });
  }
  if (file.transferStatus === "queued") {
    // const { data: newFileArray, error: dbUpdateError } = await tc(
    //   db
    //     .update(files)
    //     .set({
    //       targetStorage: file.storedIn,
    //       transferStatus: "idle",
    //     })
    //     .where(eq(files.id, input))
    //     .returning(),
    // );
    // if (dbUpdateError) {
    //   console.error(dbUpdateError);
    //   return err({
    //     type: apiErrorTypes.BadRequest,
    //     detailedType: apiDetailedErrorType.BadRequestInternalServerError,
    //     message: "Failed to update file",
    //   });
    // }

    // const updatedFile = newFileArray ? newFileArray[0] : undefined;

    const updatedFile = await databaseInteraction(
      db
        .update(files)
        .set({
          targetStorage: file.storedIn,
          transferStatus: "idle",
        })
        .where(eq(files.id, input))
        .returning(),
      true,
    );
    if (updatedFile.isErr()) {
      return err(updatedFile.error);
    }

    if (!updatedFile.value) {
      return err({
        status: apiErrorStatus.NotFound,
        message: "File not found",
      });
    }
    file = updatedFile.value.data!;
  }

  switch (file.storedIn) {
    case "utfs":
      if (!file.ufsKey) {
        return err({
          status: apiErrorStatus.Incomplete,
          type: apiErrorTypes.IncompleteProviderIdentification,
          message: "No UFS Key Provided",
        });
      }
      const deletionResponse = await utapi.deleteFiles(file.ufsKey);
      if (!deletionResponse.success || deletionResponse.deletedCount !== 1) {
        return err({
          status: apiErrorStatus.Failed,
          message: "Failed to delete file",
        });
      }
      break;
    case "blob":
      if (!file.blobPath) {
        return err({
          status: apiErrorStatus.Incomplete,
          type: apiErrorTypes.IncompleteProviderIdentification,
          message: "No Blob Path Provided",
        });
      }
      const { error: blobDeleteError } = await tc(del(file.blobPath));

      if (blobDeleteError) {
        console.error(blobDeleteError);
        return err({
          status: apiErrorStatus.Failed,
          message: "Failed to delete file",
        });
      }
      break;
  }

  // Update the presentation to remove the file

  const rIQF = await removeInternalQuestionFile({
    questionId: file.questionId,
    answerId: file.answerId,
  });
  if (rIQF.isErr()) {
    return err(rIQF.error);
  }

  const dbFileResponse = await databaseInteraction(
    db.delete(files).where(eq(files.id, input)).returning(),
    true,
  );
  if (dbFileResponse.isErr()) {
    return err(dbFileResponse.error);
  }

  return ok({
    status: apiResponseStatus.Success,
    type: apiResponseTypes.SuccessNoData,
  });
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

type GetFileReturnTypes = typeof files.$inferSelect;

export const fileRouter = createTRPCRouter({
  create: publicProcedure // only called by server!
    .input(createFileType)
    .query(async ({ input }): apiType<CreateFileReturnTypes> => {
      const vE = await validateEditability(input.questionId);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const wahl = await databaseInteraction(
        db
          .select()
          .from(questions)
          .where(eq(questions.id, input.questionId))
          .limit(1),
        true,
      );
      if (wahl.isErr()) {
        return err(wahl.error);
      }

      const question = await databaseInteraction(
        db
          .select()
          .from(questions)
          .where(eq(questions.id, input.questionId))
          .limit(1),
        true,
      );
      if (question.isErr()) {
        return err(question.error);
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

        wahlId: wahl.value.data!.id,
        questionId: input.questionId,
        answerId: input.answerId,
        owner: input.owner,

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = await databaseInteraction(
        db.insert(files).values(file).returning(),
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      const questionMutation = await setInternalQuestionFile({
        type: question.value.data!.type,
        questionId: input.questionId,
        answerId: input.answerId,
        fileId: response.value.data!.id,
      });
      if (questionMutation.isErr()) {
        return err(questionMutation.error);
      }

      return ok({
        status: apiResponseStatus.Success,

        data: {
          file: response.value.data!,
          question: questionMutation.value.data!,
        },
      });
    }),

  get: publicProcedure
    .input(uuidType)
    .query(async ({ input }): apiType<GetFileReturnTypes> => {
      const response = await databaseInteraction(
        db
          .select()
          .from(files)
          .where(or(eq(files.answerId, input), eq(files.id, input)))
          .limit(1),
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        status: apiResponseStatus.Success,

        data: response.value.data!,
      });
    }),

  deleteById: protectedProcedure.input(uuidType).mutation(async ({ input }) => {
    return deleteById(input);
  }),

  transfers: createTRPCRouter({
    run: secureCronProcedure.mutation(async (): apiType<void> => {
      // SERVER
      // First set all the files wo are idle and storedIn !== targetStorage to queued
      // This will probably only be called if i manually move around files between storage services

      const dbInitiate = await databaseInteraction(
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
          )
          .returning(),
      );
      if (dbInitiate.isErr()) {
        return err(dbInitiate.error);
      }

      const dbResetSameStorage = await databaseInteraction(
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
          )
          .returning(),
      );
      if (dbResetSameStorage.isErr()) {
        return err(dbResetSameStorage.error);
      }

      const fTT = await databaseInteraction(
        db.select().from(files).where(eq(files.transferStatus, "queued")),
        false,
      );
      if (fTT.isErr()) {
        return err(fTT.error);
      }

      const filesToTransfer = fTT.value.data!;

      for (const file of filesToTransfer) {
        const SS = await databaseInteraction(
          db
            .update(files)
            .set({
              transferStatus: "in progress",

              updatedAt: new Date(),
            })
            .where(eq(files.id, file.id))
            .returning(),
          true,
        );
        if (SS.isErr()) {
          return err(SS.error);
        }

        const { data: blob, error: FetchError } = await tc(
          fetch(file.url).then((res) => res.blob()),
        );
        if (FetchError) {
          console.error(FetchError);
          return err({
            status: apiErrorStatus.BadRequest,
            type: apiErrorTypes.BadRequestSequentialOperationFailure,
            message: "Failed to fetch file",
          });
        }

        if (blob.size !== file.size) {
          console.error(
            "Blob is Corrupted (Or Cloudflare making issues again), Aborting transfer",
          );
          const abort = await databaseInteraction(
            db
              .update(files)
              .set({
                transferStatus: "idle",

                updatedAt: new Date(),
              })
              .where(eq(files.id, file.id))
              .returning(),
            true,
          );
          if (abort.isErr()) {
            return err(abort.error);
          }

          return err({
            status: apiErrorStatus.BadRequest,
            type: apiErrorTypes.BadRequestCorrupted,
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
                status: apiErrorStatus.Failed,
                type: apiErrorTypes.Failed,
                message: "Failed to upload file",
              });
            }
            if (!up_utfs_response.data?.key) {
              console.error("No Key Provided");
              return err({
                status: apiErrorStatus.Incomplete,
                type: apiErrorTypes.IncompleteProviderIdentification,
                message: "No Key Provided",
              });
            }
            if (!up_utfs_response.data?.ufsUrl) {
              console.error("No URL Provided");
              return err({
                status: apiErrorStatus.Incomplete,
                type: apiErrorTypes.IncompleteProviderIdentification,
                message: "No URL Provided",
              });
            }

            const dbUpdateFileLocation = await databaseInteraction(
              db
                .update(files)
                .set({
                  ufsKey: up_utfs_response.data.key,
                  url: up_utfs_response.data.ufsUrl,

                  updatedAt: new Date(),
                })
                .where(eq(files.id, file.id))
                .returning(),
              true,
            );
            if (dbUpdateFileLocation.isErr()) {
              return err(dbUpdateFileLocation.error);
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
                status: apiErrorStatus.Failed,
                type: apiErrorTypes.Failed,
                message: "Failed to upload file",
              });
            }
            if (!up_blob_response.pathname) {
              console.error("No Path Provided");
              return err({
                status: apiErrorStatus.BadRequest,
                type: apiErrorTypes.BadRequestCorrupted,
                message: "No Path Provided",
              });
            }
            if (!up_blob_response.url) {
              console.error("No URL Provided");
              return err({
                status: apiErrorStatus.BadRequest,
                type: apiErrorTypes.BadRequestCorrupted,
                message: "No URL Provided",
              });
            }

            const dbUpdateBlobLocation = await databaseInteraction(
              db
                .update(files)
                .set({
                  blobPath: up_blob_response.pathname,
                  url: up_blob_response.url,

                  updatedAt: new Date(),
                })
                .where(eq(files.id, file.id))
                .returning(),
              true,
            );
            if (dbUpdateBlobLocation.isErr()) {
              return err(dbUpdateBlobLocation.error);
            }
            break;
        }

        switch (file.storedIn) {
          case "utfs":
            if (!file.ufsKey) {
              return err({
                status: apiErrorStatus.Incomplete,
                type: apiErrorTypes.IncompleteProviderIdentification,
                message: "No UFS Key Provided",
              });
            }

            const { data: del_utfs_response, error: del_utfs_error } = await tc(
              utapi.deleteFiles(file.ufsKey),
            );
            if (del_utfs_error) {
              console.error(del_utfs_error);
              return err({
                status: apiErrorStatus.Failed,
                type: apiErrorTypes.Failed,
                message: "Failed to delete file",
              });
            }
            if (
              !del_utfs_response.success ||
              del_utfs_response.deletedCount !== 1
            ) {
              console.error("Failed to delete file");
              return err({
                status: apiErrorStatus.Failed,
                type: apiErrorTypes.Failed,
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
                status: apiErrorStatus.Failed,
                type: apiErrorTypes.Failed,
                message: "Failed to delete file",
              });
            }
            break;
          case "blob":
            if (!file.blobPath) {
              return err({
                status: apiErrorStatus.BadRequest,
                type: apiErrorTypes.BadRequestCorrupted,
                message: "No Path Provided",
              });
            }

            const { error: del_blob_error } = await tc(del(file.blobPath));
            if (del_blob_error) {
              console.error(del_blob_error);
              return err({
                status: apiErrorStatus.Failed,
                type: apiErrorTypes.Failed,
                message: "Failed to delete file",
              });
            }

            const dbDelBlob = await databaseInteraction(
              db
                .update(files)
                .set({
                  blobPath: null,

                  updatedAt: new Date(),
                })
                .where(eq(files.id, file.id))
                .returning(),
              true,
            );
            if (dbDelBlob.isErr()) {
              return err(dbDelBlob.error);
            }

            break;
        }

        const dbUpdateStatus = await databaseInteraction(
          db
            .update(files)
            .set({
              storedIn: file.targetStorage,
              transferStatus: "idle",

              updatedAt: new Date(),
            })
            .where(eq(files.id, file.id))
            .returning(),
          true,
        );
        if (dbUpdateStatus.isErr()) {
          return err(dbUpdateStatus.error);
        }
      }
      return ok({
        status: apiResponseStatus.Inconsequential,
      });
    }),
  }),
});
