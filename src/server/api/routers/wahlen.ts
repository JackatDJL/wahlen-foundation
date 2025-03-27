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

enum createWahlErrorTypes {
  Failed = "Failed",
  Disallowed = "Disallowed",
}

type createWahlError = {
  type: createWahlErrorTypes;
  message: string;
};

export const wahlenRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createWahlType)
    .mutation(
      async ({
        input,
      }): Promise<Result<typeof wahlen.$inferSelect, createWahlError>> => {
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
            type: createWahlErrorTypes.Failed,
            message: insertableError.message,
          });
        }

        const response = insertableResponse[0] ? insertableResponse[0] : null;
        if (!response) {
          throw new Error("Failed to create wahl");
        }

        return response[0];
      },
    ),
  edit: protectedProcedure
    .input(
      z.object({
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
      }),
    )
    .mutation(async ({ input }) => {
      const data = await db
        .select()
        .from(wahlen)
        .where(eq(wahlen.id, input.id));

      if (!data[0]) {
        throw new Error("Wahl not found");
      }

      const insertable: typeof wahlen.$inferInsert = {
        id: input.id,
        shortname: input.shortname ?? data[0].shortname,
        status: input.status ?? data[0].status,

        alert: input.alert ?? data[0].alert,
        alertMessage: input.alertMessage ?? data[0].alertMessage,

        title: input.title ?? data[0].title,
        description: input.description ?? data[0].description,

        owner: input.owner ?? data[0].owner,

        startDate: input.startDate ?? data[0].startDate,
        endDate: input.endDate ?? data[0].endDate,
        archiveDate: input.archiveDate ?? data[0].archiveDate,

        createdAt: data[0].createdAt,
        updatedAt: input.updatedAt ?? data[0].updatedAt,
      };

      const response = await db
        .update(wahlen)
        .set(insertable)
        .where(eq(wahlen.id, input.id))
        .returning();
      if (!response[0]) {
        throw new Error("Failed to update wahl");
      }

      return response[0];
    }),
  getByShortname: publicProcedure.query(() => ""),
});
