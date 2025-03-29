import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

import { protectedProcedure } from "~/server/api/trpc";
import { throwIfActive, throwIfActiveErrorTypes } from "./delete";
import { tc } from "~/lib/tryCatch";
import { db } from "~/server/db";
import {
  questionInfo,
  questionMultipleChoice,
  questions,
  questionTrueFalse,
} from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import { deleteById } from "../files";
import { deleteRootQuestion } from "./delete";

const uuidArrayType = z.array(z.string().uuid());

export enum deleteQuestionErrorTypes { // No inputtypeerror because auto validation
  NotFound = "NotFound",
  DeleteFailed = "DeleteFailed",
  Forbidden = "Forbidden",
}

type deleteQuestionError = {
  type: deleteQuestionErrorTypes;
  message: string;
};

export const deleteChunkProcedure = protectedProcedure
  .input(uuidArrayType)
  .mutation(async ({ input }): Promise<Result<void, deleteQuestionError>[]> => {
    const results: Result<void, deleteQuestionError>[] = [];
    for (const id of input) {
      const tIA = await throwIfActive(id);
      if (tIA.isErr()) {
        if (tIA.error.type === throwIfActiveErrorTypes.Active) {
          results.push(
            err({
              type: deleteQuestionErrorTypes.Forbidden,
              message: "You cannot delete an active election!!!",
            }),
          );
          continue;
        }
        results.push(
          err({
            type: deleteQuestionErrorTypes.NotFound,
            message: tIA.error.message,
          }),
        );
        continue;
      }

      const { data: questionArray, error: questionError } = await tc(
        db
          .select()
          .from(questions)
          .where(or(eq(questions.id, id), eq(questions.questionId, id))),
      );
      if (questionError) {
        results.push(
          err({
            type: deleteQuestionErrorTypes.NotFound,
            message: "Question not found",
          }),
        );
        continue;
      }

      const question = questionArray ? questionArray[0] : null;
      if (!question) {
        results.push(
          err({
            type: deleteQuestionErrorTypes.NotFound,
            message: "Question not found",
          }),
        );
        continue;
      }

      switch (question.type) {
        case "info":
          const { data: infoRequestArray, error: infoRequestError } = await tc(
            db
              .select()
              .from(questionInfo)
              .where(eq(questionInfo.id, question.questionId!)),
          );
          if (infoRequestError) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.NotFound,
                message: "Info question not found",
              }),
            );
            continue;
          }

          const infoRequest = infoRequestArray ? infoRequestArray[0] : null;
          if (!infoRequest) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.NotFound,
                message: "Info question not found",
              }),
            );
            continue;
          }

          if (infoRequest.image) {
            const dBId = await deleteById(infoRequest.image);
            if (dBId.isErr()) {
              results.push(
                err({
                  type: deleteQuestionErrorTypes.DeleteFailed,
                  message: "Failed to delete question image",
                }),
              );
              continue;
            }
          }

          const { error: infoError } = await tc(
            db
              .delete(questionInfo)
              .where(eq(questionInfo.id, question.questionId!)),
          );
          if (infoError) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.DeleteFailed,
                message: "Failed to delete info question",
              }),
            );
            continue;
          }
          break;
        case "true_false":
          const { data: trueFalseRequestArray, error: trueFalseRequestError } =
            await tc(
              db
                .select()
                .from(questionTrueFalse)
                .where(eq(questionTrueFalse.id, question.questionId!)),
            );
          if (trueFalseRequestError) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.NotFound,
                message: "True/False question not found",
              }),
            );
            continue;
          }

          const trueFalseRequest = trueFalseRequestArray
            ? trueFalseRequestArray[0]
            : null;
          if (!trueFalseRequest) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.NotFound,
                message: "True/False question not found",
              }),
            );
            continue;
          }

          const imgDeleteArray = [
            trueFalseRequest.o1Image,
            trueFalseRequest.o2Image,
          ];

          for (const image of imgDeleteArray) {
            if (image) {
              const dBId = await deleteById(image);
              if (dBId.isErr()) {
                results.push(
                  err({
                    type: deleteQuestionErrorTypes.DeleteFailed,
                    message: "Failed to delete question image",
                  }),
                );
                continue;
              }
            }
          }

          const { error: trueFalseError } = await tc(
            db
              .delete(questionTrueFalse)
              .where(eq(questionTrueFalse.id, question.questionId!)),
          );
          if (trueFalseError) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.DeleteFailed,
                message: "Failed to delete true/false question",
              }),
            );
            continue;
          }

          break;
        case "multiple_choice":
          const {
            data: multipleChoiceRequestArray,
            error: multipleChoiceRequestError,
          } = await tc(
            db
              .select()
              .from(questionMultipleChoice)
              .where(eq(questionMultipleChoice.id, question.questionId!)),
          );
          if (multipleChoiceRequestError) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.NotFound,
                message: "Multiple choice question not found",
              }),
            );
            continue;
          }

          const multipleChoiceRequest = multipleChoiceRequestArray
            ? multipleChoiceRequestArray[0]
            : null;
          if (!multipleChoiceRequest?.content) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.NotFound,
                message: "Multiple choice question not found",
              }),
            );
            continue;
          }

          const requestedImageDeletion = multipleChoiceRequest.content.map(
            (item) => item.image,
          );
          for (const image of requestedImageDeletion) {
            if (image) {
              const dBId = await deleteById(image);
              if (dBId.isErr()) {
                results.push(
                  err({
                    type: deleteQuestionErrorTypes.DeleteFailed,
                    message: "Failed to delete question image",
                  }),
                );
                continue;
              }
            }
          }
          const { error: multipleChoiceError } = await tc(
            db
              .delete(questionMultipleChoice)
              .where(eq(questionMultipleChoice.id, question.questionId!)),
          );
          if (multipleChoiceError) {
            results.push(
              err({
                type: deleteQuestionErrorTypes.DeleteFailed,
                message: "Failed to delete multiple choice question",
              }),
            );
            continue;
          }
          break;
      }
      const dRQ = await deleteRootQuestion(question.questionId!);
      if (dRQ.isErr()) {
        results.push(
          err({
            type: deleteQuestionErrorTypes.NotFound,
            message: "Root question not found",
          }),
        );
        continue;
      }

      results.push(ok());
    }
    return results;
  });
