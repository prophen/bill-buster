import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal as generatedInternal, components } from "./_generated/api";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Escape hatch for a type-level cycle: this module's inferred action types
// feed the generated `internal` API type, so referencing `internal` here
// directly makes tsc chase its own tail (TS7022). At runtime this is the
// exact same object; only the type is loosened.
const internal: any = generatedInternal;

const firecrawl = new FirecrawlClient(components.firecrawl);

const DRAFT_SYSTEM = `You write negotiation emails that get bills lowered.
Rules:
- Plain, polite, human tone. No em-dashes, no marketing speak, no flattery.
- Short: 4 to 8 sentences plus a clear ask.
- Reference the specific competitor prices provided as leverage.
- Ask for a specific outcome: match the competitor price, a loyalty discount, or a promo rate.
- End with a simple call to action (reply, or a number to call).
Reply with JSON only, no markdown fences: {"subject": "...", "body": "..."}.
Do not include a recipient address; the user enters the real destination when they review the draft.`;

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
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

type Finding = {
  competitorName: string;
  competitorPrice?: number;
  competitorUrl?: string;
  notes?: string;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function priceFromText(text: string): number | undefined {
  const m = text.match(/\$\s?(\d{1,4}(?:\.\d{2})?)/);
  return m ? Number(m[1]) : undefined;
}

// Shared by the user-triggered action and the weekly cron.
async function checkPrices(
  ctx: { runQuery: any; runMutation: any },
  billId: Id<"bills">,
): Promise<Finding[]> {
  const bill = await ctx.runQuery(internal.bills.getInternal, { billId });
  if (!bill) throw new Error("Bill not found.");

  const query = `${bill.vendor} ${bill.category} cheaper alternatives promo pricing 2026`;
  let results: any[] = [];
  try {
    const search = await firecrawl.search(ctx as never, query, {
      limit: 5,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    });
    results = (search.web ?? []).slice(0, 5);
  } catch (e) {
    console.error("Firecrawl search failed:", e);
  }

  const findings: Finding[] = [];
  for (const r of results) {
    const url = r.url as string | undefined;
    const title = (r.title as string | undefined) ?? (url ? hostOf(url) : "");
    if (!url || !title) continue;
    const text = String(r.markdown ?? r.description ?? "").slice(0, 4000);
    const price = priceFromText(text);
    // Scrape the top result for firmer pricing details.
    let notes = text.slice(0, 500);
    if (findings.length === 0) {
      try {
        const page = await firecrawl.scrape(ctx as never, url, {
          formats: ["markdown"],
          onlyMainContent: true,
        });
        const md = String(page.markdown ?? "").slice(0, 4000);
        const scrapedPrice = priceFromText(md);
        notes = md.slice(0, 500);
        findings.push({
          competitorName: title,
          competitorPrice: scrapedPrice ?? price,
          competitorUrl: url,
          notes,
        });
        continue;
      } catch (e) {
        console.error("Firecrawl scrape failed:", e);
      }
    }
    findings.push({
      competitorName: title,
      competitorPrice: price,
      competitorUrl: url,
      notes,
    });
  }

  for (const f of findings) {
    await ctx.runMutation(internal.bills.addPriceCheck, {
      billId,
      competitorName: f.competitorName,
      competitorPrice: f.competitorPrice,
      competitorUrl: f.competitorUrl,
      notes: f.notes,
    });
  }
  return findings;
}

// User-triggered: check competitor pricing, then draft the negotiation email.
export const negotiateBill = action({
  args: { billId: v.id("bills") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const bill = await ctx.runQuery(internal.bills.getInternal, {
      billId: args.billId,
    });
    if (!bill) throw new Error("Bill not found.");
    if (bill.userId !== userId) throw new Error("Not your bill.");

    await ctx.runMutation(internal.bills.setStatusInternal, {
      billId: args.billId,
      status: "checking",
    });

    const findings = await checkPrices(ctx, args.billId);

    const findingsText =
      findings.length === 0
        ? "No competitor pricing found online."
        : findings
            .map(
              (f, i) =>
                `${i + 1}. ${f.competitorName}${f.competitorPrice ? `, about $${f.competitorPrice}/mo` : ""}${f.competitorUrl ? ` (${f.competitorUrl})` : ""}\n   Details: ${(f.notes ?? "").slice(0, 300)}`,
            )
            .join("\n");

    const draft = await openAIJson(
      DRAFT_SYSTEM,
      `Write a negotiation email for this bill:
Vendor: ${bill.vendor}
Category: ${bill.category}
Current price: $${bill.amount}/${bill.billingPeriod}
Account info: ${bill.accountHint ?? "not provided"}

Competitor and promo pricing found online:
${findingsText}

The sender is a long-time customer asking politely but firmly for a better rate.`,
    );

    const draftId = await ctx.runMutation(internal.bills.saveDraft, {
      billId: args.billId,
      userId,
      subject: String(draft.subject ?? `Request to lower my ${bill.vendor} bill`),
      body: String(draft.body ?? ""),
    });
    return { draftId, findings: findings.length };
  },
});

const SCRIPT_SYSTEM = `You write phone and chat scripts that help people negotiate bills down.
Rules:
- Plain, natural spoken language. No em-dashes, no marketing speak.
- Short sections with markdown headers: Before you call, Opener, The ask, If they push back, Close.
- Reference the specific competitor prices provided as leverage.
- Include 2 or 3 realistic pushbacks ("we can't change your rate", "that's a new-customer price") with a calm one-line response to each.
- Keep the whole script under 250 words.
Reply with JSON only, no markdown fences: {"script": "..."}. The script value itself may use markdown headers and bullets.`;

// User-triggered: generate a phone/chat negotiation script from the same
// bill and research the email draft used.
export const generateCallScript = action({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const draft = await ctx.runQuery(internal.outreach.getDraft, {
      draftId: args.draftId,
    });
    if (!draft || draft.userId !== userId)
      throw new Error("Draft not found.");
    const bill = await ctx.runQuery(internal.bills.getInternal, {
      billId: draft.billId,
    });
    if (!bill) throw new Error("Bill not found.");
    const checks = await ctx.runQuery(internal.bills.listChecksInternal, {
      billId: draft.billId,
    });
    const findingsText =
      checks.length === 0
        ? "No competitor pricing found online."
        : checks
            .map(
              (c: any, i: number) =>
                `${i + 1}. ${c.competitorName}${c.competitorPrice ? `, about $${c.competitorPrice}/mo` : ""}`,
            )
            .join("\n");
    const result = await openAIJson(
      SCRIPT_SYSTEM,
      `Write a phone/chat negotiation script for this bill:
Vendor: ${bill.vendor}
Category: ${bill.category}
Current price: $${bill.amount}/${bill.billingPeriod}

Competitor and promo pricing found online:
${findingsText}

The caller is a long-time customer, polite but firm.`,
    );
    const script = String(result.script ?? "");
    if (!script) throw new Error("Could not generate a script.");
    await ctx.runMutation(internal.bills.saveCallScript, {
      draftId: args.draftId,
      script,
    });
    return { script };
  },
});

// Weekly cron: re-check prices on active bills without drafting new emails.
export const recheckActiveBills = internalAction({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.runQuery(internal.bills.listActiveInternal, {});
    for (const bill of bills) {
      try {
        await checkPrices(ctx, bill._id);
      } catch (e) {
        console.error(`Recheck failed for ${bill._id}:`, e);
      }
    }
    return { rechecked: bills.length };
  },
});
