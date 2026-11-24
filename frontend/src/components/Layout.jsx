import { BookOpenCheck, Crown, FileText, LayoutDashboard, LogOut, Menu, MessageSquareText, Shield, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const links = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/documents", label: "My Documents", icon: FileText },
  { to: "/app/ask", label: "Ask AI", icon: MessageSquareText },
  { to: "/app/quizzes", label: "Quizzes", icon: BookOpenCheck },
  { to: "/app/plans", label: "Plans & Billing", icon: Crown },
];

export function Logo({ light }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><Sparkles className="h-5 w-5" /></span>
      <span className={`text-lg font-bold ${light ? "text-white" : "text-slate-900"}`}>VidyaMitra <span className="text-brand-600">AI</span></span>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const all = user?.role === "admin" ? [...links, { to: "/app/admin", label: "Admin Panel", icon: Shield }] : links;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {all.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
          <Icon className="h-[18px] w-[18px]" />{label}
        </NavLink>
      ))}
    </nav>
  );

  const userBox = (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">{user?.name?.[0]?.toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </div>
        {user?.role === "admin"
          ? <span className="badge bg-brand-100 text-brand-700">ADMIN</span>
          : <span className={`badge ${user?.plan === "pro" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{user?.plan === "pro" ? "PRO" : "FREE"}</span>}
      </div>
      <button onClick={() => { logout(); navigate("/login"); }} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
        <LogOut className="h-4 w-4" />Log out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-5 lg:flex lg:sticky lg:top-0 lg:h-screen">
        <Logo />{nav}{userBox}
      </aside>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col gap-6 bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Logo /><button onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            {nav}{userBox}
          </aside>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
