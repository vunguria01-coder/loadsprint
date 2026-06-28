"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";

export function DispatcherGate() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"claim" | "login">("claim");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pre-fill the code from the invite link (?code=...).
  useEffect(() => {
    const c = params.get("code");
    if (c) setCode(c.toUpperCase());
  }, [params]);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res =
        mode === "claim"
          ? await fetch("/api/dispatcher/web-claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, name, password }),
            })
          : await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Something went wrong.");
      } else {
        router.push("/drivers");
        router.refresh();
      }
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Dispatcher access</h1>
      <p className="ah-sub">
        Register with the invite code from your account owner, or sign in.
      </p>

      <div className="role-tabs" role="tablist">
        <button
          type="button"
          className={`role-tab${mode === "claim" ? " active" : ""}`}
          onClick={() => setMode("claim")}
        >
          <span className="rt-name">Register with code</span>
        </button>
        <button
          type="button"
          className={`role-tab${mode === "login" ? " active" : ""}`}
          onClick={() => setMode("login")}
        >
          <span className="rt-name">Sign in</span>
        </button>
      </div>

      {err && (
        <div className="auth-error" role="alert">
          <AlertCircle /> {err}
        </div>
      )}

      <div className="fgrid">
        {mode === "claim" ? (
          <>
            <div className="field full">
              <label>Invite code</label>
              <input
                placeholder="K7P2-9QXM"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
              />
            </div>
            <div className="field full">
              <label>Your name</label>
              <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field full">
              <label>Create a password</label>
              <input
                type="password"
                placeholder="6+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="field full">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field full">
              <label>Password</label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 20 }}
        onClick={submit}
        disabled={busy}
      >
        {busy ? "Please wait…" : mode === "claim" ? "Create account" : "Sign in"}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
