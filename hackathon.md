# Hackathon log

- **Project:** Bill Buster
- **Event:** Convex All Gas Hackathon
- **What it does:** Forward a bill email to the app inbox and it extracts the bill, checks competitor pricing, drafts a negotiation email for your approval, and tracks your savings.
- **Live app:** not deployed
- **Repo:** https://github.com/prophen/bill-buster
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @convex-dev/static-hosting, @firecrawl/firecrawl-convex, @agentmail/convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries
- **Auth:** Convex Auth
- **AI models:** gpt-4o-mini
- **Started:** 2026-09-20T22:52:32Z
- **Last updated:** 2026-09-20T22:52:32Z

## Log

### 2026-09-20 - 0070be6
Scaffolded the full app. Schema with bills, priceChecks, drafts, savings tables plus Convex Auth tables. AgentMail webhook receives forwarded bills and an internal action extracts vendor, amount, and billing period with OpenAI structured output. A negotiate action searches competitor pricing with Firecrawl, scrapes the top result, and drafts the negotiation email with OpenAI; sending happens only through a user-approved mutation via the AgentMail component. Weekly cron re-checks prices on active bills. React UI with sign-in, live dashboard, bill detail with editable draft approval, manual bill entry, and inbox settings. Convex features: schema, tables, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries (`convex/schema.ts`, `convex/bills.ts`, `convex/ingest.ts`, `convex/negotiate.ts`, `convex/outreach.ts`, `convex/crons.ts`, `convex/http.ts`, `src/`).

### 2026-09-20 - auth fix, component env fix, resend fix
- Fixed "Not your bill" on negotiate: bills stored the `getAuthUserId` id but `negotiateBill` compared against the raw identity subject. Now uses `getAuthUserId` for ownership checks (`convex/negotiate.ts`).
- Manual bill add, Firecrawl research, and OpenAI draft generation verified working end to end in the UI.
- Sending failed with `AGENTMAIL_API_KEY is not set` even though the var was set on the deployment. Root cause: Convex components only see env vars explicitly passed via `app.use(component, { env })`. The scaffold passed env to the Firecrawl component but registered AgentMail bare. Fixed by declaring `AGENTMAIL_API_KEY` / `AGENTMAIL_WEBHOOK_SECRET` in `defineApp({ env })` and forwarding them with `app.use(agentmail, { env: { ... } })` (`convex/convex.config.ts`).
- Sending is queued in a background workpool, so `sendDraft` marked drafts "sent" before delivery completed, with no retry path. Now a failed delivery can be retried; true duplicates are still blocked (`convex/outreach.ts`).
- AgentMail webhook created via API for `https://valiant-wildebeest-403.convex.site/agentmail/webhook` (console create button was unresponsive). Inbound forwarding not yet tested.

### 2026-09-20 - delivery status and retry in UI
- The bill detail never showed real delivery status and a "sent" draft had no retry path in the UI. Added: live delivery status on the sent panel (via the existing `sendStatus` query) and a Retry send button that appears when delivery failed (`src/components/BillDetail.tsx`).
