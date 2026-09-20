# Bill Buster

Forward a bill, pay less. Built for the Convex "All Gas" Hackathon.

Bill Buster gives you an inbox address. Forward any bill email (internet, mobile, insurance, subscriptions) and it extracts what you pay, checks competitor and vendor promo pricing with Firecrawl, drafts a negotiation email with OpenAI, and sends it through AgentMail once you approve. A live dashboard tracks your bills and total savings.

## Stack

- Frontend: Vite + React + TypeScript + Tailwind, served from Convex via the `@convex-dev/static-hosting` component (`*.convex.site`)
- Backend: Convex (queries, mutations, actions, crons, HTTP actions, file storage, realtime subscriptions)
- Auth: `@convex-dev/auth` with the Password provider
- Web data: `@firecrawl/firecrawl-convex` component (search + scrape competitor and promo pricing)
- Email: `@agentmail/convex` component (inbound bill emails via webhook, outbound negotiation emails)
- Drafting and extraction: OpenAI structured output

## Environment variables

Set these in the Convex dashboard (Settings > Environment Variables) for the deployment:

| Variable | Used for |
| --- | --- |
| `OPENAI_API_KEY` | Bill extraction and negotiation draft generation |
| `FIRECRAWL_API_KEY` | Competitor and vendor promo pricing lookups (20k free credits for hackathon participants registered on Luma) |
| `AGENTMAIL_API_KEY` | Sending and receiving mail through the app inbox |
| `AGENTMAIL_WEBHOOK_SECRET` | Verifying the inbound mail webhook signature |

The frontend needs `VITE_CONVEX_URL` at build time (the Convex deployment URL, e.g. `https://<name>.convex.cloud`). The static-hosting component injects this automatically on `*.convex.site` deploys; for local dev, put it in a `.env.local` file (not committed).

## Local development

```bash
npm install
npx convex dev   # sign in with your Convex account when prompted
npm run dev
```

`npx convex dev` runs codegen, syncs functions, and prints your dev deployment URL. Copy it into `.env.local` as `VITE_CONVEX_URL`.

## Deploy

```bash
npx convex deploy
npm run build
```

Then serve `dist/` through the static-hosting component to get your `*.convex.site` URL (see `convex/convex.config.ts`).

## Project layout

- `convex/schema.ts` : bills, priceChecks, drafts, savings (+ auth tables)
- `convex/auth.ts` : auth config (Password provider)
- `convex/bills.ts` : user-gated queries and mutations for bills
- `convex/ingest.ts` : internal handler for inbound AgentMail messages, extracts bill fields with OpenAI
- `convex/negotiate.ts` : action that Firecrawl-checks pricing and drafts the negotiation email
- `convex/outreach.ts` : user-approved send through AgentMail
- `convex/crons.ts` : weekly price re-check
- `convex/http.ts` : AgentMail inbound webhook
- `src/` : React UI (sign in, dashboard, bill detail, add bill, settings)
