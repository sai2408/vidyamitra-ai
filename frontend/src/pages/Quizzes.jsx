import { BookOpenCheck, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Empty, Spinner } from "../components/ui";
import { api, fmtDate } from "../lib/api";

function ScoreRing({ percent }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = percent >= 80 ? "#059669" : percent >= 50 ? "#D97706" : "#DC2626";
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" role="img" aria-label={`Score ${percent}%`}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="#E2E8F0" strokeWidth="12" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform="rotate(-90 65 65)" />
      <text x="65" y="72" textAnchor="middle" fontSize="26" fontWeight="700" fill="#0F172A">{percent}%</text>
    </svg>
  );
}

export default function Quizzes() {
  const [params] = useSearchParams();
  const [docs, setDocs] = useState([]);
  const [docId, setDocId] = useState(params.get("doc") || "");
  const [count, setCount] = useState(5);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = () => api("/quizzes/attempts").then(setHistory).catch(() => {});
  useEffect(() => {
    api("/documents").then((d) => { setDocs(d); if (!docId && d[0]) setDocId(String(d[0].id)); }).catch((e) => setError(e.message));
    loadHistory();
  }, []);

  const generate = async () => {
    setError(""); setBusy(true); setResult(null); setAnswers({});
    try { setQuiz(await api("/quizzes", { method: "POST", body: { document_id: Number(docId), num_questions: count } })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      setResult(await api(`/quizzes/${quiz.id}/submit`, { method: "POST", body: { answers } }));
      loadHistory();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const answered = Object.keys(answers).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Quizzes</h1>
        <p className="page-sub">Generate multiple-choice questions from any document and test yourself.</p>
      </div>

      {docs.length === 0 ? (
        <div className="card"><Empty icon={BookOpenCheck} title="No documents yet"><Link to="/app/documents" className="text-brand-600">Upload notes</Link> to generate a quiz.</Empty></div>
      ) : (
        <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="flex-1"><label className="label">Document</label>
            <select className="input" value={docId} onChange={(e) => setDocId(e.target.value)}>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div><label className="label">Questions</label>
            <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={generate} className="btn-primary" disabled={busy || !docId}>{busy && !quiz ? "Generating…" : "Generate quiz"}</button>
        </div>
      )}
      <Alert>{error}</Alert>

      {result && (
        <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row">
          <ScoreRing percent={result.percent} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xl font-bold">You scored {result.score} out of {result.total}</p>
            <p className="mt-1 text-sm text-slate-600">{result.percent >= 80 ? "Excellent work! You know this topic well." : result.percent >= 50 ? "Good effort. Review the explanations below to close the gaps." : "Keep going. Read the explanations below, then try again."}</p>
            <button onClick={generate} className="btn-secondary mt-4"><RotateCcw className="h-4 w-4" />New quiz</button>
          </div>
        </div>
      )}

      {quiz && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-600">{quiz.document_title} · {quiz.questions.length} questions</p>
          {(result ? result.review : quiz.questions).map((q, i) => (
            <div key={q.id} className={`card p-5 ${result ? (q.correct ? "border-emerald-300" : "border-red-300") : ""}`}>
              <div className="flex items-start gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
                <p className="font-medium text-slate-900">{q.question}</p>
                {result && (q.correct ? <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="ml-auto h-5 w-5 shrink-0 text-red-600" />)}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o) => {
                  const chosen = (result ? q.chosen : answers[q.id]) === o;
                  let cls = chosen ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50";
                  if (result) cls = o === q.answer ? "border-emerald-500 bg-emerald-50" : chosen ? "border-red-400 bg-red-50" : "border-slate-200 opacity-70";
                  return (
                    <button key={o} disabled={!!result} onClick={() => setAnswers({ ...answers, [q.id]: o })}
                      className={`rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${cls}`}>{o}</button>
                  );
                })}
              </div>
              {result && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><b>Answer: {q.answer}.</b> {q.explanation}</p>}
            </div>
          ))}
          {!result && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{answered} of {quiz.questions.length} answered</p>
              <button onClick={submit} className="btn-primary" disabled={busy || answered < quiz.questions.length}>Submit answers</button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Attempt history</h2></div>
        {history.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">No attempts yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-2.5">Document</th><th className="px-5 py-2.5">Score</th><th className="px-5 py-2.5">Date</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id}><td className="px-5 py-3">{h.document_title}</td>
                    <td className="px-5 py-3"><span className={`badge ${h.percent >= 60 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{h.score}/{h.total} · {h.percent}%</span></td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(h.created_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {busy && quiz && !result && <Spinner />}
    </div>
  );
}
