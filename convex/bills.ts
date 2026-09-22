import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";

// Bills the signed-in user owns, plus bills forwarded from their email
// address before they had an account (matched on senderEmail).
async function myBills(
  // QueryCtx["db"] and MutationCtx["db"] both satisfy this shape.
  db: any,
  userId: string,
  email: string | undefined,
): Promise<Doc<"bills">[]> {
  const byUser: Doc<"bills">[] = await db
    .query("bills")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  if (!email) return byUser;
  const seen = new Set(byUser.map((b) => b._id));
  const bySender: Doc<"bills">[] = await db
    .query("bills")
    .withIndex("by_sender", (q: any) => q.eq("senderEmail", email))
    .collect();
  return [...byUser, ...bySender.filter((b) => !seen.has(b._id))].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

function ownsBill(
  bill: Doc<"bills">,
  userId: string,
  email: string | undefined,
): boolean {
  return (
    bill.userId === userId || (email !== undefined && bill.senderEmail === email)
  );
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    return await myBills(ctx.db, userId, user?.email ?? undefined);
  },
});

export const get = query({
  args: { billId: v.id("bills") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const bill = await ctx.db.get(args.billId);
    if (!bill) return null;
    const user = await ctx.db.get(userId);
    if (!ownsBill(bill, userId, user?.email ?? undefined)) return null;
    const checks = await ctx.db
      .query("priceChecks")
      .withIndex("by_bill", (q) => q.eq("billId", args.billId))
      .collect();
    const drafts = await ctx.db
      .query("drafts")
      .withIndex("by_bill", (q) => q.eq("billId", args.billId))
      .collect();
    return { bill, checks, drafts };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { monthlySavings: 0, billCount: 0, sentCount: 0 };
    const user = await ctx.db.get(userId);
    const bills = await myBills(ctx.db, userId, user?.email ?? undefined);
    const savings = await ctx.db
      .query("savings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      monthlySavings: savings.reduce((sum, s) => sum + s.monthlySavings, 0),
      billCount: bills.length,
      sentCount: bills.filter((b) => b.status === "sent").length,
    };
  },
});

