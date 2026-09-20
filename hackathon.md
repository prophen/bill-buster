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
