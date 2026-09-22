import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import ReactMarkdown from "react-markdown";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { STATUS_LABEL, STATUS_STYLE, money } from "./Dashboard";

export default function BillDetail({
  billId,
  onBack,
}: {
  billId: Id<"bills">;
  onBack: () => void;
}) {
  const data = useQuery(api.bills.get, { billId });
  const sentDraftId = data?.drafts.find((d) => d.status === "sent")?._id;
  const delivery = useQuery(
    api.outreach.sendStatus,
    sentDraftId ? { draftId: sentDraftId } : "skip",
  );
  const setZipCode = useMutation(api.bills.setZipCode);
  const negotiate = useAction(api.negotiate.negotiateBill);
  const recheckPrices = useAction(api.negotiate.recheckPrices);
  const generateScript = useAction(api.negotiate.generateCallScript);
  const sendDraft = useMutation(api.outreach.sendDraft);
  const discardDraft = useMutation(api.outreach.discardDraft);
  const recordSavings = useMutation(api.bills.recordSavings);
  const updateStatus = useMutation(api.bills.updateStatus);
  const removeBill = useMutation(api.bills.remove);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { to: string; subject: string; body: string }>
  >({});
  const [newMonthly, setNewMonthly] = useState("");
  const [savingsNote, setSavingsNote] = useState("");
  const [resendTo, setResendTo] = useState("");
  const [draftTab, setDraftTab] = useState<"email" | "script">("email");
  const [zipInput, setZipInput] = useState<string | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [recheckBusy, setRecheckBusy] = useState(false);

  // The "Sending..." banner is set before the background delivery finishes;
  // clear it once no draft is in the sending state. Must run before any
  // early return (rules of hooks).
  useEffect(() => {
    const sending = data?.drafts.some((d) => d.status === "sending");
    if (!sending) setNotice((n) => (n?.startsWith("Sending") ? null : n));
  }, [data]);

  if (data === undefined) return <p className="text-slate-500">Loading...</p>;
  if (data === null)
    return (
      <div>
        <p>Bill not found.</p>
        <button onClick={onBack} className="text-blue-600 underline mt-2">
          Back
        </button>
      </div>
    );

  const { bill, checks, drafts } = data;
  const pendingDraft = drafts.find((d) => d.status === "pending");
  const sendingDraft = drafts.find((d) => d.status === "sending");
  const sentDraft = drafts.find((d) => d.status === "sent");

  async function runNegotiate() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await negotiate({ billId });
      setNotice(
        `Checked ${res.findings} sources and drafted your email. Review it below.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Price check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function approveAndSend(draftId: Id<"drafts">) {
    const edits = draftEdits[draftId];
    if (!edits) return;
    setBusy(true);
    setNotice(null);
    try {
      await sendDraft({
        draftId,
        to: edits.to,
        subject: edits.subject,
        body: edits.body,
      });
      setNotice("Sending your email...");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateScript(draftId: Id<"drafts">) {
    setScriptBusy(true);
    setNotice(null);
    try {
      await generateScript({ draftId });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Script generation failed.");
    } finally {
      setScriptBusy(false);
    }
  }

  async function copyScript(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      setNotice("Copy failed. Select the text manually.");
    }
  }

  async function handleRecheck() {
    setRecheckBusy(true);
    setNotice(null);
    try {
      const res = await recheckPrices({ billId });
      setNotice(`Re-checked ${res.findings} sources with your ZIP code.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Re-check failed.");
    } finally {
      setRecheckBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete ${bill.vendor} and all its research, drafts, and savings? This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    try {
      await removeBill({ billId });
      onBack();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function retrySend() {
    if (!sentDraft) return;
    setBusy(true);
    setNotice(null);
    try {
      await sendDraft({
        draftId: sentDraft._id,
        to: sentDraft.to,
        subject: sentDraft.subject,
        body: sentDraft.body,
      });
      setNotice("Sending again...");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resendToAddress() {
    if (!sentDraft || !resendTo.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await sendDraft({
        draftId: sentDraft._id,
        to: resendTo.trim(),
        subject: sentDraft.subject,
        body: sentDraft.body,
        force: true,
      });
      setNotice(`Sending to ${resendTo.trim()}...`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  function editsFor(draftId: Id<"drafts">, fallback: { to: string; subject: string; body: string }) {
    return (
      draftEdits[draftId] ?? {
        ...fallback,
        to: fallback.to,
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to bills
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Delete bill
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{bill.vendor}</h1>
            <p className="text-slate-500 capitalize mt-1">
              {bill.category} : {bill.billingPeriod}
              {bill.accountHint ? ` : ${bill.accountHint}` : ""}
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-slate-500">ZIP:</span>
              {zipInput === null ? (
                <button
                  onClick={() => setZipInput(bill.zipCode ?? "")}
                  className="text-slate-700 underline decoration-dotted underline-offset-2"
                >
                  {bill.zipCode ?? "add"}
                </button>
              ) : (
                <>
                  <input
                    value={zipInput}
                    onChange={(e) => setZipInput(e.target.value)}
                    placeholder="95814"
                    inputMode="numeric"
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                  />
                  <button
                    onClick={async () => {
                      await setZipCode({ billId, zipCode: zipInput });
                      setZipInput(null);
                    }}
                    className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-xs font-medium hover:bg-slate-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setZipInput(null)}
                    className="text-xs text-slate-500"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{money(bill.amount)}</p>
            <span
              className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[bill.status] ?? "bg-slate-100"}`}
            >
              {STATUS_LABEL[bill.status] ?? bill.status}
            </span>
          </div>
        </div>

        {(bill.status === "new" || bill.status === "checking") && (
          <button
            onClick={runNegotiate}
            disabled={busy}
            className="mt-6 rounded-lg bg-slate-900 text-white px-4 py-2.5 font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Checking prices..." : "Check prices and draft my email"}
          </button>
        )}
        {notice && (
          <p className="mt-4 text-sm bg-slate-100 rounded-lg px-3 py-2">{notice}</p>
        )}
      </div>

      {checks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">What competitors charge</h2>
            <button
              onClick={handleRecheck}
              disabled={recheckBusy}
              className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
            >
              {recheckBusy ? "Checking..." : "Re-check prices"}
            </button>
          </div>
          <ul className="space-y-3">
            {checks.map((c) => (
              <li key={c._id} className="text-sm border-b border-slate-100 pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.competitorName}</span>
                  {c.competitorPrice !== undefined && (
                    <span className="font-bold text-emerald-700">
                      {money(c.competitorPrice)}/mo
                    </span>
                  )}
                </div>
                {c.competitorUrl && (
                  <a
                    href={c.competitorUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {c.competitorUrl}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingDraft && (
        <div className="bg-white rounded-2xl border-2 border-violet-200 p-6">
          <div className="flex gap-2 border-b border-slate-200">
            {(["email", "script"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDraftTab(t)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                  draftTab === t
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "email" ? "Email" : "Phone / chat script"}
              </button>
            ))}
          </div>
          {pendingDraft.sendError && (
            <p className="mt-2 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">
              Last send failed: {pendingDraft.sendError} Fix the issue and try again.
            </p>
          )}
          {draftTab === "script" ? (
            <div className="mt-4">
              {pendingDraft.callScript ? (
                <>
                  <div className="text-sm bg-slate-50 rounded-lg border border-slate-200 p-4 max-w-none [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_p]:mb-2 [&_strong]:font-semibold">
                    <ReactMarkdown>{pendingDraft.callScript}</ReactMarkdown>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => pendingDraft.callScript && copyScript(pendingDraft.callScript, "pending")}
                      className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100"
                    >
                      {copiedKey === "pending" ? "Copied!" : "Copy script"}
                    </button>
                    <button
                      onClick={() => handleGenerateScript(pendingDraft._id)}
                      disabled={scriptBusy}
                      className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {scriptBusy ? "Writing..." : "Regenerate"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    A short script for calling or chatting with {bill.vendor},
                    built from the same research as the email: an opener, the
                    ask, and comebacks for pushback.
                  </p>
                  <button
                    onClick={() => handleGenerateScript(pendingDraft._id)}
                    disabled={scriptBusy}
                    className="mt-3 rounded-lg bg-violet-600 text-white px-4 py-2.5 font-medium hover:bg-violet-500 disabled:opacity-50"
                  >
                    {scriptBusy ? "Writing..." : "Generate phone script"}
                  </button>
                </>
              )}
            </div>
          ) : (
          <>
          <p className="text-sm text-slate-500 mt-3">
            Review and edit. Nothing sends until you approve it.
          </p>
          {(() => {
            const ed = editsFor(pendingDraft._id, pendingDraft);
            const set = (patch: Partial<typeof ed>) =>
              setDraftEdits((prev) => ({ ...prev, [pendingDraft._id]: { ...ed, ...patch } }));
            return (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">To</label>
                  <input
                    value={ed.to}
                    onChange={(e) => set({ to: e.target.value })}
                    placeholder="billing@vendor.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <input
                    value={ed.subject}
                    onChange={(e) => set({ subject: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Body</label>
                  <textarea
                    value={ed.body}
                    onChange={(e) => set({ body: e.target.value })}
                    rows={10}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveAndSend(pendingDraft._id)}
                    disabled={busy}
                    className="rounded-lg bg-emerald-600 text-white px-4 py-2.5 font-medium hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy ? "Sending..." : "Approve and send"}
                  </button>
                  <button
                    onClick={() => discardDraft({ draftId: pendingDraft._id })}
                    disabled={busy}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Discard
                  </button>
                </div>
              </div>
            );
          })()}
          </>
          )}
        </div>
      )}

      {sendingDraft && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold">Sending your email...</h2>
          <p className="text-sm text-slate-500 mt-1">
            Talking to AgentMail now. This usually takes a few seconds.
          </p>
        </div>
      )}

      {sentDraft && bill.status === "sent" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold">Negotiation sent</h2>
          <p className="text-sm text-slate-500 mt-1">
            {delivery === undefined
              ? "Checking delivery status..."
              : delivery === null || !delivery.deliveryStatus
                ? "Delivery not confirmed yet."
                : "Sent via AgentMail."}
          </p>
          {!delivery?.deliveryStatus && (
            <button
              onClick={retrySend}
              disabled={busy}
              className="mt-3 rounded-lg bg-slate-900 text-white px-4 py-2.5 font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? "Retrying..." : "Retry send"}
            </button>
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium">Send to a different address</p>
            <p className="text-xs text-slate-500 mt-1">
              Currently addressed to {sentDraft.to}. Change it below to resend, for example to yourself for a test.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={resendTo}
                onChange={(e) => setResendTo(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
              />
              <button
                onClick={resendToAddress}
                disabled={busy || !resendTo.trim()}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                Resend
              </button>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium">Phone / chat script</p>
            {sentDraft.callScript ? (
              <>
                <div className="mt-2 text-sm bg-slate-50 rounded-lg border border-slate-200 p-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_p]:mb-2 [&_strong]:font-semibold">
                  <ReactMarkdown>{sentDraft.callScript}</ReactMarkdown>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => sentDraft.callScript && copyScript(sentDraft.callScript, "sent")}
                    className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100"
                  >
                    {copiedKey === "sent" ? "Copied!" : "Copy script"}
                  </button>
                  <button
                    onClick={() => handleGenerateScript(sentDraft._id)}
                    disabled={scriptBusy}
                    className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {scriptBusy ? "Writing..." : "Regenerate"}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => handleGenerateScript(sentDraft._id)}
                disabled={scriptBusy}
                className="mt-2 rounded-lg bg-violet-600 text-white px-4 py-2.5 font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                {scriptBusy ? "Writing..." : "Generate phone script"}
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-4">
            Got a lower rate? Record it so your savings total stays honest.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">New monthly price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newMonthly}
                onChange={(e) => setNewMonthly(e.target.value)}
                placeholder="79.99"
                className="rounded-lg border border-slate-300 px-3 py-2 w-40"
              />
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-sm font-medium mb-1">Note (optional)</label>
              <input
                value={savingsNote}
                onChange={(e) => setSavingsNote(e.target.value)}
                placeholder="Called retention, got promo rate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <button
              onClick={async () => {
                const n = Number(newMonthly);
                if (!n || n <= 0) {
                  setNotice("Enter the new monthly price first.");
                  return;
                }
                await recordSavings({ billId, newMonthly: n, note: savingsNote || undefined });
                setNotice("Savings recorded. Nice work.");
              }}
              className="rounded-lg bg-slate-900 text-white px-4 py-2.5 font-medium hover:bg-slate-700"
            >
              Record savings
            </button>
          </div>
          <button
            onClick={() => updateStatus({ billId, status: "dismissed" })}
            className="mt-4 text-sm text-slate-500 hover:text-slate-900"
          >
            No luck this time, dismiss this bill
          </button>
        </div>
      )}
    </div>
  );
}
