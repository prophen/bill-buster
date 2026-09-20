import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import SignIn from "./components/SignIn";
import Dashboard from "./components/Dashboard";
import BillDetail from "./components/BillDetail";
import AddBill from "./components/AddBill";
import Settings from "./components/Settings";
import type { Id } from "../convex/_generated/dataModel";

export type View =
  | { name: "dashboard" }
  | { name: "bill"; billId: Id<"bills"> }
  | { name: "add" }
  | { name: "settings" };

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [view, setView] = useState<View>({ name: "dashboard" });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading Bill Buster...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setView({ name: "dashboard" })}
            className="text-xl font-bold tracking-tight"
          >
            Bill Buster
          </button>
          <nav className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setView({ name: "add" })}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
            >
              Add a bill
            </button>
            <button
              onClick={() => setView({ name: "settings" })}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
            >
              Inbox
            </button>
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {view.name === "dashboard" && (
          <Dashboard onOpen={(billId) => setView({ name: "bill", billId })} />
        )}
        {view.name === "bill" && (
          <BillDetail
            billId={view.billId}
            onBack={() => setView({ name: "dashboard" })}
          />
        )}
        {view.name === "add" && (
          <AddBill
            onDone={(billId) =>
              setView(billId ? { name: "bill", billId } : { name: "dashboard" })
            }
          />
        )}
        {view.name === "settings" && <Settings />}
      </main>
    </div>
  );
}
