import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { AgentMail } from "@agentmail/convex";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";

const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.ingest.onInboundMessage,
});

const http = httpRouter();

// Convex Auth routes (sign-in, sign-up, session refresh).
auth.addHttpRoutes(http);

// Inbound bill email from AgentMail. Verify the secret in the Convex
// dashboard as AGENTMAIL_WEBHOOK_SECRET.
// Note: the ctx cast works around a type-level mismatch between the
// installed convex and @agentmail/convex versions; the call shape matches
// the component README exactly.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) =>
    agentmail.handleWebhook(ctx as never, req),
  ),
});

// Static-hosting catch-all goes last: exact routes above win.
registerStaticRoutes(http, components.staticHosting);

export default http;
