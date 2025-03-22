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

/**
 * (Internal) Point an Answer or Question to a file
 * @param type Is type of questiontypes
 * @param questionId
 * @param answerId
 * @param fileId
 * @returns the DB Response
 */
async function setInternalQuestionFile(
  type: "info" | "true_false" | "multiple_choice",
  questionId: string,
  answerId: string,
  fileId: string | null,
) {
  switch (type) {
    case "info":
      const iIRes = (
        await db
          .update(questionInfo)
          .set({
            image: fileId,
          })
          .where(eq(questionInfo.questionId, questionId))
          .returning()
      )[0];
      if (!iIRes) {
        throw new Error("Question not found");
      }
      return iIRes;
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
          const tFo1Res = (
            await db
              .update(questionTrueFalse)
              .set({
                o1Image: fileId ?? null,
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o1Id))
              .returning()
          )[0];
          if (!tFo1Res) {
            throw new Error("Answer not found");
          }
          return tFo1Res;
        case tFQuestions.o2Id:
          const tFo2Res = (
            await db
              .update(questionTrueFalse)
              .set({
                o2Image: fileId ?? null,
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o2Id))
              .returning()
          )[0];

          if (!tFo2Res) {
            throw new Error("Answer not found");
          }
          return tFo2Res;
        default:
          throw new Error("Answer not found");
      }
    case "multiple_choice":
      const mCQuestions = (
        await db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.questionId, questionId))
      )[0];
      if (!mCQuestions) {
        throw new Error("Question not found");
      }
      const answerIds = mCQuestions.content?.map((a) => a.id);
      if (!answerIds?.includes(answerId)) {
        throw new Error("Answer not found");
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
      if (!editedContent) {
        throw new Error("Answer not found");
      }
      const mcRes = (
        await db
          .update(questionMultipleChoice)
          .set({
            content: editedContent,
          })
          .where(eq(questionMultipleChoice.id, mCQuestions.id))
          .returning()
      )[0];
      if (!mcRes) {
        throw new Error("Question not found");
      }
      return mcRes;
    default:
      throw new Error("Invalid question type");
  }
}

/**
 * (Internal) Remove a pointer from Answer or Question to a file
 * @param type Is type of questiontypes
 * @param questionId
 * @param answerId
 * @returns the DB Response
 */
