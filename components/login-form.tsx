"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { loginSchema, type LoginValues } from "@/lib/schemas";

export function LoginForm() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
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
      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    }
  };

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
