import { eq, not, and, or } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  secureCronProcedure,
} from "~/server/api/trpc";

import { del, put } from "@vercel/blob";
import {
  questionInfo,
  questionTrueFalse,
  questionMultipleChoice,
  questions,
} from "~/server/db/schema/questions";
import { utapi } from "~/server/uploadthing";
import crypto from "crypto";
import { tc } from "~/lib/tryCatch";
import {
  databaseInteraction,
  databaseTransaction,
  validateEditability,
} from "../utility";
import { files } from "~/server/db/schema/files";
import { type apiType, uuidType, ok, err } from "../utility";

// --- --- Utility Functions --- ---

// --- cross Table Relations ---

// -- creator --

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
 * TODO: rewrite jsdoc
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
    return err((s, t) => ({
      status: s.ValidationError,
      type: t.ValidationErrorZod,
      message: "Input is not of valid Type",
      error,
    }));
  }

  switch (type) {
    case "info":
      return databaseTransaction(async function* (_, tx) {
        return await _(
          databaseInteraction(
            tx
              .update(questionInfo)
              .set({
                image: fileId,

                updatedAt: new Date(),
              })
              .where(eq(questionInfo.questionId, questionId))
              .returning(),
          ),
        );
      });

    case "true_false":
      return databaseTransaction(async function* (_, tx) {
        const question = await _(
          databaseInteraction(
            tx
              .select()
              .from(questionTrueFalse)
              .where(eq(questionTrueFalse.questionId, questionId)),
          ),
        );

        switch (answerId) {
          case question.o1Id:
            return await _(
              databaseInteraction(
                tx
                  .update(questionTrueFalse)
                  .set({
                    o1Image: fileId ?? null,

                    updatedAt: new Date(),
                  })
                  .where(eq(questionTrueFalse.id, question.o1Id))
                  .returning(),
              ),
            );

          case question.o2Id:
            return await _(
              databaseInteraction(
                tx
                  .update(questionTrueFalse)
                  .set({
                    o2Image: fileId ?? null,

                    updatedAt: new Date(),
                  })
                  .where(eq(questionTrueFalse.id, question.o2Id))
                  .returning(),
              ),
            );

          default:
            return err().NotFound().message("Answer not found").transaction();
        }
      });

    case "multiple_choice":
      return databaseTransaction(async function* (_, tx) {
        const question = await _(
          databaseInteraction(
            tx
              .select()
              .from(questionMultipleChoice)
              .where(eq(questionMultipleChoice.questionId, questionId)),
          ),
        );

        const answerIds = question.content?.map((a) => a.id);

        const editedContent = question.content?.map((a) => {
          if (a.id === answerId) {
            return {
              ...a,
              image: fileId ?? undefined,
            };
          }
          return a;
        });

        if (!answerIds?.includes(answerId) || !editedContent?.length) {
          return err().NotFound().message("Answer not found").transaction();
        }

        return await _(
          databaseInteraction(
            tx
              .update(questionMultipleChoice)
              .set({
                content: editedContent,

                updatedAt: new Date(),
              })
              .where(eq(questionMultipleChoice.id, question.id))
              .returning(),
          ),
        );
      });

    default:
      return err().NotFound().message("Question not Found").build();
  }
}

// -- remover --

const deleteInternalQuestionFileType = z.object({
  questionId: z.string().uuid(),
  answerId: z.string().uuid(),
});

type DeleteInternalQuestionFileReturnTypes =
  | typeof questionInfo.$inferSelect
  | typeof questionTrueFalse.$inferSelect
  | typeof questionMultipleChoice.$inferSelect;

