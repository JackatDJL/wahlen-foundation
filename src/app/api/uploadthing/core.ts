/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/only-throw-error */
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { api } from "~/trpc/server";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { z } from "zod";

type InputData = inferRouterInputs<AppRouter>["files"]["create"];

const f = createUploadthing();

import { auth } from "@clerk/nextjs/server";

async function createFile({ input }: { input: InputData }) {
  // console.log("Request to Server", input);

  let response;
  try {
    response = await api.files.create(input);
  } catch (error) {
    console.error("Error creating file:", error);
    throw error;
  }
  console.log(
    "Server asigned UUID ",
    response?.file?.id,
    " to ",
    response.file.ufsKey,
  );

  return response;
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
      const Auth = auth();
      // console.log("Auth: ", Auth);
      if (!(await Auth).userId) throw new UploadThingError("Unauthorized");

      return {
        userId: (await Auth).userId,
        questionId: input.questionId,
        answerId: input.answerId,
        fileType: input.fileType,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // console.log("Uploaded ", file.name, " for ", metadata.owner);
      // console.log(metadata.presentationId, ".presentation = ", file.key);

      const request: InputData = {
        name: file.name,
        fileType: metadata.fileType,
        dataType: file.type,
        size: file.size,

        ufsKey: file.key,
        url: file.ufsUrl,

        questionId: metadata.questionId,
        answerId: metadata.answerId,

        owner: metadata.userId!,
      };

      const response = await createFile({ input: request });

      return { id: response?.file?.id, success: true };
    }),
} satisfies FileRouter;

export type UploadthingRouter = typeof UploadthingRouter;