async function removeInternalQuestionFile(
  questionId: string,
  answerId: string,
) {
  const dbresponse = (
    await db.select().from(questions).where(eq(questions.id, questionId))
  )[0];
  if (!dbresponse) {
    throw new Error("Question not found");
  }
  const type = dbresponse.type;
  switch (type) {
    case "info":
      const iIRes = (
        await db
          .update(questionInfo)
          .set({
            image: null,
          })
          .where(eq(questionInfo.questionId, questionId))
          .returning()
      )[0];
      if (!iIRes) {
        throw new Error("Question not found");
      }
      return iIRes;
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
          const tFo1Res = (
            await db
              .update(questionTrueFalse)
              .set({
                o1Image: null,
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o1Id))
              .returning()
          )[0];
          if (!tFo1Res) {
            throw new Error("Answer not found");
          }
          return tFo1Res;
        case tFQuestions.o2Id:
          const tFo2Res = (
            await db
              .update(questionTrueFalse)
              .set({
                o2Image: null,
              })
              .where(eq(questionTrueFalse.id, tFQuestions.o2Id))
              .returning()
          )[0];

          if (!tFo2Res) {
            throw new Error("Answer not found");
          }
          return tFo2Res;
        default:
          throw new Error("Answer not found");
      }
    case "multiple_choice":
      const mCQuestions = (
        await db
          .select()
          .from(questionMultipleChoice)
          .where(eq(questionMultipleChoice.questionId, questionId))
      )[0];
      if (!mCQuestions) {
        throw new Error("Question not found");
      }
      const answerIds = mCQuestions.content?.map((a) => a.id);
      if (!answerIds?.includes(answerId)) {
        throw new Error("Answer not found");
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
      if (!editedContent) {
        throw new Error("Answer not found");
      }
      const mcRes = (
        await db
          .update(questionMultipleChoice)
          .set({
            content: editedContent,
          })
          .where(eq(questionMultipleChoice.id, mCQuestions.id))
          .returning()
      )[0];
      if (!mcRes) {
        throw new Error("Question not found");
      }
      return mcRes;
    default:
      throw new Error("Invalid question type");
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const uuidType = z.string().uuid();
export async function deleteById(input: z.infer<typeof uuidType>) {
  uuidType.parse(input);
  // Check if the file exists
  let file = (
    await db
      .select()
      .from(files)
      .where(or(eq(files.answerId, input), eq(files.id, input)))
      .limit(1)
  )[0];

  if (!file || file.transferStatus === "in progress") {
    throw new Error("File not found or currently Trancending Servers");
  }
  // Immediatly remove the file from the queue so that the file doesnt get lost trancending servers
  if (file.transferStatus === "queued") {
    file = (
      await db
        .update(files)
        .set({
          targetStorage: file.storedIn,
          transferStatus: "idle",
        })
        .where(eq(files.id, input))
        .returning()
    )[0];
    if (!file) {
      throw new Error("File not found");
    }
  }
  // Get the presentationId and the filetype

  // Delete the file from the corresponding service
  switch (file.storedIn) {
    case "utfs":
      if (!file.ufsKey) {
        throw new Error("No Key Provided");
      }
      const deletionResponse = await utapi.deleteFiles(file.ufsKey);
      if (!deletionResponse.success || deletionResponse.deletedCount !== 1) {
        throw new Error("Failed to delete file");
      }
      break;
    case "blob":
      if (!file.blobPath) {
        throw new Error("No Path Provided");
      }
      await del(file.blobPath);
      break;
  }

  // Update the presentation to remove the file

  await removeInternalQuestionFile(file.questionId, file.answerId);

  // Delete the file from the db
  const dbFileResponse = await db
    .delete(files)
    .where(eq(files.id, input))
    .returning();
  if (dbFileResponse.length !== 1) {
    throw new Error("Failed to delete file");
  }

  return;
}

export const fileRouter = createTRPCRouter({
  create: publicProcedure // only called by server!
    .input(
      z.object({
        name: z.string(),
        fileType: z.enum(["logo", "banner", "candidate"]),
        dataType: z.string(),
        size: z.number().int(),
        ufsKey: z.string().length(48),
        url: z.string().url(),

        questionId: z.string().uuid(),
        answerId: z.string().uuid(),
        owner: z.string().length(32),
      }),
    )
    .query(async ({ input }) => {
      const wahl = (
        await db
          .select()
          .from(questions)
          .where(eq(questions.id, input.questionId))
      )[0];
      if (!wahl) {
        throw new Error("Question not found");
      }
      const question = (
        await db
          .select()
          .from(questions)
          .where(eq(questions.id, input.questionId))
      )[0];
      if (!question?.questionId) {
        throw new Error("Question not found");
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
      // console.log("Inserting Data into Database", file);

      const response = (await db.insert(files).values(file).returning())[0];
      if (!response) {
        throw new Error("Failed to insert file");
      }

      // console.log("Inserted Data into Database", response);

      // console.log("Configuring Question to point to File");

      const questionMutation = await setInternalQuestionFile(
        question.type,
        question.questionId,
        input.answerId,
        response.id,
      );

      // console.log("Updated Presentation", presentation);

      return {
        file: response,
        question: questionMutation,
      };
    }),
  get: publicProcedure.input(z.string().uuid()).query(async ({ input }) => {
    const file = await db
      .select()
      .from(files)
      .where(or(eq(files.answerId, input), eq(files.id, input)))
      .limit(1);
    if (!file[0]) {
      throw new Error("File not found");
    }
    return file[0];
  }),

  deleteById: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return await deleteById(input);
    }),

  transfers: createTRPCRouter({
    run: publicProcedure.mutation(async () => {
      // SERVER
      // First set all the files wo are idle and storedIn !== targetStorage to queued
      // This will probably only be called if i manually move around files between storage services

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await db
        .update(files)
        .set({
          transferStatus: "queued",
        })
        .where(
          and(
            eq(files.transferStatus, "idle"),
            not(eq(files.storedIn, files.targetStorage)),
          ),
        );

      await db
        .update(files)
        .set({
          transferStatus: "idle",
        })
        .where(
          and(
            not(eq(files.transferStatus, "idle")),
            eq(files.storedIn, files.targetStorage),
          ),
        );

      // Then get all to be transferred files
      const filesToTransfer = await db
        .select()
        .from(files)
        .where(eq(files.transferStatus, "queued"));

      // For each file, transfer it
      for (const file of filesToTransfer) {
        // Set Status
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        await db
          .update(files)
          .set({ transferStatus: "in progress" })
          .where(eq(files.id, file.id));

        const blob = await fetch(file.url).then((res) => res.blob());

        if (blob.size !== file.size) {
          console.warn(
            "Blob is Corrupted (Or Cloudflare making issues again), Aborting transfer",
          );
          await db
            .update(files)
            .set({
              transferStatus: "idle",
            })
            .where(eq(files.id, file.id));
          continue;
        }

        let up_success = false;
        // Transfer
        switch (file.targetStorage) {
          case "utfs":
            try {
              const up_utfs_response = await utapi.uploadFilesFromUrl(file.url);

              await db
                .update(files)
                .set({
                  ufsKey: up_utfs_response.data?.key,
                  url: up_utfs_response.data?.ufsUrl,
                })
                .where(eq(files.id, file.id));
            } catch (error) {
              console.error(error);
            } finally {
              up_success = true;
            }
            break;
          case "blob":
            try {
              const up_blob_response = await put(
                `wahlen/${process.env.NODE_ENV}/${file.owner}/${file.name}`,
                blob,
                {
                  access: "public",
                },
              );
              await db
                .update(files)
                .set({
                  blobPath: up_blob_response.pathname,
                  url: up_blob_response.url,
                })
                .where(eq(files.id, file.id));
            } catch (error) {
              console.error(error);
            } finally {
              up_success = true;
            }
            break;
        }

        if (!up_success) {
          throw new Error("Failed to transfer file");
        }

        // Delete old file
        let del_success = false;
        switch (file.storedIn) {
          case "utfs":
            try {
              if (!file.ufsKey) {
                throw new Error("No Key Provided");
              }
              const del_utfs_response = await utapi.deleteFiles(file.ufsKey);
              if (
                !del_utfs_response.success ||
                del_utfs_response.deletedCount !== 1
              ) {
                throw new Error("Failed to delete file");
              }

              await db
                .update(files)
                .set({
                  ufsKey: null,
                })
                .where(eq(files.id, file.id));
            } catch (error) {
              console.error(error);
            } finally {
              del_success = true;
            }
            break;
          case "blob":
            try {
              if (!file.blobPath) {
                throw new Error("No Path Provided");
              }
              await del(file.blobPath);

              await db
                .update(files)
                .set({
                  blobPath: null,
                })
                .where(eq(files.id, file.id));
            } catch (error) {
              console.error(error);
            } finally {
              del_success = true;
            }
            break;
        }

        if (!del_success) {
          throw new Error("Failed to delete file");
        }

        // Set Status and storage
        await db
          .update(files)
          .set({
            storedIn: file.targetStorage,
            transferStatus: "idle",
          })
          .where(eq(files.id, file.id));
      }
    }),
  }),
});
