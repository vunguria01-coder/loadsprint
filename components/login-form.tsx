"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { loginSchema, type LoginValues } from "@/lib/schemas";

export function LoginForm() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Two-step: "login" (email+password) then "code" (email verification code).
  const [step, setStep] = useState<"login" | "code">("login");
  const [pendingEmail, setPendingEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
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

  return (
    <div className="auth-card">
      <h1>Welcome back</h1>
      <p className="ah-sub">Sign in to your LoadSprint account.</p>

      {formError && (
        <div className="auth-error" role="alert">
          <AlertCircle /> {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="fgrid">
          <div className={`field full${errors.email ? " err" : ""}`}>
            <label>Email</label>
            <input type="email" placeholder="you@company.com" {...register("email")} />
            <span className="msg">{errors.email?.message}</span>
          </div>
          <div className={`field full${errors.password ? " err" : ""}`}>
            <label>Password</label>
            <div className="pw">
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
