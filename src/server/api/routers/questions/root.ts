import { createTRPCRouter } from "~/server/api/trpc";
import { creationRouter } from "./create";

export const questionRouter = createTRPCRouter({
  create: creationRouter,
});
