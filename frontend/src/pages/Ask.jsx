import { Bot, FileText, Lightbulb, SearchX, Send, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, ConfidenceBadge, Highlight, Spinner } from "../components/ui";
import { api } from "../lib/api";

function AnswerCard({ m }) {
  if (!m.found) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-semibold"><SearchX className="h-4 w-4" />Not found in your notes</p>
        <p className="mt-1">{m.answer}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge label={m.confidence_label} value={m.confidence} />
        <span className="badge bg-slate-100 text-slate-600">{m.mode === "llm" ? "Generative answer (LLM)" : "Answer from your notes"}</span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-800"><Highlight text={m.answer} words={m.keywords} /></p>
      {m.sources?.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
          <ul className="mt-2 space-y-2">
            {m.sources.map((s, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-brand-600" />
                  <Link to={`/app/documents/${s.document_id}`} className="font-semibold text-slate-800 hover:text-brand-600">{s.document_title}</Link>
                  <span className="badge bg-brand-100 text-brand-700">Page {s.page}</span>
                  <span className="text-slate-500">{s.relevance}% match</span>
                </div>
                <p className="mt-1.5 text-slate-600">“{s.snippet}{s.snippet.length >= 320 ? "…" : ""}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Ask() {
  const [params] = useSearchParams();
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(params.get("doc") ? [Number(params.get("doc"))] : []);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState(params.get("q") || "");
  const [suggestions, setSuggestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef();

  useEffect(() => {
    api("/documents").then(setDocs).catch((e) => setError(e.message));
    api("/ask/suggestions").then(setSuggestions).catch(() => {});
    api("/ask/history").then((h) => setMessages(h.slice(0, 6).reverse().map((x) => ({ ...x, confidence_label: x.confidence >= 70 ? "High" : x.confidence >= 45 ? "Medium" : "Low", keywords: [] })))).catch(() => {});
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const ask = async (text) => {
    const q = (text ?? question).trim();
    if (q.length < 3 || busy) return;
    setError("");
    setBusy(true);
    setQuestion("");
    try {
      const res = await api("/ask", { method: "POST", body: { question: q, document_ids: selected } });
      setMessages((m) => [...m, res]);
    } catch (err) {
      setError(err.message);
      setQuestion(q);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:h-[calc(100vh-4rem)]">
      <div>
        <h1 className="page-title">Ask AI</h1>
        <p className="page-sub">Answers come only from your uploaded notes, with the page they came from.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">Search in:</span>
        <button onClick={() => setSelected([])} className={`badge px-3 py-1.5 ${selected.length === 0 ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>All documents</button>
        {docs.map((d) => (
          <button key={d.id} onClick={() => toggle(d.id)} className={`badge px-3 py-1.5 ${selected.includes(d.id) ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{d.title}</button>
        ))}
      </div>

      <div className="card mt-4 flex-1 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && !busy && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Bot className="h-7 w-7" /></span>
            <p className="mt-3 font-semibold">Ask anything about your notes</p>
            {docs.length === 0 && <p className="mt-1 text-sm text-slate-500"><Link to="/app/documents" className="text-brand-600">Upload a document</Link> to get started.</p>}
            {suggestions.length > 0 && (
              <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />{s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-6">
          {messages.map((m) => (
            <div key={m.id} className="space-y-3">
              <div className="flex justify-end gap-2">
                <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white">{m.question}</p>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200"><User className="h-4 w-4 text-slate-600" /></span>
              </div>
              <div className="flex gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600"><Bot className="h-4 w-4 text-white" /></span>
                <div className="max-w-[88%] flex-1"><AnswerCard m={m} /></div>
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner className="h-4 w-4" />Searching your notes…</div>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="mt-3"><Alert>{error}</Alert></div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-3 flex gap-2">
        <input className="input py-3" placeholder="e.g. What is the convoy effect?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} />
        <button className="btn-primary px-5" disabled={busy || question.trim().length < 3}><Send className="h-4 w-4" /><span className="hidden sm:inline">Ask</span></button>
      </form>
    </div>
  );
}
