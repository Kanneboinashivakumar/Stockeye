import type { ReactNode } from "react";

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <p className="max-w-[40ch] text-[16px] text-ink-muted">{message}</p>
      {action}
    </div>
  );
}