/**
 * TODO: rewrite jsdoc
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
    return err((s, t) => ({
      status: s.ValidationError,
      type: t.ValidationErrorZod,
      message: "Input is not of valid Type",
      error,
    }));
  }

  return databaseTransaction<DeleteInternalQuestionFileReturnTypes>(
    async function* (_, tx) {
      const question = await _(
        databaseInteraction(
          tx
            .select()
            .from(questions)
            .where(eq(questions.id, questionId))
            .limit(1),
        ),
      );

      switch (question.type) {
        case "info":
          return await _(
            databaseInteraction(
              tx
                .update(questionInfo)
                .set({
                  image: null,

                  updatedAt: new Date(),
                })
                .where(eq(questionInfo.questionId, questionId))
                .returning(),
              true,
            ),
          );

        case "true_false":
          const tFQuestions = await _(
            // könnte auch ohne _ aber ist besser zum reingewöhnnen
            databaseInteraction(
              tx
                .select()
                .from(questionTrueFalse)
                .where(eq(questionTrueFalse.questionId, questionId)),
            ),
          );

          switch (answerId) {
            case tFQuestions.o1Id:
              return await _(
                databaseInteraction(
                  tx
                    .update(questionTrueFalse)
                    .set({
                      o1Image: null,

                      updatedAt: new Date(),
                    })
                    .where(eq(questionTrueFalse.id, tFQuestions.o1Id))
                    .returning(),
                ),
              );

            case tFQuestions.o2Id:
              return await _(
                databaseInteraction(
                  tx
                    .update(questionTrueFalse)
                    .set({
                      o2Image: null,

                      updatedAt: new Date(),
                    })
                    .where(eq(questionTrueFalse.id, tFQuestions.o2Id))
                    .returning(),
                ),
              );

            default:
              return err().NotFound().message("Answer not found").transaction();
          }

        case "multiple_choice":
          const mCQuestions = await _(
            databaseInteraction(
              tx
                .select()
                .from(questionMultipleChoice)
                .where(eq(questionMultipleChoice.questionId, questionId)),
              true,
            ),
          );

          const answerIds = mCQuestions.content?.map((a) => a.id);

          const editedContent = mCQuestions.content?.map((a) => {
            if (a.id === answerId) {
              return {
                ...a,
                image: undefined,
              };
            }
            return a;
          });

          if (!editedContent?.length || !answerIds?.includes(answerId)) {
            return err().NotFound().message("Answer not found").transaction();
          }

          return await _(
            databaseInteraction(
              tx
                .update(questionMultipleChoice)
                .set({
                  content: editedContent,

                  updatedAt: new Date(),
                })
                .where(eq(questionMultipleChoice.id, mCQuestions.id))
                .returning(),
              true,
            ),
          );

        default:
          return err().NotFound().message("Question not Found").transaction();
      }
    },
  );
}

// --- Internal File Management ---

// -- deletion --

/**
 * TODO: rewrite jsdoc
 */
