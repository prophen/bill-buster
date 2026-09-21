import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMail } from "@agentmail/convex";

const agentmail = new AgentMail(components.agentmail);

async function resolveInboxId(ctx: {
  runQuery: (q: any, a: any) => Promise<any>;
}): Promise<{ inboxId: string; email: string }> {
  const fromEnv = process.env.AGENTMAIL_INBOX_ID;
  if (fromEnv) {
    const cached = await ctx.runQuery(
      components.agentmail.lib.getCachedInbox,
      { inboxId: fromEnv },
    );
    return { inboxId: fromEnv, email: cached?.email ?? fromEnv };
  }
  const inboxes = await ctx.runQuery(
    components.agentmail.lib.listCachedInboxes,
    {},
  );
  if (!inboxes || inboxes.length === 0)
    throw new Error(
      "No AgentMail inbox found. Create one at console.agentmail.to, register the webhook, and set AGENTMAIL_INBOX_ID.",
    );
  return { inboxId: inboxes[0].inboxId, email: inboxes[0].email };
}

// User-approved send. The draft is always reviewed on screen before this runs.
export const sendDraft = mutation({
  args: {
    draftId: v.id("drafts"),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== userId)
      throw new Error("Draft not found.");
    if (!args.to.trim()) throw new Error("A recipient address is required.");
    // Sending is queued in the background, so a draft can read "sent" while
    // delivery actually failed. Allow retry in that case, block true doubles.
    if (draft.status === "sent") {
      const prior = draft.outboundId
        ? await ctx.runQuery(components.agentmail.lib.getOutboundStatus, {
            outboundId: draft.outboundId as never,
          })
        : null;
      if (prior && prior.status !== "failed")
        throw new Error("Already sent.");
    }

    const { inboxId } = await resolveInboxId(ctx);
    const outboundId = await agentmail.sendMessage(ctx, inboxId, {
      to: args.to.trim(),
      subject: args.subject,
      text: args.body,
      labels: ["bill-buster", "negotiation"],
    });

    await ctx.runMutation(internal.bills.markDraftSent, {
      draftId: args.draftId,
      outboundId: String(outboundId),
    });
    return { outboundId: String(outboundId) };
  },
});

export const discardDraft = mutation({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== userId)
      throw new Error("Draft not found.");
    await ctx.db.patch(args.draftId, { status: "discarded" });
    await ctx.db.patch(draft.billId, { status: "new", updatedAt: Date.now() });
  },
});

// Live delivery status for a sent draft (subscribable from the UI).
export const sendStatus = query({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== userId || !draft.outboundId) return null;
    return await ctx.runQuery(components.agentmail.lib.getOutboundStatus, {
      outboundId: draft.outboundId as never,
    });
  },
});

// Where users forward their bills. Shown on the settings screen.
export const inboxAddress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    try {
      const { email } = await resolveInboxId(ctx);
      return email;
    } catch {
      return null;
    }
  },
});