export const create = mutation({
  args: {
    vendor: v.string(),
    category: v.string(),
    amount: v.number(),
    billingPeriod: v.string(),
    accountHint: v.optional(v.string()),
    zipCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to add a bill.");
    const user = await ctx.db.get(userId);
    const now = Date.now();
    return await ctx.db.insert("bills", {
      userId,
      senderEmail: user?.email ?? "manual",
      vendor: args.vendor,
      category: args.category,
      amount: args.amount,
      currency: "USD",
      billingPeriod: args.billingPeriod,
      accountHint: args.accountHint,
      zipCode: args.zipCode,
      status: "new",
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { billId: v.id("bills") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const bill = await ctx.db.get(args.billId);
    if (!bill) throw new Error("Bill not found.");
    if (bill.userId !== userId) throw new Error("Not your bill.");
    const checks = await ctx.db
      .query("priceChecks")
      .withIndex("by_bill", (q) => q.eq("billId", args.billId))
      .collect();
    for (const c of checks) await ctx.db.delete(c._id);
    const drafts = await ctx.db
      .query("drafts")
      .withIndex("by_bill", (q) => q.eq("billId", args.billId))
      .collect();
    for (const d of drafts) await ctx.db.delete(d._id);
    const savings = await ctx.db
      .query("savings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of savings) {
      if (s.billId === args.billId) await ctx.db.delete(s._id);
    }
    await ctx.db.delete(args.billId);
  },
});

export const setZipCode = mutation({
  args: { billId: v.id("bills"), zipCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const bill = await ctx.db.get(args.billId);
    if (!bill) throw new Error("Bill not found.");
    const user = await ctx.db.get(userId);
    if (!ownsBill(bill, userId, user?.email ?? undefined))
      throw new Error("Not your bill.");
    await ctx.db.patch(args.billId, {
      zipCode: args.zipCode.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    billId: v.id("bills"),
    status: v.union(
      v.literal("saved"),
      v.literal("dismissed"),
      v.literal("new"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const bill = await ctx.db.get(args.billId);
    if (!bill) throw new Error("Bill not found.");
    const user = await ctx.db.get(userId);
    if (!ownsBill(bill, userId, user?.email ?? undefined))
      throw new Error("Not your bill.");
    await ctx.db.patch(args.billId, {
      status: args.status,
      userId: bill.userId ?? userId,
      updatedAt: Date.now(),
    });
  },
});

// Internal read for actions (no auth context; caller checks ownership).
export const getInternal = internalQuery({
  args: { billId: v.id("bills") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.billId);
  },
});

export const listActiveInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db.query("bills").collect();
    return bills.filter((b) =>
      ["new", "draft_ready", "sent"].includes(b.status),
    );
  },
});

export const setStatusInternal = internalMutation({
  args: {
    billId: v.id("bills"),
    status: v.union(
      v.literal("extracting"),
      v.literal("new"),
      v.literal("checking"),
      v.literal("draft_ready"),
      v.literal("sent"),
      v.literal("saved"),
      v.literal("dismissed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.billId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const listChecksInternal = internalQuery({
  args: { billId: v.id("bills") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("priceChecks")
      .withIndex("by_bill", (q) => q.eq("billId", args.billId))
      .collect();
  },
});

export const clearPriceChecks = internalMutation({
  args: { billId: v.id("bills") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("priceChecks")
      .withIndex("by_bill", (q) => q.eq("billId", args.billId))
      .collect();
    for (const c of existing) await ctx.db.delete(c._id);
  },
});

export const saveCallScript = internalMutation({
  args: { draftId: v.id("drafts"), script: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.draftId, { callScript: args.script });
  },
});

export const saveExtraction = internalMutation({
  args: {
    billId: v.id("bills"),
    vendor: v.string(),
    category: v.string(),
    amount: v.number(),
    currency: v.string(),
    billingPeriod: v.string(),
    accountHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.billId, {
      vendor: args.vendor,
      category: args.category,
      amount: args.amount,
      currency: args.currency,
      billingPeriod: args.billingPeriod,
      accountHint: args.accountHint,
      status: "new",
      updatedAt: Date.now(),
    });
  },
});

export const addPriceCheck = internalMutation({
  args: {
    billId: v.id("bills"),
    competitorName: v.string(),
    competitorPrice: v.optional(v.number()),
    competitorUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("priceChecks", {
      billId: args.billId,
      checkedAt: Date.now(),
      competitorName: args.competitorName,
      competitorPrice: args.competitorPrice,
      competitorUrl: args.competitorUrl,
      notes: args.notes,
    });
  },
});

export const saveDraft = internalMutation({
  args: {
    billId: v.id("bills"),
    userId: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Never store an AI-generated recipient: models invent addresses.
    // The user enters the real destination at the approval checkpoint.
    const id = await ctx.db.insert("drafts", {
      billId: args.billId,
      userId: args.userId,
      subject: args.subject,
      body: args.body,
      to: "",
      status: "pending",
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.billId, {
      status: "draft_ready",
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const markDraftSent = internalMutation({
  args: {
    draftId: v.id("drafts"),
    outboundId: v.string(),
    deliveryStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found.");
    await ctx.db.patch(args.draftId, {
      status: "sent",
      sentAt: Date.now(),
      outboundId: args.outboundId,
      deliveryStatus: args.deliveryStatus ?? "sent",
      sendError: undefined,
    });
    await ctx.db.patch(draft.billId, {
      status: "sent",
      updatedAt: Date.now(),
    });
  },
});

export const recordSavings = mutation({
  args: {
    billId: v.id("bills"),
    newMonthly: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const bill = await ctx.db.get(args.billId);
    if (!bill || bill.userId !== userId) throw new Error("Not your bill.");
    const toMonthly = (n: number) =>
      bill.billingPeriod === "yearly" ? n / 12 : n;
    const oldMonthly = toMonthly(bill.amount);
    const newM = toMonthly(args.newMonthly);
    const round = (n: number) => Math.round(n * 100) / 100;
    await ctx.db.insert("savings", {
      billId: args.billId,
      userId,
      oldMonthly: round(oldMonthly),
      newMonthly: round(newM),
      monthlySavings: round(oldMonthly - newM),
      recordedAt: Date.now(),
      note: args.note,
    });
    await ctx.db.patch(args.billId, { status: "saved", updatedAt: Date.now() });
  },
});
