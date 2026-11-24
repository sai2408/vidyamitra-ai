import { ArrowLeft, BookOpenCheck, Clock, FileText, Layers, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Spinner } from "../components/ui";
import { api } from "../lib/api";

export default function DocumentDetail() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/documents/${id}`).then(setDoc).catch((e) => setError(e.message)); }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!doc) return <Spinner />;
  const facts = [
    { icon: FileText, label: "Pages", value: doc.pages },
    { icon: Layers, label: "Indexed passages", value: doc.chunks },
    { icon: Clock, label: "Reading time", value: `${doc.reading_minutes} min` },
  ];

  return (
    <div className="space-y-6">
      <Link to="/app/documents" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />All documents</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{doc.title}</h1>
          <p className="page-sub">{doc.word_count.toLocaleString()} words · {doc.file_type.toUpperCase()}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/app/ask?doc=${doc.id}`} className="btn-secondary"><MessageSquareText className="h-4 w-4" />Ask about this</Link>
          <Link to={`/app/quizzes?doc=${doc.id}`} className="btn-primary"><BookOpenCheck className="h-4 w-4" />Generate quiz</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
            <div><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold">{value}</p></div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">AI summary</h2>
          <p className="mt-1 text-xs text-slate-500">The five sentences that best represent the whole document.</p>
          <ul className="mt-4 space-y-3">
            {doc.summary.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{i + 1}</span>{s}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900">Key terms</h2>
          <p className="mt-1 text-xs text-slate-500">Click a term to ask about it.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {doc.key_terms.map((t) => (
              <Link key={t} to={`/app/ask?doc=${doc.id}&q=${encodeURIComponent(`What is ${t}?`)}`}
                className="badge bg-brand-50 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-100">{t}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
