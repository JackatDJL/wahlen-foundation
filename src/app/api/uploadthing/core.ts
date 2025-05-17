/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/only-throw-error */
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { api } from "~/trpc/server";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { z } from "zod";

type InputData = inferRouterInputs<AppRouter>["files"]["create"];
type OutputData = inferRouterOutputs<AppRouter>["files"]["create"];

const f = createUploadthing();

import { auth } from "@clerk/nextjs/server";
import { err, ok, type Result } from "neverthrow";
import {
  apiResponseStatus,
  apiResponseTypes,
  apiType,
  deconstructValue,
  orReport,
} from "~/server/api/routers/utility";

/**
 * Creates a file record by sending the provided input to the API.
 *
 * This asynchronous function invokes the backend API with the given file creation data.
 * It returns a structured result that contains the file details on success or error information on failure.
 * In case of success, it logs the server-assigned UUID and file key.
 *
 * @param input - The file creation parameters.
 * @returns A promise that resolves to a Result containing either the newly created file details or error metadata.
 */
async function createFile({ input }: { input: InputData }) {
  // console.log("Request to Server", input);

  const response = await api.files.create(input);
  if (response.isErr()) return err(response.error);

  const data = deconstructValue(response).data();

  console.log("Server assigned UUID ", data.file.id, " to ", data.file.ufsKey);

  return ok({
    status: apiResponseStatus.Success,
    type: apiResponseTypes.Success,
    message: "File created successfully",
    data: data,
  });
}

// FileRouter for your app, can contain multiple FileRoutes
export const UploadthingRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .input(
      z.object({
        questionId: z.string().uuid(),
        answerId: z.string().uuid(),
        fileType: z.enum(["logo", "banner", "candidate"]),
      }),
    )
    .middleware(async ({ req, input }) => {
      const Auth = await auth();
      // console.log("Auth: ", Auth);
      if (!Auth.userId) throw new UploadThingError("Unauthorized"); // THIS IS ALLOWED!!!

      return {
        userId: Auth.userId,
        questionId: input.questionId,
        answerId: input.answerId,
        fileType: input.fileType,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const request: InputData = {
        name: file.name,
        fileType: metadata.fileType,
        dataType: file.type,
        size: file.size,

        ufsKey: file.key,
        url: file.ufsUrl,

        questionId: metadata.questionId,
        answerId: metadata.answerId,

        owner: metadata.userId,
      };

      const response = await createFile({ input: request });
      if (response.isErr()) {
        console.error("Error creating file: ", response.error.message);
        console.error("Error details: ", response.error);
        response.mapErr(orReport);
        throw new UploadThingError("Failed to create file");
      }
    }),
} satisfies FileRouter;

export type UploadthingRouter = typeof UploadthingRouter;
