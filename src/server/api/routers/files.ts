import { eq, not, and, or } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import { db } from "~/server/db";
import { del, put } from "@vercel/blob";
import {
  files,
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema";
import { utapi } from "~/server/uploadthing";
import crypto from "crypto";
import { err, ok, type Result } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const setInternalQuestionFileType = z.object({
  type: z.enum(["info", "true_false", "multiple_choice"]),
  questionId: z.string().uuid(),
  answerId: z.string().uuid(),
  fileId: z.string().uuid().nullable(),
});

type setInternalQuestionFileReturnTypes =
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect;

enum setInternalQuestionFileErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
  InputTypeError = "InputTypeError",
}

type setInternalQuestionFileError =
  | {
      type: Exclude<
        setInternalQuestionFileErrorTypes,
        setInternalQuestionFileErrorTypes.InputTypeError
      >;
      message: string;
    }
  | {
      type: setInternalQuestionFileErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

/**
 * Points an Answer or Question to a file in the system.
 *
 * This function updates the corresponding question record so that it points to a given file.
 * Depending on the question type ("info", "true_false", or "multiple_choice"), it performs
 * different database update operations.
 *
 * @param params - An object containing the following properties:
 *   @param params.type - The type of question ("info", "true_false", or "multiple_choice").
 *   @param params.questionId - The UUID of the question.
 *   @param params.answerId - The UUID of the answer.
 *   @param params.fileId - The UUID of the file, or null if no file should be pointed to.
 * @returns A Promise that resolves with a Result. The Result contains either the updated question record
 *          (of a type inferred from questionInfo, questionTrueFalse, or questionMultipleChoice), or an error.
 */
async function setInternalQuestionFile({
  type,
  questionId,
  answerId,
  fileId,
}: z.infer<typeof setInternalQuestionFileType>): Promise<
  Result<setInternalQuestionFileReturnTypes, setInternalQuestionFileError>
> {
  const { success, error } = setInternalQuestionFileType.safeParse({
    type,
    questionId,
    answerId,
    fileId,
  });
  if (!success) {
    return err({
      type: setInternalQuestionFileErrorTypes.InputTypeError,
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
          type: setInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const iIRes = iIResArray ? iIResArray[0] : undefined;

      if (!iIRes) {
        return err({
          type: setInternalQuestionFileErrorTypes.NotFound,
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
          type: setInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const tFQuestions = tFQuestionsArray ? tFQuestionsArray[0] : undefined;

      if (!tFQuestions) {
        return err({
          type: setInternalQuestionFileErrorTypes.NotFound,
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
              type: setInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo1Res = tFo1ResArray ? tFo1ResArray[0] : undefined;

          if (!tFo1Res) {
            return err({
              type: setInternalQuestionFileErrorTypes.NotFound,
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
              type: setInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo2Res = tFo2ResArray ? tFo2ResArray[0] : undefined;

          if (!tFo2Res) {
            return err({
              type: setInternalQuestionFileErrorTypes.NotFound,
              message: "Answer not found",
            });
          }
          return ok(tFo2Res);
        default:
          return err({
            type: setInternalQuestionFileErrorTypes.NotFound,
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
          type: setInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mCQuestions = mCQuestionsArray ? mCQuestionsArray[0] : undefined;
      if (!mCQuestions?.content) {
        return err({
          type: setInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      const answerIds = mCQuestions.content.map((a) => a.id);
      if (!answerIds.includes(answerId)) {
        return err({
          type: setInternalQuestionFileErrorTypes.NotFound,
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
          type: setInternalQuestionFileErrorTypes.NotFound,
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
          type: setInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mcRes = mcResArray ? mcResArray[0] : undefined;

      if (!mcRes) {
        return err({
          type: setInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      return ok(mcRes);
    default:
      return err({
        type: setInternalQuestionFileErrorTypes.NotFound,
        message: "Question not found",
      });
  }
}

const deleteInternalQuestionFileType = z.object({
  questionId: z.string().uuid(),
  answerId: z.string().uuid(),
});

type deleteInternalQuestionFileReturnTypes =
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect;

enum deleteInternalQuestionFileErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
  InputTypeError = "InputTypeError",
}

type deleteInternalQuestionFileError =
  | {
      type: Exclude<
        deleteInternalQuestionFileErrorTypes,
        deleteInternalQuestionFileErrorTypes.InputTypeError
      >;
      message: string;
    }
  | {
      type: deleteInternalQuestionFileErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

/**
 * To Be Updated
 */
async function removeInternalQuestionFile({
  questionId,
  answerId,
}: z.infer<typeof deleteInternalQuestionFileType>): Promise<
  Result<deleteInternalQuestionFileReturnTypes, deleteInternalQuestionFileError>
> {
  const { success, error } = deleteInternalQuestionFileType.safeParse({
    questionId,
    answerId,
  });
  if (!success) {
    return err({
      type: deleteInternalQuestionFileErrorTypes.InputTypeError,
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
      type: deleteInternalQuestionFileErrorTypes.UpdateFailed,
      message: "Failed to update question",
    });
  }

  const dbresponse = dbresponseArray ? dbresponseArray[0] : undefined;
  if (!dbresponse) {
    return err({
      type: deleteInternalQuestionFileErrorTypes.NotFound,
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
          type: deleteInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const iIRes = iIResArray ? iIResArray[0] : undefined;
      if (!iIRes) {
        return err({
          type: deleteInternalQuestionFileErrorTypes.NotFound,
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
        throw new Error("Question not found");
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
              type: deleteInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo1Res = tFo1ResArray ? tFo1ResArray[0] : undefined;
          if (!tFo1Res) {
            return err({
              type: deleteInternalQuestionFileErrorTypes.NotFound,
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
              type: deleteInternalQuestionFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          }

          const tFo2Res = tFo2ResArray ? tFo2ResArray[0] : undefined;
          if (!tFo2Res) {
            return err({
              type: deleteInternalQuestionFileErrorTypes.NotFound,
              message: "Answer not found",
            });
          }

          return ok(tFo2Res);
        default:
          throw new Error("Answer not found");
      }
    case "multiple_choice":
      // const mCQuestions = (
      //   await db
      //     .select()
      //     .from(questionMultipleChoice)
      //     .where(eq(questionMultipleChoice.questionId, questionId))
      // )[0];
      // if (!mCQuestions) {
      //   throw new Error("Question not found");
      // }
      const { data: mCQuestionsArray, error: mCQuestionsError } = await tc(
        db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.questionId, questionId)),
      );
      if (mCQuestionsError) {
        console.error(mCQuestionsError);
        return err({
          type: deleteInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mCQuestions = mCQuestionsArray ? mCQuestionsArray[0] : undefined;
      if (!mCQuestions?.content) {
        return err({
          type: deleteInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      const answerIds = mCQuestions.content?.map((a) => a.id);
      if (!answerIds?.includes(answerId)) {
        return err({
          type: deleteInternalQuestionFileErrorTypes.NotFound,
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
          type: deleteInternalQuestionFileErrorTypes.NotFound,
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
          type: deleteInternalQuestionFileErrorTypes.UpdateFailed,
          message: "Failed to update question",
        });
      }

      const mcRes = mcResArray ? mcResArray[0] : undefined;
      if (!mcRes) {
        return err({
          type: deleteInternalQuestionFileErrorTypes.NotFound,
          message: "Question not found",
        });
      }

      return ok(mcRes);
    default:
      return err({
        type: deleteInternalQuestionFileErrorTypes.NotFound,
        message: "Question not found",
      });
  }
}

const uuidType = z.string().uuid();

enum deleteByIdErrorTypes {
  notFound = "NotFound",
  trancending = "TrancendingServers",
  noProviderIdentifier = "NoProviderIdentifier",
  DeleteFailed = "DeleteFailed",
  InputTypeError = "InputTypeError",
}

type deleteByIdError =
  | {
      type: Exclude<deleteByIdErrorTypes, deleteByIdErrorTypes.InputTypeError>;
      message: string;
    }
  | {
      type: deleteByIdErrorTypes.InputTypeError;
      message: string;
      zodError: z.ZodError;
    };

export async function deleteById(
  input: z.infer<typeof uuidType>,
): Promise<Result<void, deleteByIdError>> {
  const { success, error } = uuidType.safeParse(input);
  if (!success) {
    return err({
      type: deleteByIdErrorTypes.InputTypeError,
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
      type: deleteByIdErrorTypes.DeleteFailed,
      message: "Failed to Query file",
    });
  }

  let file = fileArray ? fileArray[0] : undefined;
  if (!file) {
    return err({
      type: deleteByIdErrorTypes.notFound,
      message: "File not found",
    });
  }

  if (file.transferStatus === "in progress") {
    return err({
      type: deleteByIdErrorTypes.trancending,
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
        type: deleteByIdErrorTypes.DeleteFailed,
        message: "Failed to Update file",
      });
    }
    file = newFileArray ? newFileArray[0] : undefined;
    if (!file) {
      return err({
        type: deleteByIdErrorTypes.notFound,
        message: "File not found",
      });
    }
  }

  switch (file.storedIn) {
    case "utfs":
      if (!file.ufsKey) {
        return err({
          type: deleteByIdErrorTypes.noProviderIdentifier,
          message: "No UfsKey Provided",
        });
      }
      const deletionResponse = await utapi.deleteFiles(file.ufsKey);
      if (!deletionResponse.success || deletionResponse.deletedCount !== 1) {
        return err({
          type: deleteByIdErrorTypes.DeleteFailed,
          message: "Failed to delete file",
        });
      }
      break;
    case "blob":
      if (!file.blobPath) {
        return err({
          type: deleteByIdErrorTypes.noProviderIdentifier,
          message: "No Blob Path Provided",
        });
      }
      const { error: blobDeleteError } = await tc(del(file.blobPath));

      if (blobDeleteError) {
        console.error(blobDeleteError);
        return err({
          type: deleteByIdErrorTypes.DeleteFailed,
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
      deleteInternalQuestionFileErrorTypes.InputTypeError
    ) {
      return err({
        type: deleteByIdErrorTypes.InputTypeError,
        message: "Input is not of valid Type",
        zodError: rmIQFResponse.error.zodError,
      });
    } else if (
      rmIQFResponse.error.type ===
      deleteInternalQuestionFileErrorTypes.UpdateFailed
    ) {
      return err({
        type: deleteByIdErrorTypes.DeleteFailed,
        message: "Failed to update question",
      });
    } else if (
      rmIQFResponse.error.type === deleteInternalQuestionFileErrorTypes.NotFound
    ) {
      return err({
        type: deleteByIdErrorTypes.notFound,
        message: "Question not found",
      });
    }
  }

  // Delete the file from the db

  const { data: dbFileResponseArray, error: dbFileError } = await tc(
    db.delete(files).where(eq(files.id, input)).returning(),
  );
  if (dbFileError) {
    console.error(dbFileError);
    return err({
      type: deleteByIdErrorTypes.DeleteFailed,
      message: "Failed to delete file",
    });
  }

  const dbFileResponse = dbFileResponseArray
    ? dbFileResponseArray[0]
    : undefined;
  if (!dbFileResponse) {
    return err({
      type: deleteByIdErrorTypes.notFound,
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

type createFileReturnTypes = {
  file: typeof files.$inferSelect;
  question: setInternalQuestionFileReturnTypes;
};

enum createFileErrorTypes {
  NotFound = "NotFound",
  UpdateFailed = "UpdateFailed",
}

type createFileError = {
  type: createFileErrorTypes;
  message: string;
};

type getFileReturnTypes = typeof files.$inferSelect;

enum getFileErrorTypes {
  NotFound = "NotFound",
  RequestFailed = "RequestFailed",
}

type getFileError = {
  type: getFileErrorTypes;
  message: string;
};

enum runFileTransfersErrorTypes {
  NotFound = "NotFound",
  RequestFailed = "RequestFailed",
  TransferFailed = "TransferFailed",
  BlobCorrupted = "BlobCorrupted",
  NoProviderIdentifier = "NoProviderIdentifier",
  UploadFailed = "UploadFailed",
  DeleteFailed = "DeleteFailed",
}

type runFileTransfersError = {
  type: runFileTransfersErrorTypes;
  message: string;
};

export const fileRouter = createTRPCRouter({
  create: publicProcedure // only called by server!
    .input(createFileType)
    .query(
      async ({
        input,
      }): Promise<Result<createFileReturnTypes, createFileError>> => {
        const { data: wahlArray, error: wahlError } = await tc(
          db.select().from(questions).where(eq(questions.id, input.questionId)),
        );
        if (wahlError) {
          console.error(wahlError);
          return err({
            type: createFileErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const wahl = wahlArray ? wahlArray[0] : undefined;
        if (!wahl) {
          return err({
            type: createFileErrorTypes.NotFound,
            message: "Question not found",
          });
        }

        const { data: questionArray, error: questionError } = await tc(
          db.select().from(questions).where(eq(questions.id, input.questionId)),
        );
        if (questionError) {
          console.error(questionError);
          return err({
            type: createFileErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const question = questionArray ? questionArray[0] : undefined;
        if (!question) {
          return err({
            type: createFileErrorTypes.NotFound,
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
            type: createFileErrorTypes.UpdateFailed,
            message: "Failed to update question",
          });
        }

        const response = responseArray ? responseArray[0] : undefined;
        if (!response) {
          return err({
            type: createFileErrorTypes.UpdateFailed,
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
            setInternalQuestionFileErrorTypes.InputTypeError
          ) {
            return err({
              type: createFileErrorTypes.UpdateFailed,
              message: "Failed to update question",
            });
          } else {
            return err({
              type: createFileErrorTypes.UpdateFailed,
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
      async ({ input }): Promise<Result<getFileReturnTypes, getFileError>> => {
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
            type: getFileErrorTypes.RequestFailed,
            message: "Failed to Query file",
          });
        }

        const file = fileArray ? fileArray[0] : undefined;
        if (!file) {
          return err({
            type: getFileErrorTypes.NotFound,
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
    run: publicProcedure.mutation(
      async (): Promise<Result<void, runFileTransfersError>> => {
        // SERVER
        // First set all the files wo are idle and storedIn !== targetStorage to queued
        // This will probably only be called if i manually move around files between storage services

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            type: runFileTransfersErrorTypes.RequestFailed,
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
            type: runFileTransfersErrorTypes.RequestFailed,
            message: "Failed to update file status",
          });
        }

        // Then get all to be transferred files
        const { data: filesToTransfer, error: filesToTransferError } = await tc(
          db.select().from(files).where(eq(files.transferStatus, "queued")),
        );
        if (filesToTransferError) {
          console.error(filesToTransferError);
          return err({
            type: runFileTransfersErrorTypes.RequestFailed,
            message: "Failed to retrieve files to transfer",
          });
        }

        // For each file, transfer it
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
              type: runFileTransfersErrorTypes.TransferFailed,
              message: "Failed to update file status",
            });
          }

          const { data: blob, error: FetchError } = await tc(
            fetch(file.url).then((res) => res.blob()),
          );
          if (FetchError) {
            console.error(FetchError);
            return err({
              type: runFileTransfersErrorTypes.TransferFailed,
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
                type: runFileTransfersErrorTypes.TransferFailed,
                message: "Failed to update file status",
              });
            }
            return err({
              type: runFileTransfersErrorTypes.BlobCorrupted,
              message: "Blob is corrupted",
            });
          }

          // Transfer
          switch (file.targetStorage) {
            case "utfs":
              const { data: up_utfs_response, error: up_utfs_error } = await tc(
                utapi.uploadFilesFromUrl(file.url),
              );
              if (up_utfs_error) {
                console.error(up_utfs_error);
                return err({
                  type: runFileTransfersErrorTypes.UploadFailed,
                  message: "Failed to upload file",
                });
              }
              if (!up_utfs_response.data?.key) {
                console.error("No Key Provided");
                return err({
                  type: runFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Key Provided",
                });
              }
              if (!up_utfs_response.data?.ufsUrl) {
                console.error("No URL Provided");
                return err({
                  type: runFileTransfersErrorTypes.NoProviderIdentifier,
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
                  type: runFileTransfersErrorTypes.UploadFailed,
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
                  type: runFileTransfersErrorTypes.UploadFailed,
                  message: "Failed to upload file",
                });
              }
              if (!up_blob_response.pathname) {
                console.error("No Path Provided");
                return err({
                  type: runFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Path Provided",
                });
              }
              if (!up_blob_response.url) {
                console.error("No URL Provided");
                return err({
                  type: runFileTransfersErrorTypes.NoProviderIdentifier,
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
                  type: runFileTransfersErrorTypes.UploadFailed,
                  message: "Failed to update file location",
                });
              }
              break;
          }

          switch (file.storedIn) {
            case "utfs":
              if (!file.ufsKey) {
                return err({
                  type: runFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Key Provided",
                });
              }

              const { data: del_utfs_response, error: del_utfs_error } =
                await tc(utapi.deleteFiles(file.ufsKey));
              if (del_utfs_error) {
                console.error(del_utfs_error);
                return err({
                  type: runFileTransfersErrorTypes.DeleteFailed,
                  message: "Failed to delete file",
                });
              }
              if (
                !del_utfs_response.success ||
                del_utfs_response.deletedCount !== 1
              ) {
                console.error("Failed to delete file");
                return err({
                  type: runFileTransfersErrorTypes.DeleteFailed,
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
                  type: runFileTransfersErrorTypes.DeleteFailed,
                  message: "Failed to delete file",
                });
              }
              break;
            case "blob":
              if (!file.blobPath) {
                return err({
                  type: runFileTransfersErrorTypes.NoProviderIdentifier,
                  message: "No Path Provided",
                });
              }

              const { error: del_blob_error } = await tc(del(file.blobPath));
              if (del_blob_error) {
                console.error(del_blob_error);
                return err({
                  type: runFileTransfersErrorTypes.DeleteFailed,
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
                  type: runFileTransfersErrorTypes.DeleteFailed,
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
              type: runFileTransfersErrorTypes.RequestFailed,
              message: "Failed to update file status",
            });
          }
        }
        return ok();
      },
    ),
  }),
});
