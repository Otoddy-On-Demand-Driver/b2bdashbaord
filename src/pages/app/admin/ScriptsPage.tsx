import { useState } from "react";
import { AlertTriangle, RotateCcw, ShieldCheck } from "lucide-react";
import { apiErrorMessage } from "../../../lib/api";
import { opsResetAllDriverWalletBalances } from "../../../lib/opsApi";

const CONFIRMATION_TEXT = "RESET WALLETS";

export default function ScriptsPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resetWallets() {
    if (confirmation !== CONFIRMATION_TEXT) return;

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await opsResetAllDriverWalletBalances();
      setMessage(`${result.updated} driver wallet balance${result.updated === 1 ? "" : "s"} reset to ₹0.`);
      setConfirmOpen(false);
      setConfirmation("");
    } catch (err) {
      setError(apiErrorMessage(err, "Wallet reset failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-900 p-3 text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Scripts</h1>
            <p className="mt-1 text-sm text-slate-600">Admin-only maintenance actions.</p>
          </div>
        </div>

        {message ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <section className="mt-6 rounded-3xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Reset all driver wallets</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Set every driver wallet balance to ₹0. This affects all drivers and cannot be undone automatically.
              </p>
            </div>
          </div>

          <button
            onClick={() => { setError(""); setConfirmOpen(true); }}
            disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <RotateCcw size={17} />
            Reset all wallet balances
          </button>
        </section>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/40" onClick={() => !busy && setConfirmOpen(false)} aria-label="Close confirmation" />
          <div className="relative w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-extrabold text-slate-900">Confirm wallet reset</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Every driver wallet will be set to ₹0. Type <strong>{CONFIRMATION_TEXT}</strong> to continue.
            </p>
            <input
              autoFocus
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CONFIRMATION_TEXT}
              className="mt-4 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <div className="mt-5 flex gap-2">
              <button
                disabled={busy}
                onClick={() => { setConfirmOpen(false); setConfirmation(""); }}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={busy || confirmation !== CONFIRMATION_TEXT}
                onClick={resetWallets}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Resetting..." : "Confirm reset"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
