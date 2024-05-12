import {
  router,
  protectedProcedure,
  trpcError,
  publicProcedure,
} from "../../trpc/core";
import { z } from "zod";
import { schema, db } from "../../db/client";
import { eq } from "drizzle-orm";
import { plans, subscriptionActivations, subscriptions } from "../../db/schema";
import { billingCycle } from "../../constants";

export const billing = router({
  orderSubscription: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        planId: z.number(),
      })
    )
    .input(z.object({ teamId: z.number(), planId: z.number() }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { teamId, planId } = input;
      const { userId } = user;
      try {
        const status = {
          success: false,
        };
        await db.transaction(async (tx): Promise<{ success: boolean }> => {
          const newSubscription = await tx
            .insert(schema.subscriptions)
            .values({
              userId,
              teamId,
              planId,
            })
            .returning({ id: schema.subscriptions.id });
          if (newSubscription && newSubscription[0]) {
            await tx
              .insert(schema.orders)
              .values({
                subscriptionId: newSubscription[0].id,
                statusId: 1,
                createdAt: new Date(),
              })
              .returning();
            status.success = true;
            return status;
          } else {
            tx.rollback();
            status.success = false;
            return status;
          }
        });
        return status;
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
  confirmOrderPayment: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        billingCycle: z.enum([billingCycle.MONTHLY, billingCycle.YEARLY]),
      })
    )
    .mutation(async ({ input }) => {
      const { subscriptionId, billingCycle } = input;
      try {
        const status = {
          success: false,
        };
        await db.transaction(async (tx): Promise<{ success: boolean }> => {
          // update order state to Completed
          await tx
            .update(schema.orders)
            .set({ statusId: 2 })
            .where(eq(schema.orders.subscriptionId, subscriptionId))
            .returning();
          // create Activation record for subscription
          await tx
            .insert(schema.subscriptionActivations)
            .values({
              subscriptionId,
              activatedAt: new Date("2024-05-01"), // To Change to new Date,
              billingCycle,
            })
            .returning();
          status.success = true;
          return {
            success: true,
          };
        });
        return status;
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
  upgradePlanRequest: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        planId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { subscriptionId, planId } = input;
      let proratedPrice: number = 0;
      try {
        await db.transaction(async (tx) => {
          // Create order for the upgrade request
          await tx
            .insert(schema.orders)
            .values({
              subscriptionId,
              statusId: 1,
              createdAt: new Date(),
            })
            .returning();
          // Calculate prorate upgrade price:
          const currentPlan = await tx
            .select()
            .from(subscriptions)
            .innerJoin(plans, eq(subscriptions.planId, plans.id))
            .innerJoin(
              subscriptionActivations,
              eq(subscriptions.id, subscriptionActivations.subscriptionId)
            );
          const targetedPlanPrice = await tx.query.plans.findFirst({
            where: eq(schema.plans.id, planId),
          });

          if (currentPlan && currentPlan[0] && targetedPlanPrice) {
            const priceDifference: number =
              targetedPlanPrice?.price - currentPlan[0].plans.price;
            const ActivationDate = new Date(
              currentPlan[0].subscriptionActivations.activatedAt.valueOf()
            );
            const remainingDays =
              30 -
              Math.floor(
                (new Date().valueOf() - ActivationDate.valueOf()) /
                  (1000 * 60 * 60 * 24)
              );
            proratedPrice = (priceDifference / 30) * remainingDays;
          }
        });
        return proratedPrice;
      } catch (error) {
        console.error(error);
      }
    }),
  confirmUpgradePayment: protectedProcedure
    .input(
      z.object({
        planId: z.number(),
        subscriptionId: z.number(),
        billingCycle: z.enum([billingCycle.MONTHLY, billingCycle.YEARLY]),
      })
    )
    .mutation(async ({ input }): Promise<{ success: boolean }> => {
      const { subscriptionId, planId, billingCycle } = input;
      try {
        const status = {
          success: false,
        };
        await db.transaction(async (tx) => {
          // Update the subscription in table with new plan
          await tx
            .update(schema.subscriptions)
            .set({ planId })
            .where(eq(schema.subscriptions.id, subscriptionId))
            .returning();
          // Create a new Activation for the subscription
          await tx
            .insert(schema.subscriptionActivations)
            .values({
              subscriptionId,
              activatedAt: new Date(),
              billingCycle,
            })
            .returning();
        });
        status.success = true;
        return {
          success: true,
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
  addOrderStatus: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { name } = input;
      const { userId } = user;
      const authUser = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
      if (!authUser?.isAdmin) {
        throw new trpcError({
          code: "FORBIDDEN",
        });
      }
      try {
        await db
          .insert(schema.orderStatus)
          .values({
            name,
          })
          .returning();
        return {
          success: true,
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
  getPlans: publicProcedure.query(async () => {
    try {
      const plans = await db.query.plans.findMany();
      return plans;
    } catch (error) {
      console.error("Error fetching teams", error);
      return [];
    }
  }),
  addPlan: protectedProcedure
    .input(z.object({ name: z.string(), price: z.number() }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { name, price } = input;
      const { userId } = user;
      const authUser = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
      if (!authUser?.isAdmin) {
        throw new trpcError({
          code: "FORBIDDEN",
        });
      }
      try {
        await db
          .insert(schema.plans)
          .values({
            name,
            price,
          })
          .returning();
        return {
          success: true,
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
});
