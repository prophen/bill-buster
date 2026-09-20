import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
  const negotiate = useAction(api.negotiate.negotiateBill);
  const sendDraft = useMutation(api.outreach.sendDraft);
  const discardDraft = useMutation(api.outreach.discardDraft);
  const recordSavings = useMutation(api.bills.recordSavings);
  const updateStatus = useMutation(api.bills.updateStatus);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { to: string; subject: string; body: string }>
  >({});
  const [newMonthly, setNewMonthly] = useState("");
  const [savingsNote, setSavingsNote] = useState("");

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
      setNotice("Sent. The vendor reply will land in your inbox.");
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
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to bills
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{bill.vendor}</h1>
            <p className="text-slate-500 capitalize mt-1">
              {bill.category} : {bill.billingPeriod}
              {bill.accountHint ? ` : ${bill.accountHint}` : ""}
            </p>
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
          <h2 className="font-semibold mb-3">What competitors charge</h2>
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
                {c.notes && <p className="text-slate-500 mt-1">{c.notes.slice(0, 280)}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingDraft && (
        <div className="bg-white rounded-2xl border-2 border-violet-200 p-6">
          <h2 className="font-semibold">Your negotiation email</h2>
          <p className="text-sm text-slate-500 mt-1">
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
        </div>
      )}

      {sentDraft && bill.status === "sent" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold">Negotiation sent</h2>
          <p className="text-sm text-slate-500 mt-1">
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
