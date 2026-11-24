import { Crown, FileText, IndianRupee, MessageSquareText, Target, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Alert, Spinner, StatCard } from "../components/ui";
import { api, fmtDate } from "../lib/api";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tab, setTab] = useState("users");
  const [error, setError] = useState("");

  const load = () => Promise.all([api("/admin/stats"), api("/admin/users"), api("/admin/payments")])
    .then(([s, u, p]) => { setStats(s); setUsers(u); setPayments(p); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggleUser = async (u) => {
    try { await api(`/admin/users/${u.id}`, { method: "PATCH", body: { is_active: !u.is_active } }); load(); }
    catch (e) { setError(e.message); }
  };

  if (error && !stats) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner />;
  const t = stats.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-sub">Platform usage, revenue and user management.</p>
      </div>
      <Alert>{error}</Alert>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Users" value={t.users} />
        <StatCard icon={Crown} label="Pro users" value={t.pro_users} tone="amber" />
        <StatCard icon={FileText} label="Documents" value={t.documents} tone="violet" />
        <StatCard icon={MessageSquareText} label="Questions" value={t.questions} />
        <StatCard icon={Target} label="Answer rate" value={`${t.answer_rate}%`} hint="found in notes" tone="green" />
        <StatCard icon={IndianRupee} label="Revenue" value={`₹${t.revenue_inr.toLocaleString("en-IN")}`} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Questions asked · last 7 days</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={stats.questions_per_day} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} />
                <Tooltip /><Line type="linear" dataKey="count" name="Questions" stroke="#2554E6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Plan split</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.plan_split} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  <Cell fill="#94A3B8" /><Cell fill="#F59E0B" />
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">New sign-ups · last 7 days</h2>
          <div className="mt-4 h-52">
            <ResponsiveContainer>
              <BarChart data={stats.signups_per_day} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} />
                <Tooltip /><Bar dataKey="count" name="Sign-ups" fill="#2554E6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex gap-1 border-b border-slate-200 px-3 pt-3">
          {[["users", `Users (${users.length})`], ["payments", `Payments (${payments.length})`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${tab === k ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {tab === "users" ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-5 py-2.5">Name</th><th className="px-5 py-2.5">Role</th><th className="px-5 py-2.5">Plan</th><th className="px-5 py-2.5">Email</th><th className="px-5 py-2.5">Docs</th><th className="px-5 py-2.5">Questions</th><th className="px-5 py-2.5">Joined</th><th className="px-5 py-2.5">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3"><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                    <td className="px-5 py-3 capitalize">{u.role}</td>
                    <td className="px-5 py-3"><span className={`badge ${u.plan === "pro" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{u.plan.toUpperCase()}</span></td>
                    <td className="px-5 py-3"><span className={`badge ${u.is_verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{u.is_verified ? "Verified" : "Unverified"}</span></td>
                    <td className="px-5 py-3">{u.documents}</td><td className="px-5 py-3">{u.questions}</td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      {u.role === "admin" ? <span className="text-xs text-slate-400">—</span> : (
                        <button onClick={() => toggleUser(u)} className={`badge cursor-pointer px-3 py-1 ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {u.is_active ? "Active · deactivate" : "Inactive · activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : payments.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">No payments yet.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-5 py-2.5">User</th><th className="px-5 py-2.5">Order</th><th className="px-5 py-2.5">Amount</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5">Mode</th><th className="px-5 py-2.5">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3"><p className="font-medium">{p.user}</p><p className="text-xs text-slate-500">{p.email}</p></td>
                    <td className="px-5 py-3 font-mono text-xs">{p.order_id}</td>
                    <td className="px-5 py-3">₹{p.amount.toFixed(2)}</td>
                    <td className="px-5 py-3"><span className={`badge ${p.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{p.status}</span></td>
                    <td className="px-5 py-3 capitalize">{p.mode}</td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
