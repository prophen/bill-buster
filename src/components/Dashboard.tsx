import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const STATUS_LABEL: Record<string, string> = {
  extracting: "Reading your email...",
  new: "New",
  checking: "Checking prices...",
  draft_ready: "Draft ready",
  sent: "Sent",
  saved: "Saved",
  dismissed: "Dismissed",
};

export const STATUS_STYLE: Record<string, string> = {
  extracting: "bg-amber-100 text-amber-800",
  new: "bg-blue-100 text-blue-800",
  checking: "bg-amber-100 text-amber-800",
  draft_ready: "bg-violet-100 text-violet-800",
  sent: "bg-emerald-100 text-emerald-800",
  saved: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-slate-100 text-slate-500",
};

export function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function Dashboard({
  onOpen,
}: {
  onOpen: (billId: Id<"bills">) => void;
}) {
  const bills = useQuery(api.bills.list);
  const stats = useQuery(api.bills.stats);

  if (bills === undefined || stats === undefined) {
    return <p className="text-slate-500">Loading your bills...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Monthly savings</p>
          <p className="text-3xl font-bold mt-1 text-emerald-700">
            {money(stats.monthlySavings)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Bills tracked</p>
          <p className="text-3xl font-bold mt-1">{stats.billCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Negotiations sent</p>
          <p className="text-3xl font-bold mt-1">{stats.sentCount}</p>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h2 className="text-lg font-semibold">No bills yet</h2>
          <p className="mt-2 text-slate-600 max-w-md mx-auto">
            Copy the content of a bill email and paste it in, or add one
            manually. We will check what competitors charge and draft the
            negotiation email for you.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {bills.map((bill) => (
            <li key={bill._id}>
              <button
                onClick={() => onOpen(bill._id)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-400 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{bill.vendor}</p>
                    <p className="text-sm text-slate-500 capitalize">
                      {bill.category} : {bill.billingPeriod}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className="text-xl font-bold">{money(bill.amount)}</p>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[bill.status] ?? "bg-slate-100"}`}
                    >
                      {STATUS_LABEL[bill.status] ?? bill.status}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
