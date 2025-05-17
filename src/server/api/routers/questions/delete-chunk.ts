import { err, ok } from "neverthrow";
import { z } from "zod";

import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema/questions";
import { eq, or } from "drizzle-orm";
import { deleteById } from "../files";
import { deleteRootQuestion } from "./delete";
import {
  apiErrorStatus,
  apiErrorTypes,
  apiResponseStatus,
  apiResponseTypes,
  type apiType,
  databaseInteraction,
  deconstructValue,
  orReport,
  uuidType,
  validateEditability,
} from "../utility";

const uuidArrayType = z.array(uuidType);

export const deleteChunkProcedure = protectedProcedure
  .input(uuidArrayType)
  .mutation(async ({ input }): apiType<Awaited<void>[]> => {
    const results: Awaited<apiType<void>>[] = [];

    for (const id of input) {
      const tIA = await validateEditability(id);
      if (tIA.isErr()) {
        results.push(err(tIA.error));
        continue;
      }

      const question = await databaseInteraction(
        db
          .select()
          .from(questions)
          .where(or(eq(questions.id, id), eq(questions.questionId, id))),
      );
      if (question.isErr()) {
        results.push(err(question.error));
        continue;
      }

      const data = deconstructValue(question).data();

      switch (data.type) {
        case "info": {
          const infoRequest = await databaseInteraction(
            db
              .select()
              .from(questionInfo)
              .where(eq(questionInfo.id, data.questionId)),
          );
          if (infoRequest.isErr()) {
            results.push(err(infoRequest.error));
            continue;
          }

          const infoData = deconstructValue(infoRequest).data();

          if (infoData.image) {
            const dBId = await deleteById(infoData.image);
            if (dBId.isErr()) {
              results.push(err(dBId.error));
              continue;
            }
          }

          const deleteInfo = await databaseInteraction(
            db
              .delete(questionInfo)
              .where(eq(questionInfo.id, data.questionId))
              .returning(),
          );
          if (deleteInfo.isErr()) {
            results.push(err(deleteInfo.error));
            continue;
          }
          break;
        }
        case "true_false": {
          const trueFalseRequest = await databaseInteraction(
            db
              .select()
              .from(questionTrueFalse)
              .where(eq(questionTrueFalse.id, data.questionId)),
          );
          if (trueFalseRequest.isErr()) {
            results.push(err(trueFalseRequest.error));
            continue;
          }

          const trueFalseData = deconstructValue(trueFalseRequest).data();

          const imgDeleteArray = [trueFalseData.o1Image, trueFalseData.o2Image];

          for (const image of imgDeleteArray) {
            if (image) {
              const dBId = await deleteById(image);
              if (dBId.isErr()) {
                results.push(err(dBId.error));
                continue;
              }
            }
          }

          const deleteTrueFalse = await databaseInteraction(
            db
              .delete(questionTrueFalse)
              .where(eq(questionTrueFalse.id, data.questionId))
              .returning(),
          );
          if (deleteTrueFalse.isErr()) {
            results.push(err(deleteTrueFalse.error));
            continue;
          }

          break;
        }
        case "multiple_choice": {
          const multipleChoiceRequest = await databaseInteraction(
            db
              .select()
              .from(questionMultipleChoice)
              .where(eq(questionMultipleChoice.id, data.questionId)),
          );
          if (multipleChoiceRequest.isErr()) {
            results.push(err(multipleChoiceRequest.error));
            continue;
          }

          const multipleChoiceData = deconstructValue(
            multipleChoiceRequest,
          ).data();

          const requestedImageDeletion = multipleChoiceData.content
            ? multipleChoiceData.content.map((item) => item.image)
            : [];
          for (const image of requestedImageDeletion) {
            if (image) {
              const dBId = await deleteById(image);
              if (dBId.isErr()) {
                results.push(err(dBId.error));
                continue;
              }
            }
          }

          const deleteMultipleChoice = await databaseInteraction(
            db
              .delete(questionMultipleChoice)
              .where(eq(questionMultipleChoice.id, data.questionId))
              .returning(),
          );
          if (deleteMultipleChoice.isErr()) {
            results.push(err(deleteMultipleChoice.error));
            continue;
          }
          break;
        }
      }
      const dRQ = await deleteRootQuestion(data.questionId);
      if (dRQ.isErr()) {
        results.push(err(dRQ.error));
        continue;
      }

      results.push(
        ok({
          status: apiResponseStatus.Success,
          type: apiResponseTypes.SuccessNoData,
          message: "Question deleted successfully",
        }),
      );
    }
    if (results.every((result) => result.isOk())) {
      return ok({
        status: apiResponseStatus.Success,
        type: apiResponseTypes.Success,
        message: "Questions deleted successfully",
        data: results.map((result) => result.value.data),
      });
    } else {
      const failedCount = results.filter((result) => result.isErr()).length;
      return err({
        status: apiErrorStatus.Failed,
        type: apiErrorTypes.Failed,
        message: `Failed to delete ${failedCount} questions`,
        error: results
          .filter((result) => result.isErr())
          .map((result) => result.error),
      }).mapErr(orReport);
    }
  });
