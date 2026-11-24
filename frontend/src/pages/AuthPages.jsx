import { Info, MailCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Layout";
import { Alert } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

function Shell({ title, sub, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-brand-50 to-white px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex justify-center"><Logo /></Link>
        <div className="card p-7">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-slate-600">{footer}</p>}
      </div>
    </div>
  );
}

// ---------- OTP helpers ----------

function OtpInput({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const setAt = (i, ch) => {
    const next = digits.map((d, j) => (j === i ? ch : d)).join("").replace(/\s+$/, "");
    onChange(next.replace(/\s/g, ""));
  };
  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, "");
    if (!v) return setAt(i, " ");
    if (v.length > 1) { // pasted several digits
      onChange(v.slice(0, 6));
      refs.current[Math.min(5, v.length - 1)]?.focus();
      return;
    }
    setAt(i, v);
    if (i < 5) refs.current[i + 1]?.focus();
  };
  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus();
  };
  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (v) { e.preventDefault(); onChange(v); refs.current[Math.min(5, v.length - 1)]?.focus(); }
    }}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} value={d.trim()} disabled={disabled}
          onChange={(e) => handleChange(i, e)} onKeyDown={(e) => handleKey(i, e)}
          inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6} aria-label={`Digit ${i + 1}`}
          className="h-12 w-11 rounded-xl border border-slate-300 text-center text-xl font-bold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:h-14 sm:w-12" />
      ))}
    </div>
  );
}

