import { beforeAll, describe, expect, it } from "vitest";
import resetDb from "../helpers/resetDb";
import { createAuthenticatedCaller, createCaller } from "../helpers/utils";
import db, { schema } from "../../db/client";
import { eq } from "drizzle-orm";
import { billingCycle } from "../../constants";

const admin = {
  email: "admin@mail.com",
  password: "P@ssw0rd",
  name: "test",
  timezone: "Asia/Riyadh",
  locale: "en",
};
const user = {
  email: "mail@mail.com",
  password: "P@ssw0rd",
  name: "test",
  timezone: "Asia/Riyadh",
  locale: "en",
};

describe("billing routes", async () => {
  beforeAll(async () => {
    await resetDb();

    await createCaller({}).auth.register(admin);
    await createCaller({}).auth.register(user);
    await db
      .update(schema.users)
      .set({ emailVerified: true, isAdmin: true })
      .where(eq(schema.users.email, admin.email));
    await db
      .update(schema.users)
      .set({ emailVerified: true })
      .where(eq(schema.users.email, user.email));
  });

  describe("billing", async () => {
    it("should add order status to table by ADMIN only", async () => {
      const adminUserInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, admin.email),
      });
      const pending = "PENDING";
      const completed = "COMPLETED";
      const pendingStatus = await createAuthenticatedCaller({
        userId: adminUserInDb!.id,
      }).billing.addOrderStatus({
        name: pending,
      });
      const completedStatus = await createAuthenticatedCaller({
        userId: adminUserInDb!.id,
      }).billing.addOrderStatus({
        name: completed,
      });
      expect(pendingStatus.success).toBe(true);
      expect(completedStatus.success).toBe(true);
    });
    it("should add plan to table by ADMIN only", async () => {
      const adminUserInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, admin.email),
      });
      const starter = "STARTER";
      const premium = "PREMIUM";
      const starterStatus = await createAuthenticatedCaller({
        userId: adminUserInDb!.id,
      }).billing.addPlan({
        name: starter,
        price: 30,
      });
      const premiumStatus = await createAuthenticatedCaller({
        userId: adminUserInDb!.id,
      }).billing.addPlan({
        name: premium,
        price: 60,
      });
      expect(starterStatus.success).toBe(true);
      expect(premiumStatus.success).toBe(true);
    });
    it("should fetch plans publicly", async () => {
      const plans = await createCaller({}).billing.getPlans();
      expect(plans).toContainEqual({ id: 1, name: "STARTER", price: 30 });
    });
    it("should create a team by User", async () => {
      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });
      const teamCreation = await createAuthenticatedCaller({
        userId: userInDb!.id,
      }).teams.create({
        name: "Starter Teams",
      });
      expect(teamCreation.success).toBe(true);
    });
    it("should create Subscription Order by User", async () => {
      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });
      const orderCreation = await createAuthenticatedCaller({
        userId: userInDb!.id,
      }).billing.orderSubscription({
        teamId: 1,
        planId: 1,
      });
      expect(orderCreation.success).toBe(true);
    });
    // Should Confirm payment for Subscription Order
    it("Should Confirm payment for Subscription Order", async () => {
      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });
      const orderConfirmation = await createAuthenticatedCaller({
        userId: userInDb!.id,
      }).billing.confirmOrderPayment({
        subscriptionId: 1,
        billingCycle: billingCycle.MONTHLY,
      });
      expect(orderConfirmation.success).toBe(true);
    });
    // Should return prorated Upgrade Price on Upgrade
    it("Should return correct prorated upgrade Price on Upgrade", async () => {
      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });
      const proratedPrice = await createAuthenticatedCaller({
        userId: userInDb!.id,
      }).billing.upgradePlanRequest({
        subscriptionId: 1,
        planId: 2,
      });
      expect(proratedPrice).toBe(19);
    });
    it("Should create New Activation after Upgrade", async () => {
      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });
      const confirmedUpgrade = await createAuthenticatedCaller({
        userId: userInDb!.id,
      }).billing.confirmUpgradePayment({
        subscriptionId: 1,
        planId: 2,
        billingCycle: billingCycle.MONTHLY,
      });
      expect(confirmedUpgrade?.success).toBe(true);
    });
  });
});
