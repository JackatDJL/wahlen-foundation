import { createTRPCRouter } from "~/server/api/trpc";
import { creationRouter } from "./create";
import { editRouter } from "./edit";
import { deletionRouter } from "./delete";

export const questionRouter = createTRPCRouter({
  create: creationRouter,
  edit: editRouter,
  delete: deletionRouter,
});
