"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

interface AuthScreenProps {
  onSuccess?: () => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleModeSwitch(newMode: "signin" | "signup") {
    setMode(newMode);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify both fields.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.message || "Authentication failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      // Successful authentication
      if (data.store?.id) {
        // User already has a store -> route to live scanner
        router.push(`/scan/${data.store.id}`);
        router.refresh();
      } else if (onSuccess) {
        // New user or user with no store -> show Store Setup
        onSuccess();
      } else {
        // Refresh page so server component presents Store Setup
        window.location.reload();
      }
    } catch (err) {
      console.error("Auth request error:", err);
      setError("Could not reach the server. Please ensure the development server is running and check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8">
        <Logo size="md" />
      </div>

      <div className="mb-8">
        <h1 className="font-heading text-[36px] tracking-tight text-ink leading-tight">
          Your shop, understood.
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          Real-time AI store assistant for small retailers.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mb-6 flex border-b border-line">
        <button
          type="button"
          onClick={() => handleModeSwitch("signin")}
          className={`pb-3 text-[15px] font-medium transition-colors ${
            mode === "signin"
              ? "border-b-2 border-leaf text-ink font-semibold"
              : "text-ink-muted hover:text-ink"
          } mr-6`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch("signup")}
          className={`pb-3 text-[15px] font-medium transition-colors ${
            mode === "signup"
              ? "border-b-2 border-leaf text-ink font-semibold"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Create account
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="mb-6 rounded-[8px] border border-brick/30 bg-brick-tint p-4 text-[14px] text-ink"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="email-input"
            className="block text-[13px] font-medium text-ink mb-1.5"
          >
            Email address
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="shopkeeper@example.com"
            disabled={loading}
            className="w-full min-h-[44px] rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/50 focus:border-leaf focus:outline-none focus:ring-1 focus:ring-leaf disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="password-input"
            className="block text-[13px] font-medium text-ink mb-1.5"
          >
            Password
          </label>
          <input
            id="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="••••••••"
            disabled={loading}
            className="w-full min-h-[44px] rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/50 focus:border-leaf focus:outline-none focus:ring-1 focus:ring-leaf disabled:opacity-60"
          />
        </div>

        {mode === "signup" && (
          <div>
            <label
              htmlFor="confirm-password-input"
              className="block text-[13px] font-medium text-ink mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="confirm-password-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={loading}
              className="w-full min-h-[44px] rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/50 focus:border-leaf focus:outline-none focus:ring-1 focus:ring-leaf disabled:opacity-60"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-[8px] bg-leaf px-4 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? mode === "signin"
              ? "Signing in..."
              : "Creating account..."
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>
    </div>
  );
}
