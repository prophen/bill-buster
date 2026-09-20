import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const billStatus = v.union(
  v.literal("extracting"),
  v.literal("new"),
  v.literal("checking"),
  v.literal("draft_ready"),
  v.literal("sent"),
  v.literal("saved"),
  v.literal("dismissed"),
);

export default defineSchema({
  ...authTables,

  bills: defineTable({
    // Auth user id when matched, otherwise null until claimed.
    userId: v.optional(v.string()),
    // Sender of the forwarded bill email, or the manual entry owner.
    senderEmail: v.string(),
    vendor: v.string(),
    category: v.string(),
    amount: v.number(),
    currency: v.string(),
    billingPeriod: v.string(),
    accountHint: v.optional(v.string()),
    status: billStatus,
    source: v.union(v.literal("email"), v.literal("manual")),
    sourceMessageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_sender", ["senderEmail"])
    .index("by_message", ["sourceMessageId"]),

  priceChecks: defineTable({
    billId: v.id("bills"),
    checkedAt: v.number(),
    competitorName: v.string(),
    competitorPrice: v.optional(v.number()),
    competitorUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_bill", ["billId"]),

  drafts: defineTable({
    billId: v.id("bills"),
    userId: v.string(),
    subject: v.string(),
    body: v.string(),
    to: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("sent"),
      v.literal("discarded"),
    ),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    outboundId: v.optional(v.string()),
  }).index("by_bill", ["billId"]),

  savings: defineTable({
    billId: v.id("bills"),
    userId: v.string(),
    oldMonthly: v.number(),
    newMonthly: v.number(),
    monthlySavings: v.number(),
    recordedAt: v.number(),
    note: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});
