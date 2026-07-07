"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { registerSchema, type RegisterValues } from "@/lib/schemas";

export function RegisterForm() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "dispatcher", agree: false },
  });

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.error || "Could not create your account.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    }
  };

  return (
    <div className="auth-card wide">
      <h1>Create your account</h1>
      <p className="ah-sub">
        Join LoadSprint as a dispatcher. Driver accounts will arrive
        with our mobile app.
      </p>

      {formError && (
        <div className="auth-error" role="alert">
          <AlertCircle /> {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="fgrid">
          <div className={`field full${errors.name ? " err" : ""}`}>
            <label>Full name</label>
            <input placeholder="Jane Doe" {...register("name")} />
            <span className="msg">{errors.name?.message}</span>
          </div>
          <div className="field full">
            <label>Company (dispatch) — optional</label>
            <input placeholder="Company name" {...register("company")} />
          </div>
          <div className={`field full${errors.email ? " err" : ""}`}>
            <label>Work email</label>
            <input type="email" placeholder="you@company.com" {...register("email")} />
            <span className="msg">{errors.email?.message}</span>
          </div>
          <div className={`field${errors.password ? " err" : ""}`}>
            <label>Password</label>
            <div className="pw">
              <input
                type={showPw ? "text" : "password"}
                placeholder="At least 8 characters"
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
          <div className={`field${errors.confirmPassword ? " err" : ""}`}>
            <label>Confirm password</label>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Repeat password"
              {...register("confirmPassword")}
            />
            <span className="msg">{errors.confirmPassword?.message}</span>
          </div>
          <div className={`field full${errors.agree ? " err" : ""}`}>
            <label className="checkrow">
              <input type="checkbox" {...register("agree")} />
              <span>
                I agree to the <a href="#">Terms of Service</a> and{" "}
                <a href="#">Privacy Policy</a>.
              </span>
            </label>
            <span className="msg">{errors.agree?.message}</span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          style={{ marginTop: 22 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
          <ArrowRight size={17} />
        </button>
      </form>

      <p className="auth-alt">
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </div>
  );
}
