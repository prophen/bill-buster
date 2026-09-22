import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import Logo from "./Logo";

const STEPS = [
  {
    title: "Paste your bill",
    body: "Copy the content of a bill email and paste it in. The vendor, amount, and billing period are extracted automatically.",
  },
  {
    title: "See competitor prices",
    body: "Firecrawl researches what competitors and promos actually cost in your ZIP code, so your leverage is real.",
  },
  {
    title: "Review the draft",
    body: "A negotiation email and a phone script, written from the research. You read every word before anything happens.",
  },
  {
    title: "Approve to send",
    body: "Enter the vendor's real billing address and send. Record your savings when the new rate kicks in.",
  },
];

const ASSURANCES = [
  {
    title: "You approve everything",
    body: "No email sends without your review and an address you typed yourself. The approval checkpoint is the whole point.",
  },
  {
    title: "No invented addresses",
    body: "The app never guesses where to send. The recipient field starts empty, every time.",
  },
  {
    title: "Built for the call too",
    body: "A phone and chat script with pushback comebacks, plus a reminder to ask for the retention department.",
  },
];

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn("password", { email, password, flow: mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-slate-50 to-slate-50 text-slate-900">
      <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-xl font-bold tracking-tight">Bill Buster</span>
        </div>
        <a
          href="#get-started"
          className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Get started
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-10 items-center py-10 md:py-16">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Paste a bill, pay less.
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Bill Buster reads the content of a bill email, checks what
              competitors charge in your ZIP code, and drafts your
              negotiation email and phone script. Nothing sends until you
              approve it.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
              {["Convex", "OpenAI", "Firecrawl", "AgentMail"].map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full bg-white border border-slate-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div
            id="get-started"
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
          >
            <h2 className="text-xl font-bold">
              {mode === "signIn" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to track your bills and the money you save negotiating
              them down.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={input}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={input}
                  placeholder="Minimum 8 characters"
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
                {busy
                  ? "Working..."
                  : mode === "signIn"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>
            <button
              onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
              className="mt-4 w-full text-sm text-slate-500 hover:text-slate-900"
            >
              {mode === "signIn"
                ? "New here? Create an account."
                : "Already have an account? Sign in."}
            </button>
          </div>
        </div>

        <section className="py-8">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="bg-white rounded-2xl border border-slate-200 p-5"
              >
                <p className="text-sm font-bold text-emerald-700">
                  {i + 1}
                </p>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-8">
          <h2 className="text-2xl font-bold tracking-tight">
            Why you can trust it
          </h2>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {ASSURANCES.map((a) => (
              <div
                key={a.title}
                className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-5"
              >
                <h3 className="font-semibold text-emerald-900">{a.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{a.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="pt-10 mt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            Built by Nikema Prophet for the Convex All Gas hackathon.
          </p>
          <a
            href="https://github.com/prophen/bill-buster"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 hover:underline font-medium"
          >
            View the source on GitHub
          </a>
        </footer>
      </main>
    </div>
  );
}
