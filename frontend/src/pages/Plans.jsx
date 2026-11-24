import { Check, Crown, CreditCard, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "../components/ui";
import { api, fmtDate } from "../lib/api";
import { useAuth } from "../lib/auth";

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => resolve(true);
  s.onerror = () => resolve(false);
  document.body.appendChild(s);
});

export default function Plans() {
  const { user, setUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [demoOrder, setDemoOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const loadHistory = () => api("/payments/history").then(setHistory).catch(() => {});
  useEffect(() => { api("/payments/config").then(setConfig); loadHistory(); }, []);

  const verify = async (payload) => {
    const res = await api("/payments/verify", { method: "POST", body: payload });
    setUser(res.user);
    setMsg({ type: "success", text: `Payment successful! Pro is active until ${new Date(res.user.plan_expires_at + "Z").toLocaleDateString("en-IN")}.` });
    loadHistory();
  };

  const upgrade = async () => {
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const order = await api("/payments/create-order", { method: "POST" });
      if (order.mode === "demo") { setDemoOrder(order); return; }
      if (!(await loadRazorpay())) throw new Error("Could not load Razorpay checkout. Check your internet connection.");
      const rzp = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: "VidyaMitra AI", description: "Pro plan · 30 days",
        prefill: { name: order.name, email: order.email }, theme: { color: "#2554E6" },
        handler: (r) => verify({ order_id: r.razorpay_order_id, payment_id: r.razorpay_payment_id, signature: r.razorpay_signature })
          .catch((e) => setMsg({ type: "error", text: e.message })),
      });
      rzp.on("payment.failed", (r) => setMsg({ type: "error", text: r.error?.description || "Payment failed." }));
      rzp.open();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmDemo = async () => {
    setBusy(true);
    try { await verify({ order_id: demoOrder.order_id }); setDemoOrder(null); }
    catch (err) { setMsg({ type: "error", text: err.message }); }
    finally { setBusy(false); }
  };

  const isPro = user.plan === "pro";
  const plans = [
    { name: "Free", price: "₹0", features: ["3 documents", "20 questions per day", "Summaries and key terms", "Unlimited quizzes"] },
    { name: "Pro", price: `₹${config?.price_inr ?? 199}`, period: "/ 30 days", features: ["Unlimited documents", "Unlimited questions", "Everything in Free", "Priority support"], highlight: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Plans & Billing</h1>
        <p className="page-sub">Upgrade to Pro for unlimited documents and questions.</p>
      </div>
      {config?.mode === "demo" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <b>Demo payment mode.</b> No Razorpay keys are configured, so payments are simulated and no money is charged. Add Razorpay test keys in <code>backend/.env</code> to use the real checkout.
        </div>
      )}
      <Alert type={msg.type}>{msg.text}</Alert>

      <div className="grid gap-5 md:grid-cols-2">
        {plans.map((p) => {
          const current = (p.name === "Pro") === isPro;
          return (
            <div key={p.name} className={`card relative p-6 ${p.highlight ? "border-brand-500 ring-2 ring-brand-100" : ""}`}>
              {p.highlight && <span className="badge absolute -top-3 left-6 bg-brand-600 text-white">Most popular</span>}
              <div className="flex items-center gap-2">{p.highlight && <Crown className="h-5 w-5 text-amber-500" />}<h2 className="text-lg font-bold">{p.name}</h2></div>
              <p className="mt-3"><span className="text-3xl font-bold">{p.price}</span> <span className="text-sm text-slate-500">{p.period}</span></p>
              <ul className="mt-5 space-y-2.5">
                {p.features.map((f) => <li key={f} className="flex items-center gap-2 text-sm text-slate-700"><Check className="h-4 w-4 text-emerald-600" />{f}</li>)}
              </ul>
              {current ? (
                <p className="mt-6 rounded-xl bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-600">
                  Current plan{isPro && p.highlight ? ` · until ${new Date(user.plan_expires_at + "Z").toLocaleDateString("en-IN")}` : ""}
                </p>
              ) : p.highlight ? (
                <button onClick={upgrade} className="btn-primary mt-6 w-full" disabled={busy}><CreditCard className="h-4 w-4" />{busy ? "Please wait…" : "Upgrade to Pro"}</button>
              ) : null}
            </div>
          );
        })}
      </div>

      {demoOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 px-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-600" /><h3 className="font-bold">Simulated checkout</h3></div>
            <p className="mt-3 text-sm text-slate-600">Order <code className="text-xs">{demoOrder.order_id}</code></p>
            <p className="mt-1 text-2xl font-bold">₹{(demoOrder.amount / 100).toFixed(2)}</p>
            <p className="mt-2 text-xs text-slate-500">Demo mode: no real payment is made. This shows the full order → payment → verification flow.</p>
            <div className="mt-5 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDemoOrder(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary flex-1" onClick={confirmDemo} disabled={busy}>{busy ? "Verifying…" : "Pay now"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Payment history</h2></div>
        {history.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">No payments yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-2.5">Order</th><th className="px-5 py-2.5">Amount</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5">Date</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-5 py-3 font-mono text-xs">{h.order_id}</td>
                    <td className="px-5 py-3">₹{h.amount.toFixed(2)}</td>
                    <td className="px-5 py-3"><span className={`badge ${h.status === "paid" ? "bg-emerald-100 text-emerald-700" : h.status === "failed" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{h.status}</span>{h.mode === "demo" && <span className="ml-1 text-xs text-slate-400">demo</span>}</td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
