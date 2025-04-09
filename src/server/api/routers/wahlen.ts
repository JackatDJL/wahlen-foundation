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
  apiResponseDetailedTypes,
  apiResponseTypes,
  apiType,
  blankPlaceholdingCallableProcedure,
  databaseInteractionTypes,
  handleDatabaseInteraction,
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
});

const scheduleWahlType = z.object({
  id: z.string().uuid(),
  startDate: z.date(),
  endDate: z.date(),
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

      const response = await handleDatabaseInteraction(
        db.insert(wahlen).values(insertable).returning(),
        true,
        databaseInteractionTypes.Sequencial,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,
        detailedType: apiResponseDetailedTypes.Success,

        data: response.value.data!,
      });
    }),
  edit: protectedProcedure
    .input(editWahlType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const response = await handleDatabaseInteraction(
        db
          .update(wahlen)
          .set({
            shortname: input.shortname,

            alert: input.alert,
            alertMessage: input.alertMessage,

            title: input.title,
            description: input.description,

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
        true,
        databaseInteractionTypes.Sequencial,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response.value.data!,
      });
    }),

  publish: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const response = await handleDatabaseInteraction(
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
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response.value.data!,
      });
    }),

  unPublish: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const response = await handleDatabaseInteraction(
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
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response.value.data!,
      });
    }),

  schedule: protectedProcedure
    .input(scheduleWahlType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const response = await handleDatabaseInteraction(
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
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response.value.data!,
      });
    }),

  unSchedule: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const response = await handleDatabaseInteraction(
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
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response.value.data!,
      });
    }),

  archive: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const response = await handleDatabaseInteraction(
        db
          .update(wahlen)
          .set({
            isArchived: true,
            archiveDate: new Date(),

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response.value.data!,
      });
    }),

  unArchive: protectedProcedure
    .input(identifyingInputType)
    .mutation(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
      const vE = await validateEditability(input.id);
      if (vE.isErr()) {
        return err(vE.error);
      }

      const response = await handleDatabaseInteraction(
        db
          .update(wahlen)
          .set({
            isArchived: false,
            archiveDate: null,

            updatedAt: new Date(),
          })
          .where(eq(wahlen.id, input.id))
          .returning(),
        true,
      );
      if (response.isErr()) {
        return err(response.error);
      }

      return ok({
        type: apiResponseTypes.Success,

        data: response.value.data!,
      });
    }),

  delete: protectedProcedure.query(() => "!"), // TODO: Implement delete

  get: createTRPCRouter({
    byId: publicProcedure
      .input(identifyingInputType)
      .query(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
        const response = await handleDatabaseInteraction(
          db.select().from(wahlen).where(eq(wahlen.id, input.id)),
          true,
        );
        if (response.isErr()) {
          return err(response.error);
        }

        return ok({
          type: apiResponseTypes.Success,

          data: response.value.data!,
        });
      }),

    byShortname: publicProcedure
      .input(getByShortnameType)
      .query(async ({ input }): apiType<typeof wahlen.$inferSelect> => {
        const response = await handleDatabaseInteraction(
          db.select().from(wahlen).where(eq(wahlen.shortname, input.shortname)),
          true,
        );
        if (response.isErr()) {
          return err(response.error);
        }

        return ok({
          type: apiResponseTypes.Success,

          data: response.value.data!,
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
