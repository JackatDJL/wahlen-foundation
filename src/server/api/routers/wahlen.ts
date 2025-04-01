import { z } from "zod";
import { db } from "~/server/db";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  secureCronProcedure,
} from "~/server/api/trpc";
import { wahlen } from "~/server/db/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { tc } from "~/lib/tryCatch";

enum wahlErrorTypes {
  Failed = "Failed",
  Disallowed = "Disallowed",
  NotFound = "NotFound",
}

type wahlError = {
  type: wahlErrorTypes;
  message: string;
};

const draftWahlType = z.object({
  shortname: z.string().min(3).max(25),

  title: z.string().min(3).max(256),
  description: z.string().optional(),

  owner: z.string().length(32),
});

const editWahlType = z.object({
  id: z.string().uuid(),
  shortname: z.string().min(3).max(25).optional(),

  title: z.string().min(3).max(256).optional(),
  description: z.string().optional(),
});

const alertType = z.object({
  type: z.enum(["info", "warning", "error"]),
  message: z.string().min(3).max(256).optional(),
});

const queueWahlType = z.object({
  id: z.string().uuid(),

  startDate: z.date(),
  endDate: z.date().optional(),
});

const reDraftWahlType = z.string().uuid();

const cronWahlType = null;

const completeWahlType = z.string().uuid();

const archiveWahlType = z.string().uuid();

const getByShortnameType = z.string().uuid();

const generateResultsType = z.string().uuid();

const getResultsType = z.string().uuid();

export const wahlenRouter = createTRPCRouter({
  draft: protectedProcedure
    .input(draftWahlType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {
        const insertable: typeof wahlen.$inferInsert = {
          id: randomUUID(),
          shortname: input.shortname,

          title: input.title,
          description: input.description,

          owner: input.owner,
        };
        const { data: insertableResponse, error: insertableError } = await tc(
          db.insert(wahlen).values(insertable).returning(),
        );
        if (insertableError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: insertableError.message,
          });
        }

        const response = insertableResponse[0] ?? null;
        if (!response) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Failed to create wahl",
          });
        }

        return ok(response);
      },
    ),
  edit: protectedProcedure
    .input(editWahlType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {
        const { data: dataArray, error: dbError } = await tc(
          db.select().from(wahlen).where(eq(wahlen.id, input.id)),
        );
        if (dbError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: dbError.message,
          });
        }

        const data = dataArray[0] ?? null;
        if (!data) {
          return err({
            type: wahlErrorTypes.NotFound,
            message: "Wahl not found",
          });
        }

        const insertable: typeof wahlen.$inferInsert = {
          id: input.id,
          shortname: input.shortname ?? data.shortname,
          status: data.status,

          alert: data.alert,
          alertMessage: data.alertMessage,

          title: input.title ?? data.title,
          description: input.description ?? data.description,

          owner: data.owner,

          startDate: data.startDate,
          endDate: data.endDate,
          archiveDate: data.archiveDate,

          createdAt: data.createdAt,
          updatedAt: new Date(),
        };

        const { data: insertableResponse, error: insertableError } = await tc(
          db
            .update(wahlen)
            .set(insertable)
            .where(eq(wahlen.id, input.id))
            .returning(),
        );
        if (insertableError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: insertableError.message,
          });
        }

        const response = insertableResponse[0] ?? null;
        if (!response) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Failed to update wahl",
          });
        }

        return ok(response);
      },
    ),
  queue: protectedProcedure
    .input(queueWahlType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {
        const { data: resArray, error: dbError } = await tc(
          db
            .update(wahlen)
            .set({
              status: "queued",

              startDate: input.startDate,
              endDate: input.endDate,

              updatedAt: new Date(),
            })
            .where(eq(wahlen.id, input.id))
            .returning(),
        );
        if (dbError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: dbError.message,
          });
        }
        const res = resArray[0] ?? null;
        if (!res) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Failed to queue wahl",
          });
        }
        return ok(res);
      },
    ),

  reDraft: protectedProcedure
    .input(reDraftWahlType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {
        const { data: resArray, error: dbError } = await tc(
          db
            .update(wahlen)
            .set({
              status: "draft",
              updatedAt: new Date(),
            })
            .where(eq(wahlen.id, input))
            .returning(),
        );
        if (dbError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: dbError.message,
          });
        }
        const res = resArray[0] ?? null;
        if (!res) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Failed to re-draft wahl",
          });
        }
        return ok(res);
      },
    ),

  cron: createTRPCRouter({
    run: secureCronProcedure.mutation(() => " "),
  }),

  complete: protectedProcedure
    .input(completeWahlType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {
        const { data: resArray, error: dbError } = await tc(
          db
            .update(wahlen)
            .set({
              status: "completed",
              updatedAt: new Date(),
            })
            .where(eq(wahlen.id, input))
            .returning(),
        );
        if (dbError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: dbError.message,
          });
        }
        const res = resArray[0] ?? null;
        if (!res) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Failed to complete wahl",
          });
        }
        return ok(res);
      },
    ),

  archive: protectedProcedure
    .input(archiveWahlType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {
        const { data: resArray, error: dbError } = await tc(
          db
            .update(wahlen)
            .set({
              status: "archived",
              updatedAt: new Date(),
              archiveDate: new Date(),
            })
            .where(eq(wahlen.id, input))
            .returning(),
        );
        if (dbError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: dbError.message,
          });
        }
        const res = resArray[0] ?? null;
        if (!res) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Failed to archive wahl",
          });
        }
        return ok(res);
      },
    ),

  getByShortname: publicProcedure
    .input(getByShortnameType)
    .query(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {
        const { data: resArray, error: dbError } = await tc(
          db.select().from(wahlen).where(eq(wahlen.shortname, input)),
        );
        if (dbError) {
          return err({
            type: wahlErrorTypes.Failed,
            message: dbError.message,
          });
        }
        const res = resArray[0] ?? null;
        if (!res) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Wahl not found",
          });
        }
        return ok(res);
      },
    ),

  generateResults: protectedProcedure
    .input(generateResultsType)
    .mutation(async ({ input }): Promise<Result<string, wahlError>> => {
      // Placeholder implementation
      return ok("Results generated successfully");
    }),

  getResults: publicProcedure
    .input(getResultsType)
    .query(async ({ input }): Promise<Result<string, wahlError>> => {
      // Placeholder implementation
      return ok("Results retrieved successfully");
    }),
});
