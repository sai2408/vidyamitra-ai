import { FileText, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Empty, Spinner } from "../components/ui";
import { api, fmtDate } from "../lib/api";

export default function Documents() {
  const [docs, setDocs] = useState(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const navigate = useNavigate();

  const load = () => api("/documents").then(setDocs).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => { load(); }, []);

  const pick = (f) => { if (f) { setFile(f); setMsg({ type: "", text: "" }); } };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg({ type: "", text: "" });
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    try {
      const doc = await api("/documents", { method: "POST", form });
      setFile(null); setTitle("");
      navigate(`/app/documents/${doc.id}`);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.title}"? Its questions' sources will no longer be available.`)) return;
    try { await api(`/documents/${d.id}`, { method: "DELETE" }); load(); }
    catch (err) { setMsg({ type: "error", text: err.message }); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">My Documents</h1>
        <p className="page-sub">Upload lecture notes as PDF or TXT. Each file is summarised and indexed for questions and quizzes.</p>
      </div>

      <form onSubmit={upload} className="card p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"}`}>
          <UploadCloud className="h-10 w-10 text-brand-500" />
          <p className="mt-3 font-semibold text-slate-800">{file ? file.name : "Drop a PDF or TXT file here, or click to browse"}</p>
          <p className="mt-1 text-xs text-slate-500">{file ? `${(file.size / 1024).toFixed(0)} KB` : "Text-based files up to 10 MB"}</p>
          <input ref={inputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => pick(e.target.files[0])} />
        </div>
        {file && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input className="input" placeholder="Title (optional, defaults to the file name)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn-primary shrink-0" disabled={busy}>{busy ? <><Spinner className="h-4 w-4 text-white" />Analysing…</> : "Upload & analyse"}</button>
          </div>
        )}
        <div className="mt-4"><Alert type={msg.type}>{msg.text}</Alert></div>
      </form>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Library {docs && <span className="text-slate-400">({docs.length})</span>}</h2></div>
        {!docs ? <div className="p-6"><Spinner /></div> : docs.length === 0 ? (
          <Empty icon={FileText} title="No documents yet">Upload your first set of notes above.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-xs font-bold uppercase text-red-600">{d.file_type}</span>
                <Link to={`/app/documents/${d.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 hover:text-brand-600">{d.title}</p>
                  <p className="text-xs text-slate-500">{d.pages} pages · {d.word_count.toLocaleString()} words · added {fmtDate(d.created_at)}</p>
                  <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex">
                    {d.key_terms.slice(0, 5).map((t) => <span key={t} className="badge bg-slate-100 text-slate-600">{t}</span>)}
                  </div>
                </Link>
                <button onClick={() => remove(d)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