function DeliveryNotice({ email, delivery }) {
  if (!delivery) return null;
  if (delivery.mode === "email") {
    return (
      <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>We've emailed a 6-digit code to <b>{email}</b>. It expires in {delivery.expires_minutes} minutes. Check your spam folder if you don't see it.</span>
      </div>
    );
  }
  if (delivery.mode === "demo") {
    return (
      <div className={`rounded-xl border px-3.5 py-3 text-sm ${delivery.email_failed ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
        <p className="flex items-center gap-2 font-semibold">
          {delivery.email_failed ? <TriangleAlert className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          {delivery.email_failed ? "Email could not be sent" : "Demo mode"}
        </p>
        <p className="mt-1">
          {delivery.email_failed ? "The email server couldn't be reached, so" : "Email sending isn't configured, so"} your code is shown here
          (it's also printed in the backend terminal):
        </p>
        <p className="mt-2 text-center font-mono text-2xl font-bold tracking-[0.4em]">{delivery.demo_code}</p>
      </div>
    );
  }
  return null;
}

function useCountdown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

// ---------- Pages ----------

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: location.state?.email || "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      navigate(u.role === "admin" ? "/app/admin" : "/app");
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") return navigate("/verify", { state: { email: err.email, resend: true } });
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const fill = (email, password) => setForm({ email, password });

  return (
    <Shell title="Welcome back" sub="Log in to continue to your study space."
      footer={<>New here? <Link to="/register" className="font-semibold text-brand-600">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Alert type="success">{location.state?.notice}</Alert>
        <Alert>{error}</Alert>
        <div><label className="label">Email</label><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Password</label>
            <Link to="/forgot-password" state={{ email: form.email }} className="mb-1.5 text-xs font-semibold text-brand-600 hover:underline">Forgot password?</Link>
          </div>
          <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Demo accounts</p>
        <button type="button" onClick={() => fill("student@vidyamitra.ai", "Student@123")} className="mt-1 block text-brand-600 hover:underline">Student · student@vidyamitra.ai / Student@123</button>
        <button type="button" onClick={() => fill("admin@vidyamitra.ai", "Admin@123")} className="mt-1 block text-brand-600 hover:underline">Admin · admin@vidyamitra.ai / Admin@123</button>
      </div>
    </Shell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const res = await register(form.name, form.email, form.password);
      navigate("/verify", { state: { email: res.email, delivery: res.delivery } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Shell title="Create your account" sub="Free plan: 3 documents and 20 questions a day."
      footer={<>Already registered? <Link to="/login" className="font-semibold text-brand-600">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <div><label className="label">Full name</label><input className="input" required minLength={2} value={form.name} onChange={set("name")} /></div>
        <div><label className="label">Email</label><input className="input" type="email" required value={form.email} onChange={set("email")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Password</label><input className="input" type="password" required value={form.password} onChange={set("password")} /></div>
          <div><label className="label">Confirm password</label><input className="input" type="password" required value={form.confirm} onChange={set("confirm")} /></div>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending code…" : "Create account"}</button>
        <p className="text-center text-xs text-slate-500">We'll send a 6-digit code to verify your email.</p>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const { user, verifyEmail } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email;
  const [delivery, setDelivery] = useState(state?.delivery?.mode === "cooldown" ? null : state?.delivery || null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState(state?.delivery?.mode === "cooldown"
    ? { type: "info", text: "A code was sent to you less than a minute ago. Enter it below, or request a new one when the timer ends." }
    : { type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown(state?.delivery?.resend_seconds || 0);
  const requested = useRef(false);

  const resend = async (auto = false) => {
    setMsg({ type: "", text: "" });
    try {
      const res = await api("/auth/resend-otp", { method: "POST", body: { email, purpose: "verify" } });
      if (res.delivery) { setDelivery(res.delivery); setLeft(res.delivery.resend_seconds); setCode(""); }
      if (!auto) setMsg({ type: "success", text: "A new code has been sent." });
    } catch (err) {
      if (err.code === "COOLDOWN") {
        setLeft(err.retry_after);
        setMsg({ type: "info", text: "A code was sent to you less than a minute ago. Enter it below, or request a new one when the timer ends." });
      } else {
        setMsg({ type: "error", text: err.message });
      }
    }
  };

  useEffect(() => {
    if (state?.resend && !requested.current) { requested.current = true; resend(true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (user) return <Navigate to="/app" replace />;
  if (!email) return <Navigate to="/register" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return setMsg({ type: "error", text: "Enter all 6 digits." });
    setBusy(true);
    try {
      await verifyEmail(email, code);
      navigate("/app/documents");
    } catch (err) {
      setMsg({ type: "error", text: err.message });
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Verify your email" sub={<>Enter the 6-digit code sent to <b className="text-slate-700">{email}</b>.</>}
      footer={<>Wrong email? <Link to="/register" className="font-semibold text-brand-600">Register again</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <DeliveryNotice email={email} delivery={delivery} />
        <Alert type={msg.type}>{msg.text}</Alert>
        <OtpInput value={code} onChange={setCode} disabled={busy} />
        <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify & continue"}</button>
        <p className="text-center text-sm text-slate-500">
          Didn't get it?{" "}
          {left > 0 ? <span>Resend in {left}s</span> : <button type="button" onClick={() => resend()} className="font-semibold text-brand-600 hover:underline">Resend code</button>}
        </p>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(state?.email || "");
  const [delivery, setDelivery] = useState(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown(0);

  const sendCode = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const res = await api("/auth/forgot-password", { method: "POST", body: { email } });
      setDelivery(res.delivery);
      setLeft(res.delivery.resend_seconds);
      setStep(2);
      setCode("");
      if (step === 2) setMsg({ type: "success", text: "A new code has been sent." });
    } catch (err) {
      if (err.code === "COOLDOWN") { setLeft(err.retry_after); setStep(2); }
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return setMsg({ type: "error", text: "Enter all 6 digits." });
    if (pw.password.length < 6) return setMsg({ type: "error", text: "Password must be at least 6 characters." });
    if (pw.password !== pw.confirm) return setMsg({ type: "error", text: "Passwords do not match." });
    setBusy(true);
    try {
      const res = await api("/auth/reset-password", { method: "POST", body: { email, code, new_password: pw.password } });
      navigate("/login", { state: { email, notice: res.message } });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Reset your password"
      sub={step === 1 ? "Enter your account email and we'll send you a reset code." : <>Enter the code sent to <b className="text-slate-700">{email}</b> and choose a new password.</>}
      footer={<>Remembered it? <Link to="/login" className="font-semibold text-brand-600">Back to log in</Link></>}>
      {step === 1 ? (
        <form onSubmit={sendCode} className="space-y-4">
          <Alert type={msg.type}>{msg.text}</Alert>
          <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send reset code"}</button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <DeliveryNotice email={email} delivery={delivery} />
          <Alert type={msg.type}>{msg.text}</Alert>
          <OtpInput value={code} onChange={setCode} disabled={busy} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">New password</label><input className="input" type="password" required value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></div>
            <div><label className="label">Confirm password</label><input className="input" type="password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
          <p className="text-center text-sm text-slate-500">
            {left > 0 ? <span>Resend code in {left}s</span> : <button type="button" onClick={sendCode} className="font-semibold text-brand-600 hover:underline">Resend code</button>}
            {" · "}<button type="button" onClick={() => { setStep(1); setMsg({ type: "", text: "" }); }} className="font-semibold text-brand-600 hover:underline">Change email</button>
          </p>
        </form>
      )}
    </Shell>
  );
}
