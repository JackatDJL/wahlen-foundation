import { z } from "zod";
import { db } from "~/server/db";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { wahlen } from "~/server/db/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { Result, err, ok } from "neverthrow";
import { tc } from "~/lib/tryCatch";

const createWahlType = z.object({
  shortname: z.string().min(3).max(25),

  title: z.string().min(3).max(256),
  description: z.string().optional(),

  owner: z.string().length(32),
});

enum wahlErrorTypes {
  Failed = "Failed",
  Disallowed = "Disallowed",
  NotFound = "NotFound",
}

type wahlError = {
  type: wahlErrorTypes;
  message: string;
};

const editWahlType = z.object({
        id: z.string().uuid(),
        shortname: z.string().min(3).max(25).optional(),
        status: z
          .enum([
            "draft",
            "queued",
            "active",
            "inactive",
            "completed",
            "results",
            "archived",
          ])
          .optional(),

        alert: z.enum(["card", "info", "warning", "error"]).optional(),
        alertMessage: z.string().optional(),

        title: z.string().min(3).max(256).optional(),
        description: z.string().optional(),

        owner: z.string().length(32).optional(),

        startDate: z.date().optional(),
        endDate: z.date().optional(),
        archiveDate: z.date().optional(),

        updatedAt: z.date().optional(),
      })

      

export const wahlenRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createWahlType)
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

        const response = insertableResponse[0] ? insertableResponse[0] : null;
        if (!response) {
          throw new Error("Failed to create wahl");
        }

        return ok(response);
      },
    ),
  edit: protectedProcedure
    .input(
      editWahlType
    )
    .mutation(async ({ input }): Promise<Result<typeof wahlen.$inferSelect, wahlError>> => {

      const {data: dataArray, error: dbError} = await tc(
        db.select().from(wahlen).where(eq(wahlen.id, input.id)));
      if (dbError) {
        return err({
          type: wahlErrorTypes.Failed,
          message: dbError.message,
        });
      }

        const data = dataArray[0] ? dataArray[0] : null;
        if (!data) {
          return err({
            type: wahlErrorTypes.Failed,
            message: "Wahl not found",
          });
        }

      const insertable: typeof wahlen.$inferInsert = {
        id: input.id,
        shortname: input.shortname ?? data.shortname,
        status: input.status ?? data.status,

        alert: input.alert ?? data.alert,
        alertMessage: input.alertMessage ?? data.alertMessage,

        title: input.title ?? data.title,
        description: input.description ?? data.description,

        owner: input.owner ?? data.owner,

        startDate: input.startDate ?? data.startDate,
        endDate: input.endDate ?? data.endDate,
        archiveDate: input.archiveDate ?? data.archiveDate,

        createdAt: data.createdAt,
        updatedAt: input.updatedAt ?? data.updatedAt,
      };

      // const response = await db
      //   .update(wahlen)
      //   .set(insertable)
      //   .where(eq(wahlen.id, input.id))
      //   .returning();
      // if (!response[0]) {
      //   throw new Error("Failed to update wahl");
      // }

      const { data: insertableResponse, error: insertableError } = await tc(
        db.update(wahlen).set(insertable).where(eq(wahlen.id, input.id)).returning(),
      );
      if (insertableError) {
        return err({
          type: wahlErrorTypes.Failed,
          message: insertableError.message,
        });
      }

      const response = insertableResponse[0] ? insertableResponse[0] : null;
      if (!response) {
        return err({
          type: wahlErrorTypes.Failed,
          message: "Failed to update wahl",
        });
      }

      return ok(response)
    }),
  getByShortname: publicProcedure.query(() => ""),
});
