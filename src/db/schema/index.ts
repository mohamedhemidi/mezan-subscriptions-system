import { relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  uniqueIndex,
  integer,
} from "drizzle-orm/sqlite-core";
const boolean = (col: string) => integer(col, { mode: "boolean" });
const timestamp = (col: string) => integer(col, { mode: "timestamp" });

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey().notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    hashedPassword: text("hashedPassword"),
    emailVerified: boolean("emailVerified").default(false).notNull(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
    locale: text("locale").notNull(),
    timezone: text("timezone"),
    isAdmin: boolean("isAdmin").default(false).notNull(),
  },
  (table) => {
    return {
      emailIdx: uniqueIndex("emailIdx").on(table.email),
    };
  }
);

export const userRelations = relations(users, ({ many }) => ({
  teams: many(teams),
  emailVerifications: many(emailVerifications),
}));

export const emailVerifications = sqliteTable("emailVerifications", {
  id: integer("id").primaryKey().notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  email: text("email").notNull(),
  otpCode: text("otpCode").notNull(),
  attempts: integer("attempts").default(0).notNull(),
});

export const emailVerificationRelations = relations(
  emailVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerifications.userId],
      references: [users.id],
    }),
  })
);
export const emailChangeRequests = sqliteTable("emailChangeRequests", {
  id: integer("id").primaryKey().notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  newEmail: text("newEmail").notNull(),
  otpCode: text("otpCode").notNull(),
});

export const passwordResetRequests = sqliteTable("passwordResetRequests", {
  id: integer("id").primaryKey().notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  token: text("token").notNull(),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
  isPersonal: boolean("isPersonal").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
});

export const teamsRelations = relations(teams, ({ one }) => ({
  user: one(users, {
    fields: [teams.userId],
    references: [users.id],
  }),
}));

export const orderStatus = sqliteTable("orderStatus", {
  // todo: add orders table schema
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
});

export const orderStatusRelations = relations(orderStatus, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatus.id],
    references: [orders.id],
  }),
}));

export const plans = sqliteTable("plans", {
  // todo: add plans table schema
  // id
  // name
  // price
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  // todo: add subscriptions table schema
  // id
  // user_id
  // team_id
  // plan_id
  id: integer("id").primaryKey().notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
  teamId: integer("teamId")
    .notNull()
    .references(() => teams.id, { onDelete: "restrict", onUpdate: "restrict" }),
  planId: integer("planId")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict", onUpdate: "restrict" }),
});

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [subscriptions.userId],
      references: [users.id],
    }),
    team: one(teams, {
      fields: [subscriptions.teamId],
      references: [teams.id],
    }),
    plan: many(plans),
    order: many(orders),
    subscriptionActivations: many(subscriptionActivations),
  })
);

export const orders = sqliteTable("orders", {
  // todo: add orders table schema
  //// id
  //// subscription_id
  //// createdAt
  //// status
  id: integer("id").primaryKey().notNull(),
  subscriptionId: integer("subscriptionId")
    .notNull()
    .references(() => subscriptions.id, {
      onDelete: "restrict",
      onUpdate: "restrict",
    }),
  statusId: integer("statusId")
    .notNull()
    .references(() => orderStatus.id, {
      onDelete: "restrict",
      onUpdate: "restrict",
    }),
  createdAt: timestamp("createdAt").notNull(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [orders.subscriptionId],
    references: [subscriptions.id],
  }),
  status: many(orderStatus),
}));

export const subscriptionActivations = sqliteTable("subscriptionActivations", {
  // todo: add subscriptionActivations table schema
  // id
  // subscription_id
  id: integer("id").primaryKey().notNull(),
  subscriptionId: integer("subscriptionId")
    .notNull()
    .references(() => subscriptions.id, {
      onDelete: "restrict",
      onUpdate: "restrict",
    }),
  activatedAt: timestamp("activatedAt").notNull(),
  billingCycle: text("billingCycle").notNull(),
});

export const subscriptionActivationRelations = relations(
  subscriptionActivations,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [subscriptionActivations.subscriptionId],
      references: [subscriptions.id],
    }),
  })
);
