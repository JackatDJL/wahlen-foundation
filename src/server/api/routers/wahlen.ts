import { z } from "zod";
import { db } from "~/server/db";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  secureCronProcedure,
} from "~/server/api/trpc";
import { wahlen } from "~/server/db/schema/wahlen";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { tc } from "~/lib/tryCatch";
import {
  apiDetailedErrorType,
  apiErrorTypes,
  apiResponseTypes,
  apiType,
  blankPlaceholdingCallableProcedure,
  identifyingInputType,
  validateEditability,
} from "./utility";

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

  alert: z.enum(["card", "info", "warning", "error"]).optional().nullable(),
  alertMessage: z.string().min(3).max(256).optional(),

  startDate: z.date().optional(),
  endDate: z.date().optional(),
  archiveDate: z.date().optional(),
});

const scheduleWahlType = z.object({
  id: z.string().uuid(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

const getByShortnameType = z.object({
  shortname: z.string().min(3).max(25),
});

const generateResultsType = z.string().uuid();

const getResultsType = z.string().uuid();

export const wahlenRouter = createTRPCRouter({
  draft: protectedProcedure
    .input(draftWahlType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
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
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType:
            apiDetailedErrorType.BadRequestSequentialOperationFailure,
          message: "Database successfully inserted but did not return data",
        });
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response,
      });
    }),
  edit: protectedProcedure
    .input(editWahlType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const { data: dataArray, error: dbError } = await tc(
        db.select().from(wahlen).where(eq(wahlen.id, input.id)),
      );
      if (dbError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database query failed",
        });
      }

      const data = dataArray[0] ?? null;
      if (!data) {
        return err({
          type: apiErrorTypes.NotFound,
          message: "Wahl not found",
        });
      }

      const { data: insertableResponse, error: insertableError } = await tc(
        db
          .update(wahlen)
          .set({
            shortname: input.shortname,

            alert: input.alert,
            alertMessage: input.alertMessage,

            title: input.title,
            description: input.description,

            startDate: input.startDate,
            endDate: input.endDate,
            archiveDate: input.archiveDate,

            createdAt: data.createdAt,
            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
      );
      if (insertableError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType:
            apiDetailedErrorType.BadRequestSequentialOperationFailure,
          message: "Database successfully inserted but did not return data",
        });
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response,
      });
    }),

  publish: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const { data: insertableResponse, error: insertableError } = await tc(
        db
          .update(wahlen)
          .set({
            isPublished: true,
            isCompleted: false,
            hasResults: false,
            isArchived: false,

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
      );
      if (insertableError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.NotFound,
          message: "Wahl not found",
        });
      }
      return ok({
        type: apiResponseTypes.Success,
        data: response,
      });
    }),

  unPublish: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }
      const { data: insertableResponse, error: insertableError } = await tc(
        db
          .update(wahlen)
          .set({
            isActive: false,
            isPublished: false,
            isCompleted: false,
            hasResults: false,
            isArchived: false,
            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
      );
      if (insertableError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.NotFound,
          message: "Wahl not found",
        });
      }
      return ok({
        type: apiResponseTypes.Success,
        data: response,
      });
    }),

  schedule: protectedProcedure
    .input(scheduleWahlType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const { data: insertableResponse, error: insertableError } = await tc(
        db
          .update(wahlen)
          .set({
            isScheduled: true,
            startDate: input.startDate,
            endDate: input.endDate,

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
      );
      if (insertableError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.NotFound,
          message: "Wahl not found",
        });
      }

      return ok({
        type: apiResponseTypes.Success,
        data: response,
      });
    }),

  unSchedule: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const { data: insertableResponse, error: insertableError } = await tc(
        db
          .update(wahlen)
          .set({
            isScheduled: false,
            startDate: null,
            endDate: null,

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
      );
      if (insertableError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.NotFound,
          message: "Wahl not found",
        });
      }

      return ok({
        type: apiResponseTypes.Success,
        data: response,
      });
    }),

  archive: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const { data: insertableResponse, error: insertableError } = await tc(
        db
          .update(wahlen)
          .set({
            isArchived: true,
            archiveDate: new Date(),

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
      );
      if (insertableError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.NotFound,
          message: "Wahl not found",
        });
      }

      return ok({
        type: apiResponseTypes.Success,
        data: response,
      });
    }),

  unArchive: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const { data: insertableResponse, error: insertableError } = await tc(
        db
          .update(wahlen)
          .set({
            isArchived: false,
            archiveDate: null,

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
      );
      if (insertableError) {
        return err({
          type: apiErrorTypes.BadRequest,
          detailedType: apiDetailedErrorType.BadRequestUnknown,
          message: "Database rejected insert operation",
        });
      }

      const response = insertableResponse[0] ?? null;
      if (!response) {
        return err({
          type: apiErrorTypes.NotFound,
          message: "Wahl not found",
        });
      }

      return ok({
        type: apiResponseTypes.Success,
        data: response,
      });
    }),

  delete: protectedProcedure.query(() => "!"), // TODO: Implement delete

  get: createTRPCRouter({
    byId: publicProcedure
      .input(identifyingInputType)
      .query(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
        const { data: resArray, error: dbError } = await tc(
          db.select().from(wahlen).where(eq(wahlen.id, input.id)),
        );
        if (dbError) {
          return err({
            type: apiErrorTypes.BadRequest,
            detailedType: apiDetailedErrorType.BadRequestUnknown,
            message: "Database query failed",
          });
        }

        const res = resArray[0] ?? null;
        if (!res) {
          return err({
            type: apiErrorTypes.NotFound,
            message: "Wahl not found",
          });
        }

        return ok({
          type: apiResponseTypes.Success,

          data: res,
        });
      }),

    byShortname: publicProcedure
      .input(getByShortnameType)
      .query(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
        const { data: resArray, error: dbError } = await tc(
          db.select().from(wahlen).where(eq(wahlen.shortname, input.shortname)),
        );
        if (dbError) {
          return err({
            type: apiErrorTypes.BadRequest,
            detailedType: apiDetailedErrorType.BadRequestUnknown,
            message: "Database query failed",
          });
        }

        const res = resArray[0] ?? null;
        if (!res) {
          return err({
            type: apiErrorTypes.NotFound,
            message: "Wahl not found",
          });
        }

        return ok({
          type: apiResponseTypes.Success,

          data: res,
        });
      }),

    previews: createTRPCRouter({
      all: blankPlaceholdingCallableProcedure, // TODO: This will return the titles and types of all questions for a given election
    }),
  }),

  generateResults: blankPlaceholdingCallableProcedure, // TODO: Man ill probably also need a results table

  getResults: blankPlaceholdingCallableProcedure, // Prolly will get them results

  cron: createTRPCRouter({
    run: secureCronProcedure.mutation(() => " "),
  }),
});
