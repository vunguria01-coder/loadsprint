"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, KeyRound, Mail, Lock } from "lucide-react";
import { loginSchema, type LoginValues } from "@/lib/schemas";

export function LoginForm() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Steps: "login" → "code" (2FA), or "login" → "forgot" → "reset" (recovery).
  const [step, setStep] = useState<"login" | "code" | "forgot" | "reset">("login");
  const [pendingEmail, setPendingEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Forgot / reset password state.
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.error || "Could not sign you in.");
        return;
      }
      if (data.need2fa) {
        setPendingEmail(values.email);
        setStep("code");
        if (data.emailSkipped) {
          setInfo("Email isn't configured on the server, so the code can't be sent. Add RESEND_API_KEY to enable codes.");
        } else if (!data.emailed) {
          setInfo("We couldn't send the email just now. Check your inbox shortly, or try again.");
        } else {
          setInfo(`We sent a 6-digit code to ${values.email}. Enter it below.`);
        }
        return;
      }
      // Trusted device — straight in.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    }
  };

  async function verifyCode() {
    setFormError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.error || "Incorrect or expired code.");
        setVerifying(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
      setVerifying(false);
    }
  }

  // Move to the "forgot" step, pre-filling whatever's already in the email box.
  function openForgot() {
    setFormError(null);
    setInfo(null);
    setForgotEmail(getValues("email") || "");
    setStep("forgot");
  }

  // Step 1 of recovery: request a reset code by email.
  async function requestReset() {
    setFormError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.error || "Could not start the reset. Try again.");
        setBusy(false);
        return;
      }
      setPendingEmail(forgotEmail);
      setResetCode("");
      setNewPw("");
      setStep("reset");
      if (data.devCode) {
        // Local/demo only: email isn't set up, so we surface the code here.
        setResetCode(data.devCode);
        setInfo(`Email isn't configured, so here's your code for testing: ${data.devCode}. Enter a new password below.`);
      } else if (data.emailSkipped) {
        setInfo("Email isn't configured on the server, so the code can't be sent. Add RESEND_API_KEY to enable password resets.");
      } else {
        setInfo(`If an account exists for ${forgotEmail}, we sent a 6-digit reset code. Enter it below with your new password.`);
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Step 2 of recovery: submit the code + new password.
  async function submitReset() {
    setFormError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code: resetCode, password: newPw }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.error || "Could not reset your password.");
        setBusy(false);
        return;
      }
      setStep("login");
      setInfo(null);
      setFormError(null);
      setResetCode("");
      setNewPw("");
      // Surface success on the sign-in screen.
      setInfo("Your password has been updated. Sign in with your new password.");
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <div className="auth-card">
        <h1>Verify it's you</h1>
        <p className="ah-sub">Enter the 6-digit code we emailed you. We'll trust this device for 30 days.</p>

        {formError && (
          <div className="auth-error" role="alert">
            <AlertCircle /> {formError}
          </div>
        )}
        {info && (
          <div className="auth-note" role="status">
            <ShieldCheck size={16} /> {info}
          </div>
        )}

        <div className="field full">
          <label>Verification code</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ letterSpacing: "8px", fontSize: 22, textAlign: "center", fontWeight: 700 }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 18 }}
          disabled={verifying || code.length !== 6}
          onClick={verifyCode}
        >
          {verifying ? "Verifying…" : "Verify & sign in"} <ArrowRight size={17} />
        </button>

        <p className="auth-alt">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setStep("login");
              setCode("");
              setFormError(null);
              setInfo(null);
            }}
          >
            ← Back to sign in
          </a>
        </p>
      </div>
    );
  }

  if (step === "forgot") {
    return (
      <div className="auth-card">
        <h1>Reset your password</h1>
        <p className="ah-sub">Enter your account email and we'll send you a 6-digit code to set a new password.</p>

        {formError && (
          <div className="auth-error" role="alert">
            <AlertCircle /> {formError}
          </div>
        )}
        {info && (
          <div className="auth-note" role="status">
            <ShieldCheck size={16} /> {info}
          </div>
        )}

        <div className="field full">
          <label>Email</label>
          <input
            type="email"
            placeholder="you@company.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!busy && forgotEmail.trim()) requestReset();
              }
            }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 18 }}
          disabled={busy || !forgotEmail.trim()}
          onClick={requestReset}
        >
          {busy ? "Sending…" : "Send reset code"} <ArrowRight size={17} />
        </button>

        <p className="auth-alt">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setStep("login");
              setFormError(null);
              setInfo(null);
            }}
          >
            ← Back to sign in
          </a>
        </p>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <div className="auth-card">
        <h1>Set a new password</h1>
        <p className="ah-sub">Enter the code we sent to {pendingEmail} and choose a new password.</p>

        {formError && (
          <div className="auth-error" role="alert">
            <AlertCircle /> {formError}
          </div>
        )}
        {info && (
          <div className="auth-note" role="status">
            <ShieldCheck size={16} /> {info}
          </div>
        )}

        <div className="field full">
          <label>Reset code</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ letterSpacing: "8px", fontSize: 22, textAlign: "center", fontWeight: 700 }}
          />
        </div>

        <div className="field full">
          <label>New password</label>
          <div className="pw">
            <input
              type={showNewPw ? "text" : "password"}
              placeholder="At least 8 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button
              type="button"
              className="toggle"
              aria-label={showNewPw ? "Hide password" : "Show password"}
              onClick={() => setShowNewPw((s) => !s)}
            >
              {showNewPw ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 18 }}
          disabled={busy || resetCode.length !== 6 || newPw.length < 8}
          onClick={submitReset}
        >
          {busy ? "Updating…" : "Update password"} <KeyRound size={17} />
        </button>

        <p className="auth-alt">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setStep("forgot");
              setFormError(null);
              setInfo(null);
            }}
          >
            ← Use a different email
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Welcome back</h1>
      <p className="ah-sub">Sign in to your LoadSprint account.</p>

      {formError && (
        <div className="auth-error" role="alert">
          <AlertCircle /> {formError}
        </div>
      )}
      {info && (
        <div className="auth-note" role="status">
          <ShieldCheck size={16} /> {info}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="fgrid">
          <div className={`field full${errors.email ? " err" : ""}`}>
            <label>Email</label>
            <div className="input-ic">
              <Mail className="ic" size={18} />
              <input type="email" placeholder="you@company.com" {...register("email")} />
            </div>
            <span className="msg">{errors.email?.message}</span>
          </div>
          <div className={`field full${errors.password ? " err" : ""}`}>
            <div className="field-label-row">
              <label>Password</label>
              <button type="button" className="link-btn" onClick={openForgot}>
                Forgot password?
              </button>
            </div>
            <div className="pw input-ic">
              <Lock className="ic" size={18} />
              <input
                type={showPw ? "text" : "password"}
                placeholder="Your password"
                {...register("password")}
              />
              <button
                type="button"
                className="toggle"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <span className="msg">{errors.password?.message}</span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          style={{ marginTop: 22 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"} <ArrowRight size={17} />
        </button>
      </form>

      <p className="auth-alt">
        New to LoadSprint? <a href="/register">Create an account</a>
      </p>
    </div>
  );
}