export async function deleteById(
  input: z.infer<typeof uuidType>,
): apiType<void> {
  const { success, error } = uuidType.safeParse(input);
  if (!success) {
    return err((s, t) => ({
      status: s.ValidationError,
      type: t.ValidationErrorZod,
      message: "Input is not of valid Type",
      error,
    }));
  }

  return databaseTransaction<void>(async function* (_, tx) {
    let file = await _(
      databaseInteraction(
        tx
          .select()
          .from(files)
          .where(or(eq(files.answerId, input), eq(files.id, input)))
          .limit(1),
      ),
    );

    if (file.transferStatus === "in progress") {
      return err((s, t) => ({
        status: s.Conflict,
        type: t.ConflictDataTranscending,
        message: "File is currently being transferred",
      }));
    }

    if (file.transferStatus === "queued") {
      file = await _(
        databaseInteraction(
          tx
            .update(files)
            .set({
              targetStorage: file.storedIn,
              transferStatus: "idle",
            })
            .where(eq(files.id, input))
            .returning(),
        ),
      );
    }

    switch (file.storedIn) {
      case "utfs":
        if (!file.ufsKey) {
          return err((s, t) => ({
            status: s.Incomplete,
            type: t.IncompleteProviderIdentification,
            message: "No UFS Key Provided",
          }));
        }

        const deletionResponse = await utapi.deleteFiles(file.ufsKey);
        if (!deletionResponse.success || deletionResponse.deletedCount !== 1) {
          return err().Failed().message("Failed to delete file").transaction();
        }

        break;
      case "blob":
        if (!file.blobPath) {
          return err((s, t) => ({
            status: s.Incomplete,
            type: t.IncompleteProviderIdentification,
            message: "No Blob Path Provided",
          }));
        }

        const { error: blobDeleteError } = await tc(del(file.blobPath));
        if (blobDeleteError) {
          console.error(blobDeleteError);
          return err().Failed().message("Failed to delete file").transaction();
        }

        break;
    }

    await _(
      removeInternalQuestionFile({
        questionId: file.questionId,
        answerId: file.answerId,
      }),
    );

    await _(
      databaseInteraction(
        tx.delete(files).where(eq(files.id, input)).returning(),
      ),
    );

    return;
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
      return databaseTransaction<CreateFileReturnTypes>(
        async function* (_, tx) {
          await _(validateEditability(input.questionId));

          const question = await _(
            databaseInteraction(
              tx
                .select()
                .from(questions)
                .where(eq(questions.id, input.questionId))
                .limit(1),
              true,
            ),
          );

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

            wahlId: question.wahlId,
            questionId: input.questionId,
            answerId: input.answerId,
            owner: input.owner,

            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const response = await _(
            databaseInteraction(tx.insert(files).values(file).returning()),
          );

          const questionMutation = await _(
            setInternalQuestionFile({
              type: question.type,
              questionId: input.questionId,
              answerId: input.answerId,
              fileId: response.id,
            }),
          );

          return ok((s, t) => ({
            status: s.Success,
            type: t.Success,
            message: "File created successfully",

            data: {
              file: response,
              question: questionMutation,
            },
          }));
        },
      );
    }),

  get: publicProcedure
    .input(uuidType)
    .query(async ({ input }): apiType<GetFileReturnTypes> => {
      return databaseInteraction((db) =>
        db.select().from(files).where(eq(files.id, input)).limit(1),
      );
    }),

  deleteById: protectedProcedure.input(uuidType).mutation(async ({ input }) => {
    return deleteById(input);
  }),

  transfers: createTRPCRouter({
    run: secureCronProcedure.mutation(async (): apiType<void> => {
      // SERVER
      // First set all the files wo are idle and storedIn !== targetStorage to queued
      // This will probably only be called if i manually move around files between storage services

      return databaseTransaction<void>(async function* (_, tx) {
        await _(databaseInteraction(
          tx
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
        ));
  
        await _(databaseInteraction(
          tx
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
        ));
  
        const transfer = await _(databaseInteraction(
          tx.select().from(files).where(eq(files.transferStatus, "queued")),
          false,
        ));
  
        for (const file of transfer) {
          await databaseTransaction(async function* (_, tx) {
            await _(databaseInteraction(
              tx
                .update(files)
                .set({
                  transferStatus: "in progress",
    
                  updatedAt: new Date(),
                })
                .where(eq(files.id, file.id))
                .returning(),
            ));

            const { data: blob, error: FetchError } = await tc( // --- ---
              fetch(file.url).then((res) => res.blob()),
            );

            if (FetchError) {
              console.error(FetchError);
              return err().Failed().Download().message("Failed to fetch file").transaction();
            }
    
            if (blob.size !== file.size) {
              return err((s,t) => ({
                status: s.BadRequest,
                type: t.BadRequestCorrupted,
                message: "Blob is Corrupted (Or Cloudflare making issues again)",
              })).transaction();
            }
    
            switch (file.targetStorage) {
              case "utfs":
                const { data: up_utfs_response, error: up_utfs_error } = await tc(
                  utapi.uploadFilesFromUrl(file.url),
                );
                if (up_utfs_error || !up_utfs_response || !up_utfs_response.data) {
                  return err((s,t) => ({
                    status: s.Failed,
                    type: t.FailedUpload,
                    message: "Failed to upload file",
                    error: up_utfs_error ?? "Incomplete Response",
                  })).transaction();
                }
    
                await _(databaseInteraction(
                  tx
                    .update(files)
                    .set({
                      ufsKey: up_utfs_response.data.key,
                      url: up_utfs_response.data.ufsUrl,
    
                      updatedAt: new Date(),
                    })
                    .where(eq(files.id, file.id))
                    .returning(),
                  true,
                ));
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
                if (up_blob_error || !up_blob_response) {
                  return err((s,t) => ({
                    status: s.Failed,
                    type: t.FailedUpload,
                    message: "Failed to upload file",
                    error: up_blob_error ?? "Incomplete Response",
                  })).transaction();
                }
                
                await _(databaseInteraction(
                  tx
                    .update(files)
                    .set({
                      blobPath: up_blob_response.pathname,
                      url: up_blob_response.url,
    
                      updatedAt: new Date(),
                    })
                    .where(eq(files.id, file.id))
                    .returning(),
                  true,
                ));
                break;
            }
    
            switch (file.storedIn) {
              case "utfs":
                if (!file.ufsKey) {
                  return err().Incomplete().ProviderIdentification().message("No UFS Key Provided").transaction();
                }
    
                const { data: del_utfs_response, error: del_utfs_error } = await tc(
                  utapi.deleteFiles(file.ufsKey),
                );
                if (del_utfs_error || !del_utfs_response.success || del_utfs_response.deletedCount !== 1) {
                  return err((s,t) => ({
                    status: s.Failed,
                    type: t.Failed,
                    message: "Failed to delete file",
                    error: del_utfs_error ?? "Incomplete Response",
                  })).transaction();
                }
    
                await _(databaseInteraction(
                  tx
                    .update(files)
                    .set({
                      ufsKey: null,
    
                      updatedAt: new Date(),
                    })
                    .where(eq(files.id, file.id)),
                ));
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
          });
        }
        return ok({
          status: apiResponseStatus.Inconsequential,
        });
      }),
      })
  }),
});
