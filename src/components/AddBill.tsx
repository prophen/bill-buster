import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const CATEGORIES = [
  "internet",
  "mobile",
  "insurance",
  "streaming",
  "gym",
  "software",
  "utilities",
  "other",
];

export default function AddBill({
  onDone,
}: {
  onDone: (billId: Id<"bills"> | null) => void;
}) {
  const create = useMutation(api.bills.create);
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("internet");
  const [amount, setAmount] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [accountHint, setAccountHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!vendor.trim() || !n || n <= 0) {
      setError("Enter a vendor name and a valid amount.");
      return;
    }
    setBusy(true);
    try {
      const billId = await create({
        vendor: vendor.trim(),
        category,
        amount: n,
        billingPeriod,
        accountHint: accountHint.trim() || undefined,
      });
      onDone(billId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the bill.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2";

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-6">
      <h1 className="text-xl font-bold">Add a bill</h1>
      <p className="text-sm text-slate-500 mt-1">
        Add it manually, or forward the bill email to your inbox instead.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Vendor</label>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Xfinity"
            className={input}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={input}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Billing period</label>
            <select
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className={input}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="104.99"
            className={input}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Account or plan (optional)
          </label>
          <input
            value={accountHint}
            onChange={(e) => setAccountHint(e.target.value)}
            placeholder="Blast Pro 800 Mbps"
            className={input}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Adding..." : "Add bill"}
        </button>
      </form>
    </div>
  );
}
