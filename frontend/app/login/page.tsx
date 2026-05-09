"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, Mail, Shield, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validate(): string | null {
    if (!email.trim()) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "That email address looks invalid.";
    if (!password) return "Please enter your password.";
    if (password.length < 6) return "Password should be at least 6 characters.";
    return null;
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setToken(data.access_token);
      toast.success("Welcome back. Redirecting to your dashboard.", "Signed in");
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <Sparkles size={20} />
          </span>
          <div>
            <strong style={{ fontSize: 16, display: "block" }}>DB Chat AI</strong>
            <span className="text-muted" style={{ fontSize: 12.5 }}>Multi-table database assistant</span>
          </div>
        </div>

        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Welcome back</h1>
        <p className="text-muted" style={{ marginBottom: 22, fontSize: 13.5 }}>
          Sign in to ask natural-language questions across your databases.
        </p>

        {error && (
          <div style={{ marginBottom: 14 }}>
            <Alert variant="error" title="Sign in failed" onClose={() => setError("")}>
              {error}
            </Alert>
          </div>
        )}

        <form className="stack" onSubmit={login} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="email">
              <Mail size={14} /> Email address
            </label>
            <div className="input-group">
              <span className="input-group-icon"><Mail size={16} /></span>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">
              <Shield size={14} /> Password
            </label>
            <div className="input-group">
              <span className="input-group-icon"><Shield size={16} /></span>
              <input
                id="password"
                className="input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="input-group-affix"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="field-hint">Use the seeded admin account locally, or register users through the API.</span>
          </div>

          <button className="button block lg" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="divider" />
        <p className="text-muted" style={{ fontSize: 12.5, textAlign: "center" }}>
          Read-only SQL · Schema-RAG enabled · Auditable history
        </p>
      </div>
      <style jsx>{`
        .spin {
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
