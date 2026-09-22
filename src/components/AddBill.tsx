import { useState } from "react";
import { useMutation, useAction } from "convex/react";
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
  const ingestPasted = useAction(api.ingest.ingestPastedBill);
  const [mode, setMode] = useState<"manual" | "paste">("paste");
  const [pastedText, setPastedText] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("internet");
  const [amount, setAmount] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [accountHint, setAccountHint] = useState("");
  const [zipCode, setZipCode] = useState("");
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
        zipCode: zipCode.trim() || undefined,
      });
      onDone(billId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the bill.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPaste(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pastedText.trim().length < 20) {
      setError("Paste the content of the bill email first.");
      return;
    }
    setBusy(true);
    try {
      const { billId } = await ingestPasted({ emailText: pastedText.trim() });
      onDone(billId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the bill.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2";

  const tab =
    "flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition";

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-6">
      <h1 className="text-xl font-bold">Add a bill</h1>
      <p className="text-sm text-slate-500 mt-1">
        Paste the content of a bill email and we will pull out the details, or
        add it manually.
      </p>
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`${tab} ${
            mode === "paste"
              ? "bg-emerald-600 text-white border-emerald-600"
              : "border-slate-300 hover:bg-slate-100"
          }`}
        >
          Paste bill email
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`${tab} ${
            mode === "manual"
              ? "bg-emerald-600 text-white border-emerald-600"
              : "border-slate-300 hover:bg-slate-100"
          }`}
        >
          Add manually
        </button>
      </div>
      {mode === "paste" ? (
        <form onSubmit={submitPaste} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Bill email content
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Copy the content of your bill email and paste it here..."
              rows={10}
              className={`${input} font-mono text-xs`}
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
            className="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Reading..." : "Extract bill details"}
          </button>
        </form>
      ) : (
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
        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-medium mb-1">
              ZIP code (optional)
            </label>
            <input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="95814"
              inputMode="numeric"
              className={input}
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Adding..." : "Add bill"}
        </button>
      </form>
      )}
    </div>
  );
}
