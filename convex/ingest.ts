import { v } from "convex/values";
import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

type InboundMessage = {
  message_id?: string;
  messageId?: string;
  from?: string;
  sender?: string;
  subject?: string;
  text?: string;
  extractedText?: string;
  preview?: string;
};

function senderEmailOf(message: InboundMessage): string {
  const raw = message.from ?? message.sender ?? "";
  // "Name <addr@example.com>" -> addr@example.com
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

function messageTextOf(message: InboundMessage): string {
  return (
    message.text ?? message.extractedText ?? message.preview ?? ""
  ).slice(0, 12000);
}

// Called by the AgentMail component for every inbound message (wired up in
// convex/http.ts). Creates a placeholder bill, then schedules extraction.
export const onInboundMessage = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  handler: async (ctx, args) => {
    const message = args.message as InboundMessage;
    const messageId = String(
      message.message_id ?? message.messageId ?? args.eventId,
    );

    // Idempotency: never ingest the same message twice.
    const existing = await ctx.db
      .query("bills")
      .withIndex("by_message", (q) => q.eq("sourceMessageId", messageId))
      .first();
    if (existing) return { billId: existing._id, deduped: true };

    const from = senderEmailOf(message);

    // Attribute to a signed-up user when the sender address matches.
    let userId: string | undefined;
    if (from) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", from))
        .first();
      if (user) userId = user._id;
    }

    const now = Date.now();
    const billId = await ctx.db.insert("bills", {
      userId,
      senderEmail: from || "unknown",
      vendor: "Extracting...",
      category: "other",
      amount: 0,
      currency: "USD",
      billingPeriod: "monthly",
      status: "extracting",
      source: "email",
      sourceMessageId: messageId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.ingest.extractBill, {
      billId,
      emailText: `Subject: ${message.subject ?? ""}\n\n${messageTextOf(message)}`,
    });
    return { billId, deduped: false };
  },
});

const EXTRACTION_SYSTEM = `You extract bill details from a forwarded bill email.
Reply with JSON only, no markdown fences, with exactly these keys:
{
  "vendor": "company name, e.g. Xfinity",
  "category": "one of: internet, mobile, insurance, streaming, gym, software, utilities, other",
  "amount": 104.99,
  "currency": "USD",
  "billingPeriod": "one of: monthly, yearly, one-time",
  "accountHint": "account number or plan name if present, otherwise null"
}
If the email is not a bill at all, reply with exactly: {"notABill": true}.
Use null for any field you cannot determine (except amount, use 0).`;

async function openAIJson(system: string, user: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

// Runs in an action (network access), then writes via internal mutation.
export const extractBill = internalAction({
  args: { billId: v.id("bills"), emailText: v.string() },
  handler: async (ctx, args) => {
    let parsed: any;
    try {
      parsed = await openAIJson(EXTRACTION_SYSTEM, args.emailText);
    } catch (e) {
      console.error("Bill extraction failed:", e);
      return;
    }
    if (parsed.notABill) {
      await ctx.runMutation(internal.bills.setStatusInternal, {
        billId: args.billId,
        status: "dismissed",
      });
      return;
    }
    await ctx.runMutation(internal.bills.saveExtraction, {
      billId: args.billId,
      vendor: String(parsed.vendor ?? "Unknown vendor"),
      category: String(parsed.category ?? "other"),
      amount: Number(parsed.amount ?? 0),
      currency: String(parsed.currency ?? "USD"),
      billingPeriod: String(parsed.billingPeriod ?? "monthly"),
      accountHint:
        parsed.accountHint === null || parsed.accountHint === undefined
          ? undefined
          : String(parsed.accountHint),
    });
  },
});
