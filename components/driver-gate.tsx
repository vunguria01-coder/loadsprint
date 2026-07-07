"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";

export function DriverGate() {
  const router = useRouter();
  const [mode, setMode] = useState<"claim" | "login">("claim");
  const [code, setCode] = useState("");

  // Prefill the invite code when the driver opens a shared /driver?code=… link.
  useEffect(() => {
    try {
      const c = new URLSearchParams(window.location.search).get("code");
      if (c) {
        setCode(c.trim().toUpperCase());
        setMode("claim");
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res =
        mode === "claim"
          ? await fetch("/api/driver/web-claim", {
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
        router.push("/driver");
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
      <h1>Driver access</h1>
      <p className="ah-sub">
        Register with the invite code from your dispatcher, or sign in.
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
