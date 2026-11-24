import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";

export const Spinner = ({ className = "h-6 w-6" }) => <Loader2 className={`animate-spin text-brand-600 ${className}`} />;

export function Alert({ type = "error", children }) {
  if (!children) return null;
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    error: "border-red-200 bg-red-50 text-red-700",
  };
  const Icon = type === "success" ? CheckCircle2 : type === "info" ? Info : AlertCircle;
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${styles[type] || styles.error}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ConfidenceBadge({ label, value }) {
  const map = { High: "bg-emerald-100 text-emerald-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-slate-100 text-slate-600" };
  return <span className={`badge ${map[label] || map.Low}`}>{label} confidence · {value}%</span>;
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icon className="h-6 w-6" /></span>
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      <div className="mt-1 text-sm text-slate-500">{children}</div>
    </div>
  );
}

// Highlights the question's keywords inside an answer.
export function Highlight({ text, words = [] }) {
  if (!words.length) return text;
  const stems = words.map((w) => w.replace(/(ies|es|s)$/i, "")).filter((w) => w.length > 2);
  if (!stems.length) return text;
  const re = new RegExp(`\\b((?:${stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[a-z]*)`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    stems.some((s) => p.toLowerCase().startsWith(s.toLowerCase())) && i % 2 === 1
      ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-slate-900">{p}</mark>
      : <span key={i}>{p}</span>
  );
}
