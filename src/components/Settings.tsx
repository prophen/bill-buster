export default function Settings() {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-6">
      <h1 className="text-xl font-bold">Adding bills</h1>
      <p className="text-sm text-slate-500 mt-1">
        Copy the content of a bill email and paste it on the Add bill page. We
        read it, check competitor pricing, and draft your negotiation email.
      </p>
      <div className="mt-6 text-sm text-slate-600 space-y-2">
        <p className="font-medium text-slate-900">How it works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open the bill email and copy its content.</li>
          <li>Paste it on the Add bill page.</li>
          <li>Bill Buster extracts the vendor, amount, and billing period.</li>
          <li>Firecrawl checks what competitors and promos actually cost.</li>
          <li>You review the draft, then approve it to send.</li>
          <li>Record your savings when the new rate kicks in.</li>
        </ol>
      </div>
    </div>
  );
}
