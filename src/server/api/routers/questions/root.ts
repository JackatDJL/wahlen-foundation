import { createTRPCRouter } from "~/server/api/trpc";
import { creationRouter } from "./create";
import { editRouter } from "./edit";

export const questionRouter = createTRPCRouter({
  create: creationRouter,
  edit: editRouter,
});
