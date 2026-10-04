"use client";

import { useState } from "react";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        className ||
        "min-h-[36px] rounded-[6px] border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-paper transition-colors disabled:opacity-50"
      }
      aria-label="Log out of Stockeye"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
