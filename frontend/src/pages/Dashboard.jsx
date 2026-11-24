import { ArrowRight, BookOpenCheck, Crown, FileText, MessageSquareText, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Empty, Spinner, StatCard } from "../components/ui";
import { api, fmtDate } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api("/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  const { stats, plan } = data;
  const qPct = plan.daily_question_limit ? Math.min(100, (stats.questions_today / plan.daily_question_limit) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Hello, {user.name.split(" ")[0]} 👋</h1>
          <p className="page-sub">Here's your study progress at a glance.</p>
        </div>
        <Link to="/app/ask" className="btn-primary"><MessageSquareText className="h-4 w-4" />Ask a question</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Documents" value={stats.documents} hint={plan.doc_limit ? `${plan.doc_limit} allowed on Free` : "Unlimited on Pro"} />
        <StatCard icon={MessageSquareText} label="Questions asked" value={stats.questions_total} hint={`${stats.questions_today} today`} tone="violet" />
        <StatCard icon={BookOpenCheck} label="Quizzes taken" value={stats.quizzes_taken} tone="amber" />
        <StatCard icon={Target} label="Average quiz score" value={stats.average_score == null ? "–" : `${stats.average_score}%`} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent questions</h2>
            <Link to="/app/ask" className="text-sm font-medium text-brand-600">Open chat</Link>
          </div>
          {data.recent_questions.length === 0 ? (
            <Empty icon={MessageSquareText} title="No questions yet">Ask your first question about your notes.</Empty>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.recent_questions.map((q) => (
                <li key={q.id} className="py-3">
                  <p className="text-sm font-medium text-slate-800">{q.question}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{q.answer}</p>
                  <p className="mt-1 text-xs text-slate-400">{fmtDate(q.created_at)}{q.found ? ` · ${q.confidence}% confidence` : " · not found in notes"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" /><h2 className="font-semibold">{plan.name === "pro" ? "Pro plan" : "Free plan"}</h2></div>
            {plan.name === "pro" ? (
              <p className="mt-2 text-sm text-slate-600">Unlimited documents and questions. Active until {new Date(user.plan_expires_at + "Z").toLocaleDateString("en-IN")}.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">{stats.questions_today} of {plan.daily_question_limit} questions used today</p>
                <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${qPct}%` }} /></div>
                <Link to="/app/plans" className="btn-primary mt-4 w-full">Upgrade to Pro <ArrowRight className="h-4 w-4" /></Link>
              </>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Recent quiz scores</h2>
            {data.recent_attempts.length === 0 ? <p className="mt-2 text-sm text-slate-500">No quizzes taken yet.</p> : (
              <ul className="mt-3 space-y-3">
                {data.recent_attempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2 text-slate-700">{a.document_title}</span>
                    <span className={`badge ${a.percent >= 60 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{a.score}/{a.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
