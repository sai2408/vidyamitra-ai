import { BookOpenCheck, FileSearch, Quote, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Layout";
import { useAuth } from "../lib/auth";

const features = [
  { icon: Upload, title: "Upload your notes", text: "PDF or TXT lecture notes are read, split into passages and indexed in seconds." },
  { icon: FileSearch, title: "Ask in plain English", text: "Retrieval-augmented answers drawn only from your own notes, never made up." },
  { icon: Quote, title: "Every answer is cited", text: "See the exact document and page each answer came from, with a confidence score." },
  { icon: BookOpenCheck, title: "Auto-generated quizzes", text: "Turn any document into a multiple-choice quiz and review every answer." },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex gap-2">
          {user ? <Link to="/app" className="btn-primary">Open dashboard</Link> : (
            <>
              <Link to="/login" className="btn-secondary">Log in</Link>
              <Link to="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-12 text-center">
        <span className="badge bg-brand-100 text-brand-700"><Sparkles className="mr-1 h-3.5 w-3.5" />Retrieval-Augmented Generation for students</span>
        <h1 className="mt-5 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
          Your notes, turned into a <span className="text-brand-600">personal AI tutor</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Upload lecture notes, ask questions and get instant answers with page citations, summaries and practice quizzes.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={user ? "/app" : "/register"} className="btn-primary px-6 py-3 text-base">Start for free</Link>
          <Link to="/login" className="btn-secondary px-6 py-3 text-base">Try the demo account</Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">Demo login: student@vidyamitra.ai / Student@123</p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
            <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />VidyaMitra AI · Final year project demo
      </footer>
    </div>
  );
}
