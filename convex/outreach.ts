import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal, components } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

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
// Delivery goes straight to the AgentMail REST API from an action (app code
// sees deployment env vars; the component's bundled code cannot).
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
    // A "sent" draft with confirmed delivery is final. A "sent" draft without
    // delivery confirmation (e.g. the old component queue failed silently)
    // can be re-sent. "sending" is also retryable: if a scheduled delivery
    // never fired, the user must be able to kick it again.
    if (draft.status === "sent" && draft.deliveryStatus === "sent")
      throw new Error("Already sent.");
    if (
      draft.status !== "pending" &&
      draft.status !== "sent" &&
      draft.status !== "sending"
    )
      throw new Error("Already sent.");
    if (!args.to.trim()) throw new Error("A recipient address is required.");

    await ctx.db.patch(args.draftId, {
      status: "sending",
      to: args.to.trim(),
      subject: args.subject,
      body: args.body,
      sendError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.outreach.deliverDraft, {
      draftId: args.draftId,
    });
    return { queued: true };
  },
});

export const getDraft = internalQuery({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => ctx.db.get(args.draftId),
});

export const markDraftSendFailed = internalMutation({
  args: { draftId: v.id("drafts"), error: v.string() },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found.");
    await ctx.db.patch(args.draftId, {
      status: "pending",
      sendError: args.error,
    });
    await ctx.db.patch(draft.billId, {
      status: "draft_ready",
      updatedAt: Date.now(),
    });
  },
});

// Actually delivers the queued draft via the AgentMail REST API.
export const deliverDraft = internalAction({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    console.log("[deliverDraft] start", args.draftId);
    const draft = await ctx.runQuery(internal.outreach.getDraft, {
      draftId: args.draftId,
    });
    console.log("[deliverDraft] draft status", draft?.status);
    if (!draft || draft.status !== "sending") return;
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!apiKey || !inboxId) {
      await ctx.runMutation(internal.outreach.markDraftSendFailed, {
        draftId: args.draftId,
        error: "Email sending is not configured on this deployment.",
      });
      return;
    }
    const baseUrl = (
      process.env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0"
    ).replace(/\/$/, "");
    console.log("[deliverDraft] sending to", baseUrl, "inbox", inboxId);
    try {
      const res = await fetch(
        `${baseUrl}/inboxes/${inboxId}/messages/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: draft.to,
            subject: draft.subject,
            text: draft.body,
            labels: ["bill-buster", "negotiation"],
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `AgentMail rejected the send (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as {
        message_id?: string;
        thread_id?: string;
      };
      console.log("[deliverDraft] sent, message", data.message_id);
      await ctx.runMutation(internal.bills.markDraftSent, {
        draftId: args.draftId,
        outboundId: String(data.message_id ?? ""),
        deliveryStatus: "sent",
      });
    } catch (e) {
      console.log("[deliverDraft] failed", e instanceof Error ? e.message : e);
      await ctx.runMutation(internal.outreach.markDraftSendFailed, {
        draftId: args.draftId,
        error: e instanceof Error ? e.message : "Send failed.",
      });
    }
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

// Delivery status for a draft (subscribable from the UI).
export const sendStatus = query({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== userId) return null;
    return {
      status: draft.status,
      deliveryStatus: draft.deliveryStatus ?? null,
      sendError: draft.sendError ?? null,
      outboundId: draft.outboundId ?? null,
    };
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