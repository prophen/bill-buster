import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Settings() {
  const inbox = useQuery(api.outreach.inboxAddress);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!inbox) return;
    try {
      await navigator.clipboard.writeText(inbox);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-6">
      <h1 className="text-xl font-bold">Your Bill Buster inbox</h1>
      <p className="text-sm text-slate-500 mt-1">
        Forward any bill email here. We read it, check competitor pricing, and
        draft your negotiation email.
      </p>
      <div className="mt-5">
        {inbox === undefined ? (
          <p className="text-slate-500 text-sm">Loading inbox...</p>
        ) : inbox === null ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            No inbox connected yet. Create one at console.agentmail.to, point
            its webhook at /agentmail/webhook on your deployment, and set
            AGENTMAIL_INBOX_ID.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-slate-100 rounded-lg px-3 py-2.5 break-all">
              {inbox}
            </code>
            <button
              onClick={copy}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
      <div className="mt-6 text-sm text-slate-600 space-y-2">
        <p className="font-medium text-slate-900">How it works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Forward a bill to the address above.</li>
          <li>Bill Buster extracts the vendor, amount, and billing period.</li>
          <li>Firecrawl checks what competitors and promos actually cost.</li>
          <li>You review the draft, then approve it to send.</li>
          <li>Record your savings when the new rate kicks in.</li>
        </ol>
      </div>
    </div>
  );
}